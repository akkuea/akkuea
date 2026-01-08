use crate::payment::{get_equipment_price, get_payment_by_rental_id, refund_payment};
use crate::utils::{generate_rental_id, validate_duration};
use soroban_sdk::{contracttype, symbol_short, Address, Env, Symbol, Vec};

pub const RENTAL_KEY: Symbol = symbol_short!("rentals");
pub const RENTAL_KEY_CANCEL: Symbol = symbol_short!("rentalcan");
pub const MAX_DURATION: Symbol = symbol_short!("max_dur");
pub const RENTAL_CREATED: Symbol = symbol_short!("r_created");
pub const RENTAL_FAILED: Symbol = symbol_short!("r_failed");
pub const RENTAL_CANCEL: Symbol = symbol_short!("r_cancel");

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum RentalStatus {
    Pending,   // Rental created, awaiting payment
    Active,    // Payment processed, rental active
    Completed, // Rental duration ended
    Cancelled, // Rental cancelled before start
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Rental {
    pub rental_id: u64,
    pub equipment_id: u64,
    pub renter: Address,
    pub start_time: u64,
    pub duration: u64,
    pub status: RentalStatus,
}

#[contracttype]
#[derive(Clone)]
pub struct Cancellation {
    pub rental_id: u64,      // Associated rental ID
    pub canceller: Address,  // Stellar address of the canceller
    pub refund_amount: i128, // Refund amount in XLM (Stroops)
    pub timestamp: u64,      // Cancellation timestamp
}

pub fn create_rental(env: &Env, renter: Address, equipment_id: u64, duration: u64) -> u64 {
    renter.require_auth();

    if duration == 0 {
        panic!("Duration Can't be negative");
    }

    validate_duration(&env, duration);

    if check_availability(&env, equipment_id) == false {
        env.events()
            .publish((RENTAL_FAILED, equipment_id), "equipment_unavailable");
        panic!("Equipment not available");
    }

    let rental_id = generate_rental_id(&env);

    let rental = Rental {
        rental_id,
        equipment_id,
        renter: renter.clone(),
        start_time: env.ledger().timestamp(),
        duration,
        status: RentalStatus::Pending,
    };

    save_rental(&env, &rental);
    env.events().publish(
        (RENTAL_CREATED, rental_id),
        (equipment_id, renter, duration),
    );
    rental_id
}

pub fn cancel_rental(env: &Env, renter: Address, rental_id: u64) {
    let current_time = env.ledger().timestamp();
    let mut rental = validate_cancellation(&env, rental_id, renter).unwrap();

    let payment = get_payment_by_rental_id(&env, rental_id).unwrap();
    let payment_timestamp = payment.timestamp;
    let payment_amount = payment.amount;
    let duration = rental.duration;
    let rent_per_hour = get_equipment_price(&env, rental.equipment_id);

    // Amount of refund =  (duration - (current_time - payment_timestamp))
    // Maybe remove a cancellation fee
    let amount_to_refund = (duration - (current_time - payment_timestamp)) * rent_per_hour as u64;

    update_rental_status(&env, rental_id, RentalStatus::Cancelled);

    let cancellation = Cancellation {
        rental_id,
        canceller: rental.renter.clone(),
        refund_amount: amount_to_refund as i128,
        timestamp: current_time,
    };

    env.storage()
        .persistent()
        .set(&RENTAL_KEY_CANCEL, &cancellation);
    refund_payment(env.clone(), rental_id, amount_to_refund.into());

    env.events().publish(
        (RENTAL_CANCEL, rental_id),
        (rental.equipment_id, rental.renter, amount_to_refund),
    );
}

pub fn validate_cancellation(env: &Env, rental_id: u64, caller: Address) -> Option<Rental> {
    caller.require_auth();

    let rental = get_rental_by_rental_id(&env, rental_id);
    if let Some(ref rental) = rental {
        if caller != rental.renter {
            panic!("Can initiate cancel rental");
        }

        if rental.status != RentalStatus::Active {
            panic!("Rental is not Active, can't cancel");
        }
    }
    rental
}

pub fn save_rental(env: &Env, rental: &Rental) {
    let mut rentals: Vec<Rental> = env
        .storage()
        .persistent()
        .get(&RENTAL_KEY)
        .unwrap_or(Vec::new(&env));
    rentals.push_back(rental.clone());
    env.storage().persistent().set(&RENTAL_KEY, &rentals);
}

pub fn get_rentals_by_equipment_id(env: &Env, equipment_id: u64) -> Vec<Rental> {
    let rentals: Vec<Rental> = env
        .storage()
        .persistent()
        .get(&RENTAL_KEY)
        .unwrap_or(Vec::new(&env));
    let mut result = Vec::new(&env);
    for rental in rentals.iter() {
        if rental.equipment_id == equipment_id {
            result.push_back(rental);
        }
    }
    result
}

pub fn get_rental_by_rental_id(env: &Env, rental_id: u64) -> Option<Rental> {
    let rentals: Option<Vec<Rental>> = env.storage().persistent().get(&RENTAL_KEY).unwrap();
    let rental = rentals
        .and_then(|ps| ps.iter().find(|p| p.rental_id == rental_id))
        .unwrap_or_else(|| panic!("Payment not found"));
    Some(rental)
}

pub fn update_rental_status(env: &Env, rental_id: u64, rental_status: RentalStatus) -> bool {
    let mut rentals: Vec<Rental> = env
        .storage()
        .persistent()
        .get(&RENTAL_KEY)
        .unwrap_or(Vec::new(&env));
    if let Some(index) = rentals.iter().position(|r| r.rental_id == rental_id) {
        let mut rental = rentals
            .get_unchecked((index as usize).try_into().unwrap())
            .clone();
        rental.status = rental_status;
        rentals.set(index as u32, rental);
        env.storage().persistent().set(&RENTAL_KEY, &rentals);
        true
    } else {
        false
    }
}

pub fn check_availability(env: &Env, equipment_id: u64) -> bool {
    let rentals = get_rentals_by_equipment_id(env, equipment_id);
    let timestamp = env.ledger().timestamp();

    for rental in rentals {
        let payment_by_rental = get_payment_by_rental_id(&env, rental.rental_id);

        match rental.status {
            RentalStatus::Pending => {
                if payment_by_rental.is_some() {
                    return false; // Pending with payment, not available
                }
                continue; // Pending without payment, considered available
            }
            RentalStatus::Active => {
                if let Some(payment) = payment_by_rental {
                    let rental_end_time = payment.timestamp + rental.duration;
                    if rental_end_time < timestamp {
                        update_rental_status(&env, rental.rental_id, RentalStatus::Completed);
                        continue; // Expired, considered available
                    }
                    return false; // Active, not expired, not available
                }
            }
            RentalStatus::Completed | RentalStatus::Cancelled => {
                continue; // Completed or cancelled, considered available
            }
        }
    }
    true // No blocking rentals, equipment available
}
