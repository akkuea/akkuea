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

        env.storage()
            .persistent()
            .set(&DataKey::Approved(address.clone()), &true);
        events::emit_approved(&env, admin, address);
    }

    /// Revoke an investor address from pilot participation.
    pub fn revoke(env: Env, admin: Address, address: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);

        env.storage()
            .persistent()
            .set(&DataKey::Approved(address.clone()), &false);
        events::emit_revoked(&env, admin, address);
    }

    /// Return whether an address is approved for pilot participation.
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

    fn require_admin(env: &Env, caller: &Address) {
        let admin = Storage::admin(env)
            .unwrap_or_else(|| panic_with_error!(env, WhitelistError::NotInitialized));
        if admin != caller.clone() {
            panic_with_error!(env, WhitelistError::Unauthorized);
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
}
