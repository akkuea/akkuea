use soroban_sdk::{Address, Env};

use crate::datatype::RewardType;
use crate::error::Error;

/// Interface for reward distribution and event logging
pub trait RewardTrait {
    /// Distributes rewards to a recipient based on their actions
    ///
    /// This function handles the core reward distribution logic:
    /// - Validates the reward amount
    /// - Updates the recipient's balance
    /// - Emits a reward event for transparency
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `recipient` - The address of the reward recipient
    /// * `reward_type` - The type of reward being distributed (e.g., ContentCreation, ExpertReview)
    /// * `amount` - The amount of rewards to distribute
    ///
    /// # Returns
    /// * `Result<(), Error>` - Ok(()) if successful, Error if failed
    fn distribute_rewards(
        env: Env,
        recipient: Address,
        reward_type: RewardType,
        amount: i128,
    ) -> Result<(), Error>;

    /// Logs a reward event for transparency and tracking
    ///
    /// This function emits an event whenever a reward is issued, containing:
    /// - The recipient's address
    /// - The type of reward
    /// - The amount distributed
    /// - Timestamp of the distribution
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `recipient` - The address of the reward recipient
    /// * `reward_type` - The type of reward being distributed
    /// * `amount` - The amount of rewards distributed
    ///
    /// # Returns
    /// * `()` - This function doesn't return a value as it only emits an event
    fn log_reward_event(env: Env, recipient: Address, reward_type: RewardType, amount: i128);
}

/// Interface for balance management
pub trait BalanceTrait {
    /// Updates the recipient's balance after reward distribution
    ///
    /// This internal function is called by distribute_rewards to:
    /// - Add the reward amount to the recipient's existing balance
    /// - Handle any balance-related errors
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `recipient` - The address whose balance should be updated
    /// * `amount` - The amount to add to the balance
    ///
    /// # Returns
    /// * `Result<(), Error>` - Ok(()) if successful, Error if failed
    fn update_balance(env: Env, recipient: Address, amount: i128) -> Result<(), Error>;

    /// Retrieves the current balance for a recipient
    ///
    /// This function allows querying the current reward balance
    /// for any address in the system.
    ///
    /// # Arguments
    /// * `env` - The Soroban environment
    /// * `recipient` - The address to check the balance for
    ///
    /// # Returns
    /// * `Result<i128, Error>` - The balance if successful, Error if failed
    fn get_balance(env: Env, recipient: Address) -> Result<i128, Error>;
}
