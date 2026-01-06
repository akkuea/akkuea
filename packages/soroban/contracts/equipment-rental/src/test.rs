#![cfg(test)]
extern crate std;

use super::*;
use crate::rental::RentalStatus;
use soroban_sdk::testutils::LedgerInfo;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{log, token, Address, Env};
use token::Client as TokenClient;
use token::StellarAssetClient as TokenAdminClient;

fn create_token_contract<'a>(e: &Env, admin: &Address) -> (TokenClient<'a>, TokenAdminClient<'a>) {
    let sac = e.register_stellar_asset_contract_v2(admin.clone());
    (
        token::Client::new(e, &sac.address()),
        token::StellarAssetClient::new(e, &sac.address()),
    )
}

fn create_claimable_balance_contract<'a>(e: &Env) -> EquipmentRentalContractClient<'a> {
    EquipmentRentalContractClient::new(e, &e.register(EquipmentRentalContract, ()))
}

struct EquipmentRentalTest<'a> {
    env: Env,
    deposit_address: Address,
    payer: Address,
    payer2: Address,
    renter: Address,
    token: TokenClient<'a>,
    contract: EquipmentRentalContractClient<'a>,
}

impl<'a> EquipmentRentalTest<'a> {
    fn setup() -> Self {
        let env = Env::default();
        env.mock_all_auths();

        env.ledger().with_mut(|li| {
            li.timestamp = 1;
        });
        let deposit_address = Address::generate(&env);
        let payer = Address::generate(&env);
        let payer2 = Address::generate(&env);
        let renter = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let (token, token_admin_client) = create_token_contract(&env, &token_admin);
        // token_admin_client.mint(&payer, &7464960000);
        token_admin_client.mint(&payer, &250_000_000); // 250m stroops == 250 xlm
        token_admin_client.mint(&payer2, &300_000_000); // 300m stroops == 300 xlm

        let contract = create_claimable_balance_contract(&env);
        EquipmentRentalTest {
            env,
            deposit_address,
            payer,
            payer2,
            renter,
            token,
            contract,
        }
    }
}

#[test]
fn test_create_rental_success_rental_id() {
    let env = Env::default();
    let contract_id = env.register(EquipmentRentalContract, ());
    let client = EquipmentRentalContractClient::new(&env, &contract_id);

    let max_duration = 30 * 24; // 30 days
    client.initialize(&max_duration);

    let equipment_id = 1;
    let duration = 1 * 24; // 1 day
    let renter = Address::generate(&env);

    env.mock_all_auths();

    client.create_rental(&renter, &equipment_id, &duration);

    // Verify rental storage
    let rental = client.get_rental_by_rental_id(&1).unwrap();

    assert_eq!(rental.rental_id, 1);
    assert_eq!(rental.equipment_id, equipment_id);
    assert_eq!(rental.renter, renter);
    assert_eq!(rental.duration, duration);
}

#[test]
fn test_create_multiple_rental_success() {
    let env = Env::default();
    let contract_id = env.register(EquipmentRentalContract, ());
    let client = EquipmentRentalContractClient::new(&env, &contract_id);

    let max_duration = 30 * 24; // 30 days
    client.initialize(&max_duration);

    let equipment_id = 1;
    let duration = 1 * 24; // 1 day
    let renter = Address::generate(&env);

    env.mock_all_auths();
    client.create_rental(&renter, &equipment_id, &duration);

    let equipment_id_2 = 2;
    let duration_2 = 3 * 24; // 3 day
    env.mock_all_auths();

    client.create_rental(&renter, &equipment_id_2, &duration_2);
}

#[test]
fn test_create_rental_equipment_time_ended() {
    let env = Env::default();
    let contract_id = env.register(EquipmentRentalContract, ());
    let client = EquipmentRentalContractClient::new(&env, &contract_id);

    let max_duration = 30 * 24;
    client.initialize(&max_duration);

    let equipment_id = 1;
    let duration = 1 * 24; //1day
    let renter = Address::generate(&env);
    let renter2 = Address::generate(&env);

    // Create first rental
    env.mock_all_auths();
    client.create_rental(&renter, &equipment_id, &duration);

    client.create_rental(&renter2, &equipment_id, &duration);
}

