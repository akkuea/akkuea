#![no_std]

mod error;
mod events;
mod integration;
mod lms;
mod storage;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

pub use error::*;
pub use events::*;
pub use storage::LearningProgress;

#[contract]
pub struct LearningManagementContract;

#[contractimpl]
impl LearningManagementContract {
    /// Initialize the contract with admin
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        if storage::has_admin(&env) {
            return Err(ContractError::AlreadyInitialized);
        }
        admin.require_auth();
        storage::set_admin(&env, &admin);
        Ok(())
    }

    /// Initialize learning progress for a user in a course
    pub fn initialize_progress(
        env: Env,
        platform: Address,
        user: Address,
        course_id: u64,
        prerequisites: Vec<u64>,
    ) -> Result<u64, ContractError> {
        platform.require_auth();
        lms::initialize_progress(&env, &user, course_id, prerequisites, &platform)
    }

    /// Update learning progress for a user
    pub fn update_progress(
        env: Env,
        platform: Address,
        token_id: u64,
        completion_status: u32,
    ) -> Result<(), ContractError> {
        platform.require_auth();
        lms::update_progress(&env, token_id, completion_status, &platform)
    }

    /// Verify if user meets all prerequisites for a course
    pub fn verify_prerequisites(
        env: Env,
        user: Address,
        course_id: u64,
    ) -> Result<bool, ContractError> {
        lms::verify_prerequisites(&env, &user, course_id)
    }

    /// Issue NFT upon course completion
    pub fn issue_course_nft(
        env: Env,
        platform: Address,
        token_id: u64,
    ) -> Result<(), ContractError> {
        platform.require_auth();
        lms::issue_course_nft(&env, token_id, &platform)
    }

    /// Get learning progress by token ID
    pub fn get_progress(env: Env, token_id: u64) -> Result<LearningProgress, ContractError> {
        lms::get_progress(&env, token_id)
    }

    /// Get user's progress for a specific course
    pub fn get_user_course_progress(
        env: Env,
        user: Address,
        course_id: u64,
    ) -> Result<LearningProgress, ContractError> {
        lms::get_user_course_progress(&env, &user, course_id)
    }

    /// Get all NFTs issued to a user
    pub fn get_user_nfts(env: Env, user: Address) -> Vec<u64> {
        lms::get_user_nfts(&env, &user)
    }

    /// Get all NFTs issued for a course
    pub fn get_course_nfts(env: Env, course_id: u64) -> Result<Vec<u64>, ContractError> {
        lms::get_course_nfts(&env, course_id)
    }

    /// Set prerequisites for a course
    pub fn set_course_prerequisites(
        env: Env,
        platform: Address,
        course_id: u64,
        prerequisites: Vec<u64>,
    ) -> Result<(), ContractError> {
        platform.require_auth();
        lms::set_course_prerequisites(&env, course_id, prerequisites, &platform)
    }

    /// Add a learning platform
    pub fn add_platform(env: Env, admin: Address, platform: Address) -> Result<(), ContractError> {
        admin.require_auth();
        lms::add_platform(&env, &admin, &platform)
    }

    /// Remove a learning platform
    pub fn remove_platform(
        env: Env,
        admin: Address,
        platform: Address,
    ) -> Result<(), ContractError> {
        admin.require_auth();
        lms::remove_platform(&env, &admin, &platform)
    }

    /// Check if address is authorized platform
    pub fn is_platform(env: Env, platform: Address) -> bool {
        lms::is_platform(&env, &platform)
    }

    /// Notify milestone completion (integration with milestone-finance-contract)
    pub fn notify_milestone_completion(
        env: Env,
        platform: Address,
        token_id: u64,
        milestone_id: u64,
    ) -> Result<(), ContractError> {
        platform.require_auth();
        integration::notify_milestone_completion(&env, token_id, milestone_id, &platform)
    }

    /// Link progress with milestone (integration with milestone-finance-contract)
    pub fn link_progress_with_milestone(
        env: Env,
        platform: Address,
        token_id: u64,
        project_id: u64,
        milestone_id: u64,
    ) -> Result<(), ContractError> {
        platform.require_auth();
        integration::link_progress_with_milestone(
            &env,
            token_id,
            project_id,
            milestone_id,
            &platform,
        )
    }

    /// Get milestone info for a learning progress
    pub fn get_milestone_info(
        env: Env,
        token_id: u64,
    ) -> Result<integration::MilestoneInfo, ContractError> {
        integration::get_milestone_info(&env, token_id)
    }
}
