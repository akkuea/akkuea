use soroban_sdk::{contracttype, Address, Env, Vec};

use crate::ttl::{
    extend_instance as extend_instance_ttl, extend_persistent as extend_persistent_ttl,
};
use crate::WoundDownRecord;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Whitelist,
    Name,
    Symbol,
    Decimals,
    TotalSupply,
    Balance(Address),
    Holders,
    Minted,
    WoundDown,
    PendingAdmin,
    Paused,
}

pub struct Storage;

impl Storage {
    pub fn is_initialized(env: &Env) -> bool {
        env.storage().instance().has(&DataKey::Admin)
    }

    pub fn set_admin(env: &Env, admin: &Address) {
        env.storage().instance().set(&DataKey::Admin, admin);
        extend_instance_ttl(env);
    }

    pub fn admin(env: &Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }

    pub fn set_whitelist(env: &Env, whitelist: &Address) {
        env.storage().instance().set(&DataKey::Whitelist, whitelist);
        extend_instance_ttl(env);
    }

    pub fn whitelist(env: &Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Whitelist)
    }

    pub fn balance(env: &Env, owner: &Address) -> i128 {
        let key = DataKey::Balance(owner.clone());
        let amount = env.storage().persistent().get(&key).unwrap_or(0);
        // Only extend entries that exist: extending a missing key fails.
        if env.storage().persistent().has(&key) {
            extend_persistent_ttl(env, 'key);
        }
        amount
    }

    pub fn set_balance(env: &Env, owner: &Address, amount: i128) {
        let key = DataKey::Balance(owner.clone());
        env.storage().persistent().set(&key, &amount);
        extend_persistent_ttl(env, &key);
    }

    pub fn total_supply(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn set_total_supply(env: &Env, amount: i128) {
        env.storage().instance().set(&DataKey::TotalSupply, &amount);
        extend_instance_ttl(env);
    }

    pub fn holders(env: &Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Holders)
            .unwrap_or_else(|| Vec::new(env))
    }

    pub fn set_holders(env: &Env, holders: &Vec<Address>) {
        env.storage().instance().set(&DataKey::Holders, holders);
        extend_instance_ttl(env);
    }

    pub fn has_minted(env: &Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Minted)
            .unwrap_or(false)
    }

    pub fn set_minted(env: &Env) {
        env.storage().instance().set(&DataKey::Minted, &true);
        extend_instance_ttl(env);
    }

    /// The terminal wound-down record, if the pilot has been permanently ended
    /// via `mark_wound_down`. Absence means the pilot is still active. Stored in
    /// instance storage: a single contract-wide fact, set once and never
    /// removed, readable without any cross-contract call.
    pub fn wound_down_record(env: &Env) -> Option<WoundDownRecord> {
        env.storage().instance().get(&DataKey::WoundDown)
    }

    pub fn set_wound_down_record(env: &Env, record: &WoundDownRecord) {
        env.storage().instance().set(&DataKey::WoundDown, record);
        extend_instance_ttl(env);
    }

    /// The address named by the current admin as the next admin, if a
    /// transfer is in progress. Cleared on accept or cancel.
    pub fn pending_admin(env: &Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::PendingAdmin)
    }

    pub fn set_pending_admin(env: &Env, pending: &Address) {
        env.storage()
            .instance()
            .set(&DataKey::PendingAdmin, pending);
        extend_instance_ttl(env);
    }

    pub fn clear_pending_admin(env: &Env) {
        env.storage().instance().remove(&DataKey::PendingAdmin);
        extend_instance_ttl(env);
    }

    pub fn is_paused(env: &Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    pub fn set_paused(env: &Env, paused: bool) {
        env.storage().instance().set(&DataKey::Paused, &paused);
        extend_instance_ttl(env);
    }
}
