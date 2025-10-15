#![no_std]

mod achievement;
mod achievement_storage;
mod error;
mod events;
mod storage;
mod test;

use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

pub use achievement_storage::*;
pub use error::*;
pub use events::*;

#[contract]
pub struct EducationalNFTContract;

#[contractimpl]
impl EducationalNFTContract {
    /// Initialize the contract with admin
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        if storage::has_admin(&env) {
            return Err(ContractError::AlreadyInitialized);
        }
        admin.require_auth();
        storage::set_admin(&env, &admin);
        Ok(())
    }

    /// Create a new educational NFT achievement
    pub fn create_achievement(
        env: Env,
        token_id: u64,
        user: Address,
        educator: Address,
        course_title: soroban_sdk::String,
    ) -> Result<(), ContractError> {
        educator.require_auth();
        achievement::create_achievement(&env, token_id, &user, &educator, course_title)
    }

    /// Update achievement progress
    pub fn update_achievement(
        env: Env,
        token_id: u64,
        completion_status: u32,
        quiz_results: Vec<u32>,
        educator: Address,
    ) -> Result<(), ContractError> {
        educator.require_auth();
        achievement::update_achievement(&env, token_id, completion_status, quiz_results, &educator)
    }

    /// Issue certification for completed achievement
    pub fn issue_certification(
        env: Env,
        token_id: u64,
        educator: Address,
    ) -> Result<(), ContractError> {
        educator.require_auth();
        achievement::issue_certification(&env, token_id, &educator)
    }

    /// Verify certification status
    pub fn verify_certification(env: Env, token_id: u64) -> Result<bool, ContractError> {
        achievement::verify_certification(&env, token_id)
    }

    /// Add an authorized educator
    pub fn add_educator(env: Env, admin: Address, educator: Address) -> Result<(), ContractError> {
        admin.require_auth();
        achievement::add_educator(&env, &admin, &educator)
    }

    /// Remove an educator
    pub fn remove_educator(
        env: Env,
        admin: Address,
        educator: Address,
    ) -> Result<(), ContractError> {
        admin.require_auth();
        achievement::remove_educator(&env, &admin, &educator)
    }

    /// Get achievement details
    pub fn get_achievement(env: Env, token_id: u64) -> Result<Achievement, ContractError> {
        achievement::get_achievement(&env, token_id)
    }

    /// Get user achievements
    pub fn get_user_achievements(
        env: Env,
        user: Address,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<u64>, ContractError> {
        achievement::get_user_achievements(&env, &user, offset, limit)
    }

    /// Get educator's issued achievements
    pub fn get_educator_achievements(
        env: Env,
        educator: Address,
        offset: u32,
        limit: u32,
    ) -> Result<Vec<u64>, ContractError> {
        achievement::get_educator_achievements(&env, &educator, offset, limit)
    }

    /// Check if an address is an authorized educator
    pub fn is_educator(env: Env, educator: Address) -> bool {
        achievement::is_educator(&env, &educator)
    }
}
