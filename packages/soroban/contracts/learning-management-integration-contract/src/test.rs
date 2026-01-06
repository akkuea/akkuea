#![cfg(test)]
extern crate std;

use crate::{LearningManagementContract, LearningManagementContractClient};
use soroban_sdk::{
    testutils::{Address as _, Events},
    Address, Env, Vec,
};

fn create_contract<'a>(env: &Env) -> LearningManagementContractClient<'a> {
    let contract_address = env.register(LearningManagementContract, ());
    LearningManagementContractClient::new(env, &contract_address)
}

#[test]
fn test_initialize() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract = create_contract(&env);

    // Initialize contract
    contract.initialize(&admin);
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // AlreadyInitialized = 1
fn test_initialize_twice_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.initialize(&admin); // AlreadyInitialized = 1
}

#[test]
fn test_add_and_remove_platform() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let contract = create_contract(&env);

    // Initialize
    contract.initialize(&admin);

    // Add platform
    contract.add_platform(&admin, &platform);

    // Check if platform is authorized
    assert!(contract.is_platform(&platform));

    // Remove platform
    contract.remove_platform(&admin, &platform);

    // Check if platform is no longer authorized
    assert!(!contract.is_platform(&platform));
}

#[test]
fn test_initialize_progress() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    // Initialize contract and add platform
    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    // Initialize progress
    let course_id = 1u64;
    let prerequisites = Vec::new(&env);

    let token_id = contract.initialize_progress(&platform, &user, &course_id, &prerequisites);
    assert!(token_id > 0);

    // Verify progress was created
    let progress = contract.get_progress(&token_id);
    assert_eq!(progress.user, user);
    assert_eq!(progress.course_id, course_id);
    assert_eq!(progress.completion_status, 0);
}

#[test]
fn test_update_progress() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    // Setup
    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    // Initialize progress
    let course_id = 1u64;
    let prerequisites = Vec::new(&env);
    let token_id = contract.initialize_progress(&platform, &user, &course_id, &prerequisites);

    // Update progress
    let new_status = 50u32;
    contract.update_progress(&platform, &token_id, &new_status);

    // Verify progress was updated
    let progress = contract.get_progress(&token_id);
    assert_eq!(progress.completion_status, new_status);
}

#[test]
fn test_issue_course_nft() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    // Setup
    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    // Initialize and complete course
    let course_id = 1u64;
    let token_id = contract.initialize_progress(&platform, &user, &course_id, &Vec::new(&env));

    contract.update_progress(&platform, &token_id, &100u32);

    // Issue NFT
    contract.issue_course_nft(&platform, &token_id);

    // Verify NFT was issued
    let progress = contract.get_progress(&token_id);
    assert!(progress.nft_issued);
}

#[test]
fn test_get_user_nfts() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    // Setup
    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    // Create and complete multiple courses
    for course_id in 1..=3 {
        let token_id = contract.initialize_progress(&platform, &user, &course_id, &Vec::new(&env));
        contract.update_progress(&platform, &token_id, &100u32);
        contract.issue_course_nft(&platform, &token_id);
    }

    // Get user NFTs
    let nfts = contract.get_user_nfts(&user);
    assert_eq!(nfts.len(), 3);
}

// ============= EDGE CASE TESTS =============

#[test]
#[should_panic(expected = "Error(Contract, #6)")] // NotAuthorizedPlatform = 6
fn test_unauthorized_platform_initialize_progress() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);

    // Try to initialize progress without being authorized platform
    contract.initialize_progress(&unauthorized, &user, &1u64, &Vec::new(&env));
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")] // NotAuthorizedPlatform = 6
fn test_unauthorized_platform_update_progress() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    let token_id = contract.initialize_progress(&platform, &user, &1u64, &Vec::new(&env));

    // Try to update progress from unauthorized platform
    contract.update_progress(&unauthorized, &token_id, &50u32);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")] // NotAuthorizedPlatform = 6
fn test_unauthorized_platform_issue_nft() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    let token_id = contract.initialize_progress(&platform, &user, &1u64, &Vec::new(&env));
    contract.update_progress(&platform, &token_id, &100u32);

    // Try to issue NFT from unauthorized platform
    contract.issue_course_nft(&unauthorized, &token_id);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")] // AdminOnly = 4
