use soroban_sdk::{contracttype, Address, Env, String, Vec};

use crate::{Currency, EvidenceRecord, ExitRecord, SwapFailureRecord};

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
    EurcToken,
    SwapRouter,
    Paused,
    Guard,
    Evidence(String),
    CurrencyPreference(Address),
    SwapFailures(String),
    Exit,
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

    /// Explicit settlement-currency preference of a single holder.
    /// Absence means USDC (the default), so existing holders are unaffected.
    pub fn currency_preference(env: &Env, holder: &Address) -> Option<Currency> {
        env.storage()
            .persistent()
            .get(&DataKey::CurrencyPreference(holder.clone()))
    }

    pub fn set_currency_preference(env: &Env, holder: &Address, currency: &Currency) {
        env.storage()
            .persistent()
            .set(&DataKey::CurrencyPreference(holder.clone()), currency);
    }

    /// On-chain record of swap legs rejected during a cycle's distribution.
    /// Persisted so a rejected leg is auditable rather than silent.
    pub fn swap_failures(env: &Env, cycle_id: &String) -> Vec<SwapFailureRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::SwapFailures(cycle_id.clone()))
            .unwrap_or_else(|| Vec::new(env))
    }

    pub fn push_swap_failure(env: &Env, cycle_id: &String, record: &SwapFailureRecord) {
        let mut failures = Self::swap_failures(env, cycle_id);
        failures.push_back(record.clone());
        env.storage()
            .persistent()
            .set(&DataKey::SwapFailures(cycle_id.clone()), &failures);
    }

    /// The terminal exit record, if the ally/property relationship has been
    /// permanently ended via `exit`. Absence means the pilot is still active.
    /// Stored in instance storage because it is a single contract-wide fact,
    /// set exactly once and never removed.
    pub fn exit_record(env: &Env) -> Option<ExitRecord> {
        env.storage().instance().get(&DataKey::Exit)
    }

    pub fn set_exit_record(env: &Env, record: &ExitRecord) {
        env.storage().instance().set(&DataKey::Exit, record);
    }
}
