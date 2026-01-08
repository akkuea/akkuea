use crate::constants::{
    ACCURACY_WEIGHT, COMMUNICATION_WEIGHT, DELIVERY_WEIGHT, HIGH_REPUTATION_THRESHOLD,
    MEDIUM_REPUTATION_THRESHOLD, VALUE_WEIGHT,
};
use crate::storage::{get_reputation, save_reputation};
use crate::types::{ReputationData, ReputationTier};
use soroban_sdk::{Address, Env};

pub fn init_reputation_data(env: &Env, user: &Address) -> ReputationData {
    user.require_auth();

    if get_reputation(env, user).is_some() {
        panic!("User reputation already initialized");
    }

    let reputation_data = ReputationData {
        total_score: 0,
        rating_count: 0,
        reputation_score: 0,
        reputation_tier: ReputationTier::New,
    };

    save_reputation(env, user, &reputation_data);

    reputation_data
}

pub fn get_reputation_data(env: &Env, user: &Address) -> ReputationData {
    get_reputation(env, user).unwrap_or(ReputationData {
        total_score: 0,
        rating_count: 0,
        reputation_score: 0,
        reputation_tier: ReputationTier::New,
    })
}

pub fn update_reputation(
    env: &Env,
    user: &Address,
    delivery_score: u32,
    communication_score: u32,
    accuracy_score: u32,
    value_score: u32,
) -> ReputationData {
    let mut reputation_data = get_reputation_data(env, user);
    let weighted_score = calculate_weighted_score(
        delivery_score,
        communication_score,
        accuracy_score,
        value_score,
    );

    reputation_data.total_score += weighted_score;
    reputation_data.rating_count += 1;

    reputation_data.reputation_score =
        calculate_reputation_score(reputation_data.total_score, reputation_data.rating_count);

    reputation_data.reputation_tier = determine_reputation_tier(reputation_data.reputation_score);

    save_reputation(env, user, &reputation_data);
    reputation_data
}

pub fn calculate_weighted_score(
    delivery_score: u32,
    communication_score: u32,
    accuracy_score: u32,
    value_score: u32,
) -> u32 {
    (delivery_score * DELIVERY_WEIGHT)
        + (communication_score * COMMUNICATION_WEIGHT)
        + (accuracy_score * ACCURACY_WEIGHT)
        + (value_score * VALUE_WEIGHT)
}

// Helper function to calculate reputation score (normalized to 100)
pub fn calculate_reputation_score(total_score: u32, rating_count: u32) -> u32 {
    if rating_count == 0 {
        return 0;
    }

    let max_score_per_rating =
        5 * (DELIVERY_WEIGHT + COMMUNICATION_WEIGHT + ACCURACY_WEIGHT + VALUE_WEIGHT);

    // Calculate score as a percentage of maximum possible score
    (total_score * 100) / (rating_count * max_score_per_rating)
}

pub fn determine_reputation_tier(reputation_score: u32) -> ReputationTier {
    if reputation_score >= HIGH_REPUTATION_THRESHOLD {
        ReputationTier::High
    } else if reputation_score >= MEDIUM_REPUTATION_THRESHOLD {
        ReputationTier::Medium
    } else {
        ReputationTier::Low
    }
}
