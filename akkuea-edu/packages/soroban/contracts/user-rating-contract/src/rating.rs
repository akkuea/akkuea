use crate::constants::MIN_RATING_INTERVAL;
use crate::reputation::update_reputation;
use crate::storage::{
    get_last_rating_timestamp, get_rating_by_transaction, save_last_rating_timestamp, save_rating,
    update_rating_history,
};
use crate::types::{RatingData, RatingSubmissionResult, ReputationTier};
use soroban_sdk::{Address, BytesN, Env, String};

pub fn handle_rating_submission(
    env: &Env,
    transaction_id: &BytesN<32>,
    rater: &Address,
    rated_user: &Address,
    delivery_score: u32,
    communication_score: u32,
    accuracy_score: u32,
    value_score: u32,
    comment: String,
) -> RatingSubmissionResult {
    rater.require_auth();

    // Prevent rating self
    if rater == rated_user {
        return RatingSubmissionResult {
            success: false,
            new_reputation_score: 0,
            new_reputation_tier: ReputationTier::New,
            message: String::from_str(env, "Cannot rate yourself"),
        };
    }

    // Check if transaction was already rated
    if get_rating_by_transaction(env, transaction_id).is_some() {
        return RatingSubmissionResult {
            success: false,
            new_reputation_score: 0,
            new_reputation_tier: ReputationTier::New,
            message: String::from_str(env, "Transaction already rated"),
        };
    }

    // Check time restrictions
    let current_time = env.ledger().timestamp();
    if let Some(last_rating_time) = get_last_rating_timestamp(env, rater) {
        if current_time < last_rating_time + MIN_RATING_INTERVAL {
            return RatingSubmissionResult {
                success: false,
                new_reputation_score: 0,
                new_reputation_tier: ReputationTier::New,
                message: String::from_str(env, "Rating too soon after last submission"),
            };
        }
    }

    // Validate score values (1-5)
    if !is_valid_score(delivery_score)
        || !is_valid_score(communication_score)
        || !is_valid_score(accuracy_score)
        || !is_valid_score(value_score)
    {
        return RatingSubmissionResult {
            success: false,
            new_reputation_score: 0,
            new_reputation_tier: ReputationTier::New,
            message: String::from_str(env, "Invalid score value. Must be between 1 and 5"),
        };
    }

    let rating_data = RatingData {
        transaction_id: transaction_id.clone(),
        rater: rater.clone(),
        rated_user: rated_user.clone(),
        delivery_score,
        communication_score,
        accuracy_score,
        value_score,
        timestamp: current_time,
        comment,
    };

    save_rating(env, &rating_data);

    save_last_rating_timestamp(env, rater, current_time);

    update_rating_history(env, rated_user, transaction_id);

    let new_reputation = update_reputation(
        env,
        rated_user,
        delivery_score,
        communication_score,
        accuracy_score,
        value_score,
    );

    RatingSubmissionResult {
        success: true,
        new_reputation_score: new_reputation.reputation_score,
        new_reputation_tier: new_reputation.reputation_tier,
        message: String::from_str(env, "Rating submitted successfully"),
    }
}

// Helper function to validate score values
fn is_valid_score(score: u32) -> bool {
    score >= 1 && score <= 5
}
