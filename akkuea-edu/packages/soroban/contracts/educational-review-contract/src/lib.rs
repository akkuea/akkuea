#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String, Symbol, Vec};

mod datatype;
mod dispute;
mod interface;

#[cfg(test)]
mod test;

use crate::datatype::{
    CategoryRating, DataKey, MediaAttachment, Purchase, Rating, Response, Review, ReviewError,
    ReviewStatus, ReviewSummary,
};
use crate::dispute::{dispute_review, resolve_dispute};
use crate::interface::{RatingOperations, ReviewOperations, VerificationOperations};

// Constants (moved here for global access)
pub const REVIEW_WINDOW: u64 = 30 * 24 * 60 * 60; // 30 days in seconds
pub const MAX_MULTIMEDIA: u32 = 5;
pub const MAX_TEXT_LENGTH: u32 = 500;

#[contract]
pub struct AkkueaReviews;

#[contractimpl]
impl AkkueaReviews {
    pub fn initialize(
        env: Env,
        admin: Address,
        payment_contract: Address,
    ) -> Result<(), ReviewError> {
        if env.storage().persistent().has(&DataKey::Admin) {
            return Err(ReviewError::Unauthorized);
        }

        admin.require_auth();
        env.storage().persistent().set(&DataKey::Admin, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::PaymentContract, &payment_contract);

        env.events().publish(
            (Symbol::new(&env, "contract_initialized"), admin),
            payment_contract,
        );

        Ok(())
    }

    pub fn set_product_owner(env: Env, product_id: u64, owner: Address) -> Result<(), ReviewError> {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ReviewError::Unauthorized)?;

        admin.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::ProductOwner(product_id), &owner);

        env.events()
            .publish((Symbol::new(&env, "product_owner_set"), product_id), owner);

        Ok(())
    }

    pub fn resolve_dispute(env: Env, dispute_id: u32) -> Result<(), ReviewError> {
        resolve_dispute(env, dispute_id)
    }
}

#[contractimpl]
impl VerificationOperations for AkkueaReviews {
    fn record_purchase(
        env: Env,
        user: Address,
        product_id: u64,
        purchase_link: Option<String>,
    ) -> Result<(), ReviewError> {
        let payment_contract: Address = env
            .storage()
            .persistent()
            .get(&DataKey::PaymentContract)
            .ok_or(ReviewError::Unauthorized)?;

        payment_contract.require_auth();

        let purchase_key = DataKey::Purchase(user.clone(), product_id);
        if env.storage().persistent().has(&purchase_key) {
            return Err(ReviewError::PurchaseAlreadyExists);
        }

        let purchase = Purchase {
            user,
            product_id,
            purchase_time: env.ledger().timestamp(),
            review_id: None,
            purchase_link,
        };
        env.storage().persistent().set(&purchase_key, &purchase);

        env.events().publish(("purchase", "product_id"), product_id);

        Ok(())
    }

    fn has_verified_purchase(
        env: Env,
        user: Address,
        product_id: u64,
    ) -> Result<bool, ReviewError> {
        let purchase_key = DataKey::Purchase(user, product_id);
        Ok(env.storage().persistent().has(&purchase_key))
    }

    fn dispute_review(env: Env, product_id: u64, review_id: u32) -> Result<u32, ReviewError> {
        let dispute_id = dispute_review(env, product_id, review_id)?;
        Ok(dispute_id)
    }
}

#[contractimpl]
impl RatingOperations for AkkueaReviews {
    fn submit_review(
        env: Env,
        user: Address,
        product_id: u64,
        category_ratings: Vec<CategoryRating>,
        text: Option<String>,
        multimedia: Vec<MediaAttachment>,
    ) -> Result<u32, ReviewError> {
        user.require_auth();

        if category_ratings.is_empty() {
            return Err(ReviewError::NoRatingsProvided);
        }

        for rating in category_ratings.iter() {
            match rating.rating {
                Rating::OneStar
                | Rating::TwoStars
                | Rating::ThreeStars
                | Rating::FourStars
                | Rating::FiveStars => {}
            }
        }

        if multimedia.len() > MAX_MULTIMEDIA {
            return Err(ReviewError::MultimediaLimitExceeded);
        }
        if let Some(t) = &text {
            if t.len() > MAX_TEXT_LENGTH {
                return Err(ReviewError::TextTooLong);
            }
        }

        let purchase_key = DataKey::Purchase(user.clone(), product_id);
        let mut purchase: Purchase = env
            .storage()
            .persistent()
            .get(&purchase_key)
            .ok_or(ReviewError::PurchaseNotFound)?;
        if purchase.review_id.is_some() {
            return Err(ReviewError::ReviewAlreadyExists);
        }
        let current_time = env.ledger().timestamp();
        let window_end = purchase
            .purchase_time
            .checked_add(REVIEW_WINDOW)
            .ok_or(ReviewError::ReviewWindowExpired)?;
        if current_time > window_end {
            return Err(ReviewError::ReviewWindowExpired);
        }

        let count_key = DataKey::ReviewCount(product_id);
        let review_id = env.storage().persistent().get(&count_key).unwrap_or(0);
        env.storage().persistent().set(&count_key, &(review_id + 1));

        let review = Review {
            reviewer: user.clone(),
            category_ratings,
            text,
            multimedia,
            timestamp: current_time,
            responses: Vec::new(&env),
            status: ReviewStatus::Verified,
            dispute_id: None,
            helpful_votes: 0,
            not_helpful_votes: 0,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Review(product_id, review_id), &review);

        purchase.review_id = Some(review_id);
        env.storage().persistent().set(&purchase_key, &purchase);

        let summary_key = DataKey::ReviewSummary(product_id);
        let mut summary = env
            .storage()
            .persistent()
            .get(&summary_key)
            .unwrap_or(ReviewSummary {
                total_ratings: 0,
                sum_ratings: 0,
            });
        summary.total_ratings += 1;
        let sum_rating: u64 = review
            .category_ratings
            .iter()
            .map(|r| r.rating as u64)
            .sum();
        summary.sum_ratings += sum_rating;
        env.storage().persistent().set(&summary_key, &summary);

        env.events().publish(
            (Symbol::new(&env, "review_submitted"), user),
            (product_id, review_id, summary.sum_ratings),
        );

        Ok(review_id)
    }

