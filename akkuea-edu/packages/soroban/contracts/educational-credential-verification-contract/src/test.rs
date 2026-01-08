#![cfg(test)]

use crate::{
    datatype::{DisputeStatus, VerificationLevel},
    EducatorVerificationContract, EducatorVerificationContractClient,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    vec, Address, Env, IntoVal, Map, String, Vec,
};

fn setup_test() -> (
    Env,
    EducatorVerificationContractClient<'static>,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, EducatorVerificationContract {});
    let client = EducatorVerificationContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let reviewer = Address::generate(&env);
    let educator = Address::generate(&env);

    client.initialize(&admin);
    client.add_reviewer(&admin, &reviewer);

    (env, client, admin, reviewer, educator)
}

// --- Complete Test Suite ---

#[test]
#[should_panic(expected = "already initialized")]
fn test_initialize_twice() {
    let (_, client, admin, _, _) = setup_test();
    client.initialize(&admin);
}

#[test]
fn test_register_educator() {
    let (env, client, _, _, educator) = setup_test();
    let name = String::from_str(&env, "John Doe");
    let registered_address =
        client.register_educator(&educator, &name, &Vec::new(&env), &Vec::new(&env));
    assert_eq!(registered_address, educator);

    let educator_data = client.get_educator(&educator).unwrap();
    assert_eq!(educator_data.name, name);
    assert_eq!(educator_data.verification_status, false);
    assert_eq!(educator_data.verification_level, VerificationLevel::Pending);
    assert!(educator_data.ratings.is_empty());
}

#[test]
#[should_panic(expected = "not authorized")]
fn test_add_reviewer_unauthorized() {
    let (env, client, _, _, _) = setup_test();
    let non_admin = Address::generate(&env);
    let new_reviewer = Address::generate(&env);
    client.add_reviewer(&non_admin, &new_reviewer);
}

#[test]
fn test_verify_and_revoke() {
    let (env, client, admin, reviewer, educator) = setup_test();
    let mut credentials = Vec::new(&env);
    credentials.push_back(String::from_str(
        &env,
        "0123456789012345678901234567890123456789012345678901234567890123",
    ));
    client.register_educator(
        &educator,
        &"J. Doe".into_val(&env),
        &credentials,
        &Vec::new(&env),
    );
    client.add_verified_credential(&reviewer, &credentials.get_unchecked(0));

    // Verify
    client.verify_educator(&reviewer, &educator, &VerificationLevel::Basic);
    let educator_data = client.get_educator(&educator).unwrap();
    assert_eq!(educator_data.verification_status, true);
    assert!(educator_data.nft_token_id.is_some());

    // Revoke
    client.revoke_verification(&admin, &educator, &"Reason".into_val(&env));
    let educator_data_after_revoke = client.get_educator(&educator).unwrap();
    assert_eq!(educator_data_after_revoke.verification_status, false);
    assert!(educator_data_after_revoke.nft_token_id.is_none());
}

#[test]
fn test_get_educators_by_specialty() {
    let (env, client, _admin, _reviewer, educator) = setup_test();

    // Register an educator with specialties
    let mut specialties = Vec::new(&env);
    specialties.push_back(String::from_str(&env, "Math"));
    specialties.push_back(String::from_str(&env, "Physics"));
    client.register_educator(
        &educator,
        &"John Doe".into_val(&env),
        &Vec::new(&env),
        &specialties,
    );

    // Register another educator with a different specialty
    let another_educator = Address::generate(&env);
    let mut another_specialties = Vec::new(&env);
    another_specialties.push_back(String::from_str(&env, "Biology"));
    client.register_educator(
        &another_educator,
        &"Jane Smith".into_val(&env),
        &Vec::new(&env),
        &another_specialties,
    );

    // Search educators by specialty
    let math_educators = client.get_educators_by_specialty(&String::from_str(&env, "Math"));
    assert_eq!(math_educators.len(), 1);
    assert_eq!(math_educators.get_unchecked(0), educator);

    let biology_educators = client.get_educators_by_specialty(&String::from_str(&env, "Biology"));
    assert_eq!(biology_educators.len(), 1);
    assert_eq!(biology_educators.get_unchecked(0), another_educator);

    let chemistry_educators =
        client.get_educators_by_specialty(&String::from_str(&env, "Chemistry"));
    assert_eq!(chemistry_educators.len(), 0);
}

