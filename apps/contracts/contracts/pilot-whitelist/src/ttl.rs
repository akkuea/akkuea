//! TTL policy for the pilot whitelist.
//!
//! The investor allowlist is a persistent entry per address, and the contract
//! instance carries the admin, the pending admin and the pause flag. A lapse
//! would archive the allowlist and block minting for every holder until the
//! entry is restored, so every write refreshes the entry and every
//! state-changing entry point refreshes the instance.
//!
//! This is the single TTL policy for this crate: the constants and helpers
//! below are the only place TTL values are defined, and `lib.rs` both extends
//! the instance and the allowlist entry it writes.
//!
//! At ~5 s per ledger there are 17_280 ledgers per day. An entry is refreshed
//! when its remaining TTL drops below ~30 days and is then extended to ~180
//! days, so operators do not need a periodic bump transaction.

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
