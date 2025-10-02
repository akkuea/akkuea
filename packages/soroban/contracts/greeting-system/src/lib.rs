#![no_std]
extern crate alloc;
use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};
use soroban_sdk::{contract, contractimpl, Address, Env, String};

mod batch;
mod datatype;
mod error;
mod events;
mod interface;
mod rewards;
mod storage;
mod user;
mod utils;

pub use batch::*;
pub use datatype::*;
pub use error::*;
pub use events::*;
pub use interface::*;
pub use rewards::*;
pub use storage::*;
pub use utils::*;

// Move the storage use to top level (impl no fit hold use statements)
// But since pub use storage::*, the fns like has_premium_tier dey direct in scope—no need extra use

#[contract]
pub struct GreetingSystem;

#[contractimpl]
impl GreetingSystem {
    // ==================== Premium Tier Functions ====================

    /// Assign a premium tier to a user based on their contribution
    pub fn assign_premium_tier(env: Env, user: Address, contribution: i128) -> Result<(), Error> {
        verify_user_authorization(&env, &user)?;
        validate_contribution(contribution)?;

        if has_premium_tier(&env, &user) {
            return Err(Error::TierAlreadyExists);
        }

        let tier_level = TierLevel::from_contribution(contribution);
        let features = tier_level.get_features();
        let timestamp = get_current_timestamp(&env);

        let premium_tier = PremiumTier {
            user: user.clone(),
            tier: tier_level.clone(),
            contribution,
            assigned_at: timestamp,
            features,
        };

        save_premium_tier(&env, &premium_tier)?;

        let event = TierAssignmentEvent {
            user: user.clone(),
            tier: tier_level,
            contribution,
            timestamp,
        };
        emit_tier_assigned(&env, &event)?;

        Ok(())
    }

    /// Upgrade a user's premium tier with additional contribution
    pub fn upgrade_premium_tier(
        env: Env,
        user: Address,
        additional_contribution: i128,
    ) -> Result<(), Error> {
        verify_user_authorization(&env, &user)?;
        validate_contribution(additional_contribution)?;

        let mut existing_tier = load_premium_tier(&env, &user)?;
        let new_total_contribution = existing_tier.contribution + additional_contribution;
        let new_tier_level = TierLevel::from_contribution(new_total_contribution);

        if new_tier_level < existing_tier.tier {
            return Err(Error::DowngradeNotAllowed);
        }

        let old_tier = existing_tier.tier.clone();
        existing_tier.tier = new_tier_level.clone();
        existing_tier.contribution = new_total_contribution;
        existing_tier.features = new_tier_level.get_features();

        save_premium_tier(&env, &existing_tier)?;

        let timestamp = get_current_timestamp(&env);
        let event = TierUpgradeEvent {
            user: user.clone(),
            old_tier,
            new_tier: new_tier_level,
            contribution: new_total_contribution,
            timestamp,
        };
        emit_tier_upgraded(&env, &event)?;

        Ok(())
    }

    /// Get the premium status of a user
    pub fn get_premium_status(env: Env, user: Address) -> Result<PremiumTier, Error> {
        load_premium_tier(&env, &user)
    }

    /// Get features available to a user
    pub fn get_user_features(env: Env, user: Address) -> Result<PremiumFeatures, Error> {
        let tier = load_premium_tier(&env, &user)?;
        Ok(tier.features)
    }

    /// Get the tier level of a user
    pub fn get_tier_level(env: Env, user: Address) -> Result<TierLevel, Error> {
        let tier = load_premium_tier(&env, &user)?;
        Ok(tier.tier)
    }

    /// Get the total contribution amount for a user
    pub fn get_total_contribution(env: Env, user: Address) -> Result<i128, Error> {
        let tier = load_premium_tier(&env, &user)?;
        Ok(tier.contribution)
    }

    // ==================== Batch Operation Functions ====================
    
    /// Batch update multiple greetings in a single transaction
    pub fn batch_update_greetings(
        env: Env,
        user: Address,
        greeting_ids: Vec<u64>,
        updates: Vec<String>,
    ) -> Result<u64, Error> {
        batch::batch_update_greetings(&env, user, greeting_ids, updates)
    }

    /// Get the status of a batch update operation
    pub fn get_batch_status(env: Env, batch_id: u64) -> Result<BatchUpdate, Error> {
        batch::get_batch_status(&env, batch_id)
    }

    /// Create a new greeting (helper function)
    pub fn create_greeting(
        env: Env,
        greeting_id: u64,
        text: String,
        creator: Address,
    ) -> Result<(), Error> {
        batch::create_greeting(&env, greeting_id, text, creator)
    /// Issues tokens for a popular greeting via tipping contract and records reward
    pub fn issue_greeting_reward(
        env: Env,
        greeting_id: u64,
        token_amount: i128,
        creator: Address,
        token: Address,
        tipping_contract: Address,
    ) -> Result<GreetingReward, Error> {
        rewards::issue_greeting_reward(
            env,
            greeting_id,
            token_amount,
            creator,
            token,
            tipping_contract,
        )
    }

    /// Verifies if a greeting meets reward criteria
    pub fn check_reward_eligibility(env: Env, greeting_id: u64) -> Result<bool, Error> {
        rewards::check_reward_eligibility(env, greeting_id)
    }

    /// Get stored reward by greeting id
    pub fn get_greeting_reward(env: Env, greeting_id: u64) -> Option<GreetingReward> {
        rewards::get_reward(env, greeting_id)
    }
}

#[contractimpl]
impl crate::UserRegistryTrait for GreetingSystem {
    /// Registers a user with profile details
    fn register_user(
        env: Env,
        user: Address,
        name: String,
        preferences: String,
    ) -> Result<(), Error> {
        user::register(&env, &user, &name, &preferences)
    }

    /// Retrieves a user profile by address
    fn get_user_profile(env: Env, user: Address) -> Result<UserProfile, Error> {
        user::get_profile(&env, &user)
    }
}

#[contractimpl]
impl crate::ConfigTrait for GreetingSystem {
    fn set_reputation_contract(env: Env, contract: Address) -> Result<(), Error> {
        // Require admin auth: here we keep it simple and require the contract address itself to auth.
        contract.require_auth();
        crate::storage::set_reputation_contract(&env, &contract)
    }

    fn get_reputation_contract(env: Env) -> Option<Address> {
        crate::storage::get_reputation_contract(&env)
    }
}

#[cfg(test)]
mod test;
