#![no_std]
#![allow(linker_messages)]

use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Vec,
};

mod errors;
mod events;
mod storage;
mod ttl;

pub use errors::IncomeTokenError;
use storage::{DataKey, Storage};
use ttl::extend_instance;

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

        extend_instance(&env);

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
    }

    /// Mint the fixed pilot supply once to approved holders.
    pub fn mint_fixed_supply(env: Env, admin: Address, holders: Vec<Address>, amounts: Vec<i128>) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        Self::require_not_paused(&env);

        extend_instance(&env);

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
            // neither lookup can fail. Kept typed rather than `unwrap`ped so a
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

            let current = Storage::balance(&env, &holder);
            let next = current
                .checked_add(amount)
                .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::BalanceOverflow));
            Storage::set_balance(&env, &holder, next);

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
    }

    /// Return the balance of an address.
    pub fn balance(env: Env, id: Address) -> i128 {
        Storage::balance(&env, &id)
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
    ///
    /// Preserves `sum(balances) == total_supply`, which the payout split
    /// relies on: the amount may not exceed the sender's balance, and a
    /// self-transfer is rejected with `SelfTransfer`.
    pub fn transfer(env: Env, caller: Address, from: Address, to: Address, amount: i128) {
        caller.require_auth();
        Self::require_admin(&env, &caller);
        Self::require_not_paused(&env);

        if amount <= 0 {
            panic_with_error!(&env, IncomeTokenError::InvalidAmount);
        }

        extend_instance(&env);

        if from == to {
            panic_with_error!(&env, IncomeTokenError::SelfTransfer);
        }

        let whitelist_address = Storage::whitelist(&env)
            .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::NotInitialized));
        let whitelist = WhitelistClient::new(&env, &whitelist_address);
        if !whitelist.is_approved(&to) {
            panic_with_error!(&env, IncomeTokenError::HolderNotApproved);
        }

        Self::move_balance(&env, from, to, amount);
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

        extend_instance(&env);

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

        extend_instance(&env);

        Storage::set_pending_admin(&env, &new_admin);
        events::emit_admin_transfer_started(&env, caller, new_admin);
    }

    /// Accept a pending admin transfer. Must be signed by the address named
    /// in `transfer_admin_start`. The old admin loses every privilege the
    /// instant this call succeeds, since `require_admin` compares against the
    /// single stored admin address.
    pub fn transfer_admin_accept(env: Env, new_admin: Address) {
        new_admin.require_auth();

        extend_instance(&env);

        let pending = Storage::pending_admin(&env);
        if pending != Some(new_admin.clone()) {
            panic_with_error!(&env, IncomeTokenError::NotPendingAdmin);
        }

        let old_admin = Storage::admin(&env)
            .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::NotInitialized));

        Storage::set_admin(&env, &new_admin);
        Storage::clear_pending_admin(&env);
        events::emit_admin_transfer_accepted(&env, old_admin, new_admin);
    }

    /// Cancel a pending admin transfer before it is accepted. Only the
    /// current admin can cancel.
    pub fn transfer_admin_cancel(env: Env, caller: Address) {
        caller.require_auth();
        Self::require_admin(&env, &caller);

        extend_instance(&env);

        Storage::clear_pending_admin(&env);
        events::emit_admin_transfer_cancelled(&env, caller);
    }

    /// Return the pending admin, if a transfer is in progress.
    pub fn pending_admin(env: Env) -> Option<Address> {
        Storage::pending_admin(&env)
    }

    /// Pause `mint_fixed_supply`, `transfer`, and `mark_wound_down`.
    /// Read-only calls (`balance`, `holders`, `total_supply`, and the rest)
    /// keep working.
    ///
    /// Mirrors `pilot-payout-split`'s `pause`. Before this change, a
    /// wrongful mint or correction transfer had no on-chain circuit breaker.
    pub fn pause(env: Env, admin: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);

        extend_instance(&env);

        Storage::set_paused(&env, true);
        events::emit_paused(&env, admin);
    }

    /// Resume `mint_fixed_supply`, `transfer`, and `mark_wound_down`.
    pub fn unpause(env: Env, admin: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);

        extend_instance(&env);

        Storage::set_paused(&env, false);
        events::emit_unpaused(&env, admin);
    }

    /// Return whether the contract is paused.
    pub fn is_paused(env: Env) -> bool {
        Storage::is_paused(&env)
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin = Storage::admin(env)
            .unwrap_or_else(|| panic_with_error!(env, IncomeTokenError::NotInitialized));
        if admin != caller.clone() {
            panic_with_error!(env, IncomeTokenError::Unauthorized);
        }
    }

    /// `mark_wound_down` is deliberately included: pausing exists to stop
    /// every state-changing effect, including a permanent one, while an
    /// incident is under review. Ending the pilot is a decision the admin can
    /// still make after an explicit `unpause`.
    fn require_not_paused(env: &Env) {
        if Storage::is_paused(env) {
            panic_with_error!(env, IncomeTokenError::ContractPaused);
        }
    }

    fn move_balance(env: &Env, from: Address, to: Address, amount: i128) {
        let from_balance = Storage::balance(env, &from);
        // An explicit comparison, not `checked_sub`: on i128 the subtraction
        // only fails at the type boundary and would otherwise go negative.
        if amount > from_balance {
            panic_with_error!(env, IncomeTokenError::InsufficientBalance);
        }
        let next_from = from_balance - amount;
        let to_balance = Storage::balance(env, &to);
        let next_to = to_balance
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(env, IncomeTokenError::BalanceOverflow));

        // A sender emptied by the correction leaves the holder list, so a
        // departing investor who is later revoked from the whitelist no longer
        // blocks distribution, and the slot is free for the replacement.
        let mut holders = Storage::holders(env);
        if next_from == 0 {
            if let Some(index) = holders.first_index_of(&from) {
                holders.remove(index);
            }
        }
        if !Self::contains_holder(&holders, &to) {
            holders.push_back(to.clone());
        }
        if holders.len() > MAX_HOLDERS {
            panic_with_error!(env, IncomeTokenError::TooManyHolders);
        }

        Storage::set_balance(env, &from, next_from);
        Storage::set_balance(env, &to, next_to);
        Storage::set_holders(env, &holders);
        events::emit_transfer(env, from, to, amount);
    }

    fn contains_holder(holders: &Vec<Address>, holder: &Address) -> bool {
        for i in 0..holders.len() {
            if holders
                .get(i)
                .is_some_and(|candidate| candidate == holder.clone())
            {
                return true;
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pilot_whitelist::{PilotWhitelist, PilotWhitelistClient};
    use soroban_sdk::{testutils::Address as _, vec, xdr::ScVal, Error, TryFromVal};

    struct Setup {
        env: Env,
        admin: Address,
        whitelist_admin: Address,
        holder_one: Address,
        holder_two: Address,
        unapproved: Address,
        whitelist: PilotWhitelistClient<'static>,
        token: PilotIncomeTokenClient<'static>,
        token_id: Address,
    }

    fn setup() -> Setup {
        let env = Env::default();
        let admin = Address::generate(&env);
        let whitelist_admin = Address::generate(&env);
        let holder_one = Address::generate(&env);
        let holder_two = Address::generate(&env);
        let unapproved = Address::generate(&env);

        let whitelist_id = env.register(PilotWhitelist, ());
        let whitelist = PilotWhitelistClient::new(&env, &whitelist_id);
        whitelist.initialize(&whitelist_admin);

        let token_id = env.register(PilotIncomeToken, ());
        let token = PilotIncomeTokenClient::new(&env, &token_id);
        token.initialize(
            &admin,
            &whitelist_id,
            &String::from_str(&env, "Akkuea Pilot Income"),
            &String::from_str(&env, "AKIN"),
            &7,
        );

        Setup {
            env,
            admin,
            whitelist_admin,
            holder_one,
            holder_two,
            unapproved,
            whitelist,
            token,
            token_id,
        }
    }

    fn approve_default_holders(s: &Setup) {
        s.whitelist.approve(&s.whitelist_admin, &s.holder_one);
        s.whitelist.approve(&s.whitelist_admin, &s.holder_two);
    }

    #[test]
    fn initialize_sets_metadata() {
        let s = setup();

        assert_eq!(
            s.token.name(),
            String::from_str(&s.env, "Akkuea Pilot Income")
        );
        assert_eq!(s.token.symbol(), String::from_str(&s.env, "AKIN"));
        assert_eq!(s.token.decimals(), 7);
        assert_eq!(s.token.total_supply(), 0);
        assert_eq!(s.token.admin(), s.admin);
    }

    #[test]
    fn mint_fixed_supply_to_approved_holders_once() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);

        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        assert_eq!(s.token.balance(&s.holder_one), 700);
        assert_eq!(s.token.balance(&s.holder_two), 300);
        assert_eq!(s.token.total_supply(), 1000);
        assert_eq!(s.token.holders().len(), 2);
    }

    #[test]
    fn mint_rejects_unapproved_holder() {
        let s = setup();
        s.env.mock_all_auths();
        s.whitelist.approve(&s.whitelist_admin, &s.holder_one);

        let res = s.token.try_mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.unapproved.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::HolderNotApproved as u32
            )))
        );
    }

    #[test]
    fn mint_rejects_zero_amount() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);

        let res = s.token.try_mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 0i128],
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::InvalidAmount as u32
            )))
        );
    }

    #[test]
    fn mint_rejects_mismatched_vectors() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);

        let res = s.token.try_mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128],
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::HolderAmountLengthMismatch as u32
            )))
        );
    }

    #[test]
    fn mint_rejects_second_call() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);

        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        let res = s.token.try_mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone()],
            &vec![&s.env, 1000i128],
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::AlreadyMinted as u32
            )))
        );
    }

    #[test]
    fn non_admin_transfer_is_rejected() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);
        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        let res = s
            .token
            .try_transfer(&s.holder_one, &s.holder_one, &s.holder_two, &100);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::Unauthorized as u32
            )))
        );
    }

    #[test]
    fn admin_transfer_can_correct_balances() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);
        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        s.token
            .transfer(&s.admin, &s.holder_one, &s.holder_two, &200);

        assert_eq!(s.token.balance(&s.holder_one), 500);
        assert_eq!(s.token.balance(&s.holder_two), 500);
    }

    #[test]
    fn admin_transfer_rejects_unapproved_recipient() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);
        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        let res = s
            .token
            .try_transfer(&s.admin, &s.holder_one, &s.unapproved, &100);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::HolderNotApproved as u32
            )))
        );
    }

    /// Generate and approve `count` fresh holder addresses.
    fn approved_addresses(s: &Setup, count: u32) -> Vec<Address> {
        let mut addresses = Vec::new(&s.env);
        for _ in 0..count {
            let address = Address::generate(&s.env);
            s.whitelist.approve(&s.whitelist_admin, &address);
            addresses.push_back(address);
        }
        addresses
    }

    fn mint_ten_holders(s: &Setup) -> Vec<Address> {
        let holders = approved_addresses(s, MAX_HOLDERS);
        let mut amounts = Vec::new(&s.env);
        for _ in 0..MAX_HOLDERS {
            amounts.push_back(100i128);
        }
        s.token.mint_fixed_supply(&s.admin, &holders, &amounts);
        holders
    }

    #[test]
    fn transfer_of_the_full_balance_removes_the_sender_from_holders() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);
        let replacement = approved_addresses(&s, 1).get(0).unwrap();
        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        s.token
            .transfer(&s.admin, &s.holder_one, &replacement, &700);

        assert_eq!(s.token.balance(&s.holder_one), 0);
        assert_eq!(s.token.balance(&replacement), 700);
        assert_eq!(
            s.token.holders(),
            vec![&s.env, s.holder_two.clone(), replacement]
        );
    }

    #[test]
    fn partial_transfer_keeps_the_sender_in_holders() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);
        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        s.token
            .transfer(&s.admin, &s.holder_one, &s.holder_two, &699);

        assert_eq!(
            s.token.holders(),
            vec![&s.env, s.holder_one.clone(), s.holder_two.clone()]
        );
    }

    #[test]
    fn mint_rejects_more_than_max_holders() {
        let s = setup();
        s.env.mock_all_auths();
        let holders = approved_addresses(&s, MAX_HOLDERS + 1);
        let mut amounts = Vec::new(&s.env);
        for _ in 0..holders.len() {
            amounts.push_back(100i128);
        }

        let res = s.token.try_mint_fixed_supply(&s.admin, &holders, &amounts);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::TooManyHolders as u32
            )))
        );
        assert_eq!(s.token.total_supply(), 0);
        assert_eq!(s.token.holders().len(), 0);
    }

    #[test]
    fn mint_counts_a_repeated_holder_once_against_the_cap() {
        let s = setup();
        s.env.mock_all_auths();
        let mut holders = approved_addresses(&s, MAX_HOLDERS);
        holders.push_back(holders.get(0).unwrap());
        let mut amounts = Vec::new(&s.env);
        for _ in 0..holders.len() {
            amounts.push_back(100i128);
        }

        s.token.mint_fixed_supply(&s.admin, &holders, &amounts);

        assert_eq!(s.token.holders().len(), MAX_HOLDERS);
        assert_eq!(s.token.balance(&holders.get(0).unwrap()), 200);
    }

    #[test]
    fn transfer_that_would_add_an_eleventh_holder_is_rejected() {
        let s = setup();
        s.env.mock_all_auths();
        let holders = mint_ten_holders(&s);
        let newcomer = approved_addresses(&s, 1).get(0).unwrap();
        let sender = holders.get(0).unwrap();

        let res = s.token.try_transfer(&s.admin, &sender, &newcomer, &40);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::TooManyHolders as u32
            )))
        );
        assert_eq!(s.token.balance(&sender), 100);
        assert_eq!(s.token.balance(&newcomer), 0);
        assert_eq!(s.token.holders(), holders);
    }

    #[test]
    fn full_balance_transfer_to_a_new_address_keeps_ten_holders() {
        let s = setup();
        s.env.mock_all_auths();
        let holders = mint_ten_holders(&s);
        let newcomer = approved_addresses(&s, 1).get(0).unwrap();
        let sender = holders.get(0).unwrap();

        s.token.transfer(&s.admin, &sender, &newcomer, &100);

        let after = s.token.holders();
        assert_eq!(after.len(), MAX_HOLDERS);
        assert!(!after.contains(&sender));
        assert!(after.contains(&newcomer));
    }

    #[test]
    fn wound_down_status_is_none_by_default() {
        let s = setup();
        assert_eq!(s.token.wound_down_status(), None);
    }

    #[test]
    fn admin_marks_wound_down_records_reason_and_timestamp() {
        let s = setup();
        s.env.mock_all_auths();

        let reason = String::from_str(&s.env, "ally ceased operations");
        s.token.mark_wound_down(&s.admin, &reason);

        let status = s
            .token
            .wound_down_status()
            .expect("wound-down must be recorded");
        assert_eq!(status.reason, reason);
        assert_eq!(status.at, s.env.ledger().timestamp());
    }

    #[test]
    fn non_admin_cannot_mark_wound_down() {
        let s = setup();
        s.env.mock_all_auths();

        let res = s
            .token
            .try_mark_wound_down(&s.holder_one, &String::from_str(&s.env, "rogue wind-down"));

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::Unauthorized as u32
            )))
        );
        assert_eq!(s.token.wound_down_status(), None);
    }

    #[test]
    fn mark_wound_down_is_one_way() {
        let s = setup();
        s.env.mock_all_auths();

        s.token.mark_wound_down(
            &s.admin,
            &String::from_str(&s.env, "ally ceased operations"),
        );

        let res = s
            .token
            .try_mark_wound_down(&s.admin, &String::from_str(&s.env, "changed mind"));

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::AlreadyWoundDown as u32
            )))
        );

        // The original record is untouched.
        let status = s.token.wound_down_status().unwrap();
        assert_eq!(
            status.reason,
            String::from_str(&s.env, "ally ceased operations")
        );
    }

    #[test]
    fn mark_wound_down_with_empty_reason_is_rejected() {
        let s = setup();
        s.env.mock_all_auths();

        let res = s
            .token
            .try_mark_wound_down(&s.admin, &String::from_str(&s.env, ""));

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::MissingWoundDownReason as u32
            )))
        );
        assert_eq!(s.token.wound_down_status(), None);
    }

    #[test]
    fn contract_types_round_trip_through_xdr_scval() {
        let s = setup();
        s.env.mock_all_auths();
        let reason = String::from_str(&s.env, "ally ceased operations");
        s.token.mark_wound_down(&s.admin, &reason);
        let record = s
            .token
            .wound_down_status()
            .expect("wound-down must be recorded");

        // The `contracttype` derive implements the ScVal (XDR) encoding that
        // off-chain clients and `stellar contract invoke` use. Verify the new
        // types round-trip through it, in both directions.
        let scval: ScVal = (&record)
            .try_into()
            .expect("wound-down record must encode to ScVal");
        assert!(matches!(scval, ScVal::Map(Some(_))));
        let decoded: WoundDownRecord =
            TryFromVal::try_from_val(&s.env, &scval).expect("wound-down record must decode");
        assert_eq!(decoded, record);

        let event = events::WoundDownRecordedEvent {
            admin: s.admin.clone(),
            reason,
            at: record.at,
        };
        let event_scval: ScVal = (&event)
            .try_into()
            .expect("wound-down event must encode to ScVal");
        assert!(matches!(event_scval, ScVal::Map(Some(_))));
        let decoded_event: events::WoundDownRecordedEvent =
            TryFromVal::try_from_val(&s.env, &event_scval).expect("wound-down event must decode");
        assert_eq!(decoded_event, event);
    }

    // --- Typed error coverage ---

    #[test]
    fn uninitialized_contract_reports_not_initialized() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let id = env.register(PilotIncomeToken, ());
        let token = PilotIncomeTokenClient::new(&env, &id);

        // Read paths: the metadata entries have nothing stored to return yet.
        assert_eq!(
            token.try_name(),
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::NotInitialized as u32
            )))
        );
        assert_eq!(
            token.try_symbol(),
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::NotInitialized as u32
            )))
        );
        assert_eq!(
            token.try_decimals(),
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::NotInitialized as u32
            )))
        );
        assert_eq!(
            token.try_admin(),
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::NotInitialized as u32
            )))
        );

        // State-changing path: `require_admin` resolves the stored admin before
        // it can compare it, so an uninitialized contract reports
        // NotInitialized rather than Unauthorized and stays paused-free.
        assert_eq!(
            token.try_pause(&admin),
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::NotInitialized as u32
            )))
        );
        assert!(!token.is_paused());

        // The remaining NotInitialized sites are defensive: `initialize`
        // writes the admin and the whitelist address in the same call, and
        // `transfer_admin_accept` can only reach its admin lookup with a
        // pending admin stored, so neither can be reached with only one of the
        // two addresses present.
    }

    #[test]
    fn mint_rejects_empty_holder_set() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);

        let res = s
            .token
            .try_mint_fixed_supply(&s.admin, &Vec::new(&s.env), &Vec::new(&s.env));

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::EmptyHolderSet as u32
            )))
        );
        assert_eq!(s.token.total_supply(), 0);
        assert_eq!(s.token.holders().len(), 0);
    }

    #[test]
    fn mint_rejects_holder_balance_overflow() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);

        // The same holder may appear twice in one call and each occurrence is
        // credited in turn, so i128::MAX followed by 1 trips the per-holder
        // guard even though the second amount is representable on its own.
        let res = s.token.try_mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_one.clone()],
            &vec![&s.env, i128::MAX, 1i128],
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::BalanceOverflow as u32
            )))
        );
        // The rejected mint is atomic: no supply or holder was written.
        assert_eq!(s.token.total_supply(), 0);
        assert_eq!(s.token.holders().len(), 0);
    }

    #[test]
    fn mint_rejects_supply_overflow() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);

        // Minting accumulates the running total from zero and adds each
        // approved amount, so the total is what overflows here, not any single
        // holder's amount: i128::MAX + 1 exceeds the supply boundary while each
        // individual balance stays representable.
        let res = s.token.try_mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, i128::MAX, 1i128],
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::SupplyOverflow as u32
            )))
        );
        // The rejected mint is atomic: no supply or holder was written.
        assert_eq!(s.token.total_supply(), 0);
        assert_eq!(s.token.holders().len(), 0);
    }

    #[test]
    fn transfer_above_the_sender_balance_is_rejected() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);
        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        let res = s
            .token
            .try_transfer(&s.admin, &s.holder_one, &s.holder_two, &701);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::InsufficientBalance as u32
            )))
        );
        assert_eq!(s.token.balance(&s.holder_one), 700);
        assert_eq!(s.token.balance(&s.holder_two), 300);
        assert_eq!(s.token.total_supply(), 1000);
    }

    #[test]
    fn transfer_of_the_full_sender_balance_is_allowed() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);
        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        s.token
            .transfer(&s.admin, &s.holder_one, &s.holder_two, &700);

        assert_eq!(s.token.balance(&s.holder_one), 0);
        assert_eq!(s.token.balance(&s.holder_two), 1000);
    }

    #[test]
    fn transfer_from_an_address_without_balance_is_rejected() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);
        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone()],
            &vec![&s.env, 700i128],
        );

        let res = s
            .token
            .try_transfer(&s.admin, &s.holder_two, &s.holder_one, &1);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::InsufficientBalance as u32
            )))
        );
        assert_eq!(s.token.balance(&s.holder_two), 0);
        assert_eq!(s.token.balance(&s.holder_one), 700);
    }

    #[test]
    fn self_transfer_is_rejected() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);
        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        let res = s
            .token
            .try_transfer(&s.admin, &s.holder_one, &s.holder_one, &100);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::SelfTransfer as u32
            )))
        );
        assert_eq!(s.token.balance(&s.holder_one), 700);
        assert_eq!(s.token.total_supply(), 1000);
    }

    #[test]
    fn transfer_that_overflows_the_recipient_balance_is_rejected() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);
        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        // A mint can never leave a balance at the i128 boundary, so the
        // recipient side is pinned there through the contract's own storage.
        s.env.as_contract(&s.token_id, || {
            Storage::set_balance(&s.env, &s.holder_two, i128::MAX)
        });

        let res = s
            .token
            .try_transfer(&s.admin, &s.holder_one, &s.holder_two, &1);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::BalanceOverflow as u32
            )))
        );
        assert_eq!(s.token.balance(&s.holder_one), 700);
    }

    // --- Two-step admin transfer ---

    #[test]
    fn admin_transfer_happy_path() {
        let s = setup();
        s.env.mock_all_auths();
        let new_admin = Address::generate(&s.env);

        s.token.transfer_admin_start(&s.admin, &new_admin);
        assert_eq!(s.token.pending_admin(), Some(new_admin.clone()));
        assert_eq!(s.token.admin(), s.admin);

        s.token.transfer_admin_accept(&new_admin);

        assert_eq!(s.token.admin(), new_admin);
        assert_eq!(s.token.pending_admin(), None);
    }

    #[test]
    fn admin_transfer_cancel_before_accept() {
        let s = setup();
        s.env.mock_all_auths();
        let new_admin = Address::generate(&s.env);

        s.token.transfer_admin_start(&s.admin, &new_admin);
        s.token.transfer_admin_cancel(&s.admin);

        assert_eq!(s.token.pending_admin(), None);

        let res = s.token.try_transfer_admin_accept(&new_admin);
        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::NotPendingAdmin as u32
            )))
        );
        assert_eq!(s.token.admin(), s.admin);
    }

    #[test]
    fn admin_transfer_accept_by_wrong_address_fails() {
        let s = setup();
        s.env.mock_all_auths();
        let new_admin = Address::generate(&s.env);

        s.token.transfer_admin_start(&s.admin, &new_admin);

        let res = s.token.try_transfer_admin_accept(&s.holder_one);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::NotPendingAdmin as u32
            )))
        );
        assert_eq!(s.token.admin(), s.admin);
    }

    #[test]
    fn admin_transfer_start_by_non_admin_fails() {
        let s = setup();
        s.env.mock_all_auths();
        let new_admin = Address::generate(&s.env);

        let res = s.token.try_transfer_admin_start(&s.holder_one, &new_admin);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::Unauthorized as u32
            )))
        );
        assert_eq!(s.token.pending_admin(), None);
    }

    #[test]
    fn old_admin_loses_all_privileges_after_accept() {
        let s = setup();
        s.env.mock_all_auths();
        let new_admin = Address::generate(&s.env);

        s.token.transfer_admin_start(&s.admin, &new_admin);
        s.token.transfer_admin_accept(&new_admin);

        let res = s.token.try_mark_wound_down(
            &s.admin,
            &String::from_str(&s.env, "old admin trying to act"),
        );
        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::Unauthorized as u32
            )))
        );

        // The new admin can act.
        s.token
            .mark_wound_down(&new_admin, &String::from_str(&s.env, "new admin acts"));
        assert!(s.token.wound_down_status().is_some());
    }

    // --- Pause parity ---

    #[test]
    fn pause_blocks_state_changing_calls() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);

        s.token.pause(&s.admin);
        assert!(s.token.is_paused());

        let mint_res = s.token.try_mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone()],
            &vec![&s.env, 100i128],
        );
        assert_eq!(
            mint_res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::ContractPaused as u32
            )))
        );

        let transfer_res = s
            .token
            .try_transfer(&s.admin, &s.holder_one, &s.holder_two, &10);
        assert_eq!(
            transfer_res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::ContractPaused as u32
            )))
        );

        let wound_down_res = s
            .token
            .try_mark_wound_down(&s.admin, &String::from_str(&s.env, "reason"));
        assert_eq!(
            wound_down_res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::ContractPaused as u32
            )))
        );
    }

    #[test]
    fn read_only_calls_work_while_paused() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);
        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        s.token.pause(&s.admin);

        assert_eq!(s.token.balance(&s.holder_one), 700);
        assert_eq!(s.token.total_supply(), 1000);
        assert_eq!(s.token.holders().len(), 2);
        assert_eq!(s.token.admin(), s.admin);
        assert_eq!(
            s.token.name(),
            String::from_str(&s.env, "Akkuea Pilot Income")
        );
    }

    #[test]
    fn unpause_restores_state_changing_calls() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);

        s.token.pause(&s.admin);
        s.token.unpause(&s.admin);
        assert!(!s.token.is_paused());

        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone()],
            &vec![&s.env, 100i128],
        );
        assert_eq!(s.token.balance(&s.holder_one), 100);
    }

    #[test]
    fn non_admin_cannot_pause_or_unpause() {
        let s = setup();
        s.env.mock_all_auths();

        let res = s.token.try_pause(&s.holder_one);
        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::Unauthorized as u32
            )))
        );
    }

    #[test]
    fn admin_transfer_still_works_while_paused() {
        let s = setup();
        s.env.mock_all_auths();
        let new_admin = Address::generate(&s.env);

        s.token.pause(&s.admin);
        s.token.transfer_admin_start(&s.admin, &new_admin);
        s.token.transfer_admin_accept(&new_admin);

        assert_eq!(s.token.admin(), new_admin);
    }

    #[test]
    fn state_changing_entry_points_extend_ttls() {
        use crate::ttl::TTL_EXTEND_TO;
        use soroban_sdk::testutils::storage::{Instance as _, Persistent as _};
        use soroban_sdk::testutils::Ledger as _;

        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);
        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 100i128, 200i128],
        );

        // Leave ~110k ledgers of TTL on the balance entry: still live, but
        // below the refresh threshold.
        s.env
            .ledger()
            .with_mut(|ledger| ledger.sequence_number += 3_000_000);

        // A normal state-changing call must refresh the instance, and the read
        // of the holder balance must refresh that persistent entry.
        s.token.pause(&s.admin);
        let _ = s.token.balance(&s.holder_one);

        let balance_ttl = s.env.as_contract(&s.token_id, || {
            s.env
                .storage()
                .persistent()
                .get_ttl(&DataKey::Balance(s.holder_one.clone()))
        });
        let instance_ttl = s
            .env
            .as_contract(&s.token_id, || s.env.storage().instance().get_ttl());

        assert_eq!(balance_ttl, TTL_EXTEND_TO);
        assert_eq!(instance_ttl, TTL_EXTEND_TO);
    }
}

#[cfg(test)]
mod proptests;
