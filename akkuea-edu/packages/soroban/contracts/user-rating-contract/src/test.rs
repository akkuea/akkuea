#![cfg(test)]

use crate::{
    contract::RatingSystemClient,
    types::{DataKey, RatingData, ReputationTier},
    RatingSystem,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, BytesN, Env, String, Vec,
};

fn setup_test() -> (
    Env,
    RatingSystemClient<'static>,
    Address,    // rater
    Address,    // rated_user
    BytesN<32>, // transaction_id
) {
    let env = Env::default();
    let contract_id = env.register(RatingSystem, ());
    let client = RatingSystemClient::new(&env, &contract_id);

    let rater = Address::generate(&env);
    let rated_user = Address::generate(&env);
    let transaction_id = BytesN::from_array(&env, &[0; 32]);

    (env, client, rater, rated_user, transaction_id)
}

#[test]
fn test_init_user_reputation() {
    let (env, client, _, _, _) = setup_test();
    env.mock_all_auths();
    let user = Address::generate(&env);

    let reputation_data = client.init_user_reputation(&user);

    assert_eq!(reputation_data.total_score, 0);
    assert_eq!(reputation_data.rating_count, 0);
    assert_eq!(reputation_data.reputation_score, 0);
    assert_eq!(reputation_data.reputation_tier, ReputationTier::New);
}

#[test]
fn test_submit_rating_success() {
    let (env, client, rater, rated_user, transaction_id) = setup_test();

    env.mock_all_auths();

    let result = client.submit_rating(
        &transaction_id,
        &rater,
        &rated_user,
        &5,
        &4,
        &5,
        &4,
        &String::from_str(&env, "Great transaction"),
    );

    assert!(result.success);
    assert_eq!(
        result.message,
        String::from_str(&env, "Rating submitted successfully")
    );

    let rating_data: RatingData = env.as_contract(&client.address, || {
        env.storage()
            .instance()
            .get(&DataKey::TransactionRating(transaction_id.clone()))
            .unwrap()
    });

    assert_eq!(rating_data.rater, rater);
    assert_eq!(rating_data.rated_user, rated_user);
    assert_eq!(rating_data.delivery_score, 5);
    assert_eq!(rating_data.communication_score, 4);
    assert_eq!(rating_data.accuracy_score, 5);
    assert_eq!(rating_data.value_score, 4);

    let rating_history: Vec<BytesN<32>> = env.as_contract(&client.address, || {
        env.storage()
            .instance()
            .get(&DataKey::UserRatingHistory(rated_user.clone()))
            .unwrap()
    });

    assert_eq!(rating_history.len(), 1);
    assert_eq!(rating_history.get(0).unwrap(), transaction_id);

    let last_timestamp: u64 = env.as_contract(&client.address, || {
        env.storage()
            .instance()
            .get(&DataKey::LastRatingTimestamp(rater.clone()))
            .unwrap()
    });

    assert_eq!(last_timestamp, env.ledger().timestamp());
}

#[test]
fn test_submit_rating_duplicate() {
    let (env, client, rater, rated_user, transaction_id) = setup_test();
    env.mock_all_auths();

    client.submit_rating(
        &transaction_id,
        &rater,
        &rated_user,
        &5,
        &4,
        &5,
        &4,
        &String::from_str(&env, "First rating"),
    );

    let result = client.submit_rating(
        &transaction_id,
        &rater,
        &rated_user,
        &4,
        &3,
        &4,
        &3,
        &String::from_str(&env, "Second rating"),
    );

    assert!(!result.success);
    assert_eq!(
        result.message,
        String::from_str(&env, "Transaction already rated")
    );
}

#[test]
fn test_submit_rating_self() {
    let (env, client, rater, _, transaction_id) = setup_test();
    env.mock_all_auths();

    let result = client.submit_rating(
        &transaction_id,
        &rater,
        &rater,
        &5,
        &4,
        &5,
        &4,
        &String::from_str(&env, "Rating self"),
    );

    assert!(!result.success);
    assert_eq!(
        result.message,
        String::from_str(&env, "Cannot rate yourself")
    );
}

#[test]
fn test_submit_rating_time_restriction() {
    let (env, client, rater, rated_user, transaction_id_1) = setup_test();
    let transaction_id_2 = BytesN::from_array(&env, &[1; 32]);

    env.mock_all_auths();
    client.submit_rating(
        &transaction_id_1,
        &rater,
        &rated_user,
        &5,
        &4,
        &5,
        &4,
        &String::from_str(&env, "First rating"),
    );

    // Attempt to submit another rating too soon(< 1minute)
    let current_ledger = env.ledger().get();
    env.ledger().set(soroban_sdk::testutils::LedgerInfo {
        timestamp: current_ledger.timestamp + 1,
        protocol_version: current_ledger.protocol_version,
        sequence_number: current_ledger.sequence_number + 1,
        network_id: current_ledger.network_id,
        base_reserve: current_ledger.base_reserve,
        min_temp_entry_ttl: current_ledger.min_temp_entry_ttl,
        min_persistent_entry_ttl: current_ledger.min_persistent_entry_ttl,
        max_entry_ttl: current_ledger.max_entry_ttl,
    });

    env.mock_all_auths();
    let result = client.submit_rating(
        &transaction_id_2,
        &rater,
        &rated_user,
        &4,
        &3,
        &4,
        &3,
        &String::from_str(&env, "Second rating"),
    );

    assert!(!result.success);
    assert_eq!(
        result.message,
        String::from_str(&env, "Rating too soon after last submission")
    );
}

#[test]
fn test_submit_rating_invalid_score() {
    let (env, client, rater, rated_user, transaction_id) = setup_test();
    env.mock_all_auths();

    let result = client.submit_rating(
        &transaction_id,
        &rater,
        &rated_user,
        &6,
        &4,
        &5,
        &4,
        &String::from_str(&env, "Invalid score"),
    );

    assert!(!result.success);
    assert_eq!(
        result.message,
        String::from_str(&env, "Invalid score value. Must be between 1 and 5")
    );
}

#[test]
fn test_get_user_reputation() {
    let (env, client, _, rated_user, _) = setup_test();
    env.mock_all_auths();
    client.init_user_reputation(&rated_user);
    assert_eq!(client.get_user_reputation(&rated_user).reputation_score, 0);
}

#[test]
fn test_get_user_rating_history() {
    let (env, client, _, rated_user, _) = setup_test();
    env.mock_all_auths();
    assert_eq!(client.get_user_rating_history(&rated_user).len(), 0);
}

#[test]
fn test_get_transaction_rating() {
    let (env, client, rater, rated_user, transaction_id) = setup_test();
    env.mock_all_auths();

    client.submit_rating(
        &transaction_id,
        &rater,
        &rated_user,
        &5,
        &4,
        &5,
        &4,
        &String::from_str(&env, "Great transaction"),
    );

    let rating_data = client.get_transaction_rating(&transaction_id).unwrap();

    assert_eq!(rating_data.rater, rater);
    assert_eq!(rating_data.rated_user, rated_user);
    assert_eq!(rating_data.delivery_score, 5);
    assert_eq!(rating_data.communication_score, 4);
    assert_eq!(rating_data.accuracy_score, 5);
    assert_eq!(rating_data.value_score, 4);
}