    fn get_review_summary(env: Env, product_id: u64) -> Result<ReviewSummary, ReviewError> {
        let summary_key = DataKey::ReviewSummary(product_id);
        let summary = env
            .storage()
            .persistent()
            .get(&summary_key)
            .unwrap_or(ReviewSummary {
                total_ratings: 0,
                sum_ratings: 0,
            });

        env.events().publish(
            (Symbol::new(&env, "summary_retrieved"), product_id),
            summary.total_ratings,
        );

        Ok(summary)
    }
}

#[contractimpl]
impl ReviewOperations for AkkueaReviews {
    fn add_response(
        env: Env,
        author: Address,
        product_id: u64,
        review_id: u32,
        response_text: String,
    ) -> Result<(), ReviewError> {
        author.require_auth();

        if response_text.len() > MAX_TEXT_LENGTH {
            return Err(ReviewError::TextTooLong);
        }

        let review_key = DataKey::Review(product_id, review_id);
        let mut review: Review = env
            .storage()
            .persistent()
            .get(&review_key)
            .ok_or(ReviewError::ReviewNotFound)?;

        let owner_key = DataKey::ProductOwner(product_id);
        let product_owner = env
            .storage()
            .persistent()
            .get(&owner_key)
            .ok_or(ReviewError::ProductNotFound)?;
        let purchase_key = DataKey::Purchase(author.clone(), product_id);
        let purchase: Purchase = env
            .storage()
            .persistent()
            .get(&purchase_key)
            .ok_or(ReviewError::PurchaseNotFound)?;
        if purchase.review_id != Some(review_id) && author != product_owner {
            return Err(ReviewError::Unauthorized);
        }

        let response = Response {
            author: author.clone(),
            text: response_text.clone(),
            timestamp: env.ledger().timestamp(),
        };
        review.responses.push_back(response);
        env.storage().persistent().set(&review_key, &review);

        env.events().publish(
            (Symbol::new(&env, "response_added"), author),
            (product_id, review_id, response_text),
        );

        Ok(())
    }

    fn vote_helpful(
        env: Env,
        voter: Address,
        product_id: u64,
        review_id: u32,
        helpful: bool,
    ) -> Result<(), ReviewError> {
        voter.require_auth();

        let review_key = DataKey::Review(product_id, review_id);
        let mut review: Review = env
            .storage()
            .persistent()
            .get(&review_key)
            .ok_or(ReviewError::ReviewNotFound)?;

        let vote_key = DataKey::HelpfulVoteSet(product_id, review_id);
        let mut voters: Vec<Address> = env
            .storage()
            .persistent()
            .get(&vote_key)
            .unwrap_or(Vec::new(&env));
        if voters.contains(&voter) {
            return Err(ReviewError::AlreadyVoted);
        }
        voters.push_back(voter.clone());
        env.storage().persistent().set(&vote_key, &voters);

        if helpful {
            review.helpful_votes += 1;
        } else {
            review.not_helpful_votes += 1;
        }
        env.storage().persistent().set(&review_key, &review);

        env.events().publish(
            (Symbol::new(&env, "helpful_voted"), voter),
            (product_id, review_id, helpful),
        );

        Ok(())
    }

    fn get_review(env: Env, product_id: u64, review_id: u32) -> Result<Review, ReviewError> {
        let review_key = DataKey::Review(product_id, review_id);
        env.storage()
            .persistent()
            .get(&review_key)
            .ok_or(ReviewError::ReviewNotFound)
    }
}
