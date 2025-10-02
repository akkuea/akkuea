use soroban_sdk::{Address, Env, String};

use crate::{Error, GreetingReward, PremiumFeatures, PremiumTier, TierLevel, UserProfile};

/// Interface for premium tier management
pub trait PremiumTierTrait {
    /// Assign a premium tier to a user based on their contribution
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `user` - The Stellar address of the user
    /// * `contribution` - The contribution amount in Stroops (1 XLM = 10,000,000 Stroops)
    ///
    /// # Returns
    /// * `Result<(), Error>` - Ok(()) if successful, Error if failed
    fn assign_premium_tier(env: Env, user: Address, contribution: i128) -> Result<(), Error>;

    /// Upgrade a user's premium tier with additional contribution
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `user` - The Stellar address of the user
    /// * `additional_contribution` - Additional contribution amount in Stroops
    ///
    /// # Returns
    /// * `Result<(), Error>` - Ok(()) if successful, Error if failed
    fn upgrade_premium_tier(
        env: Env,
        user: Address,
        additional_contribution: i128,
    ) -> Result<(), Error>;

    /// Get the premium status of a user
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `user` - The Stellar address of the user
    ///
    /// # Returns
    /// * `Result<PremiumTier, Error>` - The premium tier if found, Error if not found
    fn get_premium_status(env: Env, user: Address) -> Result<PremiumTier, Error>;

    /// Get the features available to a user
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `user` - The Stellar address of the user
    ///
    /// # Returns
    /// * `Result<PremiumFeatures, Error>` - The features available to the user
    fn get_user_features(env: Env, user: Address) -> Result<PremiumFeatures, Error>;

    /// Get the tier level of a user
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `user` - The Stellar address of the user
    ///
    /// # Returns
    /// * `Result<TierLevel, Error>` - The tier level if found
    fn get_tier_level(env: Env, user: Address) -> Result<TierLevel, Error>;

    /// Get the total contribution amount for a user
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `user` - The Stellar address of the user
    ///
    /// # Returns
    /// * `Result<i128, Error>` - The total contribution in Stroops
    fn get_total_contribution(env: Env, user: Address) -> Result<i128, Error>;
}

/// Interface for greeting reward management
pub trait GreetingRewardTrait {
    /// Issues tokens for a popular greeting.
    /// Returns the created `GreetingReward` record.
    fn issue_greeting_reward(
        env: Env,
        greeting_id: u64,
        token_amount: i128,
        creator: Address,
        token: Address,
        tipping_contract: Address,
    ) -> Result<GreetingReward, Error>;

    /// Verifies if a greeting meets reward criteria.
    fn check_reward_eligibility(env: Env, greeting_id: u64) -> Result<bool, Error>;

    /// Get a previously issued reward by greeting id.
    fn get_greeting_reward(env: Env, greeting_id: u64) -> Option<GreetingReward>;
}

/// Interface for user registration and profiles
pub trait UserRegistryTrait {
    /// Register a specific user address with name and preferences
    fn register_user(
        env: Env,
        user: Address,
        name: String,
        preferences: String,
    ) -> Result<(), Error>;

    /// Get a user profile by address
    fn get_user_profile(env: Env, user: Address) -> Result<UserProfile, Error>;
}

/// Interface for admin/config actions
pub trait ConfigTrait {
    /// Set the reputation contract address for integration
    fn set_reputation_contract(env: Env, contract: Address) -> Result<(), Error>;

    fn get_reputation_contract(env: Env) -> Option<Address>;
}
