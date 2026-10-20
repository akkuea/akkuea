//! TTL policy for the payout-split pilot.
//!
//! The pilot reports on a monthly cycle, so entries must survive at least one
//! full reporting period plus a comfortable margin for late claims and audits.
//! Evidence records, currency preferences, rejected swap legs and withheld
//! balances are persistent entries; the contract instance carries the admin,
//! config and pause flag.
//!
//! This is the single TTL policy for this crate: the constants and helpers
//! below are the only place TTL values are defined, and `lib.rs` (entry points)
//! and `storage.rs` (persistent keys) both call them.
//!
//! At ~5 s per ledger there are 17_280 ledgers per day. An entry is refreshed
//! when its remaining TTL drops below ~30 days and is then extended to ~180
//! days, so no periodic "bump" transaction is needed as long as the contract is
//! exercised at least once every 150 days or so.

use soroban_sdk::{Env, IntoVal, Val};

/// ~5 s per ledger, so 17_280 ledgers per day.
const LEDGERS_PER_DAY: u32 = 17_280;

/// Minimum remaining TTL, in ledgers, before an entry is extended (~30 days).
pub const TTL_THRESHOLD: u32 = 30 * LEDGERS_PER_DAY;

/// TTL, in ledgers, that entries are extended to (~180 days).
pub const TTL_EXTEND_TO: u32 = 180 * LEDGERS_PER_DAY;

/// Extend the contract instance TTL. Called by every state-changing entry
/// point so admin, config and the pause flag never expire.
pub fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// Extend a persistent entry's TTL. `extend_ttl` fails on a missing key, so
/// the entry is only extended when it exists.
pub fn extend_persistent<K: IntoVal<Env, Val>>(env: &Env, key: &K) {
    if env.storage().persistent().has(key) {
        env.storage()
            .persistent()
            .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
}
