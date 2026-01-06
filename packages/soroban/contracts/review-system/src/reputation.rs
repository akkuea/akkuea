use soroban_sdk::{contracttype, Address, Env, IntoVal, Symbol};

use crate::{DataKey, ResponseError, ReviewSystemContract};

/// Reviewer profile containing credibility data
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReviewerProfile {
    pub reviewer: Address,      // Stellar address of the reviewer
    pub credibility_score: u32, // Credibility score (0-100)
    pub review_count: u32,      // Number of reviews submitted
    pub helpful_votes: u32,     // Total helpfulness votes received
}

impl ReviewSystemContract {
    /// Increment review count for a reviewer
    pub(crate) fn increment_review_count(env: &Env, reviewer: &Address) {
        let profile_key = DataKey::ReviewerProfile(reviewer.clone());
        let mut profile: ReviewerProfile =
            env.storage()
                .persistent()
                .get(&profile_key)
                .unwrap_or(ReviewerProfile {
                    reviewer: reviewer.clone(),
                    credibility_score: 50, // Start with base score
                    review_count: 0,
                    helpful_votes: 0,
                });

        profile.review_count += 1;
        profile.credibility_score =
            Self::calculate_base_credibility(profile.review_count, profile.helpful_votes);

        env.storage().persistent().set(&profile_key, &profile);

        env.events().publish(
            (Symbol::new(env, "review_count_updated"), reviewer.clone()),
            profile.review_count,
        );
    }
}
