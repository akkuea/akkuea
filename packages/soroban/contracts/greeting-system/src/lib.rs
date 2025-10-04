#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String};

mod datatype;
mod error;
mod events;
mod interface;
mod moderation;
mod rewards;
mod storage;
mod user;
mod utils;

pub use datatype::*;
pub use error::*;
pub use events::*;
pub use interface::*;
pub use rewards::*;
pub use storage::*;
pub use utils::*;

#[contract]
pub struct GreetingSystem;

#[contractimpl]
impl GreetingSystem {
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

    /// Flags a greeting for inappropriate content
    pub fn filter_greeting(env: Env, greeting_id: u64, reason: String, flagged_by: Address) -> Result<(), Error> {
        moderation::filter_greeting(env, greeting_id, reason, flagged_by)
    }

    /// Resolves a flagged greeting
    pub fn resolve_flag(env: Env, greeting_id: u64, approve: bool, resolved_by: Address) -> Result<(), Error> {
        moderation::resolve_flag(env, greeting_id, approve, resolved_by)
    }

    /// Get the flag status of a greeting
    pub fn get_flag_status(env: Env, greeting_id: u64) -> Option<ContentFlag> {
        moderation::get_flag_status(env, greeting_id)
    }

    /// Add a moderator
    pub fn add_moderator(env: Env, moderator: Address) -> Result<(), Error> {
        moderator.require_auth();
        // For simplicity, allow any user to add moderators; in production, restrict to admins
        crate::storage::add_moderator(&env, &moderator)
    }

    /// Remove a moderator
    pub fn remove_moderator(env: Env, moderator: Address) -> Result<(), Error> {
        moderator.require_auth();
        crate::storage::remove_moderator(&env, &moderator)
    }

    /// Check if an address is a moderator
    pub fn is_moderator(env: Env, address: Address) -> bool {
        crate::storage::is_moderator(&env, &address)
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