fn test_non_admin_add_platform() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let non_admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);

    // Try to add platform as non-admin
    contract.add_platform(&non_admin, &platform);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")] // AdminOnly = 4
fn test_non_admin_remove_platform() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let non_admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    // Try to remove platform as non-admin
    contract.remove_platform(&non_admin, &platform);
}

#[test]
#[should_panic(expected = "Error(Contract, #19)")] // InvalidCourseId = 19
fn test_invalid_course_id_zero() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    // Try to initialize progress with course_id = 0
    contract.initialize_progress(&platform, &user, &0u64, &Vec::new(&env));
}

#[test]
#[should_panic(expected = "Error(Contract, #15)")] // InvalidCompletionStatus = 15
fn test_invalid_completion_status_over_100() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    let token_id = contract.initialize_progress(&platform, &user, &1u64, &Vec::new(&env));

    // Try to set completion status > 100
    contract.update_progress(&platform, &token_id, &150u32);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")] // CourseNotCompleted = 10
fn test_issue_nft_incomplete_course() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    let token_id = contract.initialize_progress(&platform, &user, &1u64, &Vec::new(&env));
    contract.update_progress(&platform, &token_id, &99u32);

    // Try to issue NFT when not 100% complete
    contract.issue_course_nft(&platform, &token_id);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")] // NFTAlreadyIssued = 9
fn test_issue_nft_already_issued() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    let token_id = contract.initialize_progress(&platform, &user, &1u64, &Vec::new(&env));
    contract.update_progress(&platform, &token_id, &100u32);
    contract.issue_course_nft(&platform, &token_id);

    // Try to issue NFT again
    contract.issue_course_nft(&platform, &token_id);
}

#[test]
#[should_panic(expected = "Error(Contract, #16)")] // ProgressAlreadyExists = 16
fn test_duplicate_progress_for_same_course() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    let course_id = 1u64;

    // Initialize progress
    contract.initialize_progress(&platform, &user, &course_id, &Vec::new(&env));

    // Try to initialize again for same user and course
    contract.initialize_progress(&platform, &user, &course_id, &Vec::new(&env));
}

#[test]
#[should_panic(expected = "Error(Contract, #12)")] // InvalidPrerequisite = 12
fn test_self_prerequisite() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    let course_id = 1u64;
    let mut prerequisites = Vec::new(&env);
    prerequisites.push_back(course_id); // Self-reference

    // Try to set course as its own prerequisite
    contract.set_course_prerequisites(&platform, &course_id, &prerequisites);
}

#[test]
#[should_panic(expected = "Error(Contract, #12)")] // InvalidPrerequisite = 12
fn test_invalid_prerequisite_id_zero() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    let course_id = 1u64;
    let mut prerequisites = Vec::new(&env);
    prerequisites.push_back(0u64); // Invalid ID

    // Try to set invalid prerequisite
    contract.set_course_prerequisites(&platform, &course_id, &prerequisites);
}

// ============= PREREQUISITE TESTS =============

#[test]
fn test_verify_prerequisites_with_multiple_prereqs() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    // Complete multiple prerequisite courses
    for prereq_id in 1..=3 {
        let token_id = contract.initialize_progress(&platform, &user, &prereq_id, &Vec::new(&env));
        contract.update_progress(&platform, &token_id, &100u32);
        contract.issue_course_nft(&platform, &token_id);
    }

    // Set all as prerequisites for main course
    let main_course_id = 4u64;
    let mut prerequisites = Vec::new(&env);
    for i in 1..=3 {
        prerequisites.push_back(i);
    }
    contract.set_course_prerequisites(&platform, &main_course_id, &prerequisites);

    // Verify all prerequisites met
    assert!(contract.verify_prerequisites(&user, &main_course_id));
}

