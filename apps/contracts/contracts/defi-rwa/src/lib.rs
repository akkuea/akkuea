#![no_std]
#![allow(clippy::too_many_arguments)]
#![allow(clippy::needless_borrows_for_generic_args)]
#![allow(deprecated)]

//! # Property Tokenization & Lending Smart Contract
//!
//! This contract enables tokenization of real-world properties and a lending market
//! for those property shares on the Stellar/Soroban blockchain.

mod access;
pub mod events;
mod lending;
mod oracle_types;
mod storage;

// Public re-exports for consumers and tests
pub use lending::{
    events::{
        BadDebtWrittenOffEvent, DepositEvent, PoolCreatedEvent, ReservesWithdrawnEvent,
        WithdrawEvent,
    },
    lending_bump, BorrowPosition, DepositPosition, InterestRateModel, InterestStorage, LendingKey,
    LendingPool, OraclePriceSnapshot, PoolStorage, PositionStorage, PRECISION, SECONDS_PER_YEAR,
};

pub use access::*;
pub use events::*;
pub use lending::*;
pub use storage::*;

use soroban_sdk::{
    contract, contractclient, contractimpl, panic_with_error, symbol_short, token, Address, Env,
    String, Vec,
};

#[contractclient(name = "InvestorRegistryClient")]
pub trait InvestorRegistry {
    fn is_approved(env: Env, address: Address) -> bool;
}

const INVESTOR_REGISTRY: soroban_sdk::Symbol = symbol_short!("invreg");

fn require_approved_investor(env: &Env, recipient: &Address) {
    if let Some(registry) = PropertyTokenContract::get_investor_registry(env.clone()) {
        if !matches!(
            InvestorRegistryClient::new(env, &registry).try_is_approved(recipient),
            Ok(Ok(true))
        ) {
            panic_with_error!(env, ContractError::InvestorNotApproved);
        }
    }
}

// Internal imports
use lending::events as lending_events;

#[cfg(test)]
mod test;

#[cfg(test)]
mod reentrancy_tests;

#[cfg(test)]
mod budget_check;

#[cfg(test)]
mod lending_accounting_tests;

// ───────────────────────────────────────────────
// Helper functions
// ───────────────────────────────────────────────

/// Convert u64 to Soroban String for Event mapping in no_std
fn u64_to_string(env: &Env, mut val: u64) -> String {
    if val == 0 {
        return String::from_str(env, "0");
    }
    let mut buffer = [0u8; 20];
    let mut i = 20;
    while val > 0 {
        i -= 1;
        buffer[i] = (val % 10) as u8 + b'0';
        val /= 10;
    }
    let slice = &buffer[i..20];
    String::from_str(env, core::str::from_utf8(slice).unwrap())
}

// ───────────────────────────────────────────────
// Internal Lending Helpers
// ───────────────────────────────────────────────

fn get_lending_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&LendingKey::Admin)
        .expect("admin not set")
}

fn set_lending_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&LendingKey::Admin, admin);
    env.storage()
        .instance()
        .extend_ttl(lending_bump::INSTANCE_BUMP, lending_bump::INSTANCE_BUMP);
}

fn require_admin(env: &Env, caller: &Address) {
    caller.require_auth();
    let admin = get_lending_admin(env);
    if *caller != admin {
        panic!("only admin");
    }
}

/// Accrue interest for a pool – updates the global interest index, reserves,
/// and last-accrual timestamp. Safe to call multiple times in the same ledger.
fn accrue_interest_internal(env: &Env, pool_id: &String) -> Result<(), ContractError> {
    let last_accrual = InterestStorage::get_last_accrual(env, pool_id);
    let now = env.ledger().timestamp();
    let time_elapsed = now.saturating_sub(last_accrual);
    let accrual_timestamp = now.max(last_accrual);
    let reserves = PoolStorage::get_reserves(env, pool_id);
    // Transactions can execute in a later ledger than simulation, so mark conditional writes now.
    PoolStorage::set_reserves(env, pool_id, reserves);
    let total_deposits = PoolStorage::get_total_deposits(env, pool_id);
    let total_borrows = PoolStorage::get_total_borrows(env, pool_id);

    if total_borrows == 0 {
        InterestStorage::set_last_accrual(env, pool_id, accrual_timestamp);
        return Ok(());
    }

    let total_assets = total_deposits
        .checked_add(reserves)
        .ok_or(ContractError::BalanceOverflow)?;
    let utilization = PoolStorage::calculate_utilization(total_assets, total_borrows)?;
    let model = InterestStorage::get_model(env, pool_id);
    let borrow_rate = model.calculate_borrow_rate(utilization)?;
    let current_index = InterestStorage::get_interest_index(env, pool_id);
    let new_index = InterestStorage::calculate_new_index(current_index, borrow_rate, time_elapsed)?;
    let debt_delta = new_index
        .checked_sub(current_index)
        .ok_or(ContractError::BalanceOverflow)?;
    let debt_product = total_borrows
        .checked_mul(debt_delta)
        .ok_or(ContractError::BalanceOverflow)?;
    let interest_income = debt_product
        .checked_add(
            current_index
                .checked_sub(1)
                .ok_or(ContractError::BalanceOverflow)?,
        )
        .and_then(|value| value.checked_div(current_index))
        .ok_or(ContractError::BalanceOverflow)?;
    let total_borrows_new = total_borrows
        .checked_add(interest_income)
        .ok_or(ContractError::BalanceOverflow)?;

    let pool = PoolStorage::get(env, pool_id).expect("pool must exist");
    let reserve_factor = (pool.reserve_factor as i128)
        .checked_mul(PRECISION)
        .and_then(|value| value.checked_div(10_000))
        .ok_or(ContractError::BalanceOverflow)?;
    let supply_rate = model.calculate_supply_rate(borrow_rate, utilization, reserve_factor)?;
    let current_supply_index = InterestStorage::get_supply_index(env, pool_id);
    let new_supply_index =
        InterestStorage::calculate_new_index(current_supply_index, supply_rate, time_elapsed)?;
    let supply_delta = new_supply_index
        .checked_sub(current_supply_index)
        .ok_or(ContractError::BalanceOverflow)?;
    let supply_income = total_deposits
        .checked_mul(supply_delta)
        .and_then(|value| value.checked_div(current_supply_index))
        .ok_or(ContractError::BalanceOverflow)?;
    let reserve_income = interest_income
        .checked_sub(supply_income)
        .ok_or(ContractError::BalanceOverflow)?;
    let total_deposits_new = total_deposits
        .checked_add(supply_income)
        .ok_or(ContractError::BalanceOverflow)?;

    InterestStorage::set_interest_index(env, pool_id, new_index);
    InterestStorage::set_supply_index(env, pool_id, new_supply_index);
    PoolStorage::set_total_borrows(env, pool_id, total_borrows_new);
    PoolStorage::set_total_deposits(env, pool_id, total_deposits_new);
    if reserve_income > 0 {
        PoolStorage::add_reserves(env, pool_id, reserve_income)?;
    }

    InterestStorage::set_last_accrual(env, pool_id, accrual_timestamp);
    Ok(())
}

