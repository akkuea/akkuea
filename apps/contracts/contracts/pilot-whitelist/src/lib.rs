#![no_std]
#![allow(linker_messages)]

use soroban_sdk::{contract, contractimpl, panic_with_error, Address, Env};

mod errors;
mod events;
mod storage;

pub use errors::WhitelistError;
use storage::{DataKey, Storage};

#[contract]
pub struct PilotWhitelist;

#[contractimpl]
impl PilotWhitelist {
    /// Initialize the whitelist with the admin address that can approve and revoke investors.
    pub fn initialize(env: Env, admin: Address) {
        if Storage::is_initialized(&env) {
            panic_with_error!(&env, WhitelistError::AlreadyInitialized);
        }

        Storage::set_admin(&env, &admin);
        events::emit_initialized(&env, admin);
    }

    /// Approve an investor address for pilot participation.
    pub fn approve(env: Env, admin: Address, address: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        Self::require_not_paused(&env);

        env.storage()
            .persistent()
            .set(&DataKey::Approved(address.clone()), &true);
        events::emit_approved(&env, admin, address);
    }

    /// Revoke an investor address from pilot participation.
    pub fn revoke(env: Env, admin: Address, address: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);
        Self::require_not_paused(&env);

        env.storage()
            .persistent()
            .set(&DataKey::Approved(address.clone()), &false);
        events::emit_revoked(&env, admin, address);
    }

    /// Return whether an address is approved for pilot participation.
    /// Read-only: keeps working while the contract is paused.
    pub fn is_approved(env: Env, address: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Approved(address))
            .unwrap_or(false)
    }

    /// Return the configured whitelist admin.
    pub fn admin(env: Env) -> Address {
        Storage::admin(&env)
            .unwrap_or_else(|| panic_with_error!(&env, WhitelistError::NotInitialized))
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
            panic_with_error!(&env, WhitelistError::NotPendingAdmin);
        }

        let old_admin = Storage::admin(&env)
            .unwrap_or_else(|| panic_with_error!(&env, WhitelistError::NotInitialized));

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

    /// Pause `approve` and `revoke`. Read-only calls keep working.
    ///
    /// Mirrors `pilot-payout-split`'s `pause`. Before this change, a wrongful
    /// approval or revocation had no on-chain circuit breaker.
    pub fn pause(env: Env, admin: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);

        Storage::set_paused(&env, true);
        events::emit_paused(&env, admin);
    }

    /// Resume `approve` and `revoke`.
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
            .unwrap_or_else(|| panic_with_error!(env, WhitelistError::NotInitialized));
        if admin != caller.clone() {
            panic_with_error!(env, WhitelistError::Unauthorized);
        }
    }

    fn require_not_paused(env: &Env) {
        if Storage::is_paused(env) {
            panic_with_error!(env, WhitelistError::ContractPaused);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Error};

    fn setup() -> (Env, Address, Address, PilotWhitelistClient<'static>) {
        let env = Env::default();
        let admin = Address::generate(&env);
        let investor = Address::generate(&env);
        let id = env.register(PilotWhitelist, ());
        let client = PilotWhitelistClient::new(&env, &id);
        (env, admin, investor, client)
    }

    #[test]
    fn initialize_sets_admin() {
        let (_, admin, _, client) = setup();

        client.initialize(&admin);

        assert_eq!(client.admin(), admin);
    }

    #[test]
    fn approve_and_revoke_update_public_status() {
        let (env, admin, investor, client) = setup();
        env.mock_all_auths();
        client.initialize(&admin);

        client.approve(&admin, &investor);
        assert!(client.is_approved(&investor));

        client.revoke(&admin, &investor);
        assert!(!client.is_approved(&investor));
    }

    #[test]
    fn unapproved_address_defaults_to_false() {
        let (_, admin, investor, client) = setup();
        client.initialize(&admin);

        assert!(!client.is_approved(&investor));
    }

    #[test]
    fn initialize_twice_fails() {
        let (_, admin, _, client) = setup();
        client.initialize(&admin);

        let res = client.try_initialize(&admin);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                WhitelistError::AlreadyInitialized as u32
            )))
        );
    }

    #[test]
    fn non_admin_cannot_approve() {
        let (env, admin, investor, client) = setup();
        env.mock_all_auths();
        client.initialize(&admin);
        let attacker = Address::generate(&env);

        let res = client.try_approve(&attacker, &investor);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                WhitelistError::Unauthorized as u32
            )))
        );
    }

    #[test]
    fn non_admin_cannot_revoke() {
        let (env, admin, investor, client) = setup();
        env.mock_all_auths();
        client.initialize(&admin);
        client.approve(&admin, &investor);
        let attacker = Address::generate(&env);

        let res = client.try_revoke(&attacker, &investor);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                WhitelistError::Unauthorized as u32
            )))
        );
    }

    // --- Two-step admin transfer ---

    #[test]
    fn admin_transfer_happy_path() {
        let (env, admin, _, client) = setup();
        env.mock_all_auths();
        client.initialize(&admin);
        let new_admin = Address::generate(&env);

        client.transfer_admin_start(&admin, &new_admin);
        assert_eq!(client.pending_admin(), Some(new_admin.clone()));
        assert_eq!(client.admin(), admin);

        client.transfer_admin_accept(&new_admin);

        assert_eq!(client.admin(), new_admin);
        assert_eq!(client.pending_admin(), None);
    }

    #[test]
    fn admin_transfer_cancel_before_accept() {
        let (env, admin, _, client) = setup();
        env.mock_all_auths();
        client.initialize(&admin);
        let new_admin = Address::generate(&env);

        client.transfer_admin_start(&admin, &new_admin);
        client.transfer_admin_cancel(&admin);

        assert_eq!(client.pending_admin(), None);

        let res = client.try_transfer_admin_accept(&new_admin);
        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                WhitelistError::NotPendingAdmin as u32
            )))
        );
        assert_eq!(client.admin(), admin);
    }

    #[test]
    fn admin_transfer_accept_by_wrong_address_fails() {
        let (env, admin, investor, client) = setup();
        env.mock_all_auths();
        client.initialize(&admin);
        let new_admin = Address::generate(&env);

        client.transfer_admin_start(&admin, &new_admin);

        let res = client.try_transfer_admin_accept(&investor);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                WhitelistError::NotPendingAdmin as u32
            )))
        );
        assert_eq!(client.admin(), admin);
    }

    #[test]
    fn admin_transfer_start_by_non_admin_fails() {
        let (env, admin, _, client) = setup();
        env.mock_all_auths();
        client.initialize(&admin);
        let attacker = Address::generate(&env);
        let new_admin = Address::generate(&env);

        let res = client.try_transfer_admin_start(&attacker, &new_admin);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                WhitelistError::Unauthorized as u32
            )))
        );
        assert_eq!(client.pending_admin(), None);
    }

    #[test]
    fn old_admin_loses_all_privileges_after_accept() {
        let (env, admin, investor, client) = setup();
        env.mock_all_auths();
        client.initialize(&admin);
        let new_admin = Address::generate(&env);

        client.transfer_admin_start(&admin, &new_admin);
        client.transfer_admin_accept(&new_admin);

        let res = client.try_approve(&admin, &investor);
        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                WhitelistError::Unauthorized as u32
            )))
        );

        // The new admin can act.
        client.approve(&new_admin, &investor);
        assert!(client.is_approved(&investor));
    }

    // --- Pause parity ---

    #[test]
    fn pause_blocks_approve_and_revoke() {
        let (env, admin, investor, client) = setup();
        env.mock_all_auths();
        client.initialize(&admin);

        client.pause(&admin);
        assert!(client.is_paused());

        let approve_res = client.try_approve(&admin, &investor);
        assert_eq!(
            approve_res,
            Err(Ok(Error::from_contract_error(
                WhitelistError::ContractPaused as u32
            )))
        );

        let revoke_res = client.try_revoke(&admin, &investor);
        assert_eq!(
            revoke_res,
            Err(Ok(Error::from_contract_error(
                WhitelistError::ContractPaused as u32
            )))
        );
    }

    #[test]
    fn read_only_calls_work_while_paused() {
        let (env, admin, investor, client) = setup();
        env.mock_all_auths();
        client.initialize(&admin);
        client.approve(&admin, &investor);

        client.pause(&admin);

        assert!(client.is_approved(&investor));
        assert_eq!(client.admin(), admin);
    }

    #[test]
    fn unpause_restores_approve_and_revoke() {
        let (env, admin, investor, client) = setup();
        env.mock_all_auths();
        client.initialize(&admin);

        client.pause(&admin);
        client.unpause(&admin);
        assert!(!client.is_paused());

        client.approve(&admin, &investor);
        assert!(client.is_approved(&investor));
    }

    #[test]
    fn non_admin_cannot_pause_or_unpause() {
        let (env, admin, _, client) = setup();
        env.mock_all_auths();
        client.initialize(&admin);
        let attacker = Address::generate(&env);

        let res = client.try_pause(&attacker);
        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                WhitelistError::Unauthorized as u32
            )))
        );
    }

    #[test]
    fn admin_transfer_still_works_while_paused() {
        let (env, admin, _, client) = setup();
        env.mock_all_auths();
        client.initialize(&admin);
        let new_admin = Address::generate(&env);

        client.pause(&admin);
        client.transfer_admin_start(&admin, &new_admin);
        client.transfer_admin_accept(&new_admin);

        assert_eq!(client.admin(), new_admin);
    }
}
