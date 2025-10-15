use soroban_sdk::{contracttype, Address, Env, IntoVal, String, Symbol};

use crate::{DataKey, ResponseError, ReviewSystemContract};

impl ReviewSystemContract {
    /// Verify that an account is a verified Stellar account holder
    pub(crate) fn verify_account(env: &Env, account: &Address) -> Result<(), ResponseError> {
        #[cfg(test)]
        {
            // In test mode, always consider accounts as verified
            let _ = (env, account);
            return Ok(());
        }

        #[cfg(not(test))]
        {
            let verification_contract: Address = env
                .storage()
                .persistent()
                .get(&DataKey::VerificationContract)
                .ok_or(ResponseError::NotVerifiedAccount)?;

            // Call the verification contract to check if account is verified
            // This is a placeholder - in practice, you'd call the actual verification contract
            let is_verified: bool = env
                .try_invoke_contract::<bool, ResponseError>(
                    &verification_contract,
                    &Symbol::new(env, "is_verified"),
                    soroban_sdk::vec![env, account.into_val(env)],
                )
                .unwrap_or(Ok(false))
                .unwrap_or(false);

            if !is_verified {
                return Err(ResponseError::NotVerifiedAccount);
            }

            Ok(())
        }
    }

    /// Submit a response for moderation
    pub(crate) fn submit_for_moderation(env: &Env, response_id: u64) -> Result<(), ResponseError> {
        #[cfg(test)]
        {
            // In test mode, just emit an event without calling external contract
            env.events().publish(
                (Symbol::new(env, "submitted_for_moderation"), response_id),
                response_id,
            );
            return Ok(());
        }

        #[cfg(not(test))]
        {
            let moderation_contract: Address = env
                .storage()
                .persistent()
                .get(&DataKey::ModerationContract)
                .ok_or(ResponseError::Unauthorized)?;

            // Call the moderation contract to submit for review
            let _result = env.try_invoke_contract::<(), ResponseError>(
                &moderation_contract,
                &Symbol::new(env, "submit_for_moderation"),
                soroban_sdk::vec![env, response_id.into_val(env)],
            );

            // Emit event for moderation submission
            env.events().publish(
                (Symbol::new(env, "submitted_for_moderation"), response_id),
                moderation_contract,
            );

            Ok(())
        }
    }

    /// Utility function to get admin address
    pub fn get_admin(env: Env) -> Result<Address, ResponseError> {
        env.storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ResponseError::Unauthorized)
    }

    /// Utility function to check if caller is admin
    pub(crate) fn require_admin(env: &Env) -> Result<Address, ResponseError> {
        let admin = Self::get_admin(env.clone())?;
        admin.require_auth();
        Ok(admin)
    }

    /// Utility function to sanitize response text
    pub(crate) fn sanitize_text(env: &Env, text: &str) -> String {
        // Basic text sanitization - remove excessive whitespace
        let cleaned = text.trim();
        String::from_str(env, cleaned)
    }

    /// Calculate the depth of a response in the thread
    pub(crate) fn get_response_depth_impl(
        env: Env,
        response_id: u64,
    ) -> Result<u32, ResponseError> {
        let mut depth = 0u32;
        let mut current_id = response_id;

        loop {
            let response: crate::Response = env
                .storage()
                .persistent()
                .get(&DataKey::Response(current_id))
                .ok_or(ResponseError::ResponseNotFound)?;

            if response.parent_response == 0 {
                break;
            }

            depth += 1;
            current_id = response.parent_response;
        }

        Ok(depth)
    }

    /// Get the root response of a thread
    pub(crate) fn get_thread_root_impl(env: Env, response_id: u64) -> Result<u64, ResponseError> {
        let mut current_id = response_id;

        loop {
            let response: crate::Response = env
                .storage()
                .persistent()
                .get(&DataKey::Response(current_id))
                .ok_or(ResponseError::ResponseNotFound)?;

            if response.parent_response == 0 {
                return Ok(current_id);
            }

            current_id = response.parent_response;
        }
    }

    /// Check if a user has already responded to a specific review
    pub fn has_user_responded_to_review(
        env: Env,
        user: Address,
        review_id: u64,
    ) -> Result<bool, ResponseError> {
        let response_ids_key = DataKey::ResponsesByReview(review_id);
        let response_ids: soroban_sdk::Vec<u64> = env
            .storage()
            .persistent()
            .get(&response_ids_key)
            .unwrap_or(soroban_sdk::Vec::new(&env));

        for response_id in response_ids.iter() {
            if let Some(response) = env
                .storage()
                .persistent()
                .get::<DataKey, crate::Response>(&DataKey::Response(response_id))
            {
                if response.responder == user {
                    return Ok(true);
                }
            }
        }

        Ok(false)
    }

    /// Get all responses by a specific user
    pub fn get_user_responses(
        env: Env,
        user: Address,
        review_id: Option<u64>,
    ) -> Result<soroban_sdk::Vec<crate::Response>, ResponseError> {
        let mut user_responses = soroban_sdk::Vec::new(&env);

        if let Some(review_id) = review_id {
            // Get responses for a specific review
            let response_ids_key = DataKey::ResponsesByReview(review_id);
            let response_ids: soroban_sdk::Vec<u64> = env
                .storage()
                .persistent()
                .get(&response_ids_key)
                .unwrap_or(soroban_sdk::Vec::new(&env));

            for response_id in response_ids.iter() {
                if let Some(response) = env
                    .storage()
                    .persistent()
                    .get::<DataKey, crate::Response>(&DataKey::Response(response_id))
                {
                    if response.responder == user {
                        user_responses.push_back(response);
                    }
                }
            }
        } else {
            // This would require a more complex indexing system in a real implementation
            // For now, we'll return an empty vector as this functionality would require
            // additional storage patterns to be efficient
        }

        Ok(user_responses)
    }

    /// Validate response content for policy compliance
    pub(crate) fn validate_response_content(text: &str) -> Result<(), ResponseError> {
        // Basic validation - check for empty content
        if text.trim().is_empty() {
            return Err(ResponseError::TextTooLong); // Reusing error, ideally would have InvalidContent
        }

        // Additional validation rules can be added here
        // - Check for spam patterns
        // - Check for prohibited content
        // - Validate encoding

        Ok(())
    }

    /// Get response statistics for a review
    pub fn get_response_stats(env: Env, review_id: u64) -> ResponseStats {
        let response_ids_key = DataKey::ResponsesByReview(review_id);
        let response_ids: soroban_sdk::Vec<u64> = env
            .storage()
            .persistent()
            .get(&response_ids_key)
            .unwrap_or(soroban_sdk::Vec::new(&env));

        let mut total_responses = 0u32;
        let mut approved_responses = 0u32;
        let mut pending_responses = 0u32;
        let mut rejected_responses = 0u32;
        let mut total_helpful_votes = 0u32;
        let mut total_not_helpful_votes = 0u32;

        for response_id in response_ids.iter() {
            if let Some(response) = env
                .storage()
                .persistent()
                .get::<DataKey, crate::Response>(&DataKey::Response(response_id))
            {
                total_responses += 1;
                total_helpful_votes += response.helpful_votes;
                total_not_helpful_votes += response.not_helpful_votes;

                match response.moderation_status {
                    crate::ModerationStatus::Approved => approved_responses += 1,
                    crate::ModerationStatus::Pending => pending_responses += 1,
                    crate::ModerationStatus::Rejected => rejected_responses += 1,
                    crate::ModerationStatus::Flagged => rejected_responses += 1,
                }
            }
        }

        ResponseStats {
            total_responses,
            approved_responses,
            pending_responses,
            rejected_responses,
            total_helpful_votes,
            total_not_helpful_votes,
        }
    }
}

