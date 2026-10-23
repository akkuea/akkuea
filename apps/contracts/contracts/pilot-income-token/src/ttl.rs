//! TTL policy for the pilot income token.
//!
//! The pilot is expected to run for months with infrequent writes. Holder
//! balances are persistent entries that can go untouched between distribution
//! cycles, and the contract instance carries the token metadata, the whitelist
//! address, the admin and the pause flag. If those TTLs lapse the entries are
//! archived and must be restored (for a fee) at the worst possible moment -
//! during a distribution.
//!
//! This is the single TTL policy for this crate: the constants and helpers
//! below are the only place TTL values are defined, and `lib.rs` (entry points)
//! and `storage.rs` (persistent keys) both call them.
//!
//! The reporting cycle is monthly. One ledger closes roughly every 5 seconds,
//! so there are 17_280 ledgers per day. Entries are refreshed once their
//! remaining TTL drops under ~30 days and are extended to ~180 days (six
//! reporting cycles), which leaves enough headroom for a delayed distribution
//! without anyone submitting periodic "bump" transactions.

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