#[test]
fn test_verify_prerequisites_partial_completion() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    // Complete first prerequisite
    let token1 = contract.initialize_progress(&platform, &user, &1u64, &Vec::new(&env));
    contract.update_progress(&platform, &token1, &100u32);
    contract.issue_course_nft(&platform, &token1);

    // Only partially complete second prerequisite
    let _token2 = contract.initialize_progress(&platform, &user, &2u64, &Vec::new(&env));
    // Don't complete it

    // Set both as prerequisites
    let main_course_id = 3u64;
    let mut prerequisites = Vec::new(&env);
    prerequisites.push_back(1u64);
    prerequisites.push_back(2u64);
    contract.set_course_prerequisites(&platform, &main_course_id, &prerequisites);

    // Should fail because second prerequisite not complete
    assert!(!contract.verify_prerequisites(&user, &main_course_id));
}

#[test]
fn test_verify_prerequisites_completed_but_no_nft() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    // Complete prerequisite but don't issue NFT
    let token_id = contract.initialize_progress(&platform, &user, &1u64, &Vec::new(&env));
    contract.update_progress(&platform, &token_id, &100u32);
    // Don't issue NFT

    // Set as prerequisite
    let main_course_id = 2u64;
    let mut prerequisites = Vec::new(&env);
    prerequisites.push_back(1u64);
    contract.set_course_prerequisites(&platform, &main_course_id, &prerequisites);

    // Should fail because NFT not issued
    assert!(!contract.verify_prerequisites(&user, &main_course_id));
}

#[test]
fn test_verify_prerequisites_not_started() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    // Set prerequisite without user starting it
    let main_course_id = 2u64;
    let mut prerequisites = Vec::new(&env);
    prerequisites.push_back(1u64);
    contract.set_course_prerequisites(&platform, &main_course_id, &prerequisites);

    // Should fail because user hasn't started prerequisite
    assert!(!contract.verify_prerequisites(&user, &main_course_id));
}

// ============= MILESTONE INTEGRATION TESTS =============

#[test]
fn test_milestone_integration_link_and_notify() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    let token_id = contract.initialize_progress(&platform, &user, &1u64, &Vec::new(&env));

    // Link with milestone
    let project_id = 100u64;
    let milestone_id = 5u64;
    contract.link_progress_with_milestone(&platform, &token_id, &project_id, &milestone_id);

    // Verify link
    let milestone_info = contract.get_milestone_info(&token_id);
    assert_eq!(milestone_info.project_id, Some(project_id));
    assert_eq!(milestone_info.milestone_id, Some(milestone_id));
    assert!(milestone_info.linked);
    assert!(!milestone_info.milestone_completed);

    // Notify completion
    contract.notify_milestone_completion(&platform, &token_id, &milestone_id);

    // Verify completion
    let milestone_info = contract.get_milestone_info(&token_id);
    assert!(milestone_info.milestone_completed);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")] // NotAuthorizedPlatform = 6
fn test_milestone_unauthorized_platform_link() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    let token_id = contract.initialize_progress(&platform, &user, &1u64, &Vec::new(&env));

    // Try to link from unauthorized platform
    contract.link_progress_with_milestone(&unauthorized, &token_id, &100u64, &1u64);
}

#[test]
#[should_panic(expected = "Error(Contract, #6)")] // NotAuthorizedPlatform = 6
fn test_milestone_unauthorized_platform_notify() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let unauthorized = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    let token_id = contract.initialize_progress(&platform, &user, &1u64, &Vec::new(&env));
    contract.link_progress_with_milestone(&platform, &token_id, &100u64, &1u64);

    // Try to notify from unauthorized platform
    contract.notify_milestone_completion(&unauthorized, &token_id, &1u64);
}

#[test]
#[should_panic(expected = "Error(Contract, #17)")] // InvalidInput = 17
fn test_milestone_wrong_milestone_id() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    let token_id = contract.initialize_progress(&platform, &user, &1u64, &Vec::new(&env));
    contract.link_progress_with_milestone(&platform, &token_id, &100u64, &5u64);

    // Try to notify with wrong milestone ID
    contract.notify_milestone_completion(&platform, &token_id, &999u64);
}

#[test]
#[should_panic(expected = "Error(Contract, #14)")] // ProgressNotFound = 14
fn test_milestone_link_nonexistent_progress() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    // Try to link non-existent progress
    contract.link_progress_with_milestone(&platform, &999u64, &100u64, &1u64);
}

// ============= EVENT EMISSION TESTS =============

