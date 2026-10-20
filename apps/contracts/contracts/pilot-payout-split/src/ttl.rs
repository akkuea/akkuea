//! TTL policy for the payout-split pilot.
//!
//! The pilot reports on a monthly cycle, so entries must survive at least one
//! full reporting period plus a comfortable margin for late claims and audits.
//! At ~5 s per ledger there are 17_280 ledgers per day. An entry is refreshed
//! when its remaining TTL drops below ~30 days and is then extended to ~180
//! days, so no periodic "bump" transaction is needed as long as the contract
//! is exercised at least once every 150 days or so.

use soroban_sdk::{Env, IntoVal, Val};


/// ~5 s per ledger, so 17_280 ledgers per day.
const LEDGERS_PER_DAY: u32 = 17_280;

/// Minimum remaining TTL, in ledgers, before an entry is extended (~30 days).
pub const TTL_THRESHOLD: u32 = 30 * LEDGERS_PER_DAY;

/// TTL, in ledgers, that entries are extended to (~180 days).
pub const TTL_EXTEND_TO: u32 = 180 * LEDGERS_PER_DAY;

/// Extend the instance TTL. Called from every state-changing entry point so
/// admin, config, pause flag and other instance entries never expire.
pub fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// Extend the TTL of a persistent entry. Only call this for a key that
/// exists; extending a missing key fails.
pub fn extend_persistent<K: IntoVal<Env, Val>>(env: &Env, key: &K) {
    if env.storage().persistent().has(key) {
        env.storage()
            .persistent()
            .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
}
