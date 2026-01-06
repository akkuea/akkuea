#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, LedgerInfo},
    Address, Env, Symbol, Vec as SorobanVec,
};

fn create_env() -> Env {
    Env::default()
}

fn register_contract(env: &Env) -> Address {
    env.register(Contract, ())
}

fn setup_ledger_time(env: &Env, timestamp: u64) {
    env.ledger().set(LedgerInfo {
        timestamp,
        protocol_version: 22,
        sequence_number: env.ledger().sequence(),
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1_000_000,
        min_persistent_entry_ttl: 1_000_000,
        max_entry_ttl: 6_312_000,
    });
}

fn create_client<'a>(env: &'a Env, contract_id: &Address) -> ContractClient<'a> {
    ContractClient::new(env, contract_id)
}

fn create_expertise_vec(env: &Env, tags: &[&str]) -> SorobanVec<Symbol> {
    let mut expertise = SorobanVec::new(env);
    for tag in tags {
        expertise.push_back(Symbol::new(env, tag));
    }
    expertise
}

// ==================== USER REGISTRATION TESTS ====================

#[test]
fn test_register_user_success() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let expertise = create_expertise_vec(&env, &["rust", "blockchain"]);
    let timestamp = 1746000000u64;
    setup_ledger_time(&env, timestamp);

    // Register user
    client.register(&user, &expertise);

    // Verify user is registered
    assert!(client.is_registered(&user));

    // Verify user profile data
    let profile = client.get_user(&user);
    assert_eq!(profile.address, user);
    assert_eq!(profile.reputation, 0);
    assert_eq!(profile.contributions, 0);
    assert_eq!(profile.registered_at, timestamp);
    assert_eq!(profile.expertise, expertise);
}

#[test]
#[should_panic(expected = "User already registered")]
fn test_register_duplicate_user_fails() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let expertise = create_expertise_vec(&env, &["rust"]);

    // Register user first time
    client.register(&user, &expertise);

    // Attempt to register same user again - should panic
    client.register(&user, &expertise);
}

#[test]
fn test_register_user_with_empty_expertise() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let empty_expertise = SorobanVec::new(&env);

    // Register user with empty expertise
    client.register(&user, &empty_expertise);

    // Verify registration succeeded
    assert!(client.is_registered(&user));
    let profile = client.get_user(&user);
    assert_eq!(profile.expertise.len(), 0);
}

// ==================== REPUTATION UPDATE TESTS ====================

#[test]
fn test_update_reputation_positive_delta() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let expertise = create_expertise_vec(&env, &["rust"]);
    let reason = Symbol::new(&env, "good_answer");

    // Register user first
    client.register(&user, &expertise);

    // Update reputation with positive delta
    client.update_reputation(&user, &50, &reason);

    // Verify reputation was updated
    let profile = client.get_user(&user);
    assert_eq!(profile.reputation, 50);
}

#[test]
fn test_update_reputation_negative_delta() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let expertise = create_expertise_vec(&env, &["rust"]);
    let reason = Symbol::new(&env, "penalty");

    // Register user and give initial reputation
    client.register(&user, &expertise);
    client.update_reputation(&user, &100, &Symbol::new(&env, "initial"));

    // Update reputation with negative delta
    client.update_reputation(&user, &-30, &reason);

    // Verify reputation was updated correctly
    let profile = client.get_user(&user);
    assert_eq!(profile.reputation, 70);

    // Attempt underflow
    client.update_reputation(&user, &-200, &reason);

    // Verify reputation was updated correctly and handling underflow
    let profile = client.get_user(&user);
    assert_eq!(profile.reputation, 0);
}

#[test]
fn test_update_reputation_zero_delta() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let expertise = create_expertise_vec(&env, &["rust"]);
    let reason = Symbol::new(&env, "neutral");

    // Register user
    client.register(&user, &expertise);

    // Update reputation with zero delta
    client.update_reputation(&user, &0, &reason);

    // Verify reputation remains unchanged
    let profile = client.get_user(&user);
    assert_eq!(profile.reputation, 0);
}

#[test]
#[should_panic(expected = "User not registered")]
fn test_update_reputation_unregistered_user_fails() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let reason = Symbol::new(&env, "test");

    // Attempt to update reputation for unregistered user
    client.update_reputation(&user, &50, &reason);
}

// ==================== DATA RETRIEVAL TESTS ====================

#[test]
fn test_is_registered_returns_correct_status() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let registered_user = Address::generate(&env);
    let unregistered_user = Address::generate(&env);
    let expertise = create_expertise_vec(&env, &["rust"]);

    // Register one user
    client.register(&registered_user, &expertise);

    // Test registered user
    assert!(client.is_registered(&registered_user));

    // Test unregistered user
    assert!(!client.is_registered(&unregistered_user));
}

#[test]
#[should_panic(expected = "User not registered")]
fn test_get_user_profile_unregistered_user_fails() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);

    // Attempt to get profile for unregistered user
    client.get_user(&user);
}

