use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, Vec};

use crate::rating::handle_rating_submission;
use crate::reputation::{get_reputation_data, init_reputation_data};
use crate::storage::{get_rating_by_transaction, get_user_rating_history};
pub use crate::types::{RatingData, RatingSubmissionResult, ReputationData};

#[contract]
pub struct RatingSystem;

#[contractimpl]
impl RatingSystem {
    pub fn init_user_reputation(env: Env, user: Address) -> ReputationData {
        init_reputation_data(&env, &user)
    }

    pub fn submit_rating(
        env: Env,
        transaction_id: BytesN<32>,
        rater: Address,
        rated_user: Address,
        delivery_score: u32,
        communication_score: u32,
        accuracy_score: u32,
        value_score: u32,
        comment: String,
    ) -> RatingSubmissionResult {
        handle_rating_submission(
            &env,
            &transaction_id,
            &rater,
            &rated_user,
            delivery_score,
            communication_score,
            accuracy_score,
            value_score,
            comment,
        )
    }

    pub fn get_user_reputation(env: Env, user: Address) -> ReputationData {
        get_reputation_data(&env, &user)
    }

    pub fn get_user_rating_history(env: Env, user: Address) -> Vec<BytesN<32>> {
        get_user_rating_history(&env, &user)
    }

    // Get rating data for a specific transaction
    pub fn get_transaction_rating(env: Env, transaction_id: BytesN<32>) -> Option<RatingData> {
        get_rating_by_transaction(&env, &transaction_id)
    }
}