#[test]
fn test_weighted_review_system() {
    let (env, client, admin, reviewer, educator) = setup_test();
    let expert_reviewer = Address::generate(&env);
    client.add_reviewer(&admin, &expert_reviewer);

    // Register all participants
    client.register_educator(
        &educator,
        &"Educator".into_val(&env),
        &Vec::new(&env),
        &Vec::new(&env),
    );
    client.register_educator(
        &reviewer,
        &"Basic Reviewer".into_val(&env),
        &Vec::new(&env),
        &Vec::new(&env),
    );
    client.register_educator(
        &expert_reviewer,
        &"Expert Reviewer".into_val(&env),
        &Vec::new(&env),
        &Vec::new(&env),
    );

    // Verify reviewers to give them weight
    client.verify_educator(&reviewer, &reviewer, &VerificationLevel::Basic); // Weight 1
    client.verify_educator(&reviewer, &expert_reviewer, &VerificationLevel::Expert); // Weight 3

    // Basic reviewer gives a low score
    let mut ratings1 = Map::new(&env);
    ratings1.set(String::from_str(&env, "Knowledge"), 5);
    client.submit_review(&reviewer, &educator, &ratings1, &"h1".into_val(&env));

    // Expert reviewer gives a high score
    let mut ratings2 = Map::new(&env);
    ratings2.set(String::from_str(&env, "Knowledge"), 10);
    client.submit_review(&expert_reviewer, &educator, &ratings2, &"h2".into_val(&env));

    // Weighted average should be: ((5*1) + (10*3)) / (1+3) = 35 / 4 = 8.75, stored as 8
    let educator_data = client.get_educator(&educator).unwrap();
    let (total_score, total_weight) = educator_data
        .ratings
        .get(String::from_str(&env, "Knowledge"))
        .unwrap();
    assert_eq!(total_score / total_weight, 8);
}

#[test]
fn test_analytics_trend_and_performance() {
    let (env, client, admin, reviewer, educator) = setup_test();

    // Register participants
    client.register_educator(
        &educator,
        &"E".into_val(&env),
        &Vec::new(&env),
        &vec![&env, "Physics".into_val(&env)],
    );
    client.register_educator(
        &reviewer,
        &"R".into_val(&env),
        &Vec::new(&env),
        &Vec::new(&env),
    );

    // Day 1: Verification and a review
    client.verify_educator(&reviewer, &reviewer, &VerificationLevel::Basic);
    client.verify_educator(&reviewer, &educator, &VerificationLevel::Basic);
    client.submit_review(&reviewer, &educator, &Map::new(&env), &"h1".into_val(&env));
    client.recalculate_analytics(&admin);

    // Day 2: Another review and a dispute
    env.ledger().with_mut(|li| {
        li.timestamp += 86400;
    }); // Advance time by 1 day
    client.submit_review(&reviewer, &educator, &Map::new(&env), &"h2".into_val(&env));
    client.dispute_review(&educator, &1, &"reason".into_val(&env));
    client.recalculate_analytics(&admin);

    let analytics = client.get_analytics();
    assert_eq!(analytics.history.len(), 4);
    let snapshot1 = analytics.history.get_unchecked(2);
    let snapshot2 = analytics.history.get_unchecked(3);

    assert_eq!(snapshot1.total_verifications, 2);
    assert_eq!(snapshot1.total_reviews, 1);
    assert_eq!(snapshot2.total_reviews, 2);
    assert_eq!(snapshot2.total_disputes, 1);

    // Check performance metrics
    let perf = client.get_reviewer_performance(&reviewer).unwrap();
    assert_eq!(perf.reviews_submitted, 2);
    assert_eq!(perf.disputes_received, 1);
}

#[test]
fn test_verify_and_dispute_review() {
    let (env, client, admin, reviewer, educator) = setup_test();
    let verifier = Address::generate(&env);
    client.add_reviewer(&admin, &verifier);

    // Register participants
    client.register_educator(
        &educator,
        &"E".into_val(&env),
        &Vec::new(&env),
        &Vec::new(&env),
    );
    client.register_educator(
        &reviewer,
        &"R".into_val(&env),
        &Vec::new(&env),
        &Vec::new(&env),
    );

    // Verify the reviewer so they have weight and are allowed to submit a review.
    client.verify_educator(&reviewer, &reviewer, &VerificationLevel::Basic);

    // Submit a review first
    client.submit_review(&reviewer, &educator, &Map::new(&env), &"h1".into_val(&env));

    // 1. Verify the review
    client.verify_review(&verifier, &educator, &1);
    let reviews = client.get_educator_reviews(&educator);
    let review = reviews.get_unchecked(0);
    assert_eq!(review.verifiers.len(), 1);
    assert_eq!(review.verifiers.get_unchecked(0), verifier);

    // 2. Dispute the review
    client.dispute_review(&educator, &1, &"reason_hash".into_val(&env));
    let reviews_after_dispute = client.get_educator_reviews(&educator);
    let review_after_dispute = reviews_after_dispute.get_unchecked(0);
    assert_eq!(review_after_dispute.dispute_status, DisputeStatus::Active);

    // 3. Resolve the dispute
    client.resolve_dispute(&admin, &educator, &1);
    let reviews_after_resolve = client.get_educator_reviews(&educator);
    let review_after_resolve = reviews_after_resolve.get_unchecked(0);
    assert_eq!(review_after_resolve.dispute_status, DisputeStatus::Resolved);
}
