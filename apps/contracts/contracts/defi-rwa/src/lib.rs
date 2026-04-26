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
mod storage;

// Public re-exports for consumers and tests
pub use lending::{
    events::{DepositEvent, PoolCreatedEvent, WithdrawEvent},
    lending_bump, BorrowPosition, DepositPosition, InterestRateModel, InterestStorage, LendingKey,
    LendingPool, PoolStorage, PositionStorage, PRECISION, SECONDS_PER_YEAR,
};

pub use access::*;
pub use events::*;
pub use lending::*;
pub use storage::*;

use soroban_sdk::{contract, contractimpl, token, Address, Env, String, Vec};

// Internal imports
use lending::events as lending_events;

#[cfg(test)]
mod test;

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
fn accrue_interest_internal(env: &Env, pool_id: &String) {
    let last_accrual = InterestStorage::get_last_accrual(env, pool_id);
    let now = env.ledger().timestamp();

    if now <= last_accrual {
        return;
    }

    let time_elapsed = now - last_accrual;
    let total_deposits = PoolStorage::get_total_deposits(env, pool_id);
    let total_borrows = PoolStorage::get_total_borrows(env, pool_id);

    if total_deposits == 0 {
        InterestStorage::set_last_accrual(env, pool_id, now);
        return;
    }

    let utilization = PoolStorage::calculate_utilization(total_deposits, total_borrows);
    let model = InterestStorage::get_model(env, pool_id);
    let borrow_rate = model.calculate_borrow_rate(utilization);

    // Update interest index
    let current_index = InterestStorage::get_interest_index(env, pool_id);
    let new_index = InterestStorage::calculate_new_index(current_index, borrow_rate, time_elapsed);
    InterestStorage::set_interest_index(env, pool_id, new_index);

    // Calculate and add reserve income
    if total_borrows > 0 {
        let pool = PoolStorage::get(env, pool_id).expect("pool must exist");
        let reserve_factor_precision = (pool.reserve_factor as i128) * PRECISION / 10_000;
        let interest_income = (total_borrows * (new_index - current_index)) / current_index;
        let reserve_income = (interest_income * reserve_factor_precision) / PRECISION;
        PoolStorage::set_total_borrows(env, pool_id, total_borrows + interest_income);
        if reserve_income > 0 {
            PoolStorage::add_reserves(env, pool_id, reserve_income);
        }
    }

    InterestStorage::set_last_accrual(env, pool_id, now);
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

    pub fn mint_shares(
        env: Env,
        admin: Address,
        property_id: u64,
        recipient: Address,
        amount: u64,
    ) {
        admin.require_auth();
        AdminControl::require_admin(&env, &admin);

        if amount == 0 {
            panic!("Amount must be greater than zero");
        }

        let total = get_total_shares(&env, property_id);
        let new_total = total.checked_add(amount).expect("Total shares overflow");
        set_total_shares(&env, property_id, new_total);
        increase_balance(&env, property_id, &recipient, amount);

        let prop_str = u64_to_string(&env, property_id);
        PropertyEvents::share_transfer(&env, prop_str, admin, recipient, amount as i128);
    }

    pub fn burn_shares(env: Env, owner: Address, property_id: u64, amount: u64) {
        owner.require_auth();
        if amount == 0 {
            panic!("Amount must be greater than zero");
        }
        decrease_balance(&env, property_id, &owner, amount);
        let total = get_total_shares(&env, property_id);
        let new_total = total.checked_sub(amount).expect("Total shares underflow");
        set_total_shares(&env, property_id, new_total);

        let prop_str = u64_to_string(&env, property_id);
        PropertyEvents::share_transfer(&env, prop_str, owner.clone(), owner, amount as i128);
    }

    // ─── Share Transfers & Allowances ──────────

    pub fn transfer_shares(env: Env, from: Address, to: Address, property_id: u64, amount: u64) {
        from.require_auth();
        if amount == 0 {
            panic!("Amount must be greater than zero");
        }
        transfer_shares(&env, property_id, &from, &to, amount);

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
        if amount == 0 {
            panic!("Amount must be greater than zero");
        }
        spend_allowance(&env, property_id, &from, &spender, amount);
        transfer_shares(&env, property_id, &from, &to, amount);

        let prop_str = u64_to_string(&env, property_id);
        PropertyEvents::share_transfer(&env, prop_str, from, to, amount as i128);
    }

    // ─── Property Purchases ─────────────────────

    pub fn purchase_shares(
        env: Env,
        buyer: Address,
        property_id: u64,
        amount: u64,
        payment_token: Address,
    ) {
        buyer.require_auth();
        PauseControl::require_not_paused(&env);

        if amount == 0 {
            panic!("Amount must be positive");
        }
        let property = storage::property::PropertyMetadata::load(&env, property_id)
            .unwrap_or_else(|| panic!("Property not found"));
        if !storage::property::is_verified(&env, property_id) {
            panic!("Property is not verified");
        }
        let available_shares = storage::property::get_available_shares(&env, property_id);
        if amount > available_shares {
            panic!("Insufficient shares available");
        }

        let price_per_share = storage::property::get_price_per_share(&env, property_id);
        let total_cost = (amount as i128)
            .checked_mul(price_per_share)
            .expect("Cost calculation overflow");

        let token_client = token::Client::new(&env, &payment_token);
        token_client.transfer(&buyer, &property.owner, &total_cost);

        storage::shares::increase_balance(&env, property_id, &buyer, amount);
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
        reserve_factor: u32,
    ) {
        require_admin(&env, &admin);
        if PoolStorage::exists(&env, &pool_id) {
            panic!("pool already exists");
        }

        let pool = LendingPool {
            id: pool_id.clone(),
            name,
            asset,
            asset_address,
            collateral_factor,
            liquidation_threshold,
            liquidation_penalty,
            reserve_factor,
            is_active: true,
            created_at: env.ledger().timestamp(),
        };

        PoolStorage::set(&env, &pool);
        PoolStorage::add_to_list(&env, &pool_id);

        let model = InterestRateModel::default();
        InterestStorage::set_model(&env, &pool_id, &model);
        InterestStorage::set_interest_index(&env, &pool_id, PRECISION);
        InterestStorage::set_last_accrual(&env, &pool_id, env.ledger().timestamp());

        PoolStorage::set_total_deposits(&env, &pool_id, 0);
        PoolStorage::set_total_borrows(&env, &pool_id, 0);

        lending_events::emit_pool_created(&env, &admin, &pool_id);
    }

    // ─── Lending Operations ─────────────────────

    pub fn deposit(env: Env, depositor: Address, pool_id: String, amount: i128) {
        depositor.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let pool = PoolStorage::get(&env, &pool_id).expect("pool not found");
        if !pool.is_active {
            panic!("pool is not active");
        }
        if PoolStorage::is_paused(&env, &pool_id) {
            panic!("pool is paused");
        }

        accrue_interest_internal(&env, &pool_id);
        let token_client = token::Client::new(&env, &pool.asset_address);
        token_client.transfer(&depositor, &env.current_contract_address(), &amount);

        let current_index = InterestStorage::get_interest_index(&env, &pool_id);

        match PositionStorage::get_deposit(&env, &depositor, &pool_id) {
            Some(mut existing) => {
                let total_amount = existing.amount + amount;
                existing.index_at_deposit = ((existing.amount * existing.index_at_deposit)
                    + (amount * current_index))
                    / total_amount;
                existing.amount = total_amount;
                existing.shares = total_amount;
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
        PoolStorage::set_total_deposits(&env, &pool_id, total + amount);
        lending_events::emit_deposit(&env, &depositor, &pool_id, amount);
    }

    pub fn withdraw(env: Env, depositor: Address, pool_id: String, amount: i128) {
        depositor.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let pool = PoolStorage::get(&env, &pool_id).expect("pool not found");

        accrue_interest_internal(&env, &pool_id);
        let position =
            PositionStorage::get_deposit(&env, &depositor, &pool_id).expect("no deposit position");
        let accrued = PositionStorage::calculate_deposit_interest(&env, &position);
        let total_available = position.amount + accrued;

        if amount > total_available {
            panic!("insufficient balance");
        }

        let total_deposits = PoolStorage::get_total_deposits(&env, &pool_id);
        let total_borrows = PoolStorage::get_total_borrows(&env, &pool_id);
        let available_liquidity =
            PoolStorage::calculate_available_liquidity(total_deposits, total_borrows);
        if amount > available_liquidity {
            panic!("insufficient pool liquidity");
        }

        let token_client = token::Client::new(&env, &pool.asset_address);
        token_client.transfer(&env.current_contract_address(), &depositor, &amount);

        if amount >= total_available {
            PositionStorage::remove_deposit(&env, &depositor, &pool_id);
        } else {
            let mut updated = position;
            updated.amount = total_available - amount;
            updated.shares = updated.amount;
            updated.index_at_deposit = InterestStorage::get_interest_index(&env, &pool_id);
            PositionStorage::set_deposit(&env, &updated);
        }

        PoolStorage::set_total_deposits(&env, &pool_id, total_deposits - amount);
        lending_events::emit_withdraw(&env, &depositor, &pool_id, amount);
    }

    pub fn borrow(
        env: Env,
        borrower: Address,
        pool_id: String,
        amount: i128,
        collateral_asset: Address,
        collateral_amount: i128,
    ) -> BorrowPosition {
        borrower.require_auth();
        let pool = PoolStorage::get(&env, &pool_id).expect("Pool not found");
        if !pool.is_active {
            panic!("Pool is not active");
        }
        if PoolStorage::is_paused(&env, &pool_id) {
            panic!("Pool is paused");
        }

        accrue_interest_internal(&env, &pool_id);

        let total_deposits = PoolStorage::get_total_deposits(&env, &pool_id);
        let total_borrows = PoolStorage::get_total_borrows(&env, &pool_id);
        let available = PoolStorage::calculate_available_liquidity(total_deposits, total_borrows);
        if amount > available {
            panic!("Insufficient liquidity");
        }

        let current_index = InterestStorage::get_interest_index(&env, &pool_id);
        if current_index == 0 {
            panic!("Interest index is zero - invariant violation");
        }
        let collateral_price = PriceOracle::get_price(&env, &collateral_asset);
        let collateral_value = (collateral_price * collateral_amount) / PRECISION;

        let debt_value = amount;
        let health_factor = PositionStorage::calculate_health_factor(
            collateral_value,
            debt_value,
            pool.liquidation_threshold,
        );
        let min_health_factor = (15 * PRECISION) / 10;
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
            principal: amount,
            index_at_borrow: current_index,
            collateral_amount,
            collateral_asset: collateral_asset.clone(),
            borrowed_at: env.ledger().timestamp(),
        };

        PositionStorage::set_borrow(&env, &position);
        PoolStorage::set_total_borrows(&env, &pool_id, total_borrows + amount);

        LendingEvents::borrow(
            &env,
            pool_id,
            borrower,
            amount,
            collateral_amount,
            collateral_asset,
            health_factor,
        );
        position
    }

    pub fn repay(env: Env, borrower: Address, pool_id: String, amount: i128) -> BorrowPosition {
        borrower.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let pool = PoolStorage::get(&env, &pool_id).expect("Pool not found");
        if !pool.is_active {
            panic!("Pool is not active");
        }
        if PoolStorage::is_paused(&env, &pool_id) {
            panic!("Pool is paused");
        }

        accrue_interest_internal(&env, &pool_id);

        let position = PositionStorage::get_borrow(&env, &borrower, &pool_id)
            .expect("borrow position not found");
        let (updated_position, repaid_amount, remaining_debt, collateral_released) =
            PositionStorage::apply_repayment(&env, &position, amount);

        let pool_token = token::Client::new(&env, &pool.asset_address);
        pool_token.transfer(&borrower, &env.current_contract_address(), &repaid_amount);

        let collateral_token = token::Client::new(&env, &position.collateral_asset);
        collateral_token.transfer(
            &env.current_contract_address(),
            &borrower,
            &collateral_released,
        );

        let current_index = InterestStorage::get_interest_index(&env, &pool_id);
        let result_position = match &updated_position {
            Some(updated) => updated.clone(),
            None => BorrowPosition {
                pool_id: pool_id.clone(),
                borrower: borrower.clone(),
                principal: 0,
                index_at_borrow: current_index,
                collateral_amount: position.collateral_amount - collateral_released,
                collateral_asset: position.collateral_asset.clone(),
                borrowed_at: position.borrowed_at,
            },
        };

        match updated_position {
            Some(updated) => PositionStorage::set_borrow(&env, &updated),
            None => PositionStorage::remove_borrow(&env, &borrower, &pool_id),
        }

        let total_borrows = PoolStorage::get_total_borrows(&env, &pool_id);
        let updated_total_borrows = if repaid_amount > total_borrows {
            0
        } else {
            total_borrows - repaid_amount
        };
        PoolStorage::set_total_borrows(&env, &pool_id, updated_total_borrows);

        LendingEvents::repay(
            &env,
            pool_id.clone(),
            borrower.clone(),
            repaid_amount,
            remaining_debt,
            collateral_released,
        );

        result_position
    }

    pub fn accrue_interest(env: Env, pool_id: String) {
        if !PoolStorage::exists(&env, &pool_id) {
            panic!("pool not found");
        }
        accrue_interest_internal(&env, &pool_id);
    }

    pub fn set_oracle(env: Env, oracle_address: Address, caller: Address) {
        caller.require_auth();
        AdminControl::require_admin(&env, &caller);
        PriceOracle::set_oracle_address(&env, &oracle_address);
    }

    /// Configure oracle guardrail parameters.
    ///
    /// * `max_age`   – maximum acceptable price age in seconds (0 = use default 3600).
    /// * `min_price` – minimum normalized price (floor). Set to 0 to disable.
    pub fn set_oracle_config(env: Env, caller: Address, max_age: u64, min_price: i128) {
        caller.require_auth();
        AdminControl::require_admin(&env, &caller);
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

    //  Emergency Controls

    pub fn emergency_pause(env: Env, caller: Address) {
        caller.require_auth();
        PauseControl::require_can_pause(&env, &caller);
        PauseControl::pause(&env, &caller);
        EmergencyEvents::emergency_paused(&env, caller);
    }

    pub fn schedule_recovery(env: Env, caller: Address) {
        caller.require_auth();
        TimelockControl::schedule_recovery(&env, &caller);
    }

    pub fn cancel_recovery(env: Env, caller: Address) {
        caller.require_auth();
        TimelockControl::cancel_recovery(&env, &caller);
    }

    pub fn execute_recovery(env: Env, caller: Address) {
        caller.require_auth();
        TimelockControl::execute_recovery(&env, &caller);
    }

    pub fn grant_emergency_role(env: Env, admin: Address, target: Address) {
        admin.require_auth();
        AdminControl::require_admin(&env, &admin);
        RoleStorage::grant_role(&env, &target, &Role::EmergencyGuard);
    }

    pub fn revoke_emergency_role(env: Env, admin: Address, target: Address) {
        admin.require_auth();
        AdminControl::require_admin(&env, &admin);
        RoleStorage::revoke_role(&env, &target, &Role::EmergencyGuard);
    }
}