#[test]
fn test_get_user_profile_returns_complete_data() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let expertise = create_expertise_vec(&env, &["rust", "solidity"]);
    let timestamp = 1746000000u64;
    setup_ledger_time(&env, timestamp);

    // Register and update user
    client.register(&user, &expertise);
    client.update_reputation(&user, &100, &Symbol::new(&env, "test"));

    // Get and verify profile
    let profile = client.get_user(&user);
    assert_eq!(profile.address, user);
    assert_eq!(profile.reputation, 100);
    assert_eq!(profile.expertise, expertise);
    assert_eq!(profile.contributions, 0);
    assert_eq!(profile.registered_at, timestamp);
}

// ==================== EXPERTISE MANAGEMENT TESTS ====================

#[test]
fn test_update_expertise_success() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let initial_expertise = create_expertise_vec(&env, &["rust"]);
    let new_expertise = create_expertise_vec(&env, &["python", "javascript"]);

    // Register user with initial expertise
    client.register(&user, &initial_expertise);

    // Update expertise
    client.update_expertise(&user, &new_expertise);

    // Verify expertise was updated
    let profile = client.get_user(&user);
    assert_eq!(profile.expertise, new_expertise);
}

#[test]
fn test_add_expertise_success() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let initial_expertise = create_expertise_vec(&env, &["rust"]);
    let new_tag = Symbol::new(&env, "blockchain");

    // Register user
    client.register(&user, &initial_expertise);

    // Add new expertise
    client.add_expertise(&user, &new_tag);

    // Verify expertise was added
    let profile = client.get_user(&user);
    assert_eq!(profile.expertise.len(), 2);
    assert!(profile.expertise.contains(&new_tag));
}

#[test]
fn test_remove_expertise_success() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let tag_to_remove = Symbol::new(&env, "rust");
    let tag_to_keep = Symbol::new(&env, "blockchain");
    let expertise = soroban_sdk::vec![&env, tag_to_remove.clone(), tag_to_keep.clone()];

    // Register user with multiple expertise tags
    client.register(&user, &expertise);

    // Remove one expertise tag
    client.remove_expertise(&user, &tag_to_remove);

    // Verify expertise was removed
    let profile = client.get_user(&user);
    assert_eq!(profile.expertise.len(), 1);
    assert!(!profile.expertise.contains(&tag_to_remove));
    assert!(profile.expertise.contains(&tag_to_keep));
}

// ==================== USER MANAGEMENT TESTS ====================

#[test]
fn test_reset_reputation_success() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let expertise = create_expertise_vec(&env, &["rust"]);

    // Register user and give reputation
    client.register(&user, &expertise);
    client.update_reputation(&user, &100, &Symbol::new(&env, "test"));

    // Reset reputation
    client.reset_reputation(&user);

    // Verify reputation was reset
    let profile = client.get_user(&user);
    assert_eq!(profile.reputation, 0);
}

#[test]
fn test_remove_user_success() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let expertise = create_expertise_vec(&env, &["rust"]);

    // Register user
    client.register(&user, &expertise);
    assert!(client.is_registered(&user));

    // Remove user
    client.remove_user(&user);

    // Verify user was removed
    assert!(!client.is_registered(&user));
}

#[test]
fn test_get_user_count() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let expertise = create_expertise_vec(&env, &["rust"]);

    // Initially no users
    assert_eq!(client.get_user_count(), 0);

    // Register first user
    let user1 = Address::generate(&env);
    client.register(&user1, &expertise);
    assert_eq!(client.get_user_count(), 1);

    // Register second user
    let user2 = Address::generate(&env);
    client.register(&user2, &expertise);
    assert_eq!(client.get_user_count(), 2);

    // Remove one user
    client.remove_user(&user1);
    assert_eq!(client.get_user_count(), 1);
}

#[test]
fn test_get_all_users() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let expertise = create_expertise_vec(&env, &["rust"]);

    // Register users
    client.register(&user1, &expertise);
    client.register(&user2, &expertise);

    // Get all users
    let all_users = client.get_all_users();
    assert_eq!(all_users.len(), 2);
    assert!(all_users.contains(&user1));
    assert!(all_users.contains(&user2));
}

#[test]
fn test_get_recent_users() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let expertise = create_expertise_vec(&env, &["rust"]);
    let base_time = 1746000000u64;

    // Register user at base time
    setup_ledger_time(&env, base_time);
    let user1 = Address::generate(&env);
    client.register(&user1, &expertise);

    // Register user at later time
    setup_ledger_time(&env, base_time + 1000);
    let user2 = Address::generate(&env);
    client.register(&user2, &expertise);

    // Get recent users (cutoff after first user)
    let recent_users = client.get_recent_users(&(base_time + 500));
    assert_eq!(recent_users.len(), 1);
    assert_eq!(recent_users.get(0).unwrap().address, user2);
}

