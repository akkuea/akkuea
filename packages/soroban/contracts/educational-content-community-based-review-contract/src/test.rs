use crate::{CommunityModeration, CommunityModerationClient};
use soroban_sdk::{
    testutils::{Address as _, Events},
    Address, Env, String, Symbol, TryIntoVal,
};

// Mock Reputation Contract
mod reputation_mock {
    use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

    #[derive(Clone, Debug, Eq, PartialEq)]
    #[contracttype]
    pub enum ReputationTier {
        New,
        Low,
        Medium,
        High,
    }

    #[derive(Clone, Debug, Eq, PartialEq)]
    #[contracttype]
    pub struct ReputationData {
        pub reputation_score: u32,
        pub reputation_tier: ReputationTier,
    }

    #[contract]
    pub struct ReputationContract;

    #[contractimpl]
    impl ReputationContract {
        pub fn get_user_reputation(_env: Env, _user: Address) -> ReputationData {
            ReputationData {
                reputation_score: 100,
                reputation_tier: ReputationTier::High,
            }
        }
    }
}

use reputation_mock::ReputationContract;

fn create_moderation_contract<'a>(env: &Env) -> (CommunityModerationClient<'a>, Address, Address) {
    let admin = Address::generate(env);

    // Deploy mock reputation contract
    let reputation_contract_id = env.register(ReputationContract, ());

    // Deploy moderation contract
    let contract_id = env.register(CommunityModeration, ());
    let client = CommunityModerationClient::new(env, &contract_id);

    client.initialize(&admin, &reputation_contract_id);

    (client, admin, reputation_contract_id)
}

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let reputation_contract = Address::generate(&env);

    let contract_id = env.register(CommunityModeration, ());
    let client = CommunityModerationClient::new(&env, &contract_id);

    client.initialize(&admin, &reputation_contract);

    // Verify initialization worked by trying to flag a review
    let flagger = Address::generate(&env);
    env.mock_all_auths();

    client.flag_review(&flagger, &1, &String::from_str(&env, "Spam content"));
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_initialize_twice_fails() {
    let env = Env::default();
    let (client, admin, reputation_contract) = create_moderation_contract(&env);

    // Try to initialize again
    client.initialize(&admin, &reputation_contract);
}

#[test]
fn test_flag_review() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _rep) = create_moderation_contract(&env);
    let flagger = Address::generate(&env);
    let review_id = 1u64;
    let reason = String::from_str(&env, "Inappropriate content");

    client.flag_review(&flagger, &review_id, &reason);

    // Verify flag was created
    let flag = client.get_flag(&review_id).unwrap();
    assert_eq!(flag.review_id, review_id);
    assert_eq!(flag.flagger, flagger);
    assert_eq!(flag.reason, reason);
    assert_eq!(flag.votes_approve, 0);
    assert_eq!(flag.votes_reject, 0);
    assert_eq!(flag.resolved, false);
}

#[test]
fn test_flag_review_requires_auth() {
    let env = Env::default();
    let (client, _admin, _rep) = create_moderation_contract(&env);
    let flagger = Address::generate(&env);

    // Mock only the flagger's auth
    env.mock_all_auths_allowing_non_root_auth();

    client.flag_review(&flagger, &1, &String::from_str(&env, "Spam"));

    // Verify auth was called
    assert!(env.auths().len() > 0);
}

#[test]
#[should_panic(expected = "Review already flagged")]
fn test_flag_review_twice_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _rep) = create_moderation_contract(&env);
    let flagger = Address::generate(&env);
    let review_id = 1u64;

    client.flag_review(&flagger, &review_id, &String::from_str(&env, "Spam"));
    client.flag_review(&flagger, &review_id, &String::from_str(&env, "Spam again"));
}

