#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, String, Symbol, Vec};

mod datatype;
mod interface;

use crate::datatype::{DataKey, Purchase, Rating, Response, Review, ReviewError, ReviewSummary};
use crate::interface::{RatingOperations, ReviewOperations, VerificationOperations};

#[contract]
pub struct ReviewContract;

#[contractimpl]
impl ReviewContract {
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
            env.ledger().timestamp(),
        );

        Ok(())
    }

    pub fn set_product_owner(env: Env, product_id: u64, owner: Address) -> Result<(), ReviewError> {
        let admin = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ReviewError::Unauthorized)?;
        if env.invoker() != admin {
            return Err(ReviewError::Unauthorized);
        }

        owner.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::ProductOwner(product_id), &owner);

        env.events()
            .publish((Symbol::new(&env, "product_owner_set"), product_id), owner);

        Ok(())
    }
}

#[contractimpl]
impl RatingOperations for ReviewContract {
    fn submit_review(
        env: Env,
        user: Address,
        product_id: u64,
        rating: Rating,
        text: Option<String>,
        multimedia: Vec<String>,
    ) -> Result<(), ReviewError> {
        user.require_auth();

        let purchase_key = DataKey::Purchase(user.clone(), product_id);
        let mut purchase = env
            .storage()
            .persistent()
            .get(&purchase_key)
            .ok_or(ReviewError::PurchaseNotFound)?;

        if purchase.review_id.is_some() {
            return Err(ReviewError::ReviewAlreadyExists);
        }

        if let Some(ref t) = text {
            if t.len() > 1000 {
                return Err(ReviewError::TextTooLong);
            }
        }
        if multimedia.len() > 5 {
            return Err(ReviewError::MultimediaLimitExceeded);
        }

        let current_time = env.ledger().timestamp();
        let review_window = 30 * 24 * 60 * 60; // 30 days
        if current_time > purchase.purchase_time + review_window {
            return Err(ReviewError::ReviewWindowExpired);
        }

        // Assign review_id
        let count_key = DataKey::ReviewCount(product_id);
        let review_id = env.storage().persistent().get(&count_key).unwrap_or(0);
        env.storage().persistent().set(&count_key, &(review_id + 1));

        let review = Review {
            rating,
            text,
            multimedia,
            timestamp: current_time,
            responses: Vec::new(&env),
            is_disputed: false,
        };
        let review_key = DataKey::Review(product_id, review_id);
        env.storage().persistent().set(&review_key, &review);
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
        summary.sum_ratings += rating as u64;
        env.storage().persistent().set(&summary_key, &summary);

        env.events().publish(
            (Symbol::new(&env, "review_submitted"), user),
            (product_id, review_id, rating as u32),
        );

        Ok(())
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
impl ReviewOperations for ReviewContract {
    fn add_response(
        env: Env,
        author: Address,
        product_id: u64,
        review_id: u32,
        response_text: String,
    ) -> Result<(), ReviewError> {
        author.require_auth();

        if response_text.len() > 500 {
            return Err(ReviewError::TextTooLong);
        }

        let review_key = DataKey::Review(product_id, review_id);
        let mut review = env
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

        // Find reviewer from Purchase
        let purchase_key = DataKey::Purchase(author.clone(), product_id);
        let purchase = env
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
        review.responses.push(response);
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
    ) -> Result<(), ReviewError> {
        voter.require_auth();

        let vote_key = DataKey::HelpfulVotes(product_id, review_id);
        let mut voters: Vec<Address> = env
            .storage()
            .persistent()
            .get(&vote_key)
            .unwrap_or(Vec::new(&env));
        if voters.contains(&voter) {
            return Err(ReviewError::AlreadyVoted);
        }
        voters.push(voter.clone());
        env.storage().persistent().set(&vote_key, &voters);

        env.events().publish(
            (Symbol::new(&env, "helpful_voted"), voter),
            (product_id, review_id),
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

#[contractimpl]
impl VerificationOperations for ReviewContract {
    fn record_purchase(env: Env, user: Address, product_id: u64) -> Result<(), ReviewError> {
        let payment_contract = env
            .storage()
            .persistent()
            .get(&DataKey::PaymentContract)
            .ok_or(ReviewError::Unauthorized)?;
        if env.invoker() != payment_contract {
            return Err(ReviewError::Unauthorized);
        }

        let purchase_key = DataKey::Purchase(user.clone(), product_id);
        if env.storage().persistent().has(&purchase_key) {
            return Err(ReviewError::ReviewAlreadyExists);
        }

        let purchase = Purchase {
            user,
            product_id,
            purchase_time: env.ledger().timestamp(),
            review_id: None,
        };
        env.storage().persistent().set(&purchase_key, &purchase);

        env.events()
            .publish((Symbol::new(&env, "purchase_recorded"), user), product_id);

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

    fn dispute_review(env: Env, product_id: u64, review_id: u32) -> Result<(), ReviewError> {
        let admin = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .ok_or(ReviewError::Unauthorized)?;
        if env.invoker() != admin {
            return Err(ReviewError::Unauthorized);
        }

        let review_key = DataKey::Review(product_id, review_id);
        let mut review = env
            .storage()
            .persistent()
            .get(&review_key)
            .ok_or(ReviewError::ReviewNotFound)?;
        review.is_disputed = true;
        env.storage().persistent().set(&review_key, &review);

        env.events().publish(
            (Symbol::new(&env, "review_disputed"), product_id),
            review_id,
        );

        Ok(())
    }
}