// ==================== MASS OPERATIONS TESTS ====================

#[test]
fn test_reset_all_reputations() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let expertise = create_expertise_vec(&env, &["rust"]);

    // Register users and give them reputation
    client.register(&user1, &expertise);
    client.register(&user2, &expertise);
    client.update_reputation(&user1, &100, &Symbol::new(&env, "test"));
    client.update_reputation(&user2, &200, &Symbol::new(&env, "test"));

    // Reset all reputations
    client.reset_all_reputations();

    // Verify all reputations were reset
    assert_eq!(client.get_user(&user1).reputation, 0);
    assert_eq!(client.get_user(&user2).reputation, 0);
}

#[test]
fn test_remove_all_users() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let expertise = create_expertise_vec(&env, &["rust"]);

    // Register users
    client.register(&user1, &expertise);
    client.register(&user2, &expertise);
    assert_eq!(client.get_user_count(), 2);

    // Remove all users
    client.remove_all_users();

    // Verify all users were removed
    assert_eq!(client.get_user_count(), 0);
    assert!(!client.is_registered(&user1));
    assert!(!client.is_registered(&user2));
}

// ==================== EDGE CASES AND ERROR HANDLING ====================

#[test]
fn test_multiple_reputation_updates_accumulate() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let expertise = create_expertise_vec(&env, &["rust"]);

    // Register user
    client.register(&user, &expertise);

    // Multiple reputation updates
    client.update_reputation(&user, &50, &Symbol::new(&env, "answer1"));
    client.update_reputation(&user, &30, &Symbol::new(&env, "answer2"));
    client.update_reputation(&user, &-10, &Symbol::new(&env, "penalty"));

    // Verify final reputation
    let profile = client.get_user(&user);
    assert_eq!(profile.reputation, 70);
}

#[test]
fn test_reputation_underflow_prevention() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let expertise = create_expertise_vec(&env, &["rust"]);

    // Register user with some reputation
    client.register(&user, &expertise);
    client.update_reputation(&user, &50, &Symbol::new(&env, "initial"));

    // Apply large negative delta that would cause underflow
    // This should be handled gracefully by saturating_sub
    client.update_reputation(&user, &-100, &Symbol::new(&env, "penalty"));

    // Verify reputation didn't underflow (should be 0)
    let profile = client.get_user(&user);
    assert_eq!(profile.reputation, 0);
}

#[test]
fn test_add_duplicate_expertise_ignored() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let tag = Symbol::new(&env, "rust");
    let expertise = soroban_sdk::vec![&env, tag.clone()];

    // Register user with expertise
    client.register(&user, &expertise);

    // Try to add same expertise again
    client.add_expertise(&user, &tag);

    // Verify expertise wasn't duplicated
    let profile = client.get_user(&user);
    assert_eq!(profile.expertise.len(), 1);
}

#[test]
fn test_remove_nonexistent_expertise_ignored() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let existing_tag = Symbol::new(&env, "rust");
    let nonexistent_tag = Symbol::new(&env, "python");
    let expertise = soroban_sdk::vec![&env, existing_tag.clone()];

    // Register user with one expertise
    client.register(&user, &expertise);

    // Try to remove nonexistent expertise
    client.remove_expertise(&user, &nonexistent_tag);

    // Verify existing expertise wasn't affected
    let profile = client.get_user(&user);
    assert_eq!(profile.expertise.len(), 1);
    assert!(profile.expertise.contains(&existing_tag));
}

// ==================== NON-TRANSFERABILITY TESTS ====================

#[test]
fn test_reputation_non_transferability() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let expertise = create_expertise_vec(&env, &["rust"]);

    // Register both users
    client.register(&user1, &expertise);
    client.register(&user2, &expertise);

    // Give reputation to user1
    client.update_reputation(&user1, &100, &Symbol::new(&env, "test"));

    // Verify reputation is bound to specific user
    assert_eq!(client.get_user(&user1).reputation, 100);
    assert_eq!(client.get_user(&user2).reputation, 0);

    // The contract design inherently prevents reputation transfer
    // as there are no transfer functions and reputation can only be
    // modified through update_reputation which is tied to specific addresses
}

#[test]
fn test_reputation_modification_only_through_contract() {
    let env = create_env();
    env.mock_all_auths();
    let contract_id = register_contract(&env);
    let client = create_client(&env, &contract_id);

    let user = Address::generate(&env);
    let expertise = create_expertise_vec(&env, &["rust"]);

    // Register user
    client.register(&user, &expertise);

    // Reputation can only be modified through contract functions
    // Direct storage manipulation is not possible from outside the contract
    // This test verifies the architectural constraint

    let initial_reputation = client.get_user(&user).reputation;

    // Only way to change reputation is through contract functions
    client.update_reputation(&user, &50, &Symbol::new(&env, "test"));

    let updated_reputation = client.get_user(&user).reputation;
    assert_eq!(updated_reputation, initial_reputation + 50);
}
