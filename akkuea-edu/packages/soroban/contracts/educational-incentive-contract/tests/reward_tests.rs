#![cfg(test)]

use educational_incentive_contract::{RewardSystem, RewardSystemClient, RewardType};
use soroban_sdk::{
    testutils::{Address as _, Events},
    Address, Env,
};

#[test]
fn test_reward_distribution_success() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RewardSystem, ());
    let client = RewardSystemClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let reward_type = RewardType::ContentCreation;
    let amount = 100_i128;

    let result = client.try_distribute_rewards(&user, &reward_type, &amount);
    assert!(
        result.is_ok(),
        "distribute_rewards failed for {:?}: {:?}",
        reward_type,
        result.err()
    );

    assert_eq!(
        client.get_balance(&user),
        amount,
        "Balance incorrect for {:?}",
        reward_type
    );
}

#[test]
fn test_event_emission() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RewardSystem, ());
    let client = RewardSystemClient::new(&env, &contract_id);

    let user = Address::generate(&env);

    let result = client.try_distribute_rewards(&user, &RewardType::ContentCreation, &100);
    assert!(
        result.is_ok(),
        "distribute_rewards failed: {:?}",
        result.err()
    );

    let events = env.events().all();
    assert!(!events.is_empty(), "No events emitted for ContentCreation");
}

#[test]
fn test_raw_event_emission() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RewardSystem, ());
    let client = RewardSystemClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    client.log_reward_event(&user, &RewardType::ContentCreation, &100);
    let events = env.events().all();
    assert!(!events.is_empty(), "No raw events emitted");
}

#[test]
fn test_alternative_event_emission() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RewardSystem, ());
    let client = RewardSystemClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    client.distribute_rewards(&user, &RewardType::ContentCreation, &100);
    let events: soroban_sdk::Vec<(
        Address,
        soroban_sdk::Vec<soroban_sdk::Val>,
        soroban_sdk::Val,
    )> = env.events().all();
    assert!(!events.is_empty(), "No alternative events emitted");
}

#[test]
fn test_contract_event_emission() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RewardSystem, ());
    let client = RewardSystemClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    client.distribute_rewards(&user, &RewardType::ContentCreation, &100);
    let events = env.events().all();
    assert!(!events.is_empty(), "No contract events emitted");
}

#[test]
fn test_reward_accumulates_balance() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RewardSystem, ());
    let client = RewardSystemClient::new(&env, &contract_id);

    let user = Address::generate(&env);

    let rewards = [
        (RewardType::ContentCreation, 100),
        (RewardType::ContentCuration, 50),
        (RewardType::ExpertReview, 200),
        (RewardType::Collaboration, 75),
    ];

    let mut expected_total = 0;

    for (reward_type, amount) in rewards.iter() {
        client.distribute_rewards(&user, reward_type, amount);
        expected_total += amount;

        assert_eq!(
            client.get_balance(&user),
            expected_total,
            "Accumulated balance incorrect after {:?}",
            reward_type
        );
    }

    assert_eq!(
        client.get_balance(&user),
        425,
        "Final accumulated balance incorrect"
    );
}

#[test]
fn test_reward_invalid_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RewardSystem, ());
    let client = RewardSystemClient::new(&env, &contract_id);

    let user = Address::generate(&env);

    let invalid_amounts = [0, -100];

    for amount in invalid_amounts.iter() {
        let result = client.try_distribute_rewards(&user, &RewardType::ContentCreation, amount);

        assert_eq!(
            result.err().unwrap(),
            Ok(educational_incentive_contract::Error::InvalidAmount),
            "Expected InvalidAmount error for amount {}",
            amount
        );

        assert_eq!(
            client.get_balance(&user),
            0,
            "Balance should not change for invalid amount {}",
            amount
        );

        let events = env.events().all();
        assert!(
            events.is_empty(),
            "No events should be emitted for invalid amount {}",
            amount
        );
    }
}
