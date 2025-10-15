// equipment-rental/src/utils.rs
use crate::rental::MAX_DURATION;
use soroban_sdk::{symbol_short, Env, Symbol};
const LAST_ID: Symbol = symbol_short!("last_id");

pub fn validate_duration(env: &Env, duration: u64) {
    let max_duration: u64 = env
        .storage()
        .instance()
        .get(&MAX_DURATION)
        .unwrap_or(30 * 24 * 3600); // Default: 30 days in hours
    if duration == 0 || duration > max_duration {
        panic!("Invalid rental duration");
    }
}

pub fn generate_rental_id(env: &Env) -> u64 {
    let mut id: u64 = env.storage().instance().get(&LAST_ID).unwrap_or(0);
    id += 1;
    env.storage().instance().set(&LAST_ID, &id);
    id
}