#[test]
fn test_events_nft_issuance() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    let course_id = 1u64;
    let token_id = contract.initialize_progress(&platform, &user, &course_id, &Vec::new(&env));
    contract.update_progress(&platform, &token_id, &100u32);

    // Issue NFT and check events
    contract.issue_course_nft(&platform, &token_id);

    // Verify events were emitted
    let events = env.events().all();
    let event_count = events.len();

    // Should have events for: initialize_progress, update_progress, and issue_course_nft
    assert!(event_count > 0);
}

#[test]
fn test_events_prerequisite_verification() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    // Complete prerequisite
    let prereq_token = contract.initialize_progress(&platform, &user, &1u64, &Vec::new(&env));
    contract.update_progress(&platform, &prereq_token, &100u32);
    contract.issue_course_nft(&platform, &prereq_token);

    // Set prerequisite
    let mut prerequisites = Vec::new(&env);
    prerequisites.push_back(1u64);
    contract.set_course_prerequisites(&platform, &2u64, &prerequisites);

    // Verify prerequisites - should emit events
    contract.verify_prerequisites(&user, &2u64);

    let events = env.events().all();
    assert!(events.len() > 0);
}

#[test]
fn test_events_platform_management() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);

    // Add platform - should emit event
    contract.add_platform(&admin, &platform);

    // Remove platform - should emit event
    contract.remove_platform(&admin, &platform);

    let events = env.events().all();
    // Should have events for add and remove (at least 1)
    assert!(events.len() >= 1);
}

#[test]
fn test_events_progress_update() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    let token_id = contract.initialize_progress(&platform, &user, &1u64, &Vec::new(&env));

    // Update progress multiple times
    for completion in [25u32, 50u32, 75u32, 100u32] {
        contract.update_progress(&platform, &token_id, &completion);
    }

    let events = env.events().all();
    // Should have multiple progress update events (at least 1)
    assert!(events.len() >= 1);
}

// ============= COMPREHENSIVE INTEGRATION TEST =============

#[test]
fn test_full_learning_path_with_prerequisites_and_milestone() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let user = Address::generate(&env);
    let contract = create_contract(&env);

    contract.initialize(&admin);
    contract.add_platform(&admin, &platform);

    // Step 1: Complete foundational course (no prerequisites)
    let foundation_course = 1u64;
    let foundation_token =
        contract.initialize_progress(&platform, &user, &foundation_course, &Vec::new(&env));
    contract.update_progress(&platform, &foundation_token, &100u32);
    contract.issue_course_nft(&platform, &foundation_token);

    // Step 2: Complete intermediate course (requires foundation)
    let intermediate_course = 2u64;
    let mut prereqs = Vec::new(&env);
    prereqs.push_back(foundation_course);
    contract.set_course_prerequisites(&platform, &intermediate_course, &prereqs);

    assert!(contract.verify_prerequisites(&user, &intermediate_course));

    let intermediate_token =
        contract.initialize_progress(&platform, &user, &intermediate_course, &Vec::new(&env));
    contract.update_progress(&platform, &intermediate_token, &100u32);
    contract.issue_course_nft(&platform, &intermediate_token);

    // Step 3: Advanced course (requires both foundation and intermediate)
    let advanced_course = 3u64;
    let mut advanced_prereqs = Vec::new(&env);
    advanced_prereqs.push_back(foundation_course);
    advanced_prereqs.push_back(intermediate_course);
    contract.set_course_prerequisites(&platform, &advanced_course, &advanced_prereqs);

    assert!(contract.verify_prerequisites(&user, &advanced_course));

    let advanced_token =
        contract.initialize_progress(&platform, &user, &advanced_course, &Vec::new(&env));

    // Link with milestone
    contract.link_progress_with_milestone(&platform, &advanced_token, &100u64, &1u64);

    contract.update_progress(&platform, &advanced_token, &100u32);
    contract.issue_course_nft(&platform, &advanced_token);

    // Notify milestone completion
    contract.notify_milestone_completion(&platform, &advanced_token, &1u64);

    // Verify final state
    let user_nfts = contract.get_user_nfts(&user);
    assert_eq!(user_nfts.len(), 3); // All three NFTs issued

    let milestone_info = contract.get_milestone_info(&advanced_token);
    assert!(milestone_info.milestone_completed);
}
