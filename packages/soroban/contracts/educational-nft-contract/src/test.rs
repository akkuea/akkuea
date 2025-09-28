#![cfg(test)]
extern crate std;

use crate::{EducationalNFTContract, EducationalNFTContractClient};
use crate::error::ContractError;
use soroban_sdk::{
    vec,
    testutils::Address as _,
    Address, Env, String,
};

fn create_contract<'a>(env: &Env) -> EducationalNFTContractClient<'a> {
    let contract_address = env.register_contract(None, EducationalNFTContract);
    EducationalNFTContractClient::new(env, &contract_address)
}

struct NFTTest<'a> {
    env: Env,
    admin: Address,
    educator1: Address,
    educator2: Address,
    user1: Address,
    user2: Address,
    contract: EducationalNFTContractClient<'a>,
}

impl<'a> NFTTest<'a> {
    fn setup() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        
        let admin = Address::generate(&env);
        let educator1 = Address::generate(&env);
        let educator2 = Address::generate(&env);
        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);
        
        let contract = create_contract(&env);
        let _ = contract.initialize(&admin);
        
        NFTTest {
            env,
            admin,
            educator1,
            educator2,
            user1,
            user2,
            contract,
        }
    }
    
    fn add_educator(&self, educator: &Address) {
        self.contract.add_educator(&self.admin, educator);
    }
    
    fn create_achievement(&self, token_id: u64, user: &Address, educator: &Address, title: &str) {
        let course_title = String::from_str(&self.env, title);
        self.contract.create_achievement(&token_id, user, educator, &course_title);
    }
    
    fn setup_with_educator_and_achievement() -> (Self, u64) {
        let test = Self::setup();
        test.add_educator(&test.educator1);
        test.create_achievement(1, &test.user1, &test.educator1, "Rust Programming 101");
        (test, 1)
    }
}

// Initialization tests
#[test]
fn test_initialize_success() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract = create_contract(&env);
    let _result = contract.initialize(&admin);
    // Test passes if no panic occurs
}

#[test]
fn test_initialize_duplicate() {
    let test = NFTTest::setup();
    let result = test.contract.try_initialize(&test.admin);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::AlreadyInitialized));
}

// Educator management tests
#[test]
fn test_add_educator_success() {
    let test = NFTTest::setup();
    test.add_educator(&test.educator1);
    
    let is_educator = test.contract.is_educator(&test.educator1);
    assert!(is_educator);
}

#[test]
fn test_add_educator_non_admin() {
    let test = NFTTest::setup();
    let result = test.contract.try_add_educator(&test.educator1, &test.educator1);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::AdminOnly));
}

#[test]
fn test_remove_educator_success() {
    let test = NFTTest::setup();
    test.add_educator(&test.educator1);
    
    test.contract.remove_educator(&test.admin, &test.educator1);
    let is_educator = test.contract.is_educator(&test.educator1);
    assert!(!is_educator);
}

#[test]
fn test_remove_educator_non_admin() {
    let test = NFTTest::setup();
    test.add_educator(&test.educator1);
    
    let result = test.contract.try_remove_educator(&test.educator1, &test.educator1);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::AdminOnly));
}

// Achievement creation tests
#[test]
fn test_create_achievement_success() {
    let test = NFTTest::setup();
    test.add_educator(&test.educator1);
    
    test.create_achievement(1, &test.user1, &test.educator1, "Blockchain Basics");
    
    let achievement = test.contract.get_achievement(&1);
    // assert!(achievement.is_ok());
    
    let achievement = achievement;
    assert_eq!(achievement.token_id, 1);
    assert_eq!(achievement.user, test.user1);
    assert_eq!(achievement.educator, test.educator1);
    assert_eq!(achievement.completion_status, 0);
    assert!(!achievement.certified);
    assert_eq!(achievement.quiz_results.len(), 0);
}

#[test]
fn test_create_achievement_unauthorized_educator() {
    let test = NFTTest::setup();
    
    let course_title = String::from_str(&test.env, "Unauthorized Course");
    let result = test.contract.try_create_achievement(&1, &test.user1, &test.educator1, &course_title);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::NotAuthorizedEducator));
}

#[test]
fn test_create_achievement_zero_token_id() {
    let test = NFTTest::setup();
    test.add_educator(&test.educator1);
    
    let course_title = String::from_str(&test.env, "Invalid Token Course");
    let result = test.contract.try_create_achievement(&0, &test.user1, &test.educator1, &course_title);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::InvalidTokenId));
}

#[test]
fn test_create_achievement_already_exists() {
    let test = NFTTest::setup();
    test.add_educator(&test.educator1);
    test.create_achievement(1, &test.user1, &test.educator1, "First Course");
    
    let course_title = String::from_str(&test.env, "Duplicate Course");
    let result = test.contract.try_create_achievement(&1, &test.user2, &test.educator1, &course_title);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::AchievementAlreadyExists));
}

