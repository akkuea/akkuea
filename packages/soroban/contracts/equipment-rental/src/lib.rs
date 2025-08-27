#![no_std]
use soroban_sdk::{contract, contractimpl, Address, vec, Env, String, Vec};

mod rental;
mod utils;

use rental::{Rental, RentalStatus, RENTAL_KEY, MAX_DURATION};

#[contract]
pub struct EquipmentRentalContract;

#[contractimpl]
impl EquipmentRentalContract {

    pub fn initialize(env: Env, max_duration: u64) {
        env.storage().persistent().set(&MAX_DURATION, &max_duration);
    }

    pub fn create_rental(env: &Env, renter: Address, equipment_id: u64, duration: u64) {
        rental::create_rental(&env, renter, equipment_id, duration)
    }

    pub fn check_availability(env: &Env, equipment_id: u64) -> bool {
        rental::check_availability(&env, equipment_id)
    }

    pub fn get_rental(env: &Env, equipment_id: u64) ->Option<Rental> {
        rental::get_rental(&env, equipment_id)
    }
    
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, Address, String, vec, log, IntoVal};
    use soroban_sdk::{testutils::{ Events, Ledger as _},};

    #[test]
    fn test_create_rental_success() {
        let env = Env::default();
        let contract_id = env.register(EquipmentRentalContract, ());
        let client = EquipmentRentalContractClient::new(&env, &contract_id);

        let max_duration = 30 * 24 * 60 * 60; // 30 days
        client.initialize(&max_duration);

        let equipment_id = 1;
        let duration = 24 * 60 * 60; // 1 day
        let renter = Address::generate(&env);

        env.mock_all_auths();

        client.create_rental(&renter, &equipment_id, &duration);

        // Verify rental storage
        let rental = client.get_rental(&1).unwrap();

        assert_eq!(rental.rental_id, 1);
        assert_eq!(rental.equipment_id, equipment_id);
        assert_eq!(rental.renter, renter);
        assert_eq!(rental.duration, duration);
        // assert_eq!(rental.status, RentalStatus::Active);
    }

    #[test]
    fn test_create_multiple_rental_success() {
        let env = Env::default();
        let contract_id = env.register(EquipmentRentalContract, ());
        let client = EquipmentRentalContractClient::new(&env, &contract_id);

        let max_duration = 30 * 24 * 60 * 60; // 30 days
        client.initialize(&max_duration);

        let equipment_id = 1;
        let duration = 24 * 60 * 60; // 1 day
        let renter = Address::generate(&env);

        env.mock_all_auths();
        client.create_rental(&renter, &equipment_id, &duration);

        let equipment_id_2 = 2;
        let duration_2 = 24 * 60 * 60 * 3; // 3 day
        env.mock_all_auths();

        client.create_rental(&renter, &equipment_id_2, &duration_2);
    }

    #[test]
    #[should_panic(expected = "Equipment not available")]
    fn test_create_rental_unavailable_equipment() {
        let env = Env::default();
        let contract_id = env.register(EquipmentRentalContract, ());
        let client = EquipmentRentalContractClient::new(&env, &contract_id);

        let max_duration = 30 * 24 * 60 * 60;
        client.initialize(&max_duration);

        let equipment_id = 1;
        let duration = 24 * 60 * 60;
        let renter = Address::generate(&env);

        // Create first rental
        env.mock_all_auths();
        client.create_rental(&renter, &equipment_id, &duration);
        client.create_rental(&renter, &equipment_id, &duration);
    }

    #[test]
    #[should_panic(expected = "Invalid rental duration")]
    fn test_create_rental_invalid_duration() {
        let env = Env::default();
        let contract_id = env.register(EquipmentRentalContract, ());
        let client = EquipmentRentalContractClient::new(&env, &contract_id);

        let max_duration = 30 * 24 * 60 * 60;
        client.initialize(&max_duration);

        let equipment_id = 1;
        let duration = max_duration + 1; // Exceeds max duration
        let renter = Address::generate(&env);

        env.mock_all_auths();
        client.create_rental(&renter, &equipment_id, &duration);
    }
}
