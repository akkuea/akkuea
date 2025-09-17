#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String, Vec,
};

#[test]
fn test_initialize_user() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let user_address = Address::generate(&env);
    let name = String::from_str(&env, "Test User");

    env.mock_all_auths();

    let user_id = client.initialize_user(&user_address, &name);
    assert_eq!(user_id, 1);

    // Test duplicate initialization
    let result = client.try_initialize_user(&user_address, &name);
    assert!(result.is_err());
}

#[test]
fn test_get_reputation() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let user_address = Address::generate(&env);
    let name = String::from_str(&env, "Test User");

    env.mock_all_auths();

    client.initialize_user(&user_address, &name);

    let reputation = client.get_reputation(&user_address);
    assert_eq!(reputation.user, user_address);
    assert_eq!(reputation.score, 50); // Initial neutral score
    assert_eq!(reputation.projects_completed, 0);
    assert_eq!(reputation.milestones_missed, 0);
    assert_eq!(reputation.total_projects, 0);
}

#[test]
fn test_update_reputation_success() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let user_address = Address::generate(&env);
    let admin_address = Address::generate(&env);
    let name = String::from_str(&env, "Test User");

    env.mock_all_auths();

    client.initialize_user(&user_address, &name);

    // Update reputation for successful project
    client.update_reputation(&admin_address, &user_address, &1, &true);

    let reputation = client.get_reputation(&user_address);
    assert_eq!(reputation.score, 60); // 50 + 10 for success
    assert_eq!(reputation.projects_completed, 1);
    assert_eq!(reputation.total_projects, 1);
}

#[test]
fn test_update_reputation_failure() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let user_address = Address::generate(&env);
    let admin_address = Address::generate(&env);
    let name = String::from_str(&env, "Test User");

    env.mock_all_auths();

    client.initialize_user(&user_address, &name);

    // Update reputation for failed project
    client.update_reputation(&admin_address, &user_address, &1, &false);

    let reputation = client.get_reputation(&user_address);
    assert_eq!(reputation.score, 45); // 50 - 5 for failure
    assert_eq!(reputation.projects_completed, 0);
    assert_eq!(reputation.total_projects, 1);
}

#[test]
fn test_get_voting_power() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let user_address = Address::generate(&env);
    let admin_address = Address::generate(&env);
    let name = String::from_str(&env, "Test User");

    env.mock_all_auths();

    client.initialize_user(&user_address, &name);

    // Initial voting power (score 50)
    let voting_power = client.get_voting_power(&user_address);
    assert_eq!(voting_power, 6); // 1 + (50 / 10) = 6

    // Increase reputation and check voting power
    client.update_reputation(&admin_address, &user_address, &1, &true);
    let voting_power = client.get_voting_power(&user_address);
    assert_eq!(voting_power, 7); // 1 + (60 / 10) = 7
}

#[test]
fn test_penalize_missed_milestone() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let user_address = Address::generate(&env);
    let admin_address = Address::generate(&env);
    let name = String::from_str(&env, "Test User");

    env.mock_all_auths();

    client.initialize_user(&user_address, &name);

    // Apply penalty for missed milestone
    client.penalize_missed_milestone(&admin_address, &user_address, &1);

    let reputation = client.get_reputation(&user_address);
    assert_eq!(reputation.score, 35); // 50 - 15 penalty
    assert_eq!(reputation.milestones_missed, 1);
}

#[test]
fn test_vote_for_project() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let voter_address = Address::generate(&env);
    let name = String::from_str(&env, "Test Voter");

    env.mock_all_auths();

    client.initialize_user(&voter_address, &name);

    // Vote for project
    let voting_power = client.vote_for_project(&voter_address, &1);
    assert_eq!(voting_power, 6); // Initial voting power

    // Check project voting power
    let project_voting_power = client.get_project_voting_power(&1);
    assert_eq!(project_voting_power, 6);

    // Test duplicate vote
    let result = client.try_vote_for_project(&voter_address, &1);
    assert!(result.is_err());
}

