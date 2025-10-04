use soroban_sdk::{Address, Env};

use crate::{Error, PremiumFeatures, PremiumTier, TierLevel};

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
