use soroban_sdk::{Env, Address, String, Vec, contracterror};
use crate::{
    datatype::{Review, CategoryRating, Rating, ReviewStatus, MediaAttachment, ReviewError, DataKey},
    constants::{REVIEW_WINDOW, MAX_MULTIMEDIA, MAX_TEXT_LENGTH},
    storage::*,
};

pub fn submit_review(
    env: Env,
    reviewer: Address,
    product_id: u64,
    category_ratings: Vec<CategoryRating>,
    review_text: Option<String>,
    multimedia: Vec<MediaAttachment>,
) -> Result<u32, ReviewError> {
    reviewer.require_auth();

    // Validate inputs
    for rating in category_ratings.iter() {
        match rating.rating {
            Rating::OneStar | Rating::TwoStars | Rating::ThreeStars | Rating::FourStars | Rating::FiveStars => {},
            _ => return Err(ReviewError::InvalidRating),
        }
    }
    if multimedia.len() > MAX_MULTIMEDIA {
        return Err(ReviewError::MultimediaLimitExceeded);
    }
    if let Some(text) = &review_text {
        if text.len() > MAX_TEXT_LENGTH {
            return Err(ReviewError::TextTooLong);
        }
    }

    // Verify purchase
    let purchase = get_purchase(&env, reviewer.clone(), product_id)
        .ok_or(ReviewError::PurchaseNotFound)?;
    if purchase.review_id.is_some() {
        return Err(ReviewError::ReviewAlreadyExists);
    }
    let current_time = env.ledger().timestamp();
    if current_time > purchase.purchase_time + REVIEW_WINDOW {
        return Err(ReviewError::ReviewWindowExpired);
    }

    // Get and increment review ID
    let review_count_key = DataKey::ReviewCount(product_id);
    let review_id = env.storage().persistent()
        .get::<_, u32>(&review_count_key)
        .unwrap_or(0);
    env.storage().persistent().set(&review_count_key, &(review_id + 1));

    // Create review
    let review = Review {
        reviewer,
        category_ratings,
        text: review_text,
        multimedia,
        timestamp: current_time,
        responses: Vec::new(&env),
        status: ReviewStatus::Verified, // Auto-verified due to purchase check
        dispute_id: None,
        helpful_votes: 0,
        not_helpful_votes: 0,
    };
    set_review(&env, product_id, review_id, review.clone());

    // Update purchase
    let mut purchase = purchase;
    purchase.review_id = Some(review_id);
    set_purchase(&env, purchase);

    // Update review summary
    let mut summary = get_review_summary(&env, product_id)
        .unwrap_or(ReviewSummary { total_ratings: 0, sum_ratings: 0 });
    summary.total_ratings += 1;
    let sum_rating: u64 = review.category_ratings.iter()
        .map(|r| r.rating as u64)
        .sum();
    summary.sum_ratings += sum_rating;
    set_review_summary(&env, product_id, summary);

    Ok(review_id)
}

pub fn add_response(
    env: Env,
    responder: Address,
    product_id: u64,
    review_id: u32,
    response_text: String,
) -> Result<(), ReviewError> {
    responder.require_auth();

    let mut review = get_review(&env, product_id, review_id)
        .ok_or(ReviewError::ReviewNotFound)?;

    if response_text.len() > MAX_TEXT_LENGTH {
        return Err(ReviewError::TextTooLong);
    }

    let response = Response {
        author: responder,
        text: response_text,
        timestamp: env.ledger().timestamp(),
    };
    review.responses.push_back(response);
    set_review(&env, product_id, review_id, review);

    Ok(())
}

pub fn vote_helpful(
    env: Env,
    voter: Address,
    product_id: u64,
    review_id: u32,
    helpful: bool,
) -> Result<(), ReviewError> {
    voter.require_auth();

    let mut review = get_review(&env, product_id, review_id)
        .ok_or(ReviewError::ReviewNotFound)?;

    // Check if voter already voted (simplified; could use a voter set)
    let vote_key = DataKey::HelpfulVoteSet(product_id, review_id);
    let mut voters: Vec<Address> = env.storage().persistent()
        .get(&vote_key)
        .unwrap_or(Vec::new(&env));
    if voters.contains(&voter) {
        return Err(ReviewError::AlreadyVoted);
    }
    voters.push_back(voter);
    env.storage().persistent().set(&vote_key, &voters);

    if helpful {
        review.helpful_votes += 1;
    } else {
        review.not_helpful_votes += 1;
    }
    set_review(&env, product_id, review_id, review);

    Ok(())
}

pub fn get_review_details(
    env: Env,
    product_id: u64,
    review_id: u32,
) -> Result<Review, ReviewError> {
    get_review(&env, product_id, review_id)
        .ok_or(ReviewError::ReviewNotFound)
}

pub fn get_average_rating(
    env: Env,
    product_id: u64,
) -> Result<u64, ReviewError> {
    let summary = get_review_summary(&env, product_id)
        .ok_or(ReviewError::ProductNotFound)?;
    if summary.total_ratings == 0 {
        Ok(0)
    } else {
        Ok(summary.sum_ratings / summary.total_ratings)
    }
}