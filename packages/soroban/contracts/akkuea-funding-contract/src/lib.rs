#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};

mod fund;
mod project;
mod test;
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
