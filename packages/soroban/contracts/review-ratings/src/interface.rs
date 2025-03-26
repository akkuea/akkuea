use crate::datatype::{Rating, Review, ReviewError, ReviewSummary};
use soroban_sdk::{Address, Env, String, Vec};

/// Manages star ratings and summary calculations for products
pub trait RatingOperations {
    /// Submits a star rating as part of a review for a purchased product
    fn submit_review(
        env: Env,
        user: Address,
        product_id: u64,
        rating: Rating,
        text: Option<String>,
        multimedia: Vec<String>,
    ) -> Result<(), ReviewError>;

    /// Retrieves the rating summary (total ratings and sum) for a product
    fn get_review_summary(env: Env, product_id: u64) -> Result<ReviewSummary, ReviewError>;
}

/// Manages review interactions including responses and helpfulness voting
pub trait ReviewOperations {
    /// Adds a response to an existing review (by reviewer or product owner)
    fn add_response(
        env: Env,
        author: Address,
        product_id: u64,
        review_id: u32,
        response_text: String,
    ) -> Result<(), ReviewError>;

    /// Allows users to vote on a review’s helpfulness (one vote per user)
    fn vote_helpful(
        env: Env,
        voter: Address,
        product_id: u64,
        review_id: u32,
    ) -> Result<(), ReviewError>;

    /// Retrieves the full review details for a specific product and review ID
    fn get_review(env: Env, product_id: u64, review_id: u32) -> Result<Review, ReviewError>;
}

/// Handles purchase verification and moderation
pub trait VerificationOperations {
    /// Records a purchase, enabling review submission (called by payment contract)
    fn record_purchase(env: Env, user: Address, product_id: u64) -> Result<(), ReviewError>;

    /// Checks if a user has a verified purchase for a product
    fn has_verified_purchase(env: Env, user: Address, product_id: u64)
        -> Result<bool, ReviewError>;

    /// Marks a review as disputed (admin only)
    fn dispute_review(env: Env, product_id: u64, review_id: u32) -> Result<(), ReviewError>;
}
