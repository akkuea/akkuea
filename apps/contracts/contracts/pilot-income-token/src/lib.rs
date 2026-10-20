#!no_std]
#![allow(linker_messages)]

use soroban_sdk:{
    contract, contractclient, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Vec,
};

mod errors;
mod events;
mod storage;
mod ttl;

pub use errors::IncomeTokenError;
use storage::{DataKey, Storage};
use ttl::{extend_instance as extend_instance_ttl, extend_persistent as extend_persistent_ttl};

/// Maximum number of holders, matching `MAX_HOLDERS` in `pilot-payout-split`,
/// whose distribution loop rejects any larger holder set.
pub const MAX_HOLDERS: u32 = 10;

#[contractclient(name = "WhitelistClient")]
pub trait Whitelist {
    fn is_approved(env: Env, address: Address) -> bool;
}

/// Durable on-chain record of a permanent pilot wind-down. Written exactly
/// once by `mark_wound_down` and never removed, mirroring the payout-split
/// contract's `ExitRecord` so a client reading either contract independently
/// sees a consistent terminal picture without any cross-contract call.
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct WoundDownRecord {
    /// Free-text reason supplied by the admin (see
    /// docs/strategy/decision-log.md for the recorded representation decision).
    pub reason: String,
    /// Ledger timestamp of the `mark_wound_down` invocation.
    pub at: u64,
}

#[contract]
pub struct PilotIncomeToken;

