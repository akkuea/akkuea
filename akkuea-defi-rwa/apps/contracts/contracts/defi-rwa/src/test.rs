#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    Address, Env,
};

fn setup_env() -> (Env, ContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    (env, client, admin)
}

#[test]
fn test_happy_path_proportional_distribution() {
    let (env, client, admin) = setup_env();
    let holder_a = Address::generate(&env);
    let holder_b = Address::generate(&env);

    client.register_property(&admin, &1, &100);
    client.register_shareholder(&admin, &1, &holder_a, &60);
    client.register_shareholder(&admin, &1, &holder_b, &40);

    let dist_id = client.create_distribution(&admin, &1, &1000, &202601);

    let amount_a = client.claim_distribution(&holder_a, &1, &dist_id);
    let amount_b = client.claim_distribution(&holder_b, &1, &dist_id);

    assert_eq!(amount_a, 600);
    assert_eq!(amount_b, 400);

    let dist = client.get_distribution(&1, &dist_id);
    assert_eq!(dist.claimed_amount, 1000);
}

#[test]
fn test_get_claimable() {
    let (env, client, admin) = setup_env();
    let holder = Address::generate(&env);

    client.register_property(&admin, &1, &100);
    client.register_shareholder(&admin, &1, &holder, &25);
    client.create_distribution(&admin, &1, &2000, &202601);

    let claimable = client.get_claimable(&holder, &1, &0);
    assert_eq!(claimable, 500);

    client.claim_distribution(&holder, &1, &0);

    let claimable_after = client.get_claimable(&holder, &1, &0);
    assert_eq!(claimable_after, 0);
}

#[test]
#[should_panic(expected = "already claimed")]
fn test_double_claim_panics() {
    let (env, client, admin) = setup_env();
    let holder = Address::generate(&env);

    client.register_property(&admin, &1, &100);
    client.register_shareholder(&admin, &1, &holder, &50);
    client.create_distribution(&admin, &1, &1000, &202601);

    client.claim_distribution(&holder, &1, &0);
    client.claim_distribution(&holder, &1, &0); // should panic
}

#[test]
#[should_panic(expected = "no shares registered")]
fn test_zero_shares_claim_panics() {
    let (env, client, admin) = setup_env();
    let holder = Address::generate(&env);

    client.register_property(&admin, &1, &100);
    // holder has no shares registered
    client.create_distribution(&admin, &1, &1000, &202601);

    client.claim_distribution(&holder, &1, &0); // should panic
}

#[test]
fn test_multiple_distributions() {
    let (env, client, admin) = setup_env();
    let holder = Address::generate(&env);

    client.register_property(&admin, &1, &100);
    client.register_shareholder(&admin, &1, &holder, &50);

    let dist_0 = client.create_distribution(&admin, &1, &1000, &202601);
    let dist_1 = client.create_distribution(&admin, &1, &2000, &202602);

    assert_eq!(dist_0, 0);
    assert_eq!(dist_1, 1);

    let amount_0 = client.claim_distribution(&holder, &1, &dist_0);
    let amount_1 = client.claim_distribution(&holder, &1, &dist_1);

    assert_eq!(amount_0, 500);
    assert_eq!(amount_1, 1000);
}

#[test]
fn test_event_emission() {
    let (env, client, admin) = setup_env();
    let holder = Address::generate(&env);

    client.register_property(&admin, &1, &100);
    client.register_shareholder(&admin, &1, &holder, &50);
    client.create_distribution(&admin, &1, &1000, &202601);
    client.claim_distribution(&holder, &1, &0);

    let events = env.events().all();

    // Verify at least one contract event was emitted
    assert!(!events.is_empty());

    // Verify the last event has 2 topics (our tuple pattern)
    let (_contract_id, topics, _data) = events.last().unwrap();
    assert_eq!(topics.len(), 2);
}

#[test]
#[should_panic(expected = "property not found")]
fn test_nonexistent_property_panics() {
    let (env, client, admin) = setup_env();
    let holder = Address::generate(&env);

    // No property registered — try to register shareholder on non-existent property
    client.register_shareholder(&admin, &999, &holder, &50);
}