#[test]
fn test_multiple_voters() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    let voter3 = Address::generate(&env);
    let name = String::from_str(&env, "Test Voter");

    env.mock_all_auths();

    client.initialize_user(&voter1, &name);
    client.initialize_user(&voter2, &name);
    client.initialize_user(&voter3, &name);

    // All voters vote for the same project
    client.vote_for_project(&voter1, &1);
    client.vote_for_project(&voter2, &1);
    client.vote_for_project(&voter3, &1);

    // Check total voting power (3 * 6 = 18)
    let project_voting_power = client.get_project_voting_power(&1);
    assert_eq!(project_voting_power, 18);

    // Get voters with their voting power
    let voters = client.get_project_voters(&1);
    assert_eq!(voters.len(), 3);
    assert_eq!(voters.get(voter1), Some(6));
    assert_eq!(voters.get(voter2), Some(6));
    assert_eq!(voters.get(voter3), Some(6));
}

#[test]
fn test_project_approval() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    // Create multiple voters with high reputation
    let mut voters = Vec::new(&env);
    let name = String::from_str(&env, "Test Voter");

    env.mock_all_auths();

    // Create 20 voters (each with voting power 6 = 120 total, above 100 threshold)
    for _i in 0..20 {
        let voter = Address::generate(&env);
        client.initialize_user(&voter, &name);
        voters.push_back(voter);
    }

    // All voters vote for the same project
    for voter in voters.iter() {
        client.vote_for_project(&voter, &1);
    }

    // Check total voting power (20 * 6 = 120)
    let project_voting_power = client.get_project_voting_power(&1);
    assert_eq!(project_voting_power, 120);
}

#[test]
fn test_complete_milestone() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let creator_address = Address::generate(&env);
    let admin_address = Address::generate(&env);
    let name = String::from_str(&env, "Test Creator");

    env.mock_all_auths();

    client.initialize_user(&creator_address, &name);

    // Complete milestone
    client.complete_milestone(&admin_address, &1, &1, &creator_address);

    let reputation = client.get_reputation(&creator_address);
    assert_eq!(reputation.score, 60); // 50 + 10 for successful completion
    assert_eq!(reputation.projects_completed, 1);
}

#[test]
fn test_reputation_stats() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let admin = Address::generate(&env);
    let name = String::from_str(&env, "Test User");

    env.mock_all_auths();

    client.initialize_user(&user1, &name);
    client.initialize_user(&user2, &name);

    // Update reputations
    client.update_reputation(&admin, &user1, &1, &true); // 50 -> 60
    client.update_reputation(&admin, &user2, &1, &false); // 50 -> 45
    client.penalize_missed_milestone(&admin, &user1, &1); // 60 -> 45

    let stats = client.get_reputation_stats();
    assert_eq!(stats.total_users, 2);
    assert_eq!(stats.average_reputation, 45); // (45 + 45) / 2
    assert_eq!(stats.total_projects_completed, 1);
    assert_eq!(stats.total_milestones_missed, 1);
    assert_eq!(stats.highest_reputation, 45);
    assert_eq!(stats.lowest_reputation, 45);
}

#[test]
fn test_reputation_underflow_protection() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let user_address = Address::generate(&env);
    let admin_address = Address::generate(&env);
    let name = String::from_str(&env, "Test User");

    env.mock_all_auths();

    client.initialize_user(&user_address, &name);

    // Try to apply multiple penalties that would cause underflow
    for _ in 0..4 {
        let result = client.try_penalize_missed_milestone(&admin_address, &user_address, &1);
        if result.is_err() {
            break; // Should fail on 4th penalty (50 - 4*15 = -10)
        }
    }

    let reputation = client.get_reputation(&user_address);
    assert_eq!(reputation.score, 5); // 50 - 3*15 = 5 (last penalty should fail)
}

#[test]
fn test_reputation_overflow_protection() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let user_address = Address::generate(&env);
    let admin_address = Address::generate(&env);
    let name = String::from_str(&env, "Test User");

    env.mock_all_auths();

    client.initialize_user(&user_address, &name);

    // Apply many successful updates (should cap at 100)
    for i in 0..10 {
        client.update_reputation(&admin_address, &user_address, &i, &true);
    }

    let reputation = client.get_reputation(&user_address);
    assert_eq!(reputation.score, 100); // Capped at maximum
    assert_eq!(reputation.projects_completed, 10);
}

// ===== MILESTONE SYSTEM TESTS =====

#[test]
fn test_initialize_milestone_system() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    client.initialize_milestone_system();
    // System should be initialized without errors
}