#[contractimpl]
impl PilotIncomeToken {
    /// Initialize token metadata and the whitelist contract used for mint gating.
    pub fn initialize(
        env: Env,
        admin: Address,
        whitelist: Address,
        name: String,
        symbol: String,
        decimals: u32,
    ) {
        if Storage::is_initialized(&env) {
            panic_with_error!(&env, IncomeTokenError::AlreadyInitialized);
        }

        Storage::set_admin(&env, &admin);
        Storage::set_whitelist(&env, &whitelist);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::Decimals, &decimals);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);
        env.storage()
            .instance()
            .set(&DataKey::Holders, &Vec::<Address>::new(&env));
        env.storage().instance().set(&DataKey::Minted, &false);

        events::emit_initialized(&env, admin, whitelist);

        extend_instance_ttl(&env);
    }

    /// Mint the fixed pilot supply once to approved holders.
    pub fn mint_fixed_supply(env: Env, admin: Address, holders: Vec<Address>, amounts: Vec<i128>) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        Self::require_not_paused(&env);

        if Storage::has_minted(&env) {
            panic_with_error!(&env, IncomeTokenError::AlreadyMinted);
        }

        if holders.is_empty() {
            panic_with_error!(&env, IncomeTokenError::EmptyHolderSet);
        }

        if holders.len() != amounts.len() {
            panic_with_error!(&env, IncomeTokenError::HolderAmountLengthMismatch);
        }

        let whitelist_address = Storage::whitelist(&env)
            .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::NotInitialized));
        let whitelist = WhitelistClient::new(&env, &whitelist_address);

        let mut minted_holders: Vec<Address> = Vec::new(&env);
        let mut total_supply = 0i128;

        for i in 0..holders.len() {
            // Unreachable: every index comes from `0..holders.len()`, and the
            // length check above guarantees `amounts` has that same length, so
            // neither lookup can fail. Kept typed rather than `unwrap` ped so a
            // future refactor that breaks the invariant surfaces as
            // `InternalInvariant` instead of a generic host trap.
            let holder = holders
                .get(i)
                .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::InternalInvariant));
            let amount = amounts
                .get(i)
                .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::InternalInvariant));

            if amount <= 0 {
                panic_with_error!(&env, IncomeTokenError::InvalidAmount);
            }

            if !whitelist.is_approved(&holder) {
                panic_with_error!(&env, IncomeTokenError::HolderNotApproved);
            }

            let current = Storage::balance(&env,& holder);
            let next = current
                .checked_add(amount)
                .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::BalanceOverflow));
            Storage::set_balance(&env,& holder, next);

            total_supply = total_supply
                .checked_add(amount)
                .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::SupplyOverflow));

            if !Self::contains_holder(&minted_holders, &holder) {
                minted_holders.push_back(holder);
            }
        }

        if minted_holders.len() > MAX_HOLDERS {
            panic_with_error!(&env, IncomeTokenError::TooManyHolders);
        }

        Storage::set_total_supply(&env, total_supply);
        Storage::set_holders(&env, &minted_holders);
        Storage::set_minted(&env);
        events::emit_minted(&env, admin, total_supply, minted_holders.len());

        extend_instance_ttl(&env);
    }

    /// Return the balance of an address.
    pub fn balance(env: Env, id: Address) -> i128 {
        let key = DataKey::Balance(id.clone());
        let balance = Storage::balance(&env,& id);
        if env.storage().persistent().has(&key) {
            extend_persistent_ttl(&env,& key);
        }
        balance
    }

    /// Return token name.
    pub fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::NotInitialized))
    }

    /// Return token symbol.
    pub fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Symbol)
            .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::NotInitialized))
    }

    /// Return token decimal precision.
    pub fn decimals(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Decimals)
            .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::NotInitialized))
    }

    /// Return total minted supply.
    pub fn total_supply(env: Env) -> i128 {
        Storage::total_supply(&env)
    }

    /// Return the holder set used by payout distribution: every address with a
    /// positive balance, at most `MAX_HOLDERS` of them.
    pub fn holders(env: Env) -> Vec<Address> {
        Storage::holders(&env)
    }

    /// Return the configured token admin.
    pub fn admin(env: Env) -> Address {
        Storage::admin(&env)
            .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::NotInitialized))
    }

    /// Admin-only correction transfer. Holders cannot transfer the token.
    pub fn transfer(env: Env, caller: Address, from: Address, to: Address, amount: i128) {
        caller.require_auth();
        Self::require_admin(&env, &caller);
        Self::require_not_paused(&env);

        if amount <= 0 {
            panic_with_error!(&env, IncomeTokenError::InvalidAmount);
        }

        let whitelist_address = Storage::whitelist(&env)
            .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::NotInitialized));
        let whitelist = WhitelistClient::new(&env, &whitelist_address);
        if !whitelist.is_approved(&to) {
            panic_with_error!(&env, IncomeTokenError::HolderNotApproved);
        }

        Self::move_balance(&env, from, to, amount);

        extend_instance_ttl(&env);
    }

    /// Permanently mark the pilot as wound down.
    ///
    /// One-way and irreversible: once set, the marker can never be cleared and
    /// no un-wind-down function exists. Admin-gated, matching every other
    /// state-changing function on this contract, so the same platform key that
    /// mints and corrects balances owns the terminal state too.
    ///
    /// This is an independent write from `exit` on the payout-split contract:
    /// each contract stores and exposes its own terminal marker, so a client
    /// reading either contract alone gets a complete answer without a
    /// cross-contract call at read time. Recording the fact of wind-down only;
    /// no fund-recovery, refund, or unwind logic is implemented here (that
    /// remains an open product/legal question, Known Risk #5 in the product
    /// brief).
    pub fn mark_wound_down(env: Env, admin: Address, reason: String) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        Self::require_not_paused(&env);

        if Storage::wound_down_record(&env).is_some() {
            panic_with_error!(&env, IncomeTokenError::AlreadyWoundDown);
        }

        if reason.is_empty() {
            panic_with_error!(&env, IncomeTokenError::MissingWoundDownReason);
        }

        let record = WoundDownRecord {
            reason: reason.clone(),
            at: env.ledger().timestamp(),
        };
        Storage::set_wound_down_record(&env, &record);
        events::emit_wound_down_recorded(&env, admin, reason, record.at);

        extend_instance_ttl(&env);
    }

    /// Return the terminal wound-down record, or `None` while the pilot is
    /// active. Read-only and self-contained: no cross-contract call is needed.
    pub fn wound_down_status(env: Env) -> Option<WoundDownRecord> {
        Storage::wound_down_record(&env)
    }

    /// Begin transferring admin to a new address.
    ///
    /// Two-step, following the same pattern as `defi-rwa`'s
    /// `AdminControl::transfer_admin_start` (see
    /// docs/operations/runbook-role-management.md). The current admin keeps
    /// full control until `new_admin` calls `transfer_admin_accept`, so a
    /// mistyped or unreachable new admin can never lock the contract out.
    /// Not blocked by `pause`: admin recovery must keep working while paused.
    pub fn transfer_admin_start(env: Env, caller: Address, new_admin: Address) {
        caller.require_auth();
        Self::require_admin(&env, &caller);

        Storage::set_pending_admin(&env, &new_admin);
        events::emit_admin_transfer_started(&env, caller, new_admin);

        extend_instance_ttl(&env);
    }

    /// Accept a pending admin transfer. Must be signed by the address named
    /// in `transfer_admin_start`. The old admin loses every privilege the
    /// instant this call succeeds, since `require_admin` compares against the
    /// single stored admin address.
    pub fn transfer_admin_accept(env: Env, new_admin: Address) {
        new_admin.require_auth();

        let pending = Storage::pending_admin(&env);
        if pending != Some(new_admin.clone()) {
            panic_with_error!(&env, IncomeTokenError::NotPendingAdmin);
        }

        let old_admin = Storage::admin(&env)
            .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::NotInitialized));

        Storage::set_admin(&env, &new_admin);
        Storage::clear_pending_admin(&env);
        events::emit_admin_transfer_accepted(&env, old_admin, new_admin);

        extend_instance_ttl(&env);
    }

    /// Cancel a pending admin transfer before it is accepted. Only the
    /// current admin can cancel.
    pub fn transfer_admin_cancel(env: Env, caller: Address) {
        caller.require_auth();
        Self::require_admin(&env, &caller);

        Storage::clear_pending_admin(&env);
        events::emit_admin_transfer_cancelled(&env, caller);

        extend_instance_ttl(&env);
    }

    /// Return the pending admin, if a transfer is in progress.
    pub fn pending_admin(env: Env) -> Option<Address> {
        Storage::pending_admin(&env)
    }

    /// Pause `mint_fixed_supply`, `transfer`, and `mark_wound_down`.
    /// Read-only calls (balance, metadata, holders, wound-down status) remain
    /// available while paused.
    pub fn pause(env: Env, admin: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);

        env.storage().instance().set(&DataKey::Paused, &true);
        events::emit_paused(&env, admin);

        extend_instance_ttl(&env);
    }

    /// Unpause the contract. Admin-only.
    pub fn unpause(env: Env, admin: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);

        env.storage().instance().set(&DataKey::Paused, &false);
        events::emit_unpaused(&env, admin);

        extend_instance_ttl(&env);
    }

    /// Return whether the contract is paused.
    pub fn is_paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or_default(&false)
    }

    fn require_admin(env: &Env, admin: &Address) {
        let stored = Storage::admin(env)
            .unwrap_or_else(|| panic_with_error!(env, IncomeTokenError::NotInitialized));
        if &stored != admin {
            panic_with_error!(env, IncomeTokenError::NotAdmin);
        }
    }

    fn require_not_paused(env: &Env) {
        if env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or_default(&false)
        {
            panic_with_error!(env, IncomeTokenError::Paused);
        }
    }

    fn contains_holder(holders: &Vec<Address>, address: &Address) -> bool {
        for i in 0..holders.len() {
            if holders.get(i) == Some(address.clone()) {
                return true;
            }
        }
        false
    }

    fn move_balance(env: &Env, from: Address, to: Address, amount: i128) {
        let from_balance = Storage::balance(env, &from);
        if from_balance < amount {
            panic_with_error(env, IncomeTokenError::InsufficientBalance);
        }

        let to_balance = Storage::balance(env, &to);
        let next_to = to_balance
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(env, IncomeTokenError::BalanceOverflow));

        Storage::set_balance(env, &from, from_balance - amount);
        Storage::set_balance(env, &to, next_to);

        events::emit_transfer(env, from, to, amount);
    }
}

#[cfg(test)]
mod test;
