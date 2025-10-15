#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Env, IntoVal, String, Symbol, Vec,
};

mod incentives;
mod reputation;
mod response;
mod utils;

#[cfg(test)]
mod test;

pub use incentives::{QualityThresholds, QualityTier, ReviewReward, RewardAmounts, RewardError};
pub use reputation::ReviewerProfile;
pub use response::ThreadNode;
pub use utils::{CredibilityTier, ResponseStats, RewardStatistics};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Response {
    pub response_id: u64,
    pub review_id: u64,
    pub parent_response: u64, // 0 if top-level response
    pub responder: Address,
    pub text: String,
    pub timestamp: u64,
    pub moderation_status: ModerationStatus,
    pub helpful_votes: u32,
    pub not_helpful_votes: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ModerationStatus {
    Pending,
    Approved,
    Rejected,
    Flagged,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    ModerationContract,
    ResponseCounter,
    Response(u64),            // response_id -> Response
    ResponsesByReview(u64),   // review_id -> Vec<u64> (response_ids)
    ResponsesByParent(u64),   // parent_response_id -> Vec<u64> (child response_ids)
    VoteRecord(Address, u64), // (voter, response_id) -> bool (true for helpful, false for not helpful)
    VerificationContract,     // Address of the contract that verifies Stellar accounts
    ReviewerProfile(Address), // reviewer_address -> ReviewerProfile
    UserReputationContract,   // Address of the user reputation contract for integration
    // Reward system keys
    RewardContract,           // Address of the reward distribution contract
    ReviewReward(u64),        // review_id -> ReviewReward
    ReviewerRewards(Address), // reviewer -> Vec<u64> (review_ids with rewards)
    RewardCounter,            // Counter for total rewards issued
    QualityThresholds,        // Quality thresholds for rewards
    RewardAmounts,            // Standard reward amounts by quality tier
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ResponseError {
    Unauthorized = 1,
    ResponseNotFound = 2,
    ReviewNotFound = 3,
    InvalidParentResponse = 4,
    TextTooLong = 5,
    AlreadyVoted = 6,
    NotVerifiedAccount = 7,
    ModerationPending = 8,
    ResponseRejected = 9,
    InvalidResponseId = 10,
}

pub const MAX_RESPONSE_TEXT_LENGTH: u32 = 1000;
pub const MAX_THREAD_DEPTH: u32 = 10;

#[contract]
pub struct ReviewSystemContract;

#[contractimpl]
impl ReviewSystemContract {
    /// Initialize the contract with admin and related contract addresses
    pub fn initialize(
        env: Env,
        admin: Address,
        moderation_contract: Address,
        verification_contract: Address,
        user_reputation_contract: Address,
    ) {
        if env.storage().persistent().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        admin.require_auth();

        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::ModerationContract, &moderation_contract);
        env.storage()
            .persistent()
            .set(&DataKey::VerificationContract, &verification_contract);
        env.storage()
            .persistent()
            .set(&DataKey::UserReputationContract, &user_reputation_contract);
        env.storage()
            .persistent()
            .set(&DataKey::ResponseCounter, &0u64);

        env.events().publish(
            (Symbol::new(&env, "contract_initialized"), admin),
            (
                moderation_contract,
                verification_contract,
                user_reputation_contract,
            ),
        );
    }

    /// Add a response to a review or another response
    pub fn add_response(
        env: Env,
        responder: Address,
        review_id: u64,
        parent_response: u64,
        text: String,
    ) -> u64 {
        responder.require_auth();

        // Validate response text length
        if text.len() > MAX_RESPONSE_TEXT_LENGTH {
            panic!("Response text too long");
        }

        // Verify the responder is a verified Stellar account holder
        Self::verify_account(&env, &responder).expect("Account verification failed");

        // Validate parent response exists if it's not a top-level response
        if parent_response != 0 {
            Self::validate_parent_response(&env, parent_response, review_id)
                .expect("Invalid parent response");

            // Check thread depth to prevent excessively deep nesting
            Self::validate_thread_depth(&env, parent_response).expect("Thread depth exceeded");
        }

        // Generate new response ID
        let response_counter: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::ResponseCounter)
            .unwrap_or(0);
        let response_id = response_counter + 1;
        env.storage()
            .persistent()
            .set(&DataKey::ResponseCounter, &response_id);

        // Create the response
        let response = Response {
            response_id,
            review_id,
            parent_response,
            responder: responder.clone(),
            text: text.clone(),
            timestamp: env.ledger().timestamp(),
            moderation_status: ModerationStatus::Pending,
            helpful_votes: 0,
            not_helpful_votes: 0,
        };

        // Store the response
        env.storage()
            .persistent()
            .set(&DataKey::Response(response_id), &response);

        // Update reviewer profile (increment review count)
        Self::increment_review_count(&env, &responder);

        // Update response indices
        Self::update_response_indices(&env, review_id, parent_response, response_id);

        // Submit for moderation
        Self::submit_for_moderation(&env, response_id).expect("Moderation submission failed");

        env.events().publish(
            (Symbol::new(&env, "response_added"), responder),
            (review_id, response_id, parent_response),
        );

        response_id
    }

    /// Get all responses for a specific review as a threaded structure
    pub fn get_response_thread(env: Env, review_id: u64) -> Vec<Response> {
        let response_ids_key = DataKey::ResponsesByReview(review_id);
        let response_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&response_ids_key)
            .unwrap_or(Vec::new(&env));

        let mut responses = Vec::new(&env);
        for response_id in response_ids.iter() {
            if let Some(response) = env
                .storage()
                .persistent()
                .get::<DataKey, Response>(&DataKey::Response(response_id))
            {
                if response.moderation_status == ModerationStatus::Approved {
                    responses.push_back(response);
                }
            }
        }

        responses
    }

    /// Get a specific response by ID
    pub fn get_response(env: Env, response_id: u64) -> Response {
        env.storage()
            .persistent()
            .get(&DataKey::Response(response_id))
            .expect("Response not found")
    }

    /// Vote on the helpfulness of a response
    pub fn vote_helpful(env: Env, voter: Address, response_id: u64, helpful: bool) {
        voter.require_auth();

        // Verify the voter is a verified Stellar account holder
        Self::verify_account(&env, &voter).expect("Account verification failed");

        // Check if already voted
        let vote_key = DataKey::VoteRecord(voter.clone(), response_id);
        if env.storage().persistent().has(&vote_key) {
            panic!("Already voted");
        }

        // Get and update the response
        let mut response: Response = env
            .storage()
            .persistent()
            .get(&DataKey::Response(response_id))
            .expect("Response not found");

        if helpful {
            response.helpful_votes += 1;

            // Update the responder's credibility score when they receive a helpful vote
            Self::update_reviewer_credibility_on_vote(&env, &response.responder);
        } else {
            response.not_helpful_votes += 1;
        }

        // Record the vote
        env.storage().persistent().set(&vote_key, &helpful);
        env.storage()
            .persistent()
            .set(&DataKey::Response(response_id), &response);

        env.events().publish(
            (Symbol::new(&env, "response_voted"), voter),
            (response_id, helpful),
        );
    }

    /// Update moderation status (called by moderation contract)
    pub fn update_moderation_status(env: Env, response_id: u64, status: ModerationStatus) {
        let moderation_contract: Address = env
            .storage()
            .persistent()
            .get(&DataKey::ModerationContract)
            .expect("Moderation contract not set");

        moderation_contract.require_auth();

        let mut response: Response = env
            .storage()
            .persistent()
            .get(&DataKey::Response(response_id))
            .expect("Response not found");

        response.moderation_status = status.clone();
        env.storage()
            .persistent()
            .set(&DataKey::Response(response_id), &response);

        env.events().publish(
            (Symbol::new(&env, "moderation_updated"), moderation_contract),
            (response_id, status),
        );
    }

    /// Get child responses for a given parent response
    pub fn get_child_responses(env: Env, parent_response_id: u64) -> Vec<Response> {
        Self::get_child_responses_impl(env.clone(), parent_response_id).unwrap_or(Vec::new(&env))
    }

    /// Get responses count for a review
    pub fn get_response_count(env: Env, review_id: u64) -> u64 {
        Self::get_response_count_impl(env, review_id)
    }

    /// Get top-level responses (direct replies to review)
    pub fn get_top_level_responses(env: Env, review_id: u64) -> Vec<Response> {
        Self::get_top_level_responses_impl(env.clone(), review_id).unwrap_or(Vec::new(&env))
    }

    /// Calculate the depth of a response in the thread
    pub fn get_response_depth(env: Env, response_id: u64) -> u32 {
        Self::get_response_depth_impl(env, response_id).unwrap_or(0)
    }

    /// Get the root response of a thread
    pub fn get_thread_root(env: Env, response_id: u64) -> u64 {
        Self::get_thread_root_impl(env, response_id).unwrap_or(0)
    }

    // === CREDIBILITY SYSTEM FUNCTIONS ===

    /// Update a reviewer's credibility score based on helpful votes
    pub fn update_credibility(env: Env, reviewer: Address, helpful_votes: u32) {
        // Verify the caller is authorized
        reviewer.require_auth();

        // Verify the reviewer is a verified Stellar account holder
        Self::verify_account(&env, &reviewer).expect("Account verification failed");

        // Get existing profile or create new one
        let profile_key = DataKey::ReviewerProfile(reviewer.clone());
        let mut profile: ReviewerProfile =
            env.storage()
                .persistent()
                .get(&profile_key)
                .unwrap_or(ReviewerProfile {
                    reviewer: reviewer.clone(),
                    credibility_score: 0,
                    review_count: 0,
                    helpful_votes: 0,
                });

        // Update helpful votes
        profile.helpful_votes = helpful_votes;

        // Calculate new credibility score
        profile.credibility_score =
            Self::calculate_base_credibility(profile.review_count, profile.helpful_votes);

        // Store updated profile
        env.storage().persistent().set(&profile_key, &profile);

        // Emit credibility update event
        env.events().publish(
            (Symbol::new(&env, "credibility_updated"), reviewer.clone()),
            (profile.credibility_score, helpful_votes),
        );
    }

    /// Get a reviewer's credibility score
    pub fn get_credibility(env: Env, reviewer: Address) -> u32 {
        let profile_key = DataKey::ReviewerProfile(reviewer.clone());
        let profile: ReviewerProfile =
            env.storage()
                .persistent()
                .get(&profile_key)
                .unwrap_or(ReviewerProfile {
                    reviewer: reviewer.clone(),
                    credibility_score: 0,
                    review_count: 0,
                    helpful_votes: 0,
                });

        profile.credibility_score
    }

    /// Get full reviewer profile
    pub fn get_reviewer_profile(env: Env, reviewer: Address) -> ReviewerProfile {
        let profile_key = DataKey::ReviewerProfile(reviewer.clone());
        env.storage()
            .persistent()
            .get(&profile_key)
            .unwrap_or(ReviewerProfile {
                reviewer,
                credibility_score: 0,
                review_count: 0,
                helpful_votes: 0,
            })
    }

    /// Reset credibility score (admin only)
    pub fn reset_credibility(env: Env, admin: Address, reviewer: Address) {
        admin.require_auth();

        // Verify admin is the contract admin
        let contract_admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Admin not found");

        if admin != contract_admin {
            panic!("Unauthorized: Only admin can reset credibility");
        }

        let profile_key = DataKey::ReviewerProfile(reviewer.clone());
        let mut profile: ReviewerProfile =
            env.storage()
                .persistent()
                .get(&profile_key)
                .unwrap_or(ReviewerProfile {
                    reviewer: reviewer.clone(),
                    credibility_score: 0,
                    review_count: 0,
                    helpful_votes: 0,
                });

        profile.credibility_score = 50; // Reset to base score
        profile.review_count = 0;
        profile.helpful_votes = 0;

        env.storage().persistent().set(&profile_key, &profile);

        env.events()
            .publish((Symbol::new(&env, "credibility_reset"), admin), reviewer);
    }

    /// Get all reviewers with credibility above threshold
    pub fn get_credible_reviewers(env: Env, _min_score: u32) -> soroban_sdk::Vec<Address> {
        // This is a simplified implementation
        let credible_reviewers = soroban_sdk::Vec::new(&env);
        credible_reviewers
    }

    // === REWARD SYSTEM FUNCTIONS ===

    /// Initialize reward system with contract address and parameters
    pub fn initialize_rewards(
        env: Env,
        admin: Address,
        reward_contract: Address,
        quality_thresholds: QualityThresholds,
        reward_amounts: RewardAmounts,
    ) {
        admin.require_auth();

        // Store reward contract address
        env.storage()
            .persistent()
            .set(&DataKey::RewardContract, &reward_contract);

        // Store quality thresholds
        env.storage()
            .persistent()
            .set(&DataKey::QualityThresholds, &quality_thresholds);

        // Store reward amounts
        env.storage()
            .persistent()
            .set(&DataKey::RewardAmounts, &reward_amounts);

        // Initialize reward counter
        env.storage()
            .persistent()
            .set(&DataKey::RewardCounter, &0u64);

        env.events().publish(
            (Symbol::new(&env, "rewards_initialized"), admin),
            (reward_contract, quality_thresholds, reward_amounts),
        );
    }

    /// Issue tokens for a high-quality review
    pub fn issue_reward(
        env: Env,
        caller: Address,
        review_id: u64,
        token_amount: Option<i128>,
    ) -> Result<ReviewReward, RewardError> {
        use crate::incentives::*;
        caller.require_auth();

        // Check if reward already issued for this review
        if env
            .storage()
            .persistent()
            .has(&DataKey::ReviewReward(review_id))
        {
            return Err(RewardError::RewardAlreadyIssued);
        }

        // Check reward eligibility
        let quality_tier = Self::check_reward_eligibility_internal(&env, review_id)?;

        // Determine reward amount
        let final_amount = if let Some(amount) = token_amount {
            // Validate custom amount
            if amount <= 0 {
                return Err(RewardError::InvalidRewardAmount);
            }
            amount
        } else {
            // Use standard amount based on quality tier
            Self::get_standard_reward_amount(&env, &quality_tier)?
        };

        // Get review to find reviewer
        let reviewer = Self::get_reviewer_for_review(&env, review_id)
            .map_err(|_| RewardError::NotEligibleForReward)?;

        // Distribute tokens via reward contract
        Self::distribute_reward_tokens(&env, &reviewer, final_amount)?;

        // Create reward record
        let reward = ReviewReward {
            review_id,
            reviewer: reviewer.clone(),
            token_amount: final_amount,
            timestamp: env.ledger().timestamp(),
        };

        // Store reward record
        env.storage()
            .persistent()
            .set(&DataKey::ReviewReward(review_id), &reward);

        // Update reviewer's reward list
        Self::add_to_reviewer_rewards(&env, &reviewer, review_id);

        // Increment reward counter
        let counter: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::RewardCounter)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::RewardCounter, &(counter + 1));

        // Emit reward issuance event
        env.events().publish(
            (Symbol::new(&env, "reward_issued"), reviewer.clone()),
            (review_id, final_amount, env.ledger().timestamp()),
        );

        Ok(reward)
    }

    /// Check if a review meets reward criteria
    pub fn check_reward_eligibility(env: Env, review_id: u64) -> Result<bool, RewardError> {
        match Self::check_reward_eligibility_internal(&env, review_id) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    /// Get reward information for a review
    pub fn get_review_reward(env: Env, review_id: u64) -> Option<ReviewReward> {
        env.storage()
            .persistent()
            .get(&DataKey::ReviewReward(review_id))
    }

    /// Get all rewards for a reviewer
    pub fn get_reviewer_rewards(env: Env, reviewer: Address) -> Vec<ReviewReward> {
        let reward_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::ReviewerRewards(reviewer))
            .unwrap_or(Vec::new(&env));

        let mut rewards = Vec::new(&env);
        for review_id in reward_ids.iter() {
            if let Some(reward) = env
                .storage()
                .persistent()
                .get::<DataKey, ReviewReward>(&DataKey::ReviewReward(review_id))
            {
                rewards.push_back(reward);
            }
        }

        rewards
    }

    /// Get total rewards issued
    pub fn get_total_rewards_issued(env: Env) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::RewardCounter)
            .unwrap_or(0)
    }

    /// Update quality thresholds (admin only)
    pub fn update_quality_thresholds(env: Env, admin: Address, thresholds: QualityThresholds) {
        admin.require_auth();

        // Verify admin
        let stored_admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Admin not set");

        if admin != stored_admin {
            panic!("Unauthorized");
        }

        env.storage()
            .persistent()
            .set(&DataKey::QualityThresholds, &thresholds);

        env.events()
            .publish((Symbol::new(&env, "thresholds_updated"), admin), thresholds);
    }

    /// Update reward amounts (admin only)
    pub fn update_reward_amounts(env: Env, admin: Address, amounts: RewardAmounts) {
        admin.require_auth();

        // Verify admin
        let stored_admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Admin not set");

        if admin != stored_admin {
            panic!("Unauthorized");
        }

        env.storage()
            .persistent()
            .set(&DataKey::RewardAmounts, &amounts);

        env.events()
            .publish((Symbol::new(&env, "amounts_updated"), admin), amounts);
    }

    /// Calculate potential reward amount for a review
    pub fn calculate_potential_reward(env: Env, review_id: u64) -> Result<i128, ResponseError> {
        // Get quality thresholds and reward amounts
        let thresholds: QualityThresholds = env
            .storage()
            .persistent()
            .get(&DataKey::QualityThresholds)
            .ok_or(ResponseError::Unauthorized)?; // Reusing error, ideally would have specific error

        let amounts: RewardAmounts = env
            .storage()
            .persistent()
            .get(&DataKey::RewardAmounts)
            .ok_or(ResponseError::Unauthorized)?;

        // Find the best response for this review
        let response_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::ResponsesByReview(review_id))
            .unwrap_or(Vec::new(&env));

        let mut best_score = 0u32;
        for response_id in response_ids.iter() {
            if let Some(response) = env
                .storage()
                .persistent()
                .get::<DataKey, Response>(&DataKey::Response(response_id))
            {
                if response.moderation_status == ModerationStatus::Approved {
                    let score = Self::calculate_quality_score(&response, &thresholds);
                    if score > best_score {
                        best_score = score;
                    }
                }
            }
        }

        // Determine reward based on quality score
        let reward_amount = if best_score >= 90 {
            amounts.exceptional_reward
        } else if best_score >= 70 {
            amounts.high_quality_reward
        } else if best_score >= 50 {
            amounts.basic_reward
        } else {
            0 // Not eligible for reward
        };

        Ok(reward_amount)
    }

    /// Get reward statistics
    pub fn get_reward_statistics(env: Env) -> RewardStatistics {
        let total_rewards_issued: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::RewardCounter)
            .unwrap_or(0);

        // For a complete implementation, you'd iterate through all rewards
        // to calculate these statistics. For now, we return basic info.
        RewardStatistics {
            total_rewards_issued,
            total_amount_distributed: 0, // Would need to calculate from all rewards
            average_reward_amount: 0,    // Would need to calculate from all rewards
            unique_rewarded_reviewers: 0, // Would need to count unique addresses
        }
    }

    /// Check if a reviewer has already been rewarded for a specific review
    pub fn has_reviewer_been_rewarded(env: Env, reviewer: Address, review_id: u64) -> bool {
        let reviewer_rewards: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::ReviewerRewards(reviewer))
            .unwrap_or(Vec::new(&env));

        for rewarded_review_id in reviewer_rewards.iter() {
            if rewarded_review_id == review_id {
                return true;
            }
        }

        false
    }

    // === PRIVATE HELPER FUNCTIONS FOR REWARD SYSTEM ===

    /// Internal function to check reward eligibility and return quality tier
    fn check_reward_eligibility_internal(
        env: &Env,
        review_id: u64,
    ) -> Result<QualityTier, RewardError> {
        use crate::incentives::*;

        // Get quality thresholds
        let thresholds: QualityThresholds = env
            .storage()
            .persistent()
            .get(&DataKey::QualityThresholds)
            .ok_or(RewardError::ThresholdsNotSet)?;

        // Find responses for this review to evaluate quality
        let response_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::ResponsesByReview(review_id))
            .unwrap_or(Vec::new(env));

        if response_ids.is_empty() {
            return Err(RewardError::NotEligibleForReward);
        }

        // Evaluate the best response for this review
        let mut best_response: Option<Response> = None;
        let mut highest_quality_score = 0u32;

        for response_id in response_ids.iter() {
            if let Some(response) = env
                .storage()
                .persistent()
                .get::<DataKey, Response>(&DataKey::Response(response_id))
            {
                // Only consider approved responses
                if response.moderation_status != ModerationStatus::Approved {
                    continue;
                }

                // Calculate quality score
                let quality_score = Self::calculate_quality_score(&response, &thresholds);

                if quality_score > highest_quality_score {
                    highest_quality_score = quality_score;
                    best_response = Some(response);
                }
            }
        }

        let response = best_response.ok_or(RewardError::NotEligibleForReward)?;

        // Check if meets minimum criteria
        if !Self::meets_minimum_criteria(&response, &thresholds) {
            return Err(RewardError::NotEligibleForReward);
        }

        // Determine quality tier
        Ok(Self::determine_quality_tier(&response, &thresholds))
    }

    /// Calculate quality score for a response
    fn calculate_quality_score(response: &Response, thresholds: &QualityThresholds) -> u32 {
        let mut score = 0u32;

        // Length score (up to 30 points)
        if response.text.len() >= thresholds.min_length {
            score += 30;
        } else {
            score += (response.text.len() * 30) / thresholds.min_length;
        }

        // Helpfulness score (up to 70 points)
        let total_votes = response.helpful_votes + response.not_helpful_votes;
        if total_votes > 0 {
            let helpfulness_ratio = (response.helpful_votes * 100) / total_votes;
            score += (helpfulness_ratio * 70) / 100;
        }

        score
    }

    /// Check if response meets minimum criteria
    fn meets_minimum_criteria(response: &Response, thresholds: &QualityThresholds) -> bool {
        // Check minimum length
        if response.text.len() < thresholds.min_length {
            return false;
        }

        // Check minimum helpful votes
        if response.helpful_votes < thresholds.min_helpful_votes {
            return false;
        }

        // Check maximum not helpful votes
        if response.not_helpful_votes > thresholds.max_not_helpful_votes {
            return false;
        }

        // Check helpfulness ratio
        let total_votes = response.helpful_votes + response.not_helpful_votes;
        if total_votes > 0 {
            let helpfulness_ratio = (response.helpful_votes * 100) / total_votes;
            if helpfulness_ratio < thresholds.min_helpfulness_ratio {
                return false;
            }
        }

        true
    }

    /// Determine quality tier based on response metrics
    fn determine_quality_tier(response: &Response, thresholds: &QualityThresholds) -> QualityTier {
        let quality_score = Self::calculate_quality_score(response, thresholds);

        if quality_score >= 90 {
            QualityTier::Exceptional
        } else if quality_score >= 70 {
            QualityTier::HighQuality
        } else {
            QualityTier::Basic
        }
    }

    /// Get standard reward amount for quality tier
    fn get_standard_reward_amount(env: &Env, tier: &QualityTier) -> Result<i128, RewardError> {
        use crate::incentives::*;

        let amounts: RewardAmounts = env
            .storage()
            .persistent()
            .get(&DataKey::RewardAmounts)
            .ok_or(RewardError::RewardAmountsNotSet)?;

        Ok(match tier {
            QualityTier::Basic => amounts.basic_reward,
            QualityTier::HighQuality => amounts.high_quality_reward,
            QualityTier::Exceptional => amounts.exceptional_reward,
        })
    }

    /// Get reviewer address for a given review
    fn get_reviewer_for_review(env: &Env, review_id: u64) -> Result<Address, ResponseError> {
        // Find the first approved response for this review
        let response_ids: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::ResponsesByReview(review_id))
            .unwrap_or(Vec::new(env));

        for response_id in response_ids.iter() {
            if let Some(response) = env
                .storage()
                .persistent()
                .get::<DataKey, Response>(&DataKey::Response(response_id))
            {
                if response.moderation_status == ModerationStatus::Approved {
                    return Ok(response.responder);
                }
            }
        }

        Err(ResponseError::ResponseNotFound)
    }

    /// Distribute reward tokens via external reward contract
    fn distribute_reward_tokens(
        env: &Env,
        recipient: &Address,
        amount: i128,
    ) -> Result<(), RewardError> {
        #[cfg(test)]
        {
            // In test mode, just emit an event
            env.events().publish(
                (Symbol::new(env, "mock_reward_distributed"), recipient),
                amount,
            );
            return Ok(());
        }

        #[cfg(not(test))]
        {
            let reward_contract: Address = env
                .storage()
                .persistent()
                .get(&DataKey::RewardContract)
                .ok_or(RewardError::RewardContractNotSet)?;

            // Call the reward contract to distribute tokens
            let result = env.try_invoke_contract::<(), RewardError>(
                &reward_contract,
                &Symbol::new(env, "distribute_tokens"),
                soroban_sdk::vec![
                    env,
                    recipient.into_val(env),
                    amount.into_val(env),
                    Symbol::new(env, "review_reward").into_val(env)
                ],
            );

            result
                .map_err(|_| RewardError::RewardDistributionFailed)?
                .map_err(|_| RewardError::RewardDistributionFailed)?;

            Ok(())
        }
    }

    /// Add review to reviewer's reward list
    fn add_to_reviewer_rewards(env: &Env, reviewer: &Address, review_id: u64) {
        let mut rewards: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::ReviewerRewards(reviewer.clone()))
            .unwrap_or(Vec::new(env));

        rewards.push_back(review_id);
        env.storage()
            .persistent()
            .set(&DataKey::ReviewerRewards(reviewer.clone()), &rewards);
    }
}
