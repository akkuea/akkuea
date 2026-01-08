#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};

mod fund;
mod project;
mod validate;
mod vote;

use crate::project::Milestone;
use crate::validate::{validate_milestone_exists, validate_project_exists};

#[contract]
pub struct CrowdfundContract;

#[contractimpl]
impl CrowdfundContract {
    // Register a new project
    pub fn register_project(
        env: Env,
        id: u64,
        creator: Address,
        title: String,
        description: String,
        total_funds: u64,
        milestones: Vec<Milestone>,
    ) {
        project::register_project(
            &env,
            id,
            creator,
            title,
            description,
            total_funds,
            milestones,
        );
    }

    // Get public project metadata
    pub fn get_project_info(env: Env, id: u64) -> (String, String, u64, u32, bool, u64) {
        project::get_project_info(&env, id)
    }

    // List milestones for a project
    pub fn get_milestones(env: Env, id: u64) -> Vec<Milestone> {
        project::get_milestones(&env, id)
    }

    // Vote for a project
    pub fn vote_for_projects(env: Env, project_id: u64, voter: Address) {
        vote::VotingContract::vote_for_project(env, project_id, voter);
    }

    // Get vote count
    pub fn get_vote(env: Env, project_id: u64) -> u32 {
        vote::VotingContract::get_votes(env, project_id)
    }

    // Get voter list
    pub fn get_voter(env: Env, project_id: u64) -> Vec<Address> {
        vote::VotingContract::get_voters(env, project_id)
    }

    // Mark a milestone as completed
    pub fn complete_milestone(env: Env, project_id: u64, milestone_id: u64, caller: Address) {
        validate_project_exists(&env, project_id, project::get_project);
        validate_milestone_exists(&env, project_id, milestone_id, project::get_project);
        fund::complete_milestone(&env, project_id, milestone_id, caller);
    }

    // Release funds for completed milestones
    pub fn release_funds(
        env: Env,
        project_id: u64,
        caller: Address,
        token_address: Address,
        treasury_address: Address,
    ) {
        validate_project_exists(&env, project_id, project::get_project);
        fund::release_funds(&env, project_id, caller, token_address, treasury_address);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::project::Milestone;
    use soroban_sdk::{testutils::Address as _, vec, Address, Env, String};

    #[test]
    fn test_register_project() {
        let env = Env::default();
        let contract_id = env.register(CrowdfundContract, ());
        let client = CrowdfundContractClient::new(&env, &contract_id);

        let project_id = 1u64;
        let creator = Address::generate(&env);
        let title = String::from_str(&env, "Test Project");
        let description = String::from_str(&env, "Test Description");
        let total_funds = 1000u64;

        // Create proper Milestone objects with correct field names
        let milestone = Milestone {
            id: 1u64,
            description: String::from_str(&env, "Milestone 1"),
            release_amount: 500u64,
            is_completed: false,
        };
        let milestones = vec![&env, milestone];

        // Mock authorization for all calls
        env.mock_all_auths();

        // register_project returns (), not an ID
        client.register_project(
            &project_id,
            &creator,
            &title,
            &description,
            &total_funds,
            &milestones,
        );

        // Verify the project was registered by fetching its info
        let (proj_title, _, _, _, _, _) = client.get_project_info(&project_id);
        assert_eq!(proj_title, title);
    }

    #[test]
    fn test_vote_for_project() {
        let env = Env::default();
        let contract_id = env.register(CrowdfundContract, ());
        let client = CrowdfundContractClient::new(&env, &contract_id);

        let project_id = 1u64;
        let creator = Address::generate(&env);
        let voter = Address::generate(&env);
        let title = String::from_str(&env, "Test Project");
        let description = String::from_str(&env, "Test Description");
        let total_funds = 1000u64;

        let milestone = Milestone {
            id: 1u64,
            description: String::from_str(&env, "Milestone 1"),
            release_amount: 500u64,
            is_completed: false,
        };
        let milestones = vec![&env, milestone];

        // Mock authorization for all calls
        env.mock_all_auths();

        client.register_project(
            &project_id,
            &creator,
            &title,
            &description,
            &total_funds,
            &milestones,
        );

        client.vote_for_projects(&project_id, &voter);

        assert_eq!(client.get_vote(&project_id), 1);
    }

    #[test]
    fn test_multiple_votes() {
        let env = Env::default();
        let contract_id = env.register(CrowdfundContract, ());
        let client = CrowdfundContractClient::new(&env, &contract_id);

        let project_id = 1u64;
        let creator = Address::generate(&env);
        let title = String::from_str(&env, "Test Project");
        let description = String::from_str(&env, "Test Description");
        let total_funds = 1000u64;

        let milestone = Milestone {
            id: 1u64,
            description: String::from_str(&env, "Milestone 1"),
            release_amount: 500u64,
            is_completed: false,
        };
        let milestones = vec![&env, milestone];

        // Mock authorization for all calls
        env.mock_all_auths();

        client.register_project(
            &project_id,
            &creator,
            &title,
            &description,
            &total_funds,
            &milestones,
        );

        let voter1 = Address::generate(&env);
        let voter2 = Address::generate(&env);
        let voter3 = Address::generate(&env);

        client.vote_for_projects(&project_id, &voter1);
        client.vote_for_projects(&project_id, &voter2);
        client.vote_for_projects(&project_id, &voter3);

        assert_eq!(client.get_vote(&project_id), 3);
    }

    #[test]
    #[should_panic(expected = "Project not found")]
    fn test_vote_for_nonexistent_project() {
        let env = Env::default();
        let contract_id = env.register(CrowdfundContract, ());
        let client = CrowdfundContractClient::new(&env, &contract_id);

        let voter = Address::generate(&env);
        let nonexistent_project_id = 999u64;

        // Mock authorization for all calls
        env.mock_all_auths();

        client.vote_for_projects(&nonexistent_project_id, &voter);
    }

    #[test]
    #[should_panic(expected = "Duplicate vote not allowed")]
    fn test_duplicate_vote() {
        let env = Env::default();
        let contract_id = env.register(CrowdfundContract, ());
        let client = CrowdfundContractClient::new(&env, &contract_id);

        let project_id = 1u64;
        let creator = Address::generate(&env);
        let voter = Address::generate(&env);
        let title = String::from_str(&env, "Test Project");
        let description = String::from_str(&env, "Test Description");
        let total_funds = 1000u64;

        let milestone = Milestone {
            id: 1u64,
            description: String::from_str(&env, "Milestone 1"),
            release_amount: 500u64,
            is_completed: false,
        };
        let milestones = vec![&env, milestone];

        // Mock authorization for all calls
        env.mock_all_auths();

        client.register_project(
            &project_id,
            &creator,
            &title,
            &description,
            &total_funds,
            &milestones,
        );

        client.vote_for_projects(&project_id, &voter);
        // This should panic
        client.vote_for_projects(&project_id, &voter);
    }
}
