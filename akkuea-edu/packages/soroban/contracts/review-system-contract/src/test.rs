#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};

use crate::{ReviewSystemContract, ReviewSystemContractClient};

#[test]
fn test_initialize() {
    let env = Env::default();

    let contract_id = env.register(ReviewSystemContract, ());
    let client = ReviewSystemContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    // Initialize the contract
    client.initialize();

    // Verify initialization - should be able to use contract functions
    // Try getting reviews for a non-existent content (should return empty vec)
    let reviews = client.get_content_reviews(&1);
    assert_eq!(reviews.len(), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")]
fn test_double_initialize() {
    let env = Env::default();

    let contract_id = env.register(ReviewSystemContract, ());
    let client = ReviewSystemContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    // Initialize once
    client.initialize();

    // Try to initialize again (should panic)
    client.initialize();
}

#[test]
fn test_analyze_sentiment_positive() {
    let env = Env::default();
    let reviewer = Address::generate(&env);

    let contract_id = env.register(ReviewSystemContract, ());
    let client = ReviewSystemContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    client.initialize();

    // Create a positive review
    let review_text = String::from_str(
        &env,
        "This is great content! Very helpful and easy to understand. Love it!",
    );

    let review_id = client.analyze_sentiment(&1, &reviewer, &review_text);

    // Verify review was created
    assert_eq!(review_id, 1);

    // Get sentiment score
    let sentiment = client.get_review_sentiment(&review_id);

    // Should be positive (contains "great", "helpful", "easy", "love")
    assert!(sentiment > 0);
}

#[test]
fn test_analyze_sentiment_negative() {
    let env = Env::default();
    let reviewer = Address::generate(&env);

    let contract_id = env.register(ReviewSystemContract, ());
    let client = ReviewSystemContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    client.initialize();

    // Create a negative review
    let review_text = String::from_str(
        &env,
        "This is terrible and useless. Very confusing and disappointing content.",
    );

    let review_id = client.analyze_sentiment(&1, &reviewer, &review_text);

    // Get sentiment score
    let sentiment = client.get_review_sentiment(&review_id);

    // Should be negative (contains "terrible", "useless", "confusing", "disappointing")
    assert!(sentiment < 0);
}

#[test]
fn test_analyze_sentiment_neutral() {
    let env = Env::default();
    let reviewer = Address::generate(&env);

    let contract_id = env.register(ReviewSystemContract, ());
    let client = ReviewSystemContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    client.initialize();

    // Create a neutral review (no sentiment keywords)
    let review_text = String::from_str(
        &env,
        "This content covers basic topics and provides some information.",
    );

    let review_id = client.analyze_sentiment(&1, &reviewer, &review_text);

    // Get sentiment score
    let sentiment = client.get_review_sentiment(&review_id);

    // Should be neutral (close to 0)
    assert!(sentiment >= -15 && sentiment <= 15);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_review_text_too_short() {
    let env = Env::default();
    let reviewer = Address::generate(&env);

    let contract_id = env.register(ReviewSystemContract, ());
    let client = ReviewSystemContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    client.initialize();

    // Try to submit a review that's too short (less than 5 characters)
    let review_text = String::from_str(&env, "Bad");

    client.analyze_sentiment(&1, &reviewer, &review_text);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_review_text_empty() {
    let env = Env::default();
    let reviewer = Address::generate(&env);

    let contract_id = env.register(ReviewSystemContract, ());
    let client = ReviewSystemContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    client.initialize();

    // Try to submit an empty review
    let review_text = String::from_str(&env, "");

    client.analyze_sentiment(&1, &reviewer, &review_text);
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")]
fn test_review_text_too_long() {
    let env = Env::default();
    let reviewer = Address::generate(&env);

    let contract_id = env.register(ReviewSystemContract, ());
    let client = ReviewSystemContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    client.initialize();

    // Create a very long review (over 1000 characters)
    let long_text = "a".repeat(1001);
    let review_text = String::from_str(&env, &long_text);

    client.analyze_sentiment(&1, &reviewer, &review_text);
}

#[test]
fn test_get_review() {
    let env = Env::default();
    let reviewer = Address::generate(&env);

    let contract_id = env.register(ReviewSystemContract, ());
    let client = ReviewSystemContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    client.initialize();

    let review_text = String::from_str(&env, "Great educational content!");
    let review_id = client.analyze_sentiment(&5, &reviewer, &review_text);

    // Get full review details
    let review = client.get_review(&review_id);

    assert_eq!(review.review_id, review_id);
    assert_eq!(review.content_id, 5);
    assert_eq!(review.reviewer, reviewer);
    assert_eq!(review.text, review_text);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_get_nonexistent_review() {
    let env = Env::default();

    let contract_id = env.register(ReviewSystemContract, ());
    let client = ReviewSystemContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    client.initialize();

    // Try to get a review that doesn't exist
    client.get_review(&999);
}

#[test]
fn test_get_content_reviews() {
    let env = Env::default();
    let reviewer1 = Address::generate(&env);
    let reviewer2 = Address::generate(&env);

    let contract_id = env.register(ReviewSystemContract, ());
    let client = ReviewSystemContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    client.initialize();

    // Add multiple reviews for the same content
    let content_id = 10u64;

    client.analyze_sentiment(
        &content_id,
        &reviewer1,
        &String::from_str(&env, "Excellent work!"),
    );
    client.analyze_sentiment(
        &content_id,
        &reviewer2,
        &String::from_str(&env, "Very helpful content."),
    );

    // Get all reviews for this content
    let reviews = client.get_content_reviews(&content_id);

    assert_eq!(reviews.len(), 2);
}

#[test]
fn test_get_content_average_sentiment() {
    let env = Env::default();
    let reviewer1 = Address::generate(&env);
    let reviewer2 = Address::generate(&env);
    let reviewer3 = Address::generate(&env);

    let contract_id = env.register(ReviewSystemContract, ());
    let client = ReviewSystemContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    client.initialize();

    let content_id = 15u64;

    // Add reviews with different sentiments
    client.analyze_sentiment(
        &content_id,
        &reviewer1,
        &String::from_str(&env, "Great and helpful!"),
    );
    client.analyze_sentiment(
        &content_id,
        &reviewer2,
        &String::from_str(&env, "Excellent content!"),
    );
    client.analyze_sentiment(
        &content_id,
        &reviewer3,
        &String::from_str(&env, "Good work!"),
    );

    // Get average sentiment
    let avg_sentiment = client.get_content_average_sentiment(&content_id);

    // Should be positive since all reviews are positive
    assert!(avg_sentiment > 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_get_average_sentiment_no_reviews() {
    let env = Env::default();

    let contract_id = env.register(ReviewSystemContract, ());
    let client = ReviewSystemContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    client.initialize();

    // Try to get average for content with no reviews
    client.get_content_average_sentiment(&999);
}

#[test]
fn test_get_reviewer_reviews() {
    let env = Env::default();
    let reviewer = Address::generate(&env);

    let contract_id = env.register(ReviewSystemContract, ());
    let client = ReviewSystemContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    client.initialize();

    // Reviewer adds multiple reviews for different content
    client.analyze_sentiment(&1, &reviewer, &String::from_str(&env, "Great content!"));
    client.analyze_sentiment(&2, &reviewer, &String::from_str(&env, "Very useful!"));
    client.analyze_sentiment(&3, &reviewer, &String::from_str(&env, "Excellent work!"));

    // Get all reviews from this reviewer
    let reviews = client.get_reviewer_reviews(&reviewer);

    assert_eq!(reviews.len(), 3);
}

#[test]
fn test_multiple_reviewers_same_content() {
    let env = Env::default();
    let reviewer1 = Address::generate(&env);
    let reviewer2 = Address::generate(&env);
    let reviewer3 = Address::generate(&env);

    let contract_id = env.register(ReviewSystemContract, ());
    let client = ReviewSystemContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    client.initialize();

    let content_id = 20u64;

    // Different reviewers review the same content
    let id1 = client.analyze_sentiment(&content_id, &reviewer1, &String::from_str(&env, "Great!"));
    let id2 = client.analyze_sentiment(
        &content_id,
        &reviewer2,
        &String::from_str(&env, "Terrible!"),
    );
    let id3 = client.analyze_sentiment(
        &content_id,
        &reviewer3,
        &String::from_str(&env, "Okay stuff"),
    );

    // Verify all reviews are tracked
    assert_eq!(id1, 1);
    assert_eq!(id2, 2);
    assert_eq!(id3, 3);

    // Verify content has all reviews
    let content_reviews = client.get_content_reviews(&content_id);
    assert_eq!(content_reviews.len(), 3);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")]
fn test_invalid_content_id() {
    let env = Env::default();
    let reviewer = Address::generate(&env);

    let contract_id = env.register(ReviewSystemContract, ());
    let client = ReviewSystemContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    client.initialize();

    // Try to submit review with content_id of 0 (invalid)
    client.analyze_sentiment(&0, &reviewer, &String::from_str(&env, "Good content!"));
}

#[test]
fn test_sentiment_score_clamping() {
    let env = Env::default();
    let reviewer = Address::generate(&env);

    let contract_id = env.register(ReviewSystemContract, ());
    let client = ReviewSystemContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    client.initialize();

    // Create review with many positive keywords to test clamping at 100
    let very_positive = String::from_str(
        &env,
        "Great excellent amazing wonderful fantastic awesome perfect brilliant outstanding best best best"
    );

    let review_id = client.analyze_sentiment(&1, &reviewer, &very_positive);
    let sentiment = client.get_review_sentiment(&review_id);

    // Should be clamped at 100
    assert!(sentiment <= 100);
    assert!(sentiment >= 50); // Should be high positive
}