#[test]
fn test_vote_moderation() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _rep) = create_moderation_contract(&env);
    let flagger = Address::generate(&env);
    let voter = Address::generate(&env);
    let review_id = 1u64;

    // Flag the review first
    client.flag_review(&flagger, &review_id, &String::from_str(&env, "Spam"));

    // Vote to approve removal
    client.vote_moderation(&voter, &review_id, &true);

    // Verify vote was recorded (weight = 1 + 100/20 = 6)
    let flag = client.get_flag(&review_id).unwrap();
    assert_eq!(flag.votes_approve, 6);
    assert_eq!(flag.votes_reject, 0);
    assert_eq!(flag.resolved, false); // Not resolved yet (needs 10+ total votes with majority)
}

#[test]
#[should_panic(expected = "Voter has already voted")]
fn test_vote_twice_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _rep) = create_moderation_contract(&env);
    let flagger = Address::generate(&env);
    let voter = Address::generate(&env);
    let review_id = 1u64;

    client.flag_review(&flagger, &review_id, &String::from_str(&env, "Spam"));
    client.vote_moderation(&voter, &review_id, &true);
    client.vote_moderation(&voter, &review_id, &true); // Should panic
}

#[test]
#[should_panic(expected = "Flag not found")]
fn test_vote_non_existent_flag_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _rep) = create_moderation_contract(&env);
    let voter = Address::generate(&env);

    client.vote_moderation(&voter, &999, &true);
}

#[test]
fn test_auto_resolution_on_approval() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _rep) = create_moderation_contract(&env);
    let flagger = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    let review_id = 1u64;

    client.flag_review(&flagger, &review_id, &String::from_str(&env, "Spam"));

    // First vote (weight 6)
    client.vote_moderation(&voter1, &review_id, &true);
    let flag = client.get_flag(&review_id).unwrap();
    assert_eq!(flag.resolved, false); // Not resolved yet

    // Second vote (weight 6, total 12 >= 10 threshold)
    client.vote_moderation(&voter2, &review_id, &true);

    let flag = client.get_flag(&review_id).unwrap();
    assert_eq!(flag.resolved, true);
    assert_eq!(flag.votes_approve, 12);
    assert_eq!(flag.votes_reject, 0);
}

#[test]
fn test_auto_resolution_on_rejection() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _rep) = create_moderation_contract(&env);
    let flagger = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    let review_id = 1u64;

    client.flag_review(&flagger, &review_id, &String::from_str(&env, "Spam"));

    // Two votes rejecting the flag (total 12 >= 10 threshold)
    client.vote_moderation(&voter1, &review_id, &false);
    client.vote_moderation(&voter2, &review_id, &false);

    let flag = client.get_flag(&review_id).unwrap();
    assert_eq!(flag.resolved, true);
    assert_eq!(flag.votes_approve, 0);
    assert_eq!(flag.votes_reject, 12);
}

#[test]
#[should_panic(expected = "Moderation already resolved")]
fn test_vote_on_resolved_flag_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _rep) = create_moderation_contract(&env);
    let flagger = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    let voter3 = Address::generate(&env);
    let review_id = 1u64;

    client.flag_review(&flagger, &review_id, &String::from_str(&env, "Spam"));
    client.vote_moderation(&voter1, &review_id, &true);
    client.vote_moderation(&voter2, &review_id, &true); // Resolves (12 votes >= 10 threshold)

    // Try to vote on resolved flag
    client.vote_moderation(&voter3, &review_id, &true);
}

#[test]
fn test_admin_resolve() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _rep) = create_moderation_contract(&env);
    let flagger = Address::generate(&env);
    let review_id = 1u64;

    client.flag_review(&flagger, &review_id, &String::from_str(&env, "Spam"));

    // Admin resolves without waiting for votes
    client.admin_resolve(&review_id, &true);

    let flag = client.get_flag(&review_id).unwrap();
    assert_eq!(flag.resolved, true);
}