#[test]
fn test_initialize_project_funding() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let admin_address = Address::generate(&env);
    let project_id = 1u64;
    let total_funding = 1000000i128; // 1 XLM in stroops

    env.mock_all_auths();

    client.initialize_project_funding(&admin_address, &project_id, &total_funding);

    let funding_info = client.get_project_funding_info(&project_id).unwrap();
    assert_eq!(funding_info.project_id, project_id);
    assert_eq!(funding_info.total_funding, total_funding);
    assert_eq!(funding_info.released_funding, 0);
    assert_eq!(funding_info.available_funding, total_funding);
}

#[test]
fn test_create_milestone_without_dependencies() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let admin_address = Address::generate(&env);
    let project_id = 1u64;
    let total_funding = 1000000i128;
    let funding_amount = 100000i128; // 0.1 XLM
    let deadline = env.ledger().timestamp() + 86400; // 1 day from now
    let dependencies = Vec::new(&env);

    env.mock_all_auths();

    // Initialize project funding first
    client.initialize_project_funding(&admin_address, &project_id, &total_funding);

    // Create milestone
    let milestone_id = client.create_milestone(
        &admin_address,
        &project_id,
        &dependencies,
        &funding_amount,
        &deadline,
    );

    assert_eq!(milestone_id, 1);

    let milestone = client.get_milestone_details(&milestone_id).unwrap();
    assert_eq!(milestone.milestone_id, milestone_id);
    assert_eq!(milestone.project_id, project_id);
    assert_eq!(milestone.funding_amount, funding_amount);
    assert_eq!(milestone.deadline, deadline);
    assert_eq!(milestone.status, MilestoneStatus::Active);
    assert_eq!(milestone.completion_percentage, 0);
}

#[test]
fn test_create_milestone_with_dependencies() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let admin_address = Address::generate(&env);
    let project_id = 1u64;
    let total_funding = 1000000i128;
    let funding_amount = 100000i128;
    let deadline = env.ledger().timestamp() + 86400;

    env.mock_all_auths();

    // Initialize project funding
    client.initialize_project_funding(&admin_address, &project_id, &total_funding);

    // Create first milestone (no dependencies)
    let milestone1_id = client.create_milestone(
        &admin_address,
        &project_id,
        &Vec::new(&env),
        &funding_amount,
        &deadline,
    );

    // Create second milestone with dependency on first
    let mut dependencies = Vec::new(&env);
    dependencies.push_back(milestone1_id);

    let milestone2_id = client.create_milestone(
        &admin_address,
        &project_id,
        &dependencies,
        &funding_amount,
        &deadline,
    );

    let milestone2 = client.get_milestone_details(&milestone2_id).unwrap();
    assert_eq!(milestone2.status, MilestoneStatus::Pending); // Should be pending until dependency is completed
}

#[test]
fn test_verify_partial_completion() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let admin_address = Address::generate(&env);
    let verifier_address = Address::generate(&env);
    let project_id = 1u64;
    let total_funding = 1000000i128;
    let funding_amount = 100000i128;
    let deadline = env.ledger().timestamp() + 86400;

    env.mock_all_auths();

    // Initialize project funding
    client.initialize_project_funding(&admin_address, &project_id, &total_funding);

    // Add admin as stakeholder first
    client.add_stakeholder(&admin_address, &project_id, &admin_address);

    // Add verifier as stakeholder
    client.add_stakeholder(&admin_address, &project_id, &verifier_address);

    // Create milestone
    let milestone_id = client.create_milestone(
        &admin_address,
        &project_id,
        &Vec::new(&env),
        &funding_amount,
        &deadline,
    );

    // Verify partial completion (50%)
    client.verify_partial_completion(&verifier_address, &milestone_id, &50);

    let milestone = client.get_milestone_details(&milestone_id).unwrap();
    assert_eq!(milestone.completion_percentage, 50);
    assert_eq!(milestone.status, MilestoneStatus::PartiallyCompleted);

    // Check that proportional funding was released
    let funding_info = client.get_project_funding_info(&project_id).unwrap();
    assert_eq!(funding_info.released_funding, 50000); // 50% of 100000
    assert_eq!(funding_info.available_funding, 950000); // 1000000 - 50000
}

