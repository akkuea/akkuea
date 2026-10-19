use soroban_sdk::{contracttype, panic_with_error, Address, Env, String, Vec};

use crate::ttl::{extend_instance, extend_persistent};
use crate::{Currency, EvidenceRecord, ExitRecord, PayoutError, SwapFailureRecord};

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
    /// USDC reserved in this contract for a holder whose EURC swap leg failed
    /// and who has not yet claimed it.
    ///
    /// Kept separate from the cycle record because a holder's reserve is
    /// cumulative across cycles and must be releasable in one call. It is only
    /// written on a failed leg, so a normal distribution adds no ledger keys.
    WithheldBalance(Address),
    /// Sum of every outstanding `WithheldBalance`. Instance storage, so it
    /// costs no additional footprint entry and lets `execute_distribution`
    /// prove it never spends another holder's reserved funds.
    TotalWithheld,
    PendingAdmin,
}

pub struct Storage;

impl Storage {
    /// Extends the instance TTL. Called from every state-changing entry point
    /// so admin, config, pause flag and other instance entries never expire.
    pub fn extend_instance_ttl(env: &Env) {
        extend_instance(env);
    }

    /// Extends a persistent entry's TTL on a read path, only if the entry
    /// exists (extending a missing key fails).
    fn extend_if_present(env: &Env, key: &DataKey) {
        if env.storage().persistent().has(key) {
            extend_persistent(env, key);
        }
    }

    pub fn is_initialized(env: &Env) -> bool {
        env.storage().instance().has(&DataKey::Admin)
    }

    pub fn set_address(env: &Env, key: &DataKey, address: &Address) {
        env.storage().instance().set(key, address);
        Self::extend_instance_ttl(env);
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

    /// The durable per-cycle record. Alongside the evidence and review
    /// lifecycle it now also carries the cycle's distribution summary and each
    /// holder's settlement outcome, so those facts are readable after the RPC
    /// event retention window without introducing any new ledger keys.
    pub fn evidence(env: &Env, cycle_id: &String) -> Option<EvidenceRecord> {
        let key = DataKey::Evidence(cycle_id.clone());
        Self::extend_if_present(env, &key);
        env.storage().persistent().get(&key)
    }

    pub fn set_evidence(env: &Env, cycle_id: &String, record: &EvidenceRecord) {
        let key = DataKey::Evidence(cycle_id.clone());
        env.storage().persistent().set(&key, record);
        extend_persistent(env, &key);
    }

    /// Explicit settlement-currency preference of a single holder.
    /// Absence means USDC (the default), so existing holders are unaffected.
    pub fn currency_preference(env: &Env, holder: &Address) -> Option<Currency> {
        let key = DataKey::CurrencyPreference(holder.clone());
        Self::extend_if_present(env, &key);
        env.storage().persistent().get(&key)
    }

    pub fn set_currency_preference(env: &Env, holder: &Address, currency: &Currency) {
        let key = DataKey::CurrencyPreference(holder.clone());
        env.storage().persistent().set(&key, currency);
        extend_persistent(env, &key);
    }

    /// On-chain record of swap legs rejected during a cycle's distribution.
    /// Persisted so a rejected leg is auditable rather than silent.
    pub fn swap_failures(env: &Env, cycle_id: &String) -> Vec<SwapFailureRecord> {
        let key = DataKey::SwapFailures(cycle_id.clone());
        Self::extend_if_present(env, &key);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| Vec::new(env))
    }

    pub fn push_swap_failure(env: &Env, cycle_id: &String, record: &SwapFailureRecord) {
        let mut failures = Self::swap_failures(env, cycle_id);
        failures.push_back(record.clone());
        let key = DataKey::SwapFailures(cycle_id.clone());
        env.storage().persistent().set(&key, &failures);
        extend_persistent(env, &key);
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
        Self::extend_instance_ttl(env);
    }

    /// USDC currently reserved for a holder after a failed EURC swap leg.
    pub fn withheld_balance(env: &Env, holder: &Address) -> i128 {
        let key = DataKey::WithheldBalance(holder.clone());
        Self::extend_if_present(env, &key);
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    pub fn set_withheld_balance(env: &Env, holder: &Address, amount: i128) {
        let key = DataKey::WithheldBalance(holder.clone());
        env.storage().persistent().set(&key, &amount);
        extend_persistent(env, &key);
    }

    /// Adds a cycle's withheld share to a holder's reserved balance.
    pub fn add_withheld(env: &Env, holder: &Address, amount: i128) {
        let updated = Self::withheld_balance(env, holder)
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(env, PayoutError::ArithmeticOverflow));
        Self::set_withheld_balance(env, holder, updated);
    }

    /// Returns the holder's reserved balance and clears it in the same call,
    /// so a re-entrant or repeated claim can never release the same USDC twice.
    pub fn take_withheld(env: &Env, holder: &Address) -> i128 {
        let amount = Self::withheld_balance(env, holder);
        if amount > 0 {
            Self::set_withheld_balance(env, holder, 0);
        }
        amount
    }

    /// Sum of every outstanding holder reserve. Stored in instance storage so
    /// `execute_distribution` can read it without touching each holder.
    pub fn total_withheld(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalWithheld)
            .unwrap_or(0)
    }

    pub fn set_total_withheld(env: &Env, amount: i128) {
        env.storage()
            .instance()
            .set(&DataKey::TotalWithheld, &amount);
        Self::extend_instance_ttl(env);
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
        Self::extend_instance_ttl(env);
    }

    pub fn clear_pending_admin(env: &Env) {
        env.storage().instance().remove(&DataKey::PendingAdmin);
        Self::extend_instance_ttl(env);
    }
}
