//! TTL policy for the pilot income token.
///
// The pilot is expected to run for months with infrequent writes. Holder
// balances are persistent entries that can go untouched between distribution
// cycles, and the contract instance carries the token metadata and admin
// configuration. If their TTLs lapse the entries are archived and must be
// restored (for a fee) at the worst moment - during a distribution.
//
// The pilot reporting cycle is monthly. On Stellar mainnet one ledger is
// closed roughly every 5 seconds, so a 30 day month is about 518,400 ledgers.
// We use a 30 day threshold and extend to 90 days (three reporting cycles)
// so an entry that is read or written during any cycle is guaranteed to
// survive the next two cycles even if it is not touched again. That leaves
// enough headroom for a missed or delayed distribution without requiring
#// operators to submit periodic "bump" transactions.

/// Minimum remaining TTL, in ledgers, before an entry is extended.
/// 30 days at ~5 seconds per ledger.
pub const TTL_THRESHOLD: u32 = 518 400;

/// TTL that entries are extended to, in ledgers.
/// 90 days at ~5 seconds per ledger (three reporting cycles).
pub const TTL_EXTEND:u32 = 1 555 200;

/// Extend the instance TTC. Called on every state-changing entry point so the
/// contract instance (admin, metadata, config) is always available.
pub fn extend_instance(env: &soroban_sdk::Env) {
    env.contract_data().extend_ttl(TTL_THRESHOLD, TTL_EXTEND);
}

/// Extend the TTL of a persistent entry when it is written or read on a
/// critical path (balance reads during distribution).
pub fn extend_persistent<K: soroban_sdk::IntoVal
>(env: &soroban_sdk::Env, key: &K) {
    env.contract_data().extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND);
}