#[test]
fn test_verify_milestone_completion() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let admin_address = Address::generate(&env);
    let verifier_address = Address::generate(&env);
    let project_id = 1u64;
    let total_funding = 1000000i128;
    let funding_amount = 100000i128;
    let deadline = env.ledger().timestamp() + 86400;

    env.mock_all_auths();

    // Initialize project funding
    client.initialize_project_funding(&admin_address, &project_id, &total_funding);

    // Add admin as stakeholder first
    client.add_stakeholder(&admin_address, &project_id, &admin_address);

    // Add verifier as stakeholder
    client.add_stakeholder(&admin_address, &project_id, &verifier_address);

    // Create milestone
    let milestone_id = client.create_milestone(
        &admin_address,
        &project_id,
        &Vec::new(&env),
        &funding_amount,
        &deadline,
    );

    // Verify full completion
    client.verify_milestone(&verifier_address, &milestone_id);

    let milestone = client.get_milestone_details(&milestone_id).unwrap();
    assert_eq!(milestone.completion_percentage, 100);
    assert_eq!(milestone.status, MilestoneStatus::Completed);

    // Check that all funding was released
    let funding_info = client.get_project_funding_info(&project_id).unwrap();
    assert_eq!(funding_info.released_funding, 100000);
    assert_eq!(funding_info.available_funding, 900000);
}

#[test]
fn test_milestone_dependencies_activation() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let admin_address = Address::generate(&env);
    let verifier_address = Address::generate(&env);
    let project_id = 1u64;
    let total_funding = 1000000i128;
    let funding_amount = 100000i128;
    let deadline = env.ledger().timestamp() + 86400;

    env.mock_all_auths();

    // Initialize project funding
    client.initialize_project_funding(&admin_address, &project_id, &total_funding);

    // Add admin as stakeholder first
    client.add_stakeholder(&admin_address, &project_id, &admin_address);

    // Add verifier as stakeholder
    client.add_stakeholder(&admin_address, &project_id, &verifier_address);

    // Create first milestone
    let milestone1_id = client.create_milestone(
        &admin_address,
        &project_id,
        &Vec::new(&env),
        &funding_amount,
        &deadline,
    );

    // Create second milestone with dependency
    let mut dependencies = Vec::new(&env);
    dependencies.push_back(milestone1_id);

    let milestone2_id = client.create_milestone(
        &admin_address,
        &project_id,
        &dependencies,
        &funding_amount,
        &deadline,
    );

    // Verify milestone2 is pending
    let milestone2 = client.get_milestone_details(&milestone2_id).unwrap();
    assert_eq!(milestone2.status, MilestoneStatus::Pending);

    // Complete first milestone
    client.verify_milestone(&verifier_address, &milestone1_id);

    // Check that first milestone is completed
    let milestone1_updated = client.get_milestone_details(&milestone1_id).unwrap();
    assert_eq!(milestone1_updated.status, MilestoneStatus::Completed);

    // Check that second milestone is now active (automatically activated when first milestone was completed)
    let milestone2_updated = client.get_milestone_details(&milestone2_id).unwrap();
    assert_eq!(milestone2_updated.status, MilestoneStatus::Active);
}

#[test]
fn test_circular_dependency_detection() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let admin_address = Address::generate(&env);
    let project_id = 1u64;
    let total_funding = 1000000i128;
    let funding_amount = 100000i128;
    let deadline = env.ledger().timestamp() + 86400;

    env.mock_all_auths();

    // Initialize project funding
    client.initialize_project_funding(&admin_address, &project_id, &total_funding);

    // Create first milestone
    let _milestone1_id = client.create_milestone(
        &admin_address,
        &project_id,
        &Vec::new(&env),
        &funding_amount,
        &deadline,
    );

    // Try to create second milestone that depends on itself
    let mut self_dependency = Vec::new(&env);
    self_dependency.push_back(2u64); // This will be the ID of the milestone being created

    let result = client.try_create_milestone(
        &admin_address,
        &project_id,
        &self_dependency,
        &funding_amount,
        &deadline,
    );
    assert!(result.is_err()); // Should fail due to circular dependency
}