#[test]
#[should_panic(expected = "Flag not found")]
fn test_admin_resolve_non_existent_flag() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _rep) = create_moderation_contract(&env);

    client.admin_resolve(&999, &true);
}

#[test]
#[should_panic(expected = "Moderation already resolved")]
fn test_admin_resolve_already_resolved() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _rep) = create_moderation_contract(&env);
    let flagger = Address::generate(&env);
    let review_id = 1u64;

    client.flag_review(&flagger, &review_id, &String::from_str(&env, "Spam"));
    client.admin_resolve(&review_id, &true);
    client.admin_resolve(&review_id, &false); // Should panic
}

#[test]
fn test_get_flag_returns_none_for_non_existent() {
    let env = Env::default();
    let (client, _admin, _rep) = create_moderation_contract(&env);

    let result = client.get_flag(&999);
    assert_eq!(result, None);
}

#[test]
fn test_mixed_votes() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _rep) = create_moderation_contract(&env);
    let flagger = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    let voter3 = Address::generate(&env);
    let review_id = 1u64;

    client.flag_review(
        &flagger,
        &review_id,
        &String::from_str(&env, "Questionable"),
    );

    // 2 approve, 1 reject (total 18 >= 10 threshold)
    client.vote_moderation(&voter1, &review_id, &true); // 6 approve
    client.vote_moderation(&voter2, &review_id, &false); // 6 reject
    client.vote_moderation(&voter3, &review_id, &true); // 12 approve total

    // Should resolve with approval winning (12 > 6, total 18 >= 10)
    let flag = client.get_flag(&review_id).unwrap();
    assert_eq!(flag.resolved, true);
    assert_eq!(flag.votes_approve, 12);
    assert_eq!(flag.votes_reject, 6);
}

#[test]
fn test_event_emission_on_flag() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _rep) = create_moderation_contract(&env);
    let flagger = Address::generate(&env);
    let review_id = 1u64;

    client.flag_review(&flagger, &review_id, &String::from_str(&env, "Spam"));

    let events = env.events().all();
    let event = events.last().unwrap();

    // Event structure is (contract_id, topics, data)
    assert_eq!(event.0, client.address);
    let topics = &event.1;
    assert_eq!(topics.len(), 1);
    // Compare as Symbol directly
    let topic_val = topics.get(0).unwrap();
    let topic_symbol: Symbol = topic_val.try_into_val(&env).unwrap();
    assert_eq!(topic_symbol, Symbol::new(&env, "review_flagged"));
}

#[test]
fn test_event_emission_on_vote() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _rep) = create_moderation_contract(&env);
    let flagger = Address::generate(&env);
    let voter = Address::generate(&env);
    let review_id = 1u64;

    client.flag_review(&flagger, &review_id, &String::from_str(&env, "Spam"));
    client.vote_moderation(&voter, &review_id, &true);

    let events = env.events().all();
    let last_event = events.last().unwrap();

    let topics = &last_event.1;
    let topic_val = topics.get(0).unwrap();
    let topic_symbol: Symbol = topic_val.try_into_val(&env).unwrap();
    assert_eq!(topic_symbol, Symbol::new(&env, "moderation_voted"));
}

#[test]
fn test_event_emission_on_resolution() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _rep) = create_moderation_contract(&env);
    let flagger = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    let review_id = 1u64;

    client.flag_review(&flagger, &review_id, &String::from_str(&env, "Spam"));
    client.vote_moderation(&voter1, &review_id, &true);
    client.vote_moderation(&voter2, &review_id, &true); // Should trigger resolution

    let events = env.events().all();
    let resolution_count = events
        .iter()
        .filter(|e| {
            let topics = &e.1;
            let topic_val = topics.get(0).unwrap();
            let topic_symbol: Result<Symbol, _> = topic_val.try_into_val(&env);
            topic_symbol.map_or(false, |s| s == Symbol::new(&env, "moderation_resolved"))
        })
        .count();

    assert_eq!(resolution_count, 1);
}