#[test]
fn test_create_rental_multiple_pending() {
    let env = Env::default();
    let contract_id = env.register(EquipmentRentalContract, ());
    let client = EquipmentRentalContractClient::new(&env, &contract_id);

    let max_duration = 30 * 24;
    client.initialize(&max_duration);

    let equipment_id = 1;
    let duration = 1 * 24; //1day
    let renter = Address::generate(&env);
    let renter2 = Address::generate(&env);

    // Create first rental
    env.mock_all_auths();
    client.create_rental(&renter, &equipment_id, &duration);
    client.create_rental(&renter2, &equipment_id, &duration);
}

#[test]
#[should_panic(expected = "Invalid rental duration")]
fn test_create_rental_invalid_duration() {
    let env = Env::default();
    let contract_id = env.register(EquipmentRentalContract, ());
    let client = EquipmentRentalContractClient::new(&env, &contract_id);

    let max_duration = 30 * 24 * 3600 + 1;
    client.initialize(&max_duration);

    let equipment_id = 1;
    let duration = max_duration + 1; // Exceeds max duration
    let renter = Address::generate(&env);

    env.mock_all_auths();
    client.create_rental(&renter, &equipment_id, &duration);
}

#[test]
fn test_payment() {
    let max_duration = 30 * 24; // 30 days
    let equipment_id = 1;
    let duration = 24; // 24hrs

    let test = EquipmentRentalTest::setup();

    let renter = test.renter;
    let token = &test.token.address;

    test.contract.initialize(&max_duration);
    test.contract
        .create_rental(&renter, &equipment_id, &duration);

    let rental = test.contract.get_rental_by_rental_id(&1).unwrap();

    assert_eq!(rental.rental_id, 1);
    assert_eq!(rental.equipment_id, equipment_id);
    assert_eq!(rental.renter, renter);
    assert_eq!(rental.duration, duration);

    let price_per_hour = 10_000_000; // 1 xlm
    test.contract.set_token_address(&token);
    test.contract
        .set_equipment_price(&equipment_id, &(price_per_hour as i128));
    let _stored_equip_price = test.contract.get_equipment_price(&equipment_id);

    let amount_to_pay = 240_000_000; // 240 xlm
    test.contract
        .process_payment(&1, &test.payer, &amount_to_pay);

    assert_eq!(test.token.balance(&test.payer), 10_000_000);
    assert_eq!(test.token.balance(&test.contract.address), amount_to_pay);
}

#[test]
#[should_panic(expected = "NO PRICE FOR EQUIPMENT")]
fn test_payment_equipment_price_unset() {
    let max_duration = 30 * 24; // 30 days
    let equipment_id = 1;
    let duration = 1 * 24; // 1 day

    let test = EquipmentRentalTest::setup();

    let renter = test.renter;
    let token = &test.token.address;

    test.contract.initialize(&max_duration);
    test.contract
        .create_rental(&renter, &equipment_id, &duration);

    test.contract.set_token_address(&token);
    let amount_to_pay = 240_000_000; // 240 xlm
    test.contract
        .process_payment(&1, &test.payer, &amount_to_pay);
}

#[test]
fn test_payment_multiple() {
    let max_duration = 30 * 24 * 3600; // 30 days
    let equipment_id = 1;
    let duration = 24; // 24hrs
    let equipment_id_2 = 2;

    let test = EquipmentRentalTest::setup();

    let renter = test.renter;
    let token = &test.token.address;

    test.contract.initialize(&max_duration);
    test.contract
        .create_rental(&renter, &equipment_id, &duration);
    test.contract
        .create_rental(&renter, &equipment_id_2, &duration);

    let price_per_hour = 10_000_000; // 1 xlm
    test.contract.set_token_address(&token);
    test.contract
        .set_equipment_price(&equipment_id, &(price_per_hour as i128));
    test.contract
        .set_equipment_price(&equipment_id_2, &(price_per_hour as i128));

    let amount_to_pay = 240_000_000; // 240 xlm
    test.contract
        .process_payment(&1, &test.payer, &amount_to_pay);

    let amount_to_pay_2 = 280_000_000; // 280 xlm
    test.contract
        .process_payment(&2, &test.payer2, &amount_to_pay_2);

    assert_eq!(test.token.balance(&test.payer), 10_000_000);
    assert_eq!(test.token.balance(&test.payer2), 20_000_000);
    assert_eq!(
        test.token.balance(&test.contract.address),
        amount_to_pay + amount_to_pay_2
    );

    let pay_rent_1 = test.contract.get_payment_by_rental_id(&1);
    let pay_rent_2 = test.contract.get_payment_by_rental_id(&2);
}