/// Oracle-priced view of a borrow position, with debt and collateral valued
/// in the same 18-decimal quote unit by [`Valuation`].
struct PositionValuation {
    collateral_price: i128,
    collateral_decimals: u32,
    collateral_value: i128,
    pool_price: i128,
    pool_decimals: u32,
    debt_value: i128,
}

/// Value a position's collateral and debt through the guarded oracle path.
///
/// Rounds in the pool's favor: debt value up, collateral value down.
fn value_position(
    env: &Env,
    pool: &LendingPool,
    collateral_asset: &Address,
    collateral_amount: i128,
    debt: i128,
) -> Result<PositionValuation, ContractError> {
    let pool_decimals = Valuation::pool_asset_decimals(env, &pool.id, &pool.asset_address);
    let pool_price = PriceOracle::try_get_price(env, &pool.asset_address)?;
    let collateral_decimals = Valuation::collateral_decimals(env, collateral_asset);
    let collateral_price = PriceOracle::try_get_price(env, collateral_asset)?;
    Ok(PositionValuation {
        collateral_price,
        collateral_decimals,
        collateral_value: Valuation::value_at_price(
            collateral_price,
            collateral_decimals,
            collateral_amount,
            Rounding::Down,
        )?,
        pool_price,
        pool_decimals,
        debt_value: Valuation::value_at_price(pool_price, pool_decimals, debt, Rounding::Up)?,
    })
}

/// Write off debt that no collateral backs any more.
///
/// The pool reserves absorb the loss first. Whatever they cannot cover lowers
/// `total_deposits` and scales the supply index down by the same ratio, so every
/// depositor's claim shrinks in proportion instead of the shortfall landing on
/// whoever withdraws last. The caller removes the debt from `total_borrows`.
fn write_off_bad_debt(
    env: &Env,
    pool_id: &String,
    borrower: &Address,
    amount: i128,
) -> Result<(), ContractError> {
    let reserves = PoolStorage::get_reserves(env, pool_id);
    let covered_by_reserves = amount.min(reserves);
    PoolStorage::set_reserves(
        env,
        pool_id,
        reserves
            .checked_sub(covered_by_reserves)
            .ok_or(ContractError::BalanceOverflow)?,
    );

    let shortfall = amount
        .checked_sub(covered_by_reserves)
        .ok_or(ContractError::BalanceOverflow)?;
    let total_deposits = PoolStorage::get_total_deposits(env, pool_id);
    let socialized = shortfall.min(total_deposits);
    if socialized > 0 {
        let remaining_deposits = total_deposits
            .checked_sub(socialized)
            .ok_or(ContractError::BalanceOverflow)?;
        // The ratio is rounded down so the sum of depositor claims never
        // exceeds the reduced total_deposits.
        let ratio = remaining_deposits
            .checked_mul(PRECISION)
            .and_then(|value| value.checked_div(total_deposits))
            .ok_or(ContractError::BalanceOverflow)?;
        let supply_index = InterestStorage::get_supply_index(env, pool_id);
        let new_supply_index = supply_index
            .checked_mul(ratio)
            .and_then(|value| value.checked_div(PRECISION))
            .ok_or(ContractError::BalanceOverflow)?
            .max(1);
        InterestStorage::set_supply_index(env, pool_id, new_supply_index);
        PoolStorage::set_total_deposits(env, pool_id, remaining_deposits);
    }

    lending_events::emit_bad_debt_written_off(
        env,
        pool_id,
        borrower,
        amount,
        covered_by_reserves,
        socialized,
    );
    Ok(())
}

// ───────────────────────────────────────────────
// Contract definition
// ───────────────────────────────────────────────

#[contract]
pub struct PropertyTokenContract;

#[contractimpl]
impl PropertyTokenContract {
    // ─── Constructor ───────────────────────────
    pub fn __constructor(env: Env, admin: Address) {
        set_lending_admin(&env, &admin);
    }

    // ─── Share Management (Admin) ──────────────

    pub fn set_investor_registry(env: Env, admin: Address, registry: Address) {
        admin.require_auth();
        AdminControl::require_admin(&env, &admin).unwrap_or_else(|e| panic_with_error!(&env, e));
        let previous = Self::get_investor_registry(env.clone());
        env.storage().instance().set(&INVESTOR_REGISTRY, &registry);
        env.events()
            .publish((symbol_short!("invreg"),), (previous, registry));
    }

    pub fn get_investor_registry(env: Env) -> Option<Address> {
        env.storage().instance().get(&INVESTOR_REGISTRY)
    }

    pub fn mint_shares(
        env: Env,
        admin: Address,
        property_id: u64,
        recipient: Address,
        amount: u64,
    ) {
        admin.require_auth();
        AdminControl::require_admin(&env, &admin).unwrap_or_else(|e| panic_with_error!(&env, e));
        PauseControl::require_not_paused(&env).unwrap_or_else(|e| panic_with_error!(&env, e));

        if amount == 0 {
            panic!("Amount must be greater than zero");
        }

        require_approved_investor(&env, &recipient);
        let total = get_total_shares(&env, property_id);
        let new_total = total.checked_add(amount).expect("Total shares overflow");
        set_total_shares(&env, property_id, new_total);
        increase_balance(&env, property_id, &recipient, amount)
            .unwrap_or_else(|e| panic_with_error!(&env, e));

        let prop_str = u64_to_string(&env, property_id);
        PropertyEvents::share_transfer(&env, prop_str, admin, recipient, amount as i128);
    }

    pub fn burn_shares(env: Env, owner: Address, property_id: u64, amount: u64) {
        owner.require_auth();
        PauseControl::require_not_paused(&env).unwrap_or_else(|e| panic_with_error!(&env, e));
        if amount == 0 {
            panic!("Amount must be greater than zero");
        }
        decrease_balance(&env, property_id, &owner, amount)
            .unwrap_or_else(|e| panic_with_error!(&env, e));
        let total = get_total_shares(&env, property_id);
        let new_total = total.checked_sub(amount).expect("Total shares underflow");
        set_total_shares(&env, property_id, new_total);

        let prop_str = u64_to_string(&env, property_id);
        PropertyEvents::share_transfer(&env, prop_str, owner.clone(), owner, amount as i128);
    }

