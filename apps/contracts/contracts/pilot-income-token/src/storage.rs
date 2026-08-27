use soroban_sdk::{contracttype, Address, Env, Vec};

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
}

pub struct Storage;

impl Storage {
    pub fn is_initialized(env: &Env) -> bool {
        env.storage().instance().has(&DataKey::Admin)
    }

    pub fn set_admin(env: &Env, admin: &Address) {
        env.storage().instance().set(&DataKey::Admin, admin);
    }

    pub fn admin(env: &Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }

    pub fn set_whitelist(env: &Env, whitelist: &Address) {
        env.storage().instance().set(&DataKey::Whitelist, whitelist);
    }

    pub fn whitelist(env: &Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Whitelist)
    }

    pub fn balance(env: &Env, owner: &Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(owner.clone()))
            .unwrap_or(0)
    }

    pub fn set_balance(env: &Env, owner: &Address, amount: i128) {
        env.storage()
            .persistent()
            .set(&DataKey::Balance(owner.clone()), &amount);
    }

    pub fn total_supply(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn set_total_supply(env: &Env, amount: i128) {
        env.storage().instance().set(&DataKey::TotalSupply, &amount);
    }

    pub fn holders(env: &Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Holders)
            .unwrap_or_else(|| Vec::new(env))
    }

    pub fn set_holders(env: &Env, holders: &Vec<Address>) {
        env.storage().instance().set(&DataKey::Holders, holders);
    }

    pub fn has_minted(env: &Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Minted)
            .unwrap_or(false)
    }

    pub fn set_minted(env: &Env) {
        env.storage().instance().set(&DataKey::Minted, &true);
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
    }
}
