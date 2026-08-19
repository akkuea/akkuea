use soroban_sdk::{contracttype, Address, Env, String};

use crate::EvidenceRecord;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    Operator,
    Ally,
    PlatformFeeRecipient,
    IncomeToken,
    Whitelist,
    UsdcToken,
    Paused,
    Guard,
    Evidence(String),
}

pub struct Storage;

impl Storage {
    pub fn is_initialized(env: &Env) -> bool {
        env.storage().instance().has(&DataKey::Admin)
    }

    pub fn set_address(env: &Env, key: &DataKey, address: &Address) {
        env.storage().instance().set(key, address);
    }

    pub fn address(env: &Env, key: &DataKey) -> Option<Address> {
        env.storage().instance().get(key)
    }

    pub fn is_paused(env: &Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    pub fn evidence(env: &Env, cycle_id: &String) -> Option<EvidenceRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::Evidence(cycle_id.clone()))
    }

    pub fn set_evidence(env: &Env, cycle_id: &String, record: &EvidenceRecord) {
        env.storage()
            .persistent()
            .set(&DataKey::Evidence(cycle_id.clone()), record);
    }
}