    // ─── Share Transfers & Allowances ──────────

    pub fn transfer_shares(env: Env, from: Address, to: Address, property_id: u64, amount: u64) {
        from.require_auth();
        PauseControl::require_not_paused(&env).unwrap_or_else(|e| panic_with_error!(&env, e));
        if amount == 0 {
            panic!("Amount must be greater than zero");
        }
        require_approved_investor(&env, &to);
        transfer_shares(&env, property_id, &from, &to, amount)
            .unwrap_or_else(|e| panic_with_error!(&env, e));

        let prop_str = u64_to_string(&env, property_id);
        PropertyEvents::share_transfer(&env, prop_str, from, to, amount as i128);
    }

    pub fn approve(env: Env, owner: Address, spender: Address, property_id: u64, amount: u64) {
        owner.require_auth();
        set_allowance(&env, property_id, &owner, &spender, amount);
    }

    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        property_id: u64,
        amount: u64,
    ) {
        spender.require_auth();
        PauseControl::require_not_paused(&env).unwrap_or_else(|e| panic_with_error!(&env, e));
        if amount == 0 {
            panic!("Amount must be greater than zero");
        }
        require_approved_investor(&env, &to);
        spend_allowance(&env, property_id, &from, &spender, amount)
            .unwrap_or_else(|e| panic_with_error!(&env, e));
        transfer_shares(&env, property_id, &from, &to, amount)
            .unwrap_or_else(|e| panic_with_error!(&env, e));

        let prop_str = u64_to_string(&env, property_id);
        PropertyEvents::share_transfer(&env, prop_str, from, to, amount as i128);
    }

    // ─── Property Listing & Purchases ──────────

    /// List a property for sale and open it for `purchase_shares`.
    ///
    /// Stores the property metadata, marks it verified, and records the sale
    /// parameters (price per share, shares for sale and the accepted payment
    /// token) in persistent storage. Display metadata such as the name lives in
    /// the API database; the chain keeps only the minimal fields this contract
    /// needs, keyed by `property_id`.
    pub fn list_property(
        env: Env,
        admin: Address,
        property_id: u64,
        owner: Address,
        price_per_share: i128,
        shares_for_sale: u64,
        payment_token: Address,
    ) {
        admin.require_auth();
        AdminControl::require_admin(&env, &admin).unwrap_or_else(|e| panic_with_error!(&env, e));

        if price_per_share <= 0 {
            panic!("Price per share must be positive");
        }
        if shares_for_sale == 0 {
            panic!("Shares for sale must be greater than zero");
        }
        if storage::property::PropertyMetadata::exists(&env, property_id) {
            panic!("Property already listed");
        }

        let valuation = price_per_share
            .checked_mul(shares_for_sale as i128)
            .expect("Property valuation overflow");
        let property_id_str = u64_to_string(&env, property_id);
        let metadata = storage::property::PropertyMetadata::new(
            property_id,
            owner.clone(),
            u64_to_string(&env, property_id),
            String::from_str(&env, ""),
            String::from_str(&env, ""),
            valuation,
            shares_for_sale,
            env.ledger().timestamp(),
        );
        metadata.save(&env);

        storage::property::set_verified(&env, property_id, true);
        storage::property::set_price_per_share(&env, property_id, price_per_share);
        storage::property::set_available_shares(&env, property_id, shares_for_sale);
        storage::property::set_payment_token(&env, property_id, &payment_token);

        PropertyEvents::property_registered(
            &env,
            property_id_str,
            owner,
            metadata.name,
            shares_for_sale as i128,
            price_per_share,
        );
    }

    /// Pause or delist a property (active = false), or put it back on sale
    /// (active = true). Admin-only. Delisting stops `purchase_shares` without
    /// touching shares already sold.
    pub fn set_property_active(env: Env, admin: Address, property_id: u64, active: bool) {
        admin.require_auth();
        AdminControl::require_admin(&env, &admin).unwrap_or_else(|e| panic_with_error!(&env, e));

        let mut metadata = storage::property::PropertyMetadata::load(&env, property_id)
            .unwrap_or_else(|| panic!("Property not found"));
        metadata.set_active(&env, active);
    }

    pub fn purchase_shares(
        env: Env,
        buyer: Address,
        property_id: u64,
        amount: u64,
        payment_token: Address,
    ) {
        buyer.require_auth();
        PauseControl::require_not_paused(&env).unwrap_or_else(|e| panic_with_error!(&env, e));

        if amount == 0 {
            panic!("Amount must be positive");
        }
        let property = storage::property::PropertyMetadata::load(&env, property_id)
            .unwrap_or_else(|| panic!("Property not found"));
        if !storage::property::is_verified(&env, property_id) {
            panic!("Property is not verified");
        }
        if !property.is_active {
            panic!("Property is not active");
        }
        let available_shares = storage::property::get_available_shares(&env, property_id);
        if amount > available_shares {
            panic!("Insufficient shares available");
        }
        let stored_payment_token = storage::property::get_payment_token(&env, property_id)
            .unwrap_or_else(|| panic!("Property payment token not set"));
        if payment_token != stored_payment_token {
            panic_with_error!(&env, ContractError::PaymentTokenMismatch);
        }

        let price_per_share = storage::property::get_price_per_share(&env, property_id);
        let total_cost = (amount as i128)
            .checked_mul(price_per_share)
            .expect("Cost calculation overflow");

        require_approved_investor(&env, &buyer);
        let token_client = token::Client::new(&env, &stored_payment_token);
        token_client.transfer(&buyer, &property.owner, &total_cost);

        storage::shares::increase_balance(&env, property_id, &buyer, amount)
            .unwrap_or_else(|e| panic_with_error!(&env, e));
        // Purchases mint, so total_shares always equals the sum of balances.
        let total = storage::shares::get_total_shares(&env, property_id);
        let new_total = total.checked_add(amount).expect("Total shares overflow");
        storage::shares::set_total_shares(&env, property_id, new_total);
        storage::property::decrease_available_shares(&env, property_id, amount);

        let mut buffer = itoa::Buffer::new();
        let property_id_str = String::from_str(&env, buffer.format(property_id));
        PropertyEvents::share_purchase(&env, property_id_str, buyer, amount as i128, total_cost);
    }

    // ─── Lending Pool Admin ────────────────────

    pub fn create_pool(
        env: Env,
        admin: Address,
        pool_id: String,
        name: String,
        asset: String,
        asset_address: Address,
        collateral_factor: i128,
        liquidation_threshold: i128,
        liquidation_penalty: i128,
        close_factor: i128,
        reserve_factor: u32,
    ) {
        require_admin(&env, &admin);
        PauseControl::require_not_paused(&env).unwrap_or_else(|e| panic_with_error!(&env, e));
        if PoolStorage::exists(&env, &pool_id) {
            panic!("pool already exists");
        }
        if reserve_factor > 10_000 {
            panic!("reserve factor cannot exceed 10000 basis points");
        }
        let asset_decimals = token::Client::new(&env, &asset_address).decimals();

        let pool = LendingPool {
            id: pool_id.clone(),
            name,
            asset,
            asset_address,
            collateral_factor,
            liquidation_threshold,
            liquidation_penalty,
            close_factor,
            reserve_factor,
            is_active: true,
            created_at: env.ledger().timestamp(),
        };

        PoolStorage::set(&env, &pool);
        PoolStorage::add_to_list(&env, &pool_id);
        Valuation::set_pool_asset_decimals(&env, &pool_id, asset_decimals);

        let model = InterestRateModel::default();
        InterestStorage::set_model(&env, &pool_id, &model);
        InterestStorage::set_interest_index(&env, &pool_id, PRECISION);
        InterestStorage::set_supply_index(&env, &pool_id, PRECISION);
        InterestStorage::set_last_accrual(&env, &pool_id, env.ledger().timestamp());

        PoolStorage::set_total_deposits(&env, &pool_id, 0);
        PoolStorage::set_total_borrows(&env, &pool_id, 0);
        PoolStorage::set_reserves(&env, &pool_id, 0);

        lending_events::emit_pool_created(&env, &admin, &pool_id);
    }

    // ─── Lending Operations ─────────────────────

    pub fn deposit(
        env: Env,
        depositor: Address,
        pool_id: String,
        amount: i128,
    ) -> Result<(), ContractError> {
        depositor.require_auth();
        PauseControl::require_not_paused(&env)?;
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let pool = PoolStorage::get(&env, &pool_id).expect("pool not found");
        if !pool.is_active {
            panic!("pool is not active");
        }
        PoolStorage::require_not_paused(&env, &pool_id)?;

        accrue_interest_internal(&env, &pool_id)?;
        let token_client = token::Client::new(&env, &pool.asset_address);
        token_client.transfer(&depositor, &env.current_contract_address(), &amount);

        let current_index = InterestStorage::get_supply_index(&env, &pool_id);

        match PositionStorage::get_deposit(&env, &depositor, &pool_id) {
            Some(mut existing) => {
                let current_amount = PositionStorage::calculate_deposit_balance(&env, &existing)?;
                let total_amount = current_amount
                    .checked_add(amount)
                    .ok_or(ContractError::BalanceOverflow)?;
                existing.amount = total_amount;
                existing.shares = total_amount;
                existing.index_at_deposit = current_index;
                PositionStorage::set_deposit(&env, &existing);
            }
            None => {
                let position = DepositPosition {
                    pool_id: pool_id.clone(),
                    depositor: depositor.clone(),
                    amount,
                    shares: amount,
                    index_at_deposit: current_index,
                    deposited_at: env.ledger().timestamp(),
                };
                PositionStorage::set_deposit(&env, &position);
            }
        }

        let total = PoolStorage::get_total_deposits(&env, &pool_id);
        PoolStorage::set_total_deposits(
            &env,
            &pool_id,
            total
                .checked_add(amount)
                .ok_or(ContractError::BalanceOverflow)?,
        );
        lending_events::emit_deposit(&env, &depositor, &pool_id, amount);
        Ok(())
    }

    pub fn withdraw(
        env: Env,
        depositor: Address,
        pool_id: String,
        amount: i128,
    ) -> Result<(), ContractError> {
        depositor.require_auth();
        PauseControl::require_not_paused(&env)?;
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let pool = PoolStorage::get(&env, &pool_id).expect("pool not found");
        // Policy: a pool pause halts that pool's activity the same way the global
        // pause halts the protocol, with the single carve-out being repay (see
        // repay() below). Withdraw is not special-cased open under a pool pause:
        // if the pool was paused because its own accounting or price feed is
        // suspect, letting depositors withdraw against that same bad state is
        // exactly the kind of risk-increasing action a pause is meant to stop.
        PoolStorage::require_not_paused(&env, &pool_id)?;

        accrue_interest_internal(&env, &pool_id)?;
        let position =
            PositionStorage::get_deposit(&env, &depositor, &pool_id).expect("no deposit position");
        let total_available = PositionStorage::calculate_deposit_balance(&env, &position)?;

        if amount > total_available {
            panic!("insufficient balance");
        }

        let total_deposits = PoolStorage::get_total_deposits(&env, &pool_id);
        let total_borrows = PoolStorage::get_total_borrows(&env, &pool_id);
        let available_liquidity =
            PoolStorage::calculate_available_liquidity(total_deposits, total_borrows)?;
        if amount > available_liquidity {
            panic!("insufficient pool liquidity");
        }

        let token_client = token::Client::new(&env, &pool.asset_address);
        token_client.transfer(&env.current_contract_address(), &depositor, &amount);

        if amount >= total_available {
            PositionStorage::remove_deposit(&env, &depositor, &pool_id);
        } else {
            let mut updated = position;
            updated.amount = total_available
                .checked_sub(amount)
                .ok_or(ContractError::BalanceOverflow)?;
            updated.shares = updated.amount;
            updated.index_at_deposit = InterestStorage::get_supply_index(&env, &pool_id);
            PositionStorage::set_deposit(&env, &updated);
        }

        PoolStorage::set_total_deposits(
            &env,
            &pool_id,
            total_deposits
                .checked_sub(amount)
                .ok_or(ContractError::BalanceOverflow)?,
        );
        lending_events::emit_withdraw(&env, &depositor, &pool_id, amount);
        Ok(())
    }

    pub fn borrow(
        env: Env,
        borrower: Address,
        pool_id: String,
        amount: i128,
        collateral_asset: Address,
        collateral_amount: i128,
    ) -> Result<BorrowPosition, ContractError> {
        borrower.require_auth();
        PauseControl::require_not_paused(&env)?;
        let pool = PoolStorage::get(&env, &pool_id).expect("Pool not found");
        if !pool.is_active {
            panic!("Pool is not active");
        }
        PoolStorage::require_not_paused(&env, &pool_id)?;

        accrue_interest_internal(&env, &pool_id)?;

        let total_deposits = PoolStorage::get_total_deposits(&env, &pool_id);
        let total_borrows = PoolStorage::get_total_borrows(&env, &pool_id);
        let available = PoolStorage::calculate_available_liquidity(total_deposits, total_borrows)?;
        if amount > available {
            panic!("Insufficient liquidity");
        }

        let current_index = InterestStorage::get_interest_index(&env, &pool_id);
        if current_index == 0 {
            panic!("Interest index is zero - invariant violation");
        }
        if amount <= 0 || collateral_amount <= 0 {
            panic!("amount and collateral must be positive");
        }
        let existing = PositionStorage::get_borrow(&env, &borrower, &pool_id);
        if let Some(existing_position) = &existing {
            if existing_position.collateral_asset != collateral_asset {
                panic_with_error!(&env, ContractError::CollateralAssetMismatch);
            }
        }
        let current_debt = match &existing {
            Some(position) => PositionStorage::calculate_current_debt(&env, position)?,
            None => 0,
        };
        let combined_debt = current_debt
            .checked_add(amount)
            .ok_or(ContractError::BalanceOverflow)?;
        let combined_collateral = existing
            .as_ref()
            .map(|position| position.collateral_amount)
            .unwrap_or(0)
            .checked_add(collateral_amount)
            .ok_or(ContractError::BalanceOverflow)?;
        let valuation = value_position(
            &env,
            &pool,
            &collateral_asset,
            combined_collateral,
            combined_debt,
        )?;

        // Enforce max borrow based on collateral factor (LTV), in value terms
        let max_borrow_value = Valuation::mul_div(
            valuation.collateral_value,
            pool.collateral_factor,
            PRECISION,
            Rounding::Down,
        )?;
        if valuation.debt_value > max_borrow_value {
            panic!("Borrow exceeds collateral factor limit");
        }

        let health_factor = PositionStorage::calculate_health_factor(
            valuation.collateral_value,
            valuation.debt_value,
            pool.liquidation_threshold,
        )?;
        let min_health_factor = 15_i128
            .checked_mul(PRECISION)
            .and_then(|value| value.checked_div(10))
            .ok_or(ContractError::BalanceOverflow)?;
        if health_factor < min_health_factor {
            panic!("Health factor too low");
        }

        let collateral_token = token::Client::new(&env, &collateral_asset);
        collateral_token.transfer(
            &borrower,
            env.current_contract_address(),
            &collateral_amount,
        );
        let pool_token = token::Client::new(&env, &pool.asset_address);
        pool_token.transfer(&env.current_contract_address(), &borrower, &amount);

        let position = BorrowPosition {
            pool_id: pool_id.clone(),
            borrower: borrower.clone(),
            principal: combined_debt,
            index_at_borrow: current_index,
            collateral_amount: combined_collateral,
            collateral_asset: collateral_asset.clone(),
            borrowed_at: existing
                .as_ref()
                .map(|position| position.borrowed_at)
                .unwrap_or(env.ledger().timestamp()),
        };

        PositionStorage::set_borrow(&env, &position);
        PoolStorage::set_total_borrows(
            &env,
            &pool_id,
            total_borrows
                .checked_add(amount)
                .ok_or(ContractError::BalanceOverflow)?,
        );

        LendingEvents::borrow(
            &env,
            pool_id,
            borrower,
            amount,
            collateral_amount,
            collateral_asset,
            health_factor,
        );
        Ok(position)
    }

    /// Liquidate an underwater borrow position.
    ///
    /// A position is eligible for liquidation when its health factor drops below 1.0
    /// (i.e. `health_factor < PRECISION`). The liquidator repays `debt_to_cover`
    /// of the borrower's debt and receives the equivalent collateral value plus a
    /// liquidation penalty (bonus).
    ///
    /// * The close factor caps the debt repaid per call, unless the debt left
    ///   after that cap would fall below the pool's minimum position debt, in
    ///   which case the whole position can be closed.
    /// * When the collateral cannot cover the repaid debt plus penalty, all of it
    ///   is seized and `debt_to_cover` is lowered to what that collateral pays
    ///   for, so the liquidator never pays more than the value received.
    /// * When no collateral is left and debt remains, that debt is written off:
    ///   reserves absorb it first and depositors share the rest through the
    ///   supply index. The position is closed in the same call.
    ///
    /// # Arguments
    /// * `liquidator`       - Address of the account performing the liquidation.
    /// * `pool_id`          - The lending pool identifier.
    /// * `borrower_address` - Address of the underwater borrower.
    /// * `debt_to_cover`    - Amount of debt the liquidator wants to repay
    ///                        (capped at the borrower's current debt).
    ///
    /// # Returns
    /// The resulting (possibly zeroed-out) borrow position.
    ///
    /// # Errors
    /// `ContractError::LiquidationAmountZero` when the call would repay no debt
    /// or seize no collateral.
    pub fn liquidate(
        env: Env,
        liquidator: Address,
        pool_id: String,
        borrower_address: Address,
        debt_to_cover: i128,
    ) -> Result<BorrowPosition, ContractError> {
        liquidator.require_auth();
        PauseControl::require_not_paused(&env)?;
        if debt_to_cover <= 0 {
            panic!("debt to cover must be positive");
        }

        let pool = PoolStorage::get(&env, &pool_id).expect("Pool not found");
        if !pool.is_active {
            panic!("Pool is not active");
        }
        PoolStorage::require_not_paused(&env, &pool_id)?;

        accrue_interest_internal(&env, &pool_id)?;

        let position = PositionStorage::get_borrow(&env, &borrower_address, &pool_id)
            .expect("borrow position not found");

        let current_debt = PositionStorage::calculate_current_debt(&env, &position)?;
        let debt_to_cover = debt_to_cover.min(current_debt);

        // Enforce close factor - cap % of debt liquidatable per tx, unless the
        // debt it would leave behind is dust that could never be closed.
        let max_liquidatable = current_debt
            .checked_mul(pool.close_factor)
            .and_then(|value| value.checked_div(PRECISION))
            .ok_or(ContractError::BalanceOverflow)?;
        let debt_left_at_cap = current_debt
            .checked_sub(max_liquidatable)
            .ok_or(ContractError::BalanceOverflow)?;
        let min_position_debt = PoolStorage::get_min_position_debt(&env, &pool_id);
        let liquidation_cap = if max_liquidatable == 0 || debt_left_at_cap < min_position_debt {
            current_debt
        } else {
            max_liquidatable
        };
        let debt_to_cover = debt_to_cover.min(liquidation_cap);

        // Check health factor – position must be underwater
        let valuation = value_position(
            &env,
            &pool,
            &position.collateral_asset,
            position.collateral_amount,
            current_debt,
        )?;
        let health_factor = PositionStorage::calculate_health_factor(
            valuation.collateral_value,
            valuation.debt_value,
            pool.liquidation_threshold,
        )?;
        if health_factor >= PRECISION {
            panic!("Position is not underwater");
        }

        // Calculate the liquidation bonus (in pool asset units, for the event)
        // and the collateral to seize: the repaid value plus penalty, converted
        // to collateral units. Both values round down, so the seized collateral
        // never exceeds what the repaid value plus penalty covers.
        let penalty = debt_to_cover
            .checked_mul(pool.liquidation_penalty)
            .and_then(|value| value.checked_div(PRECISION))
            .ok_or(ContractError::BalanceOverflow)?;
        let repaid_value = Valuation::value_at_price(
            valuation.pool_price,
            valuation.pool_decimals,
            debt_to_cover,
            Rounding::Down,
        )?;
        let penalty_value = Valuation::mul_div(
            repaid_value,
            pool.liquidation_penalty,
            PRECISION,
            Rounding::Down,
        )?;
        let collateral_seize_value = repaid_value
            .checked_add(penalty_value)
            .ok_or(ContractError::BalanceOverflow)?;
        let collateral_to_seize = Valuation::amount_for_value(
            valuation.collateral_price,
            valuation.collateral_decimals,
            collateral_seize_value,
        )?;

        // When the collateral cannot pay for the requested debt plus penalty,
        // seize all of it and lower the debt covered to what it pays for,
        // rounded down so the liquidator never pays more than it receives.
        let (debt_to_cover, penalty, collateral_to_seize) =
            if collateral_to_seize > position.collateral_amount {
                let penalty_factor = PRECISION
                    .checked_add(pool.liquidation_penalty)
                    .ok_or(ContractError::BalanceOverflow)?;
                let payable_value = Valuation::mul_div(
                    valuation.collateral_value,
                    PRECISION,
                    penalty_factor,
                    Rounding::Down,
                )?;
                let reduced_debt = Valuation::amount_for_value(
                    valuation.pool_price,
                    valuation.pool_decimals,
                    payable_value,
                )?
                .min(debt_to_cover);
                let reduced_penalty = reduced_debt
                    .checked_mul(pool.liquidation_penalty)
                    .and_then(|value| value.checked_div(PRECISION))
                    .ok_or(ContractError::BalanceOverflow)?;
                (reduced_debt, reduced_penalty, position.collateral_amount)
            } else {
                (debt_to_cover, penalty, collateral_to_seize)
            };

        if debt_to_cover <= 0 || collateral_to_seize <= 0 {
            return Err(ContractError::LiquidationAmountZero);
        }

        let collateral_left = position
            .collateral_amount
            .checked_sub(collateral_to_seize)
            .ok_or(ContractError::BalanceOverflow)?;
        let remaining_debt = current_debt
            .checked_sub(debt_to_cover)
            .ok_or(ContractError::BalanceOverflow)?;
        // Debt that no collateral backs any more is written off in this call.
        let bad_debt = if collateral_left == 0 {
            remaining_debt
        } else {
            0
        };
        let closes_position = remaining_debt == 0 || bad_debt > 0;

        // ── EFFECTS phase (CEI) - update state before token transfers ──
        if closes_position {
            PositionStorage::remove_borrow(&env, &borrower_address, &pool_id);
        } else {
            let current_index = InterestStorage::get_interest_index(&env, &pool_id);
            let updated_position = BorrowPosition {
                pool_id: pool_id.clone(),
                borrower: borrower_address.clone(),
                principal: remaining_debt,
                index_at_borrow: current_index,
                collateral_amount: collateral_left,
                collateral_asset: position.collateral_asset.clone(),
                borrowed_at: position.borrowed_at,
            };
            PositionStorage::set_borrow(&env, &updated_position);
        }

        let debt_removed = debt_to_cover
            .checked_add(bad_debt)
            .ok_or(ContractError::BalanceOverflow)?;
        let total_borrows = PoolStorage::get_total_borrows(&env, &pool_id);
        let updated_total_borrows = if debt_removed > total_borrows {
            0
        } else {
            total_borrows
                .checked_sub(debt_removed)
                .ok_or(ContractError::BalanceOverflow)?
        };
        PoolStorage::set_total_borrows(&env, &pool_id, updated_total_borrows);

        if bad_debt > 0 {
            write_off_bad_debt(&env, &pool_id, &borrower_address, bad_debt)?;
        }

        // ── INTERACTIONS phase - token transfers ──
        let pool_token = token::Client::new(&env, &pool.asset_address);
        pool_token.transfer(&liquidator, &env.current_contract_address(), &debt_to_cover);

        let collateral_token = token::Client::new(&env, &position.collateral_asset);
        collateral_token.transfer(
            &env.current_contract_address(),
            &liquidator,
            &collateral_to_seize,
        );

        // Return any excess collateral to the borrower on full close
        if remaining_debt == 0 && collateral_left > 0 {
            collateral_token.transfer(
                &env.current_contract_address(),
                &borrower_address,
                &collateral_left,
            );
        }

        // Emit event
        LendingEvents::liquidation(
            &env,
            pool_id.clone(),
            borrower_address.clone(),
            liquidator.clone(),
            debt_to_cover,
            collateral_to_seize,
            penalty,
        );

        let current_index = InterestStorage::get_interest_index(&env, &pool_id);
        Ok(if closes_position {
            BorrowPosition {
                pool_id,
                borrower: borrower_address,
                principal: 0,
                index_at_borrow: current_index,
                collateral_amount: 0,
                collateral_asset: position.collateral_asset,
                borrowed_at: position.borrowed_at,
            }
        } else {
            BorrowPosition {
                pool_id,
                borrower: borrower_address,
                principal: remaining_debt,
                index_at_borrow: current_index,
                collateral_amount: collateral_left,
                collateral_asset: position.collateral_asset,
                borrowed_at: position.borrowed_at,
            }
        })
    }

    pub fn repay(
        env: Env,
        borrower: Address,
        pool_id: String,
        amount: i128,
    ) -> Result<BorrowPosition, ContractError> {
        borrower.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let pool = PoolStorage::get(&env, &pool_id).expect("Pool not found");
        if !pool.is_active {
            panic!("Pool is not active");
        }
        // Deliberately not gated by either the global or the per-pool pause:
        // repay only reduces the caller's own debt, so blocking it would trap
        // borrowers under an accruing balance, and could force a liquidation
        // the moment the pause lifts. See PauseControl/PoolStorage pause checks
        // on deposit/withdraw/borrow/liquidate for the operations a pause does
        // block.

        accrue_interest_internal(&env, &pool_id)?;

        let position = PositionStorage::get_borrow(&env, &borrower, &pool_id)
            .expect("borrow position not found");
        let (updated_position, repaid_amount, remaining_debt, collateral_released) =
            PositionStorage::apply_repayment(&env, &position, amount)?;

        let refund_amount = amount
            .checked_sub(repaid_amount)
            .ok_or(ContractError::BalanceOverflow)?;

        let current_index = InterestStorage::get_interest_index(&env, &pool_id);
        let result_position = match &updated_position {
            Some(updated) => updated.clone(),
            None => BorrowPosition {
                pool_id: pool_id.clone(),
                borrower: borrower.clone(),
                principal: 0,
                index_at_borrow: current_index,
                collateral_amount: position
                    .collateral_amount
                    .checked_sub(collateral_released)
                    .ok_or(ContractError::BalanceOverflow)?,
                collateral_asset: position.collateral_asset.clone(),
                borrowed_at: position.borrowed_at,
            },
        };

        let total_borrows = PoolStorage::get_total_borrows(&env, &pool_id);
        let updated_total_borrows = if repaid_amount > total_borrows {
            0
        } else {
            total_borrows
                .checked_sub(repaid_amount)
                .ok_or(ContractError::BalanceOverflow)?
        };

        match updated_position {
            Some(updated) => PositionStorage::set_borrow(&env, &updated),
            None => PositionStorage::remove_borrow(&env, &borrower, &pool_id),
        }
        PoolStorage::set_total_borrows(&env, &pool_id, updated_total_borrows);

        let pool_token = token::Client::new(&env, &pool.asset_address);
        pool_token.transfer(&borrower, &env.current_contract_address(), &amount);
        if refund_amount > 0 {
            pool_token.transfer(&env.current_contract_address(), &borrower, &refund_amount);
        }

        let collateral_token = token::Client::new(&env, &position.collateral_asset);
        collateral_token.transfer(
            &env.current_contract_address(),
            &borrower,
            &collateral_released,
        );

        LendingEvents::repay(
            &env,
            pool_id.clone(),
            borrower.clone(),
            repaid_amount,
            remaining_debt,
            collateral_released,
        );

        Ok(result_position)
    }

    /// Configure the close factor for a pool - max % of debt liquidatable per tx.
    ///
    /// * `pool_id`         – The lending pool identifier.
    /// * `new_close_factor` – New close factor in PRECISION units (e.g., 50% = 500_000_000_000_000_000).
    /// * `caller`           – Must be the contract admin.
    pub fn set_close_factor(env: Env, caller: Address, pool_id: String, new_close_factor: i128) {
        require_admin(&env, &caller);
        if new_close_factor <= 0 || new_close_factor > PRECISION {
            panic!("close factor must be between 0 and 1.0 (PRECISION)");
        }
        let mut pool = PoolStorage::get(&env, &pool_id).expect("pool not found");
        let old = pool.close_factor;
        pool.close_factor = new_close_factor;
        PoolStorage::set(&env, &pool);
        LendingEvents::pool_updated(
            &env,
            pool_id,
            String::from_str(&env, "close_factor"),
            old,
            new_close_factor,
        );
    }

    /// Configure the debt, in pool asset base units, below which a liquidation
    /// may close the whole position regardless of the close factor.
    ///
    /// * `caller`            - Must be the contract admin.
    /// * `min_position_debt` - Zero or a positive amount.
    pub fn set_min_position_debt(
        env: Env,
        caller: Address,
        pool_id: String,
        min_position_debt: i128,
    ) {
        require_admin(&env, &caller);
        if min_position_debt < 0 {
            panic!("min position debt cannot be negative");
        }
        PoolStorage::get(&env, &pool_id).expect("pool not found");
        let old = PoolStorage::get_min_position_debt(&env, &pool_id);
        PoolStorage::set_min_position_debt(&env, &pool_id, min_position_debt);
        LendingEvents::pool_updated(
            &env,
            pool_id,
            String::from_str(&env, "min_position_debt"),
            old,
            min_position_debt,
        );
    }

    /// Return the debt below which a liquidation may close the whole position.
    pub fn get_min_position_debt(env: Env, pool_id: String) -> i128 {
        PoolStorage::get_min_position_debt(&env, &pool_id)
    }

    pub fn accrue_interest(env: Env, pool_id: String) -> Result<(), ContractError> {
        if !PoolStorage::exists(&env, &pool_id) {
            panic!("pool not found");
        }
        accrue_interest_internal(&env, &pool_id)?;
        Ok(())
    }

    pub fn withdraw_reserves(
        env: Env,
        caller: Address,
        pool_id: String,
        to: Address,
        amount: i128,
    ) -> Result<(), ContractError> {
        require_admin(&env, &caller);
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let pool = PoolStorage::get(&env, &pool_id).expect("pool not found");
        accrue_interest_internal(&env, &pool_id)?;

        let reserves = PoolStorage::get_reserves(&env, &pool_id);
        let deposits = PoolStorage::get_total_deposits(&env, &pool_id);
        let token_client = token::Client::new(&env, &pool.asset_address);
        let cash = token_client.balance(&env.current_contract_address());
        let withdrawable_cash = if cash > deposits {
            cash.checked_sub(deposits)
                .ok_or(ContractError::BalanceOverflow)?
        } else {
            0
        };
        if amount > reserves || amount > withdrawable_cash {
            panic_with_error!(&env, ContractError::InsufficientReserves);
        }

        PoolStorage::set_reserves(
            &env,
            &pool_id,
            reserves
                .checked_sub(amount)
                .ok_or(ContractError::BalanceOverflow)?,
        );
        token_client.transfer(&env.current_contract_address(), &to, &amount);
        lending_events::emit_reserves_withdrawn(&env, &caller, &pool_id, &to, amount);
        Ok(())
    }

    pub fn set_oracle(env: Env, oracle_address: Address, caller: Address) {
        caller.require_auth();
        AdminControl::require_admin(&env, &caller).unwrap_or_else(|e| panic_with_error!(&env, e));
        PriceOracle::set_oracle_address(&env, &oracle_address);
    }

    /// Configure oracle guardrail parameters.
    ///
    /// * `max_age`   – maximum acceptable price age in seconds (0 = use default 3600).
    /// * `min_price` – minimum normalized price (floor). Set to 0 to disable.
    pub fn set_oracle_config(env: Env, caller: Address, max_age: u64, min_price: i128) {
        caller.require_auth();
        AdminControl::require_admin(&env, &caller).unwrap_or_else(|e| panic_with_error!(&env, e));
        if max_age > 0 {
            PriceOracle::set_max_age(&env, max_age);
        }
        PriceOracle::set_min_price(&env, min_price);
    }

    // ─── Query Views ────────────────────────────

    /// Return the current oracle guardrail parameters: `(max_age, min_price)`.
    pub fn get_oracle_config(env: Env) -> (u64, i128) {
        (
            PriceOracle::get_max_age(&env),
            PriceOracle::get_min_price(&env),
        )
    }

    pub fn get_balance(env: Env, property_id: u64, owner: Address) -> u64 {
        get_balance(&env, property_id, &owner)
    }
    pub fn get_total_shares(env: Env, property_id: u64) -> u64 {
        get_total_shares(&env, property_id)
    }
    pub fn get_allowance(env: Env, property_id: u64, owner: Address, spender: Address) -> u64 {
        get_allowance(&env, property_id, &owner, &spender)
    }
    pub fn get_pool(env: Env, pool_id: String) -> LendingPool {
        PoolStorage::get(&env, &pool_id).expect("pool not found")
    }
    pub fn get_user_deposits(env: Env, user: Address) -> Vec<String> {
        PositionStorage::get_user_deposits(&env, &user)
    }
    pub fn get_total_deposits(env: Env, pool_id: String) -> i128 {
        PoolStorage::get_total_deposits(&env, &pool_id)
    }
    pub fn get_total_borrows(env: Env, pool_id: String) -> i128 {
        PoolStorage::get_total_borrows(&env, &pool_id)
    }
    pub fn get_reserves(env: Env, pool_id: String) -> i128 {
        PoolStorage::get_reserves(&env, &pool_id)
    }
    pub fn get_available_liquidity(env: Env, pool_id: String) -> i128 {
        let deposits = PoolStorage::get_total_deposits(&env, &pool_id);
        let borrows = PoolStorage::get_total_borrows(&env, &pool_id);
        PoolStorage::calculate_available_liquidity(deposits, borrows)
            .expect("available liquidity arithmetic overflow")
    }
    pub fn get_user_borrows(env: Env, user: Address) -> Vec<String> {
        PositionStorage::get_user_borrows(&env, &user)
    }
    pub fn get_interest_index(env: Env, pool_id: String) -> i128 {
        InterestStorage::get_interest_index(&env, &pool_id)
    }
    pub fn get_deposit_position(env: Env, user: Address, pool_id: String) -> DepositPosition {
        PositionStorage::get_deposit(&env, &user, &pool_id).expect("no deposit position")
    }
    pub fn get_borrow_position(env: Env, user: Address, pool_id: String) -> BorrowPosition {
        PositionStorage::get_borrow(&env, &user, &pool_id).expect("borrow position not found")
    }

    /// Calculate the current health factor for a borrow position.
    ///
    /// Returns the health factor in PRECISION units (1.0 = PRECISION).
    /// A value below PRECISION means the position is underwater and eligible
    /// for liquidation. This is a read-only view that does not modify state.
    pub fn get_health_factor(
        env: Env,
        user: Address,
        pool_id: String,
    ) -> Result<i128, ContractError> {
        let position =
            PositionStorage::get_borrow(&env, &user, &pool_id).expect("borrow position not found");
        let pool = PoolStorage::get(&env, &pool_id).expect("pool not found");
        let current_debt = PositionStorage::calculate_current_debt(&env, &position)?;
        let valuation = value_position(
            &env,
            &pool,
            &position.collateral_asset,
            position.collateral_amount,
            current_debt,
        )?;

        PositionStorage::calculate_health_factor(
            valuation.collateral_value,
            valuation.debt_value,
            pool.liquidation_threshold,
        )
    }

    //  Emergency Controls

    pub fn emergency_pause(env: Env, caller: Address) {
        caller.require_auth();
        PauseControl::require_can_pause(&env, &caller)
            .unwrap_or_else(|e| panic_with_error!(&env, e));
        PauseControl::pause(&env, &caller).unwrap_or_else(|e| panic_with_error!(&env, e));
        EmergencyEvents::emergency_paused(&env, caller);
    }

    /// Pause a single lending pool, independent of the global emergency pause.
    /// Gated the same way as `emergency_pause`: admin, `Pauser`, or `EmergencyGuard`.
    pub fn pause_pool(env: Env, caller: Address, pool_id: String) {
        caller.require_auth();
        PauseControl::require_can_pause(&env, &caller)
            .unwrap_or_else(|e| panic_with_error!(&env, e));
        PoolStorage::get(&env, &pool_id).expect("pool not found");
        PoolStorage::set_paused(&env, &pool_id, true);
        LendingEvents::pool_pause_toggled(&env, pool_id, true, caller);
    }

    /// Unpause a single lending pool previously paused with `pause_pool`.
    pub fn unpause_pool(env: Env, caller: Address, pool_id: String) {
        caller.require_auth();
        PauseControl::require_can_pause(&env, &caller)
            .unwrap_or_else(|e| panic_with_error!(&env, e));
        PoolStorage::get(&env, &pool_id).expect("pool not found");
        PoolStorage::set_paused(&env, &pool_id, false);
        LendingEvents::pool_pause_toggled(&env, pool_id, false, caller);
    }

    pub fn schedule_recovery(env: Env, caller: Address) {
        caller.require_auth();
        TimelockControl::schedule_recovery(&env, &caller)
            .unwrap_or_else(|e| panic_with_error!(&env, e));
    }

    pub fn cancel_recovery(env: Env, caller: Address) {
        caller.require_auth();
        TimelockControl::cancel_recovery(&env, &caller)
            .unwrap_or_else(|e| panic_with_error!(&env, e));
    }

    pub fn execute_recovery(env: Env, caller: Address) {
        caller.require_auth();
        TimelockControl::execute_recovery(&env, &caller)
            .unwrap_or_else(|e| panic_with_error!(&env, e));
    }

    pub fn grant_emergency_role(env: Env, admin: Address, target: Address) {
        admin.require_auth();
        AdminControl::require_admin(&env, &admin).unwrap_or_else(|e| panic_with_error!(&env, e));
        RoleStorage::grant_role(&env, &target, &Role::EmergencyGuard);
    }

    pub fn revoke_emergency_role(env: Env, admin: Address, target: Address) {
        admin.require_auth();
        AdminControl::require_admin(&env, &admin).unwrap_or_else(|e| panic_with_error!(&env, e));
        RoleStorage::revoke_role(&env, &target, &Role::EmergencyGuard);
    }
}
