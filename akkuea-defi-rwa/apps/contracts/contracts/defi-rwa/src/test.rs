#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Events, vec, Address, Env, String};

use super::{PropertyTokenContract, PropertyTokenContractClient};

#[test]
fn test() {
    let env = Env::default();
    let contract_id = env.register(PropertyTokenContract, ());
    let client = PropertyTokenContractClient::new(&env, &contract_id);

    let words = client.hello(&String::from_str(&env, "Dev"));
    assert_eq!(
        words,
        vec![
            &env,
            String::from_str(&env, "Hello"),
            String::from_str(&env, "Dev"),
        ]
    );
}

#[test]
fn test_property_registered_event() {
    let env = Env::default();
    let contract_id = env.register_contract(None, PropertyTokenContract);

    let owner = Address::generate(&env);
    let property_id = String::from_str(&env, "PROP001");
    let name = String::from_str(&env, "Test Property");

    // Execute in contract context
    env.as_contract(&contract_id, || {
        PropertyEvents::property_registered(&env, &property_id, &owner, &name, 1000, 1000_00);
    });

    let events = env.events().all();
    assert_eq!(events.len(), 1);
}

#[test]
fn test_deposit_event() {
    let env = Env::default();
    let contract_id = env.register_contract(None, PropertyTokenContract);

    let depositor = Address::generate(&env);
    let pool_id = String::from_str(&env, "USDC-POOL");

    // Execute in contract context
    env.as_contract(&contract_id, || {
        LendingEvents::deposit(
            &env,
            &pool_id,
            &depositor,
            1000_000_000,
            1000_000_000,
            5000_000_000,
        );
    });

    let events = env.events().all();
    assert_eq!(events.len(), 1);
}
