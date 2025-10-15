#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::{RewardSystem, RewardSystemClient, RewardType};

#[test]
fn test_distribute_rewards() {
    let env = Env::default();
    let contract_id = env.register(RewardSystem, ());
    let client = RewardSystemClient::new(&env, &contract_id);

    // Create test addresses
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    // Test content creation reward
    client.distribute_rewards(&user1, &RewardType::ContentCreation, &100);
    assert_eq!(client.get_balance(&user1), 100);

    // Test content curation reward
    client.distribute_rewards(&user1, &RewardType::ContentCuration, &50);
    assert_eq!(client.get_balance(&user1), 150);

    // Test expert review reward
    client.distribute_rewards(&user2, &RewardType::ExpertReview, &200);
    assert_eq!(client.get_balance(&user2), 200);

    // Test collaboration reward
    client.distribute_rewards(&user2, &RewardType::Collaboration, &75);
    assert_eq!(client.get_balance(&user2), 275);
}

#[test]
fn test_invalid_amount() {
    let env = Env::default();
    let contract_id = env.register(RewardSystem, ());
    let client = RewardSystemClient::new(&env, &contract_id);

    let user = Address::generate(&env);

    // Test with zero amount
    let result = client.try_distribute_rewards(&user, &RewardType::ContentCreation, &0);
    assert!(result.is_err());

    // Test with negative amount
    let result = client.try_distribute_rewards(&user, &RewardType::ContentCreation, &-100);
    assert!(result.is_err());

    // Verify no balance was updated
    assert_eq!(client.get_balance(&user), 0);
}

#[test]
fn test_multiple_rewards_same_user() {
    let env = Env::default();
    let contract_id = env.register(RewardSystem, ());
    let client = RewardSystemClient::new(&env, &contract_id);

    let user = Address::generate(&env);

    // Distribute multiple rewards to the same user
    client.distribute_rewards(&user, &RewardType::ContentCreation, &100);
    client.distribute_rewards(&user, &RewardType::ContentCuration, &50);
    client.distribute_rewards(&user, &RewardType::ExpertReview, &200);
    client.distribute_rewards(&user, &RewardType::Collaboration, &75);

    // Verify total balance
    assert_eq!(client.get_balance(&user), 425);
}