#[test]
#[should_panic(expected = "Equipment Already Paid For")]
fn test_payment_same_equipmnent_unavailable() {
    let max_duration = 30 * 24; // 30 days
    let equipment_id = 1;
    let duration = 1 * 24; // 1 day

    let test = EquipmentRentalTest::setup();

    let payer1 = test.payer;
    let payer2 = test.payer2;
    let token = &test.token.address;

    test.contract.initialize(&max_duration);
    test.contract
        .create_rental(&payer1, &equipment_id, &duration);
    test.contract
        .create_rental(&payer2, &equipment_id, &duration);

    let price_per_hour = 10_000_000; // 1 xlm
    test.contract.set_token_address(&token);
    test.contract
        .set_equipment_price(&equipment_id, &(price_per_hour as i128));

    let amount_to_pay = 240_000_000; // 240 xlm
    test.contract.process_payment(&1, &payer1, &amount_to_pay);

    let amount_to_pay_2 = 280_000_000; // 280 xlm
    test.contract.process_payment(&1, &payer2, &amount_to_pay_2);
}

#[test]
fn test_payment_multiple_equipmnents() {
    let max_duration = 30 * 24; // 30 days
    let equipment_id = 1;
    let equipment_id_2 = 2;
    let duration = 1 * 24; // 1 day

    let test = EquipmentRentalTest::setup();

    let payer1 = test.payer;
    let payer2 = test.payer2;
    let token = &test.token.address;

    test.contract.initialize(&max_duration);
    test.contract
        .create_rental(&payer1, &equipment_id, &duration);
    test.contract
        .create_rental(&payer2, &equipment_id_2, &duration);

    let price_per_hour = 10_000_000; // 1 xlm
    test.contract.set_token_address(&token);
    test.contract
        .set_equipment_price(&equipment_id, &(price_per_hour as i128));
    test.contract
        .set_equipment_price(&equipment_id_2, &(price_per_hour as i128));

    let amount_to_pay = 240_000_000; // 240 xlm
    test.contract.process_payment(&1, &payer1, &amount_to_pay);

    let amount_to_pay_2 = 280_000_000; // 280 xlm
    test.contract.process_payment(&2, &payer2, &amount_to_pay_2);

    assert_eq!(test.token.balance(&payer1), 10_000_000);
    assert_eq!(test.token.balance(&payer2), 20_000_000);
    assert_eq!(
        test.token.balance(&test.contract.address),
        amount_to_pay + amount_to_pay_2
    );

    let pay_rent_1 = test.contract.get_payment_by_rental_id(&1).unwrap();
    assert_eq!(pay_rent_1.amount, amount_to_pay);

    let pay_rent_2 = test.contract.get_payment_by_rental_id(&2).unwrap();
    assert_eq!(pay_rent_2.amount, amount_to_pay_2);
}

#[test]
// #[should_panic(expected = "Equipment Already Paid For")]
fn test_payment_same_equipmnent_available_after_completed() {
    let max_duration = 30 * 24; // 30 days
    let equipment_id = 1;
    let duration = 1 * 24; // 1 day

    let test = EquipmentRentalTest::setup();

    let payer1 = test.payer;
    let payer2 = test.payer2;
    let token = &test.token.address;

    test.contract.initialize(&max_duration);
    test.contract
        .create_rental(&payer1, &equipment_id, &duration);

    let price_per_hour = 10_000_000; // 1 xlm
    test.contract.set_token_address(&token);
    test.contract
        .set_equipment_price(&equipment_id, &(price_per_hour as i128));

    let _ = test.contract.get_rental_by_rental_id(&(1 as u64));

    let amount_to_pay = 240_000_000; // 240 xlm
    test.contract.process_payment(&1, &payer1, &amount_to_pay);

    let _ = test.contract.get_rental_by_rental_id(&(1 as u64));
    let _ = test.contract.get_rentals_by_equipment_id(&(1 as u64));

    let next_timestamp = test.env.ledger().timestamp() + duration + 10;

    test.env.ledger().set(LedgerInfo {
        timestamp: next_timestamp,
        protocol_version: 22,
        sequence_number: test.env.ledger().sequence(),
        network_id: Default::default(),
        base_reserve: 0,
        min_persistent_entry_ttl: 4096,
        min_temp_entry_ttl: 16,
        max_entry_ttl: 6312000,
    });

    test.contract
        .create_rental(&payer2, &equipment_id, &duration);

    let amount_to_pay_2 = 280_000_000; // 280 xlm
    test.contract.process_payment(&1, &payer2, &amount_to_pay_2);
}

