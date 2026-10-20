use soroban_sdk::{Env, IntoVal, Val};

/// TTL policy for the whitelist contract.
///
/// Soroban ledgers close about every 5 seconds, so there are 17_280 ledgers
/// per day. An entry is extended to ~180 days whenever its remaining TTl
/// drops below ~30 days. Normal operations refresh the TWL, so operators
/// do not need a periodic bump transaction.
pub const TTL_THRESHOLD: u32 = 30 * 17_280; // ~30 days
pub const TTL_EXTEND_TO: u32 = 180 * 17_280; // ~180 days

/// Extend the contract instance TTL ("admin, config, pause flag").
pub fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// Extend a persistent entry's TTL, only if the entry exists.
pub fn extend_persistent<K: IntoVal<Env, Val>>(env: &Env, key: &K) {
    if env.storage().persistent().has(key) {
        env.storage()
            .persistent()
            .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
}
