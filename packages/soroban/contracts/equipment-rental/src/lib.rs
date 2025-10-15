#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

mod payment;
mod rental;
mod utils;

#[cfg(test)]
mod test;

use payment::Payment;
use rental::{Rental, MAX_DURATION};

#[contract]
pub struct EquipmentRentalContract;

#[contractimpl]
impl EquipmentRentalContract {
    pub fn initialize(env: Env, max_duration: u64) {
        env.storage().persistent().set(&MAX_DURATION, &max_duration);
    }

    pub fn create_rental(env: &Env, renter: Address, equipment_id: u64, duration: u64) -> u64 {
        rental::create_rental(&env, renter, equipment_id, duration)
    }

    pub fn cancel_rental(env: &Env, renter: Address, rental_id: u64) {
        rental::cancel_rental(env, renter, rental_id)
    }

    pub fn check_availability(env: &Env, equipment_id: u64) -> bool {
        rental::check_availability(&env, equipment_id)
    }

    pub fn get_rentals_by_equipment_id(env: &Env, equipment_id: u64) -> Vec<Rental> {
        rental::get_rentals_by_equipment_id(&env, equipment_id)
    }

    pub fn get_rental_by_rental_id(env: &Env, rental_id: u64) -> Option<Rental> {
        rental::get_rental_by_rental_id(&env, rental_id)
    }

    pub fn process_payment(env: &Env, rental_id: u64, payer: Address, amount: i128) -> bool {
        payment::process_payment(env, rental_id, payer, amount)
    }

    pub fn set_token_address(env: &Env, token: Address) {
        payment::set_token_address(&env, token)
    }

    pub fn set_equipment_price(env: &Env, equipment_id: u64, price_per_hour: i128) {
        payment::set_equipment_price(env, equipment_id, price_per_hour)
    }

    pub fn get_equipment_price(env: &Env, equipment_id: u64) -> i128 {
        payment::get_equipment_price(env, equipment_id)
    }

    pub fn get_payment_by_rental_id(env: &Env, rental_id: u64) -> Option<Payment> {
        payment::get_payment_by_rental_id(env, rental_id)
    }

    pub fn refund_payment(env: Env, rental_id: u64, amount: i128) -> bool {
        payment::refund_payment(env, rental_id, amount)
    }
}