#[test]
fn test_payment_and_refund() {
    let max_duration = 30 * 24 * 3600; // 30 days
    let equipment_id = 1;
    let duration = 15; // 15hrs

    let test = EquipmentRentalTest::setup();

    let renter = test.renter;
    let token = &test.token.address;

    test.contract.initialize(&max_duration);
    test.contract
        .create_rental(&renter, &equipment_id, &duration);

    let price_per_hour = 10_000_000; // 1 xlm
    test.contract.set_token_address(&token);
    test.contract
        .set_equipment_price(&equipment_id, &(price_per_hour as i128));
    let _ = test.contract.get_equipment_price(&equipment_id);

    let amount_to_pay = 200_000_000; // 200 xlm
    test.contract
        .process_payment(&1, &test.payer, &amount_to_pay);

    assert_eq!(test.token.balance(&test.contract.address), 200_000_000);
    assert_eq!(test.token.balance(&test.payer), 50_000_000);

    let _ = test.contract.refund_payment(&1, &(50_000_000 as i128));
    assert_eq!(test.token.balance(&test.contract.address), 150_000_000);
    assert_eq!(test.token.balance(&test.payer), 100_000_000);
}

#[test]
#[should_panic(expected = "Max Refundable Amount:")]
fn test_payment_and_refund_failed() {
    let max_duration = 30 * 24 * 3600; // 30 days
    let equipment_id = 1;
    let duration = 15; // 15hrs

    let test = EquipmentRentalTest::setup();

    let renter = test.renter;
    let token = &test.token.address;

    test.contract.initialize(&max_duration);
    test.contract
        .create_rental(&renter, &equipment_id, &duration);

    let price_per_hour = 10_000_000; // 1 xlm
    test.contract.set_token_address(&token);
    test.contract
        .set_equipment_price(&equipment_id, &(price_per_hour as i128));

    let amount_to_pay = 200_000_000; // 200 xlm
    test.contract
        .process_payment(&1, &test.payer, &amount_to_pay);

    let _ = test.contract.refund_payment(&1, &(60_000_000 as i128));
}

#[test]
#[should_panic(expected = "Amount Can't be negative")]
fn test_payment_and_refund_neg_amount_failed() {
    let max_duration = 30 * 24; // 30 days
    let equipment_id = 1;
    let duration = 1 * 15; // 15hrs

    let test = EquipmentRentalTest::setup();

    let renter = test.renter;
    let token = &test.token.address;

    test.contract.initialize(&max_duration);
    test.contract
        .create_rental(&renter, &equipment_id, &duration);

    let price_per_hour = 10_000_000; // 1 xlm
    test.contract.set_token_address(&token);
    test.contract
        .set_equipment_price(&equipment_id, &(price_per_hour as i128));
    let _ = test.contract.get_equipment_price(&equipment_id);

    let amount_to_pay = -200_000_000; // 200 xlm
    test.contract
        .process_payment(&1, &test.payer, &amount_to_pay);
}

#[test]
#[should_panic(expected = "Insufficient balance/amount")]
fn test_payment_and_refund_insufficient_amount_failed() {
    let max_duration = 30 * 24 * 3600; // 30 days
    let equipment_id = 1;
    let duration = 15; // 15hrs

    let test = EquipmentRentalTest::setup();

    let renter = test.renter;
    let token = &test.token.address;

    test.contract.initialize(&max_duration);
    test.contract
        .create_rental(&renter, &equipment_id, &duration);

    let price_per_hour = 10_000_000; // 1 xlm
    test.contract.set_token_address(&token);
    test.contract
        .set_equipment_price(&equipment_id, &(price_per_hour as i128));
    let _ = test.contract.get_equipment_price(&equipment_id);

    let amount_to_pay = 100_000_000; // 100 xlm
    test.contract
        .process_payment(&1, &test.payer, &amount_to_pay);
}