// Achievement update tests
#[test]
fn test_update_achievement_success() {
    let (test, token_id) = NFTTest::setup_with_educator_and_achievement();
    
    let mut quiz_results = vec![&test.env];
    quiz_results.push_back(85);
    quiz_results.push_back(92);
    
    test.contract.update_achievement(&token_id, &75, &quiz_results, &test.educator1);
    
    let achievement = test.contract.get_achievement(&token_id);
    assert_eq!(achievement.completion_status, 75);
    assert_eq!(achievement.quiz_results.len(), 2);
    assert_eq!(achievement.quiz_results.get(0).unwrap(), 85);
    assert_eq!(achievement.quiz_results.get(1).unwrap(), 92);
}

#[test]
fn test_update_achievement_unauthorized_educator() {
    let (test, token_id) = NFTTest::setup_with_educator_and_achievement();
    test.add_educator(&test.educator2);
    
    let quiz_results = vec![&test.env];
    let result = test.contract.try_update_achievement(&token_id, &50, &quiz_results, &test.educator2);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::EducatorOnly));
}

#[test]
fn test_update_achievement_invalid_completion_status() {
    let (test, token_id) = NFTTest::setup_with_educator_and_achievement();
    
    let quiz_results = vec![&test.env];
    let result = test.contract.try_update_achievement(&token_id, &150, &quiz_results, &test.educator1);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::InvalidCompletionStatus));
}

#[test]
fn test_update_achievement_invalid_quiz_score() {
    let (test, token_id) = NFTTest::setup_with_educator_and_achievement();
    
    let mut quiz_results = vec![&test.env];
    quiz_results.push_back(85);
    quiz_results.push_back(150); // Invalid score > 100
    
    let result = test.contract.try_update_achievement(&token_id, &75, &quiz_results, &test.educator1);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::InvalidQuizScore));
}

#[test]
fn test_update_nonexistent_achievement() {
    let test = NFTTest::setup();
    test.add_educator(&test.educator1);
    
    let quiz_results = vec![&test.env];
    let result = test.contract.try_update_achievement(&999, &75, &quiz_results, &test.educator1);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::AchievementNotFound));
}

// Certification tests
#[test]
fn test_issue_certification_success() {
    let (test, token_id) = NFTTest::setup_with_educator_and_achievement();
    
    // Update to 100% completion first
    let mut quiz_results = vec![&test.env];
    quiz_results.push_back(95);
    test.contract.update_achievement(&token_id, &100, &quiz_results, &test.educator1);
    
    test.contract.issue_certification(&token_id, &test.educator1);
    
    let achievement = test.contract.get_achievement(&token_id);
    assert!(achievement.certified);
    assert!(achievement.certified_at.is_some());
}

#[test]
fn test_issue_certification_incomplete() {
    let (test, token_id) = NFTTest::setup_with_educator_and_achievement();
    
    // Update to less than 100% completion
    let quiz_results = vec![&test.env];
    test.contract.update_achievement(&token_id, &75, &quiz_results, &test.educator1);
    
    let result = test.contract.try_issue_certification(&token_id, &test.educator1);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::InvalidCompletionStatus));
}

#[test]
fn test_issue_certification_already_certified() {
    let (test, token_id) = NFTTest::setup_with_educator_and_achievement();
    
    let quiz_results = vec![&test.env];
    test.contract.update_achievement(&token_id, &100, &quiz_results, &test.educator1);
    test.contract.issue_certification(&token_id, &test.educator1);
    
    let result = test.contract.try_issue_certification(&token_id, &test.educator1);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::AlreadyCertified));
}

#[test]
fn test_issue_certification_wrong_educator() {
    let (test, token_id) = NFTTest::setup_with_educator_and_achievement();
    test.add_educator(&test.educator2);
    
    let quiz_results = vec![&test.env];
    test.contract.update_achievement(&token_id, &100, &quiz_results, &test.educator1);
    
    let result = test.contract.try_issue_certification(&token_id, &test.educator2);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::EducatorOnly));
}

#[test]
fn test_issue_certification_unauthorized_educator() {
    let (test, token_id) = NFTTest::setup_with_educator_and_achievement();
    
    let unauthorized = Address::generate(&test.env);
    let result = test.contract.try_issue_certification(&token_id, &unauthorized);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::NotAuthorizedEducator));
}

// Verification tests
#[test]
fn test_verify_certification_certified() {
    let (test, token_id) = NFTTest::setup_with_educator_and_achievement();
    
    let quiz_results = vec![&test.env];
    test.contract.update_achievement(&token_id, &100, &quiz_results, &test.educator1);
    test.contract.issue_certification(&token_id, &test.educator1);
    
    let is_certified = test.contract.verify_certification(&token_id);
    assert!(is_certified);
}