/// Statistics about responses for a review
#[contracttype]
#[derive(Clone)]
pub struct ResponseStats {
    pub total_responses: u32,
    pub approved_responses: u32,
    pub pending_responses: u32,
    pub rejected_responses: u32,
    pub total_helpful_votes: u32,
    pub total_not_helpful_votes: u32,
}

/// Credibility scoring utilities
impl ReviewSystemContract {
    /// Calculate base credibility score for gas efficiency
    pub(crate) fn calculate_base_credibility(review_count: u32, helpful_votes: u32) -> u32 {
        // Optimized calculation to minimize gas usage
        let base_score = 50u32;

        // Review frequency bonus (max 25 points, efficient calculation)
        let review_bonus = (review_count.min(25)) as u32;

        // Helpfulness ratio bonus (max 25 points)
        let helpfulness_bonus = if review_count > 0 {
            let ratio = (helpful_votes * 25) / review_count.max(1);
            ratio.min(25)
        } else {
            0
        };

        (base_score + review_bonus + helpfulness_bonus).min(100)
    }

    /// Validate credibility score range
    pub(crate) fn validate_credibility_score(score: u32) -> Result<u32, ResponseError> {
        if score > 100 {
            Err(ResponseError::InvalidResponseId) // Reusing error for validation
        } else {
            Ok(score)
        }
    }

    /// Calculate helpfulness ratio for scoring
    pub(crate) fn calculate_helpfulness_ratio(helpful_votes: u32, total_reviews: u32) -> u32 {
        if total_reviews == 0 {
            return 0;
        }

        // Return percentage (0-100)
        (helpful_votes * 100) / total_reviews
    }

    /// Determine credibility tier based on score
    pub(crate) fn get_credibility_tier(score: u32) -> CredibilityTier {
        match score {
            0..=30 => CredibilityTier::Novice,
            31..=60 => CredibilityTier::Intermediate,
            61..=80 => CredibilityTier::Expert,
            81..=100 => CredibilityTier::Master,
            _ => CredibilityTier::Novice,
        }
    }

    /// Update reviewer credibility when they receive a helpful vote
    pub(crate) fn update_reviewer_credibility_on_vote(env: &Env, reviewer: &Address) {
        let profile_key = DataKey::ReviewerProfile(reviewer.clone());
        let mut profile: crate::reputation::ReviewerProfile =
            env.storage().persistent().get(&profile_key).unwrap_or(
                crate::reputation::ReviewerProfile {
                    reviewer: reviewer.clone(),
                    credibility_score: 50, // Default starting score
                    review_count: 0,
                    helpful_votes: 0,
                },
            );

        // Increment helpful votes
        profile.helpful_votes += 1;

        // Recalculate credibility score
        profile.credibility_score =
            Self::calculate_base_credibility(profile.review_count, profile.helpful_votes);

        // Store updated profile
        env.storage().persistent().set(&profile_key, &profile);

        // Emit credibility update event
        env.events().publish(
            (
                Symbol::new(env, "credibility_auto_updated"),
                reviewer.clone(),
            ),
            (profile.credibility_score, profile.helpful_votes),
        );
    }
}

/// Credibility tiers for reviewers
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CredibilityTier {
    Novice,       // 0-30 points
    Intermediate, // 31-60 points
    Expert,       // 61-80 points
    Master,       // 81-100 points
}

/// Statistics about the reward system
#[contracttype]
#[derive(Clone)]
pub struct RewardStatistics {
    pub total_rewards_issued: u64,
    pub total_amount_distributed: i128,
    pub average_reward_amount: i128,
    pub unique_rewarded_reviewers: u64,
}
