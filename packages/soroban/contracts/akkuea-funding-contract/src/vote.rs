use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Map, Symbol, Vec,
};

use crate::project::{get_project, save_project};

const REQUIRED_VOTES: u32 = 10;
const VOTERS_KEY: Symbol = symbol_short!("voters");

/// Helper type to store voter lists per project ID
#[contracttype]
pub struct VoterList(pub Map<u64, Vec<Address>>);

#[contract]
pub struct VotingContract;

#[contractimpl]
impl VotingContract {
    /// Vote for a project based on project_id and voter's address
    pub fn vote_for_project(env: Env, project_id: u64, voter: Address) {
        // Require voter to be authorized
        voter.require_auth();

        // Retrieve the project
        let mut project =
            get_project(&env, project_id).unwrap_or_else(|| panic!("Project not found"));

        // Reject if already approved
        if project.is_approved {
            panic!("Voting closed: project already approved");
        }

        // Load the current voter list map (or initialize if none)
        let mut all_voters: Map<u64, Vec<Address>> = env
            .storage()
            .instance()
            .get(&VOTERS_KEY)
            .unwrap_or_else(|| Map::new(&env));

        // Get voter list for the project (or empty list)
        let mut voter_list = all_voters.get(project_id).unwrap_or_else(|| Vec::new(&env));

        // Check for duplicate vote
        if voter_list.iter().any(|addr| addr == voter) {
            panic!("Duplicate vote not allowed");
        }

        // Add this voter to the list
        voter_list.push_back(voter.clone());
        all_voters.set(project_id, voter_list.clone());

        // Persist updated voter list
        env.storage().instance().set(&VOTERS_KEY, &all_voters);

        // Increment the vote count
        project.votes += 1;

        // Auto-approve if vote threshold met
        if project.votes >= REQUIRED_VOTES {
            project.is_approved = true;
        }

        // Save updated project
        save_project(&env, project_id, project);
    }

    /// Retrieve number of votes for a given project
    pub fn get_votes(env: Env, project_id: u64) -> u32 {
        let project = get_project(&env, project_id).unwrap_or_else(|| panic!("Project not found"));
        project.votes
    }

    /// Retrieve list of voters who voted for a given project
    pub fn get_voters(env: Env, project_id: u64) -> Vec<Address> {
        let all_voters: Map<u64, Vec<Address>> = env
            .storage()
            .instance()
            .get(&VOTERS_KEY)
            .unwrap_or_else(|| Map::new(&env));

        all_voters.get(project_id).unwrap_or_else(|| Vec::new(&env))
    }
}
