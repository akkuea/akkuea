// equipment-rental/src/utils.rs
use soroban_sdk::{Env, Symbol, symbol_short};

use crate::rental::{Rental, RentalStatus, RENTAL_KEY, MAX_DURATION};
const LAST_ID: Symbol = symbol_short!("last_id");

pub fn validate_duration(env: &Env, duration: u64) {
    let max_duration: u64 = env.storage().instance().get(&MAX_DURATION).unwrap_or(30 * 24 * 60 * 60); // Default: 30 days
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