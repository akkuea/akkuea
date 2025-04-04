#![no_std]
use soroban_sdk::{
    contract, contractimpl, symbol_short, Address, Env, Symbol, Vec
};
use soroban_sdk::token::Client as TokenClient;


// Import the educator verification contract
mod educator_contract {
    // Import the WASM file for the educator verification contract
    soroban_sdk::contractimport!( 
        file = "../../target/wasm32-unknown-unknown/release/educator_verification_nft.wasm"
    );
}


// Import the EducatorClient for interacting with the educator verification contract
use educator_contract::Client as EducatorClient;
// Import custom data types and error definitions
use datatypes::{TipRecord, Error, TIPS_HISTORY};
// Import the interface definition for the tipping rewards contract
use interfaces::TippingRewardsInterface;





// Define the main contract struct
#[contract]
pub struct TippingRewards;

// Constant to store the key for the educator contract address in storage
const EDUCATOR_CONTRACT: Symbol = symbol_short!("EDU_CONT");





// Implement the TippingRewardsInterface for the TippingRewards contract
#[contractimpl]
impl TippingRewardsInterface for TippingRewards {

    // Constructor function that initializes the contract by storing the educator verification contract address
    // This is called once during contract deployment
    fn __constructor(env: &Env, educator_contract: Address) {
        env.storage().instance().set(&EDUCATOR_CONTRACT, &educator_contract);
    }



    // Send a tip from one user to an educator
    // Parameters:
    // - token: The address of the token to send as a tip
    // - from: The address of the user sending the tip
    // - educator: The address of the educator receiving the tip
    // - amount: The amount of tokens to send
    // Returns Result with () on success or Error on failure
    fn send_tip(
        env: &Env,
        token: Address,
        from: Address,
        educator: Address,
        amount: i128,
    ) -> Result<(), Error> {
        // Verify that the sender has authorized this transaction
        from.require_auth();

        // Ensure the tip amount is positive
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        // Verify that the recipient is a registered educator in the educator verification contract
        let educator_client = EducatorClient::new(&env, &env.storage().instance().get(&EDUCATOR_CONTRACT).unwrap());
        educator_client.get_educator(&educator)
            .ok_or(Error::InvalidEducator)?;

        // Create a token client and transfer the tokens from sender to educator
        let token = TokenClient::new(&env, &token);
        token.transfer(&from, &educator, &amount);

        // Record the tip transaction in contract storage
        let mut tips_history: Vec<TipRecord> = env.storage().instance().get(&TIPS_HISTORY).unwrap_or(Vec::new(&env));
        tips_history.push_back(TipRecord {
            from: from.clone(),
            to: educator.clone(),
            amount,
            timestamp: env.ledger().timestamp(),
        });
        env.storage().instance().set(&TIPS_HISTORY, &tips_history);

        // Emit an event to record the tip on the blockchain
        env.events().publish(
            (TIPS_HISTORY, symbol_short!("send")),
            (from, educator, amount)
        );

        Ok(())
    }

    


    // Get the top educators ranked by reputation score
    // Parameters:
    // - limit: Maximum number of educators to return
    // Returns a vector of Educator objects
    fn get_top_educators(
        env: &Env, 
        limit: u32
    ) -> Vec<educator_contract::Educator> {
        // Retrieve the educator contract address from storage
        let educator_contract = env.storage().instance().get(&EDUCATOR_CONTRACT).unwrap();
        let educator_client = EducatorClient::new(&env, &educator_contract);
        
        // Get all verified educators from the educator verification contract
        let all_educators = educator_client.get_verified_educators();
        let mut educator_scores: Vec<(Address, i128)> = Vec::new(&env);
        
        // Calculate reputation scores for each educator based on tips and ratings
        for educator in all_educators.iter() {
            // Get tips history from storage
            let tips_history: Vec<TipRecord> = env.storage().instance().get(&TIPS_HISTORY).unwrap_or(Vec::new(&env));
            let mut total_tips = 0_i128;
            
            // Calculate total tip amount received by this educator
            for tip in tips_history.iter() {
                if tip.to == educator {
                    total_tips += tip.amount;
                }
            }
            
            // Get all reviews for this educator from the educator contract
            let reviews = educator_client.get_educator_reviews(&educator);
           
            // Extract ratings from reviews
            let mut ratings = Vec::new(&env);
            for review in reviews.iter() {
                ratings.push_back(review.rating);
            }
            // Calculate the average rating
            let avg_rating = Self::calculate_average_rating(ratings);
            
            // Combine tips and ratings into a single reputation score
            let reputation_score = Self::combine_reputation_metrics(total_tips, avg_rating);
            
            // Store educator with their reputation score
            educator_scores.push_back((educator.clone(), reputation_score));
        }
        
        // Sort educators by reputation score in descending order using bubble sort
        for _i in 0..educator_scores.len() {
            for j in 0..educator_scores.len() - 1 {
                if educator_scores.get_unchecked(j).1 < educator_scores.get_unchecked(j + 1).1 {
                    let temp = educator_scores.get_unchecked(j);
                    educator_scores.set(j, educator_scores.get_unchecked(j + 1));
                    educator_scores.set(j + 1, temp);
                }
            }
        }
        
        // Create a vector of the top N educators with their full profiles
        let mut result = Vec::new(&env);
        for (addr, _) in educator_scores.iter().take(limit as usize) {
            if let Some(educator) = educator_client.get_educator(&addr) {
                result.push_back(educator);
            }
        }
        
        // Emit an event with the list of top educators
        env.events().publish(
            (symbol_short!("TOP_EDU"), symbol_short!("list")),
            (limit, result.clone())
        );
        
        result
    }




