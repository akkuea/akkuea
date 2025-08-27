use soroban_sdk::{contracttype, Address, Env, Symbol, symbol_short, Vec, log};
use crate::utils::{validate_duration, generate_rental_id};

pub const RENTAL_KEY: Symbol = symbol_short!("rental");
pub const MAX_DURATION: Symbol = symbol_short!("max_dur");
pub const RENTAL_CREATED: Symbol = symbol_short!("r_created");
pub const RENTAL_failed: Symbol = symbol_short!("r_failed");


#[contracttype]
#[derive(Clone, PartialEq)]
pub enum RentalStatus {
    Active,
    Completed,
    Cancelled,
}

#[contracttype]
#[derive(Clone)]
pub struct Rental {
    pub rental_id: u64,
    pub equipment_id: u64,
    pub renter: Address,
    pub start_time: u64,
    pub duration: u64,
    pub status: RentalStatus,
}

pub fn create_rental(env: &Env, renter: Address, equipment_id: u64, duration: u64) {
    renter.require_auth();

    validate_duration(&env, duration);

    if check_availability(&env, equipment_id) == false {
        env.events().publish((RENTAL_failed, equipment_id), "equipment_unavailable");
        panic!("Equipment not available");
    }

    let rental_id = generate_rental_id(&env);
    
    let rental = Rental {
        rental_id,
        equipment_id,
        renter: renter.clone(),
        start_time: env.ledger().timestamp(),
        duration,
        status: RentalStatus::Active,
    };
    save_rental(env, equipment_id, rental);
    env.events().publish((RENTAL_CREATED, rental_id), (equipment_id, renter, duration));
}

pub fn get_rental(env: &Env, equipment_id: u64) -> Option<Rental> {
    let key = (RENTAL_KEY, equipment_id);
    env.storage().persistent().get(&key)
}

pub fn save_rental(env: &Env, equipment_id: u64, rental: Rental) {
    let key = (RENTAL_KEY, equipment_id);
    env.storage().persistent().set(&key, &rental);
}

pub fn check_availability(env: &Env, equipment_id: u64) -> bool  {
    let rentals = get_rental(env, equipment_id);

    if let Some(rental) = rentals {
        if rental.status == RentalStatus::Active {
            return false;
        }
    }
    true
}

