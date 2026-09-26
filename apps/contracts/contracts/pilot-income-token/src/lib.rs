#![no_std]
#![allow(linker_messages)]

use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, panic_with_error, Address, Env, String,
    Vec,
};

mod errors;
mod events;
mod storage;

pub use errors::IncomeTokenError;
use storage::{DataKey, Storage};

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

    /// Return the fixed holder set used by payout distribution.
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
    }

    /// Cancel a pending admin transfer before it is accepted. Only the
    /// current admin can cancel.
    pub fn transfer_admin_cancel(env: Env, caller: Address) {
        caller.require_auth();
        Self::require_admin(&env, &caller);

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

        Storage::set_paused(&env, true);
        events::emit_paused(&env, admin);
    }

    /// Resume `mint_fixed_supply`, `transfer`, and `mark_wound_down`.
    pub fn unpause(env: Env, admin: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);

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
        let next_from = from_balance
            .checked_sub(amount)
            .unwrap_or_else(|| panic_with_error!(env, IncomeTokenError::InsufficientBalance));
        let to_balance = Storage::balance(env, &to);
        let next_to = to_balance
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(env, IncomeTokenError::BalanceOverflow));

        Storage::set_balance(env, &from, next_from);
        Storage::set_balance(env, &to, next_to);
        Self::upsert_holder(env, &to);
        events::emit_transfer(env, from, to, amount);
    }

    fn upsert_holder(env: &Env, holder: &Address) {
        let mut holders = Storage::holders(env);
        if !Self::contains_holder(&holders, holder) {
            holders.push_back(holder.clone());
            Storage::set_holders(env, &holders);
        }
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
}
