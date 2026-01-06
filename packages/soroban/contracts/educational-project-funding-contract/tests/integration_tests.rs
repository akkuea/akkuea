mod test_helpers;

use educational_project_funding_contract::{CrowdfundContract, CrowdfundContractClient};
use soroban_sdk::{testutils::Address as _, Address, String, Vec};
use test_helpers::helpers::setup_minimal_env;

#[cfg(test)]
mod integration_tests {
    use super::*;

    fn setup_contract() -> (soroban_sdk::Env, CrowdfundContractClient<'static>, Address) {
        let env = setup_minimal_env();
        let contract_id = env.register(CrowdfundContract, ());
        let client = CrowdfundContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);

        (env, client, admin)
    }

    #[test]
    fn test_funding_workflow_integration() {
        let (env, client, admin) = setup_contract();
        let voter = Address::generate(&env);

        env.mock_all_auths();

        let project_id = 1u64;
        let title = String::from_str(&env, "Test Project");
        let description = String::from_str(&env, "A test project");
        let target_amount = 1000u64;
        let milestones = Vec::new(&env);

        client.register_project(
            &project_id,
            &admin,
            &title,
            &description,
            &target_amount,
            &milestones,
        );
        client.vote_for_projects(&project_id, &voter);

        assert_eq!(client.get_vote(&project_id), 1);
    }

    #[test]
    fn test_edge_cases_integration() {
        let (env, client, admin) = setup_contract();
        let voter = Address::generate(&env);
        env.mock_all_auths();
        let project_id = 2u64;
        let title = String::from_str(&env, "Edge Case Project");
        let description = String::from_str(&env, "Testing edge cases");
        let target_amount = 500u64;
        let milestones = Vec::new(&env);
        client.register_project(
            &project_id,
            &admin,
            &title,
            &description,
            &target_amount,
            &milestones,
        );
        client.vote_for_projects(&project_id, &voter);

        assert_eq!(client.get_vote(&project_id), 1);
    }

    #[test]
    fn test_multiple_projects_workflow() {
        let (env, client, admin) = setup_contract();
        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);

        env.mock_all_auths();
        let project1_id = 1u64;
        let project2_id = 2u64;
        let title1 = String::from_str(&env, "Project One");
        let title2 = String::from_str(&env, "Project Two");
        let description1 = String::from_str(&env, "First project");
        let description2 = String::from_str(&env, "Second project");
        let target_amount = 1000u64;
        let milestones = Vec::new(&env);
        client.register_project(
            &project1_id,
            &admin,
            &title1,
            &description1,
            &target_amount,
            &milestones,
        );
        client.register_project(
            &project2_id,
            &admin,
            &title2,
            &description2,
            &target_amount,
            &milestones,
        );
        client.vote_for_projects(&project1_id, &user1);
        client.vote_for_projects(&project2_id, &user2);
        client.vote_for_projects(&project2_id, &user1);
        assert_eq!(client.get_vote(&project1_id), 1);
        assert_eq!(client.get_vote(&project2_id), 2);
    }

    #[test]
    fn test_minimal_integration() {
        let (env, client, admin) = setup_contract();
        env.mock_all_auths();
        let project_id = 999u64;
        let title = String::from_str(&env, "Minimal");
        let description = String::from_str(&env, "Test");
        let target_amount = 1u64;
        let milestones = Vec::new(&env);
        client.register_project(
            &project_id,
            &admin,
            &title,
            &description,
            &target_amount,
            &milestones,
        );
        assert_eq!(client.get_vote(&project_id), 0);
    }

    #[test]
    fn test_contract_initialization() {
        let (_env, _client, _admin) = setup_contract();
        // Simple test that just ensures the contract can be initialized
    }
}
