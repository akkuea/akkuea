//! TTL policy for the pilot income token.
//!
//! The pilot is expected to run for months with infrequent writes. Holder
//! balances are persistent entries that can go untouched between distribution
//! cycles, and the contract instance carries the token metadata and admin
//! configuration. If their TTLs lapse the entries are archived and must be
//! restored (for a fee) at the worst moment - during a distribution.
//!
//! This is the single TTL policy for this crate. The pilot reporting cycle
//! is monthly. On Stellar mainnet one ledger is closed roughly every 5
//! seconds, so there are 17_280 ledgers per day. We use a 30 day threshold
//! and extend to 180 days (six reporting cycles) so an entry that is read
//! or written during any cycle survives the next five cycles even if it is
//! not touched again. That leaves enough headroom for a missed or delayed
//! distribution without requiring operators to submit periodic "bump"
//! transactions.

use soroban_sdk::Env;

/// ~5 s per ledger, so 17_280 ledgers per day.
const LEDGERS_PER_DAY: u32 = 17_280;

/// Minimum remaining TTL, in ledgers, before an entry is extended (~30 days).
pub const TTL_THRESHOLD: u32 = 30 * LEDGERS_PER_DAY;

/// TTL, in ledgers, that entries are extended to (~180 days).
pub const TTL_EXTEND_TO: u32 = 180 * LEDGERS_PER_DAY;

/// Extend the instance TTL. Called on every state-changing entry point so the
/// contract instance (admin, metadata, config) is always available.
pub fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// Extend the TTL of a persistent entry. Only call this for a key that
/// exists; extending a missing key fails.
pub fn extend_persistent<K> env: &Env, key: &K)
where
    K: sroban_sdk::IntoVal<Env, soroban_sdk::Val>,
{
    env.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}