    // Helper function to calculate the average rating from a vector of ratings
    // Returns 0 if there are no ratings
    fn calculate_average_rating(ratings: Vec<u32>) -> i128 {
        if ratings.len() == 0 {
            return 0;
        }
        
        // Sum all ratings
        let mut total = 0_i128;
        for i in 0..ratings.len() {
            total += ratings.get_unchecked(i) as i128;
        }
        // Calculate and return average
        total / (ratings.len() as i128)
    }



    // Helper function that combines tips and ratings into a single reputation score
    // The formula applies different weights to each metric to balance their importance
    fn combine_reputation_metrics(total_tips: i128, avg_rating: i128) -> i128 {
        // Weight factors (adjustable)
        let tip_weight = 1;      // Base weight for tips
        let rating_weight = 50;  // Higher weight for ratings (1-5 scale)
        
        // Calculate weighted scores for each component
        let weighted_tips = total_tips * tip_weight;
        let weighted_rating = avg_rating * rating_weight;
        
        // Combine weighted scores into a single reputation score
        weighted_tips + weighted_rating
    }



    
    // Get detailed reputation information for a specific educator
    // Returns tuple with tip total, average rating, reputation score, and educator profile
    fn get_educator_reputation(
        env: &Env,
        educator: Address,
    ) -> Result<(i128, i128, i128, educator_contract::Educator), Error> {
        // Get educator contract from storage
        let educator_contract = env.storage().instance().get(&EDUCATOR_CONTRACT).unwrap();
        let educator_client = EducatorClient::new(&env, &educator_contract);
        
        // Verify educator exists and get their profile data
        let educator_data = educator_client.get_educator(&educator)
            .ok_or(Error::InvalidEducator)?;
        
        // Get tips history from storage
        let tips_history: Vec<TipRecord> = env.storage().instance().get(&TIPS_HISTORY).unwrap_or(Vec::new(&env));
        let mut total_tips = 0_i128;
        
        // Calculate total tips received by this educator
        for tip in tips_history.iter() {
            if tip.to == educator {
                total_tips += tip.amount;
            }
        }
        
        // Get reviews and calculate average rating
        let reviews = educator_client.get_educator_reviews(&educator);
        let mut ratings = Vec::new(&env);
        for review in reviews.iter() {
            ratings.push_back(review.rating);
        }
        let avg_rating = Self::calculate_average_rating(ratings);
        
        // Calculate the educator's overall reputation score
        let reputation_score = Self::combine_reputation_metrics(total_tips, avg_rating);
        
        // Return the complete reputation data
        Ok((total_tips, avg_rating, reputation_score, educator_data))
    }

    


    // Get all tips sent by a specific user
    // Returns a vector of TipRecord objects
    fn get_tips_sent(env: &Env, user: Address) -> Vec<TipRecord> {
        // Get tips history from storage
        let tips_history: Vec<TipRecord> = env.storage().instance().get(&TIPS_HISTORY).unwrap_or(Vec::new(&env));
        let mut user_tips = Vec::new(&env);

        // Filter tips where the user is the sender
        for tip in tips_history.iter() {
            if tip.from == user {
                user_tips.push_back(tip);
            }
        }

        // Emit an event for this query
        env.events().publish(
            (TIPS_HISTORY, symbol_short!("tips_sent")),
            user
        );

        user_tips
    }



    // Get all tips received by a specific user (typically an educator)
    // Returns a vector of TipRecord objects
    fn get_tips_received(env: &Env, user: Address) -> Vec<TipRecord> {
        // Get tips history from storage
        let tips_history: Vec<TipRecord> = env.storage().instance().get(&TIPS_HISTORY).unwrap_or(Vec::new(&env));
        let mut user_tips = Vec::new(&env);

        // Filter tips where the user is the recipient
        for tip in tips_history.iter() {
            if tip.to == user {
                user_tips.push_back(tip);
            }
        }

        // Emit an event for this query
        env.events().publish(
            (TIPS_HISTORY, symbol_short!("tips_recv")),
            user
        );

        user_tips
    }
}

// Module for tests
#[cfg(test)]
mod test;
// Module containing data type definitions
mod datatypes;
// Module containing interface definitions
mod interfaces;