#[test]
fn test_verify_certification_not_certified() {
    let (test, token_id) = NFTTest::setup_with_educator_and_achievement();
    
    let is_certified = test.contract.verify_certification(&token_id);
    assert!(!is_certified);
}

#[test]
fn test_verify_nonexistent_certification() {
    let test = NFTTest::setup();
    
    let result = test.contract.try_verify_certification(&999);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::AchievementNotFound));
}

// Query tests
#[test]
fn test_get_user_achievements() {
    let test = NFTTest::setup();
    test.add_educator(&test.educator1);
    
    // Create multiple achievements for the same user
    test.create_achievement(1, &test.user1, &test.educator1, "Course 1");
    test.create_achievement(2, &test.user1, &test.educator1, "Course 2");
    test.create_achievement(3, &test.user1, &test.educator1, "Course 3");
    
    let achievements = test.contract.get_user_achievements(&test.user1, &0, &10);
    assert_eq!(achievements.len(), 3);
    
    // Test pagination
    let page1 = test.contract.get_user_achievements(&test.user1, &0, &2);
    assert_eq!(page1.len(), 2);
    
    let page2 = test.contract.get_user_achievements(&test.user1, &2, &2);
    assert_eq!(page2.len(), 1);
}

#[test]
fn test_get_educator_achievements() {
    let test = NFTTest::setup();
    test.add_educator(&test.educator1);
    
    // Create achievements for different users but same educator
    test.create_achievement(1, &test.user1, &test.educator1, "Course 1");
    test.create_achievement(2, &test.user2, &test.educator1, "Course 2");
    
    let achievements = test.contract.get_educator_achievements(&test.educator1, &0, &10);
    assert_eq!(achievements.len(), 2);
}

#[test]
fn test_get_empty_user_achievements() {
    let test = NFTTest::setup();
    
    let achievements = test.contract.get_user_achievements(&test.user1, &0, &10);
    assert_eq!(achievements.len(), 0);
}

// Authorization tests
#[test]
fn test_unauthorized_operations() {
    let (test, token_id) = NFTTest::setup_with_educator_and_achievement();
    let unauthorized = Address::generate(&test.env);
    
    // Test unauthorized update
    let quiz_results = vec![&test.env];
    let result = test.contract.try_update_achievement(&token_id, &50, &quiz_results, &unauthorized);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::NotAuthorizedEducator));
    
    // Test unauthorized certification
    let result = test.contract.try_issue_certification(&token_id, &unauthorized);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Ok(ContractError::NotAuthorizedEducator));
}

// Edge case tests
#[test]
fn test_multiple_quiz_scores() {
    let (test, token_id) = NFTTest::setup_with_educator_and_achievement();
    
    let mut quiz_results = vec![&test.env];
    for i in 1..=10 {
        quiz_results.push_back(i * 8); // Scores from 8 to 80
    }
    
    test.contract.update_achievement(&token_id, &90, &quiz_results, &test.educator1);
    
    let achievement = test.contract.get_achievement(&token_id);
    assert_eq!(achievement.quiz_results.len(), 10);
}

#[test]
fn test_zero_completion_update() {
    let (test, token_id) = NFTTest::setup_with_educator_and_achievement();
    
    let quiz_results = vec![&test.env];
    test.contract.update_achievement(&token_id, &0, &quiz_results, &test.educator1);
    
    let achievement = test.contract.get_achievement(&token_id);
    assert_eq!(achievement.completion_status, 0);
}

#[test]
fn test_perfect_scores() {
    let (test, token_id) = NFTTest::setup_with_educator_and_achievement();
    
    let mut quiz_results = vec![&test.env];
    quiz_results.push_back(100);
    quiz_results.push_back(100);
    quiz_results.push_back(100);
    
    test.contract.update_achievement(&token_id, &100, &quiz_results, &test.educator1);
    test.contract.issue_certification(&token_id, &test.educator1);
    
    let achievement = test.contract.get_achievement(&token_id);
    assert!(achievement.certified);
    assert_eq!(achievement.completion_status, 100);
    
    // Verify all quiz scores are 100
    for i in 0..3 {
        assert_eq!(achievement.quiz_results.get(i).unwrap(), 100);
    }
}

#[test]
fn test_empty_quiz_results_certification() {
    let (test, token_id) = NFTTest::setup_with_educator_and_achievement();
    
    let quiz_results = vec![&test.env]; // Empty quiz results
    test.contract.update_achievement(&token_id, &100, &quiz_results, &test.educator1);
    test.contract.issue_certification(&token_id, &test.educator1);
    
    let achievement = test.contract.get_achievement(&token_id);
    assert!(achievement.certified);
    assert_eq!(achievement.quiz_results.len(), 0);
}