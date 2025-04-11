use crate::datatypes::{Error, TipRecord};
use soroban_sdk::{Address, Env, Vec};
use crate::educator_contract::Educator;






/// TippingRewardsInterface defines the public interface for the TippingRewards contract
/// This trait outlines all functions that can be called by users or other contracts
pub trait TippingRewardsInterface {
    /// Constructor function that must be called once when the contract is deployed
    /// Stores the address of the educator verification contract for future reference
    /// 
    /// # Parameters
    /// * `env` - The Soroban environment handle
    /// * `educator_contract` - Address of the deployed educator verification contract
    fn __constructor(env: &Env, educator_contract: Address);
    
    /// Allows a user to send a tip in any token to a verified educator
    /// Verifies the educator's status and transfers tokens if valid
    /// 
    /// # Parameters
    /// * `env` - The Soroban environment handle
    /// * `token` - Address of the token contract to use for the tip
    /// * `from` - Address of the user sending the tip
    /// * `educator` - Address of the educator receiving the tip
    /// * `amount` - Amount of tokens to send as a tip
    /// 
    /// # Returns
    /// * `Result<(), Error>` - Success or specific error code
    fn send_tip(
        env: &Env,
        token: Address,
        from: Address,
        educator: Address,
        amount: i128,
    ) -> Result<(), Error>;
    
    /// Helper function to calculate the average rating from a collection of ratings
    /// 
    /// # Parameters
    /// * `ratings` - Vector of rating values (typically 1-5)
    /// 
    /// # Returns
    /// * `i128` - The calculated average rating
    fn calculate_average_rating(ratings: Vec<u32>) -> i128;
    
    /// Helper function to combine different reputation metrics into a single score
    /// Applies weights to different factors to create a balanced ranking system
    /// 
    /// # Parameters
    /// * `total_tips` - Total amount of tips received by an educator
    /// * `avg_rating` - Average rating score for an educator
    /// 
    /// # Returns
    /// * `i128` - Combined reputation score
    fn combine_reputation_metrics(total_tips: i128, avg_rating: i128) -> i128;
    
    //
    // Query Interface - Read-only functions to retrieve contract data
    //
    
    /// Returns a list of top educators sorted by their reputation score
    /// Combines tip amounts and ratings to calculate rankings
    /// 
    /// # Parameters
    /// * `env` - The Soroban environment handle
    /// * `limit` - Maximum number of educators to return
    /// 
    /// # Returns
    /// * `Vec<Educator>` - Vector of Educator objects with their profile data
    fn get_top_educators(env: &Env, limit: u32) -> Vec<Educator>;
    
    /// Retrieves comprehensive reputation information for a specific educator
    /// 
    /// # Parameters
    /// * `env` - The Soroban environment handle
    /// * `educator` - Address of the educator to query
    /// 
    /// # Returns
    /// * `Result<(i128, i128, i128, Educator), Error>` - Tuple containing:
    ///   - Total tips received
    ///   - Average rating
    ///   - Reputation score
    ///   - Educator profile data
    ///   Or an error if the educator is not found
    fn get_educator_reputation(
        env: &Env,
        educator: Address,
    ) -> Result<(i128, i128, i128, Educator), Error>;
    
    /// Retrieves all tips sent by a specific user
    /// 
    /// # Parameters
    /// * `env` - The Soroban environment handle
    /// * `user` - Address of the user who sent the tips
    /// 
    /// # Returns
    /// * `Vec<TipRecord>` - Vector of all tip transactions sent by the user
    fn get_tips_sent(env: &Env, user: Address) -> Vec<TipRecord>;
    
    /// Retrieves all tips received by a specific user (typically an educator)
    /// 
    /// # Parameters
    /// * `env` - The Soroban environment handle
    /// * `user` - Address of the user who received the tips
    /// 
    /// # Returns
    /// * `Vec<TipRecord>` - Vector of all tip transactions received by the user
    fn get_tips_received(env: &Env, user: Address) -> Vec<TipRecord>;
}