#[test]
#[should_panic(expected = "Insufficient contract balance")]
fn test_payment_and_refund_insufficient_contract_balance_failed() {
    let max_duration = 30 * 24 * 3600; // 30 days
    let equipment_id = 1;
    let duration = 15; // 15hrs

    let test = EquipmentRentalTest::setup();

    let renter = test.renter;
    let token = &test.token.address;

    test.contract.initialize(&max_duration);
    test.contract
        .create_rental(&renter, &equipment_id, &duration);

    let price_per_hour = 10_000_000; // 1 xlm
    test.contract.set_token_address(&token);
    test.contract
        .set_equipment_price(&equipment_id, &(price_per_hour as i128));
    let _ = test.contract.get_equipment_price(&equipment_id);

    let amount_to_pay = 200_000_000; // 200 xlm
    test.contract
        .process_payment(&1, &test.payer, &amount_to_pay);

    let _ = test.contract.refund_payment(&1, &(600_000_000 as i128));
}

#[test]
fn test_payment_and_cancel() {
    let max_duration = 30 * 24 * 3600; // 30 days
    let equipment_id = 1;
    let duration = 15; // 15hrs

    let test = EquipmentRentalTest::setup();

    let renter = test.renter;
    let token = &test.token.address;

    test.contract.initialize(&max_duration);
    let rental_id = test
        .contract
        .create_rental(&renter, &equipment_id, &duration);

    let price_per_hour = 10_000_000; // 1 xlm
    test.contract.set_token_address(&token);
    test.contract
        .set_equipment_price(&equipment_id, &(price_per_hour as i128));
    let _ = test.contract.get_equipment_price(&equipment_id);

    let amount_to_pay = 200_000_000; // 200 xlm
    test.contract
        .process_payment(&1, &test.payer, &amount_to_pay);

    assert_eq!(test.token.balance(&test.contract.address), 200_000_000);
    assert_eq!(test.token.balance(&test.payer), 50_000_000);

    let rent = test.contract.get_rental_by_rental_id(&rental_id);

    test.env.ledger().with_mut(|li| {
        li.timestamp = 1 * 13; // 24 hours + 1 second
    });

    test.contract.cancel_rental(&renter, &rental_id);

    let rental = test.contract.get_rental_by_rental_id(&rental_id).unwrap();

    assert_eq!(test.token.balance(&test.contract.address), 170000000);
    assert_eq!(test.token.balance(&test.payer), 80000000);

    assert_eq!(rental.rental_id, 1);
    assert_eq!(rental.status, RentalStatus::Cancelled);
}

#[test]
fn test_payment_and_cancel_create() {
    let max_duration = 30 * 24 * 3600; // 30 days
    let equipment_id = 1;
    let duration = 15; // 15hrs

    let test = EquipmentRentalTest::setup();

    let renter = test.renter;
    let token = &test.token.address;

    test.contract.initialize(&max_duration);
    let rental_id = test
        .contract
        .create_rental(&renter, &equipment_id, &duration);
    let rental = test.contract.get_rental_by_rental_id(&rental_id).unwrap();

    let price_per_hour = 10_000_000; // 1 xlm
    test.contract.set_token_address(&token);
    test.contract
        .set_equipment_price(&equipment_id, &(price_per_hour as i128));
    let _ = test.contract.get_equipment_price(&equipment_id);

    let amount_to_pay = 200_000_000; // 200 xlm
    test.contract
        .process_payment(&1, &test.payer, &amount_to_pay);

    test.env.ledger().with_mut(|li| {
        li.timestamp = 1 * 13; // 24 hours + 1 second
    });

    test.contract.cancel_rental(&renter, &rental_id);

    let new_renter = Address::generate(&test.env);
    let duration = 25; // 25hrs
    let equipment_id_2 = 1;

    let new_rental_id = test
        .contract
        .create_rental(&new_renter, &equipment_id_2, &duration);
    let rental = test
        .contract
        .get_rental_by_rental_id(&new_rental_id)
        .unwrap();

    assert_eq!(rental.rental_id, 2);
    assert_eq!(rental.equipment_id, equipment_id);
    assert_eq!(rental.renter, new_renter);
    assert_eq!(rental.duration, duration);
}
