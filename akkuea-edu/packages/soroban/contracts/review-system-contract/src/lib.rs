#![no_std]

mod analytics;
mod error;
mod events;
mod storage;
mod utils;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, String, Symbol};

use crate::error::ContractError;
use crate::events::Events;
use crate::storage::{Review, ReviewStorage};

const INITIALIZED_KEY: Symbol = symbol_short!("INIT");

#[contract]
pub struct ReviewSystemContract;

#[contractimpl]
impl ReviewSystemContract {
    /// Initialize the contract
    pub fn initialize(env: Env) -> Result<(), ContractError> {
        let storage = env.storage().instance();

        if storage.has(&INITIALIZED_KEY) {
            return Err(ContractError::AlreadyInitialized);
        }

        ReviewStorage::initialize(&env);

        storage.set(&INITIALIZED_KEY, &true);
        storage.extend_ttl(50, 100);

        Ok(())
    }

    /// Analyze sentiment of review text and store the review
    pub fn analyze_sentiment(
        env: Env,
        content_id: u64,
        reviewer: Address,
        text: String,
    ) -> Result<u64, ContractError> {
        if !env.storage().instance().has(&INITIALIZED_KEY) {
            return Err(ContractError::NotInitialized);
        }

        reviewer.require_auth();

        // Validate input
        if content_id == 0 {
            return Err(ContractError::InvalidInput);
        }

        crate::utils::validate_review_text(&text)?;

        // Generate review ID
        let review_id = ReviewStorage::get_next_review_id(&env);

        // Analyze sentiment
        let sentiment_score = crate::analytics::calculate_sentiment(&text);

        // Create review
        let review = Review {
            review_id,
            content_id,
            reviewer: reviewer.clone(),
            text: text.clone(),
            sentiment: sentiment_score,
        };

        // Store review
        ReviewStorage::set_review(&env, &review);
        ReviewStorage::add_content_review(&env, content_id, review_id);
        ReviewStorage::add_reviewer_review(&env, &reviewer, review_id);

        // Emit event
        Events::sentiment_analyzed(&env, review_id, content_id, &reviewer, sentiment_score);

        Ok(review_id)
    }

    /// Get sentiment score for a specific review
    pub fn get_review_sentiment(env: Env, review_id: u64) -> Result<i32, ContractError> {
        if !env.storage().instance().has(&INITIALIZED_KEY) {
            return Err(ContractError::NotInitialized);
        }

        let review =
            ReviewStorage::get_review(&env, review_id).ok_or(ContractError::ReviewNotFound)?;

        Ok(review.sentiment)
    }

    /// Get full review details
    pub fn get_review(env: Env, review_id: u64) -> Result<Review, ContractError> {
        if !env.storage().instance().has(&INITIALIZED_KEY) {
            return Err(ContractError::NotInitialized);
        }

        ReviewStorage::get_review(&env, review_id).ok_or(ContractError::ReviewNotFound)
    }

    /// Get all review IDs for a specific content
    pub fn get_content_reviews(
        env: Env,
        content_id: u64,
    ) -> Result<soroban_sdk::Vec<u64>, ContractError> {
        if !env.storage().instance().has(&INITIALIZED_KEY) {
            return Err(ContractError::NotInitialized);
        }

        Ok(ReviewStorage::get_content_reviews(&env, content_id))
    }

    /// Get average sentiment for a content
    pub fn get_content_average_sentiment(env: Env, content_id: u64) -> Result<i32, ContractError> {
        if !env.storage().instance().has(&INITIALIZED_KEY) {
            return Err(ContractError::NotInitialized);
        }

        let review_ids = ReviewStorage::get_content_reviews(&env, content_id);

        if review_ids.is_empty() {
            return Err(ContractError::NoReviewsFound);
        }

        let mut total: i64 = 0;
        let mut count: u32 = 0;

        for review_id in review_ids.iter() {
            if let Some(review) = ReviewStorage::get_review(&env, review_id) {
                total += review.sentiment as i64;
                count += 1;
            }
        }

        if count == 0 {
            return Err(ContractError::NoReviewsFound);
        }

        let average = total / count as i64;
        Ok(average as i32)
    }

    /// Get all review IDs from a specific reviewer
    pub fn get_reviewer_reviews(
        env: Env,
        reviewer: Address,
    ) -> Result<soroban_sdk::Vec<u64>, ContractError> {
        if !env.storage().instance().has(&INITIALIZED_KEY) {
            return Err(ContractError::NotInitialized);
        }

        Ok(ReviewStorage::get_reviewer_reviews(&env, &reviewer))
    }
}