#[test]
fn test_unauthorized_verification() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let admin_address = Address::generate(&env);
    let unauthorized_address = Address::generate(&env);
    let project_id = 1u64;
    let total_funding = 1000000i128;
    let funding_amount = 100000i128;
    let deadline = env.ledger().timestamp() + 86400;

    env.mock_all_auths();

    // Initialize project funding
    client.initialize_project_funding(&admin_address, &project_id, &total_funding);

    // Create milestone
    let milestone_id = client.create_milestone(
        &admin_address,
        &project_id,
        &Vec::new(&env),
        &funding_amount,
        &deadline,
    );

    // Try to verify with unauthorized address
    let result = client.try_verify_partial_completion(&unauthorized_address, &milestone_id, &50);
    assert!(result.is_err()); // Should fail due to unauthorized access
}

#[test]
fn test_milestone_expiration() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let admin_address = Address::generate(&env);
    let project_id = 1u64;
    let total_funding = 1000000i128;
    let funding_amount = 100000i128;
    let deadline = env.ledger().timestamp() + 1; // Very short deadline

    env.mock_all_auths();

    // Initialize project funding
    client.initialize_project_funding(&admin_address, &project_id, &total_funding);

    // Create milestone
    let milestone_id = client.create_milestone(
        &admin_address,
        &project_id,
        &Vec::new(&env),
        &funding_amount,
        &deadline,
    );

    // Advance time past deadline
    let mut ledger_info = env.ledger().get();
    ledger_info.timestamp = env.ledger().timestamp() + 2;
    env.ledger().set(ledger_info);

    // Update expired milestones
    client.update_expired_milestones(&project_id);

    let milestone = client.get_milestone_details(&milestone_id).unwrap();
    assert_eq!(milestone.status, MilestoneStatus::Expired);
}

#[test]
fn test_multiple_stakeholders() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let admin_address = Address::generate(&env);
    let stakeholder1 = Address::generate(&env);
    let stakeholder2 = Address::generate(&env);
    let project_id = 1u64;
    let total_funding = 1000000i128;
    let funding_amount = 100000i128;
    let deadline = env.ledger().timestamp() + 86400;

    env.mock_all_auths();

    // Initialize project funding
    client.initialize_project_funding(&admin_address, &project_id, &total_funding);

    // Add admin as stakeholder first
    client.add_stakeholder(&admin_address, &project_id, &admin_address);

    // Add stakeholders
    client.add_stakeholder(&admin_address, &project_id, &stakeholder1);
    client.add_stakeholder(&admin_address, &project_id, &stakeholder2);

    // Create milestone
    let milestone_id = client.create_milestone(
        &admin_address,
        &project_id,
        &Vec::new(&env),
        &funding_amount,
        &deadline,
    );

    // Both stakeholders can verify
    client.verify_partial_completion(&stakeholder1, &milestone_id, &50);
    client.verify_milestone(&stakeholder2, &milestone_id);

    let milestone = client.get_milestone_details(&milestone_id).unwrap();
    assert_eq!(milestone.status, MilestoneStatus::Completed);

    // Check verifications
    let verifications = client.get_milestone_verifications(&milestone_id);
    assert_eq!(verifications.len(), 2);
}

#[test]
fn test_project_milestones_retrieval() {
    let env = Env::default();
    let contract_id = env.register(MilestoneFinance, ());
    let client = MilestoneFinanceClient::new(&env, &contract_id);

    let admin_address = Address::generate(&env);
    let project_id = 1u64;
    let total_funding = 1000000i128;
    let funding_amount = 100000i128;
    let deadline = env.ledger().timestamp() + 86400;

    env.mock_all_auths();

    // Initialize project funding
    client.initialize_project_funding(&admin_address, &project_id, &total_funding);

    // Create multiple milestones
    let milestone1_id = client.create_milestone(
        &admin_address,
        &project_id,
        &Vec::new(&env),
        &funding_amount,
        &deadline,
    );

    let milestone2_id = client.create_milestone(
        &admin_address,
        &project_id,
        &Vec::new(&env),
        &funding_amount,
        &deadline,
    );

    // Get all project milestones
    let milestones = client.get_project_milestones(&project_id);
    assert_eq!(milestones.len(), 2);

    // Check that both milestones are present
    let mut found_milestone1 = false;
    let mut found_milestone2 = false;
    for i in 0..milestones.len() {
        let milestone = milestones.get(i).unwrap();
        if milestone.milestone_id == milestone1_id {
            found_milestone1 = true;
        }
        if milestone.milestone_id == milestone2_id {
            found_milestone2 = true;
        }
    }
    assert!(found_milestone1);
    assert!(found_milestone2);
}
