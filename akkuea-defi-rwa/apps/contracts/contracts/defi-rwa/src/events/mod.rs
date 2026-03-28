// The #[contractevent] macro is the recommended replacement for `publish`,
// but it is not yet stable in soroban-sdk 23.4.0 for custom topic tuples.
// Allow deprecated usage until the SDK provides a stable alternative.
#![allow(deprecated)]

use soroban_sdk::{Address, Env};

pub fn emit_property_registered(env: &Env, property_id: u64, total_shares: u32) {
    env.events()
        .publish(("property", "registered"), (property_id, total_shares));
}

pub fn emit_shareholder_registered(env: &Env, property_id: u64, holder: Address, shares: u32) {
    env.events()
        .publish(("shareholder", "registered"), (property_id, holder, shares));
}

pub fn emit_distribution_created(
    env: &Env,
    property_id: u64,
    dist_id: u32,
    total_amount: i128,
    period: u64,
) {
    env.events().publish(
        ("distribution", "created"),
        (property_id, dist_id, total_amount, period),
    );
}

pub fn emit_distribution_claimed(
    env: &Env,
    property_id: u64,
    dist_id: u32,
    holder: Address,
    amount: i128,
) {
    env.events().publish(
        ("distribution", "claimed"),
        (property_id, dist_id, holder, amount),
    );
}
