use soroban_sdk::{Address, Env, Map, String, Vec};
use crate::datatype::{Dispute, DisputeStatus, Educator, Review, VerificationLevel};
use crate::storage::{DataKey, EDUCATORS, DISPUTES};
use crate::verification::VerificationSystem;
use crate::analytics;

pub struct ReviewSystem;

impl ReviewSystem {
    /// Submits a multi-category, weighted review for an educator.
    pub fn submit_review(
        env: &Env,
        reviewer_address: Address,
        educator_address: Address,
        ratings: Map<String, u32>,
        comment_hash: String,
    ) {
        reviewer_address.require_auth();

        let educators: Map<Address, Educator> = env.storage().persistent().get(&EDUCATORS).unwrap();
        let reviewer = educators.get(reviewer_address.clone()).expect("reviewer not found");
        let mut educator = educators.get(educator_address.clone()).expect("educator not found");

        // Determine the weight of the review based on the reviewer's verification level.
        let weight = match reviewer.verification_level {
            VerificationLevel::Pending => 0, // Pending educators cannot review.
            VerificationLevel::Basic => 1,
            VerificationLevel::Advanced => 2,
            VerificationLevel::Expert => 3,
        };
        if weight == 0 {
            panic!("pending educators cannot submit reviews");
        }

        let review_counter_key = DataKey::ReviewCounter(educator_address.clone());
        let review_id: u32 = env.storage().persistent().get(&review_counter_key).unwrap_or(0) + 1;
        env.storage().persistent().set(&review_counter_key, &review_id);

        let review = Review {
            review_id,
            reviewer: reviewer_address.clone(),
            educator: educator_address.clone(),
            ratings: ratings.clone(),
            comment_hash,
            timestamp: env.ledger().timestamp(),
            verifiers: Vec::new(env),
            dispute_status: DisputeStatus::None,
        };

        let reviews_key = DataKey::Reviews(educator_address.clone());
        let mut reviews: Vec<Review> = env.storage().persistent().get(&reviews_key).unwrap_or(Vec::new(env));
        reviews.push_back(review);
        env.storage().persistent().set(&reviews_key, &reviews);

        // Calculate the new weighted average rating.
        educator.reviews_count += 1;
        for (category, new_rating) in ratings.iter() {
            let (current_score, current_weight) = educator.ratings.get(category.clone()).unwrap_or((0, 0));
            let new_total_score = current_score + (new_rating * weight);
            let new_total_weight = current_weight + weight;
            educator.ratings.set(category.clone(), (new_total_score, new_total_weight));
        }
        
        educator.verification_level = VerificationSystem::calculate_verification_level(&env, &educators, &educator_address);

        let mut educators_map = educators;
        educators_map.set(educator_address.clone(), educator);
        env.storage().persistent().set(&EDUCATORS, &educators_map);

        analytics::AnalyticsSystem::update_review_analytics(env, &reviewer_address);
    }

    // Allows an authorized party to verify/endorse an existing review.
    pub fn verify_review(env: &Env, verifier: Address, educator_address: Address, review_id: u32) {
        verifier.require_auth();
        if !VerificationSystem::is_reviewer(env, &verifier) {
            panic!("not an authorized reviewer");
        }

        let reviews_key = DataKey::Reviews(educator_address.clone());
        let mut reviews: Vec<Review> = env.storage().persistent().get(&reviews_key).expect("no reviews found");
        
        // Find the index of the review to modify.
        let index = reviews.iter().position(|r| r.review_id == review_id);

        if let Some(i) = index {
            let mut review = reviews.get(i.try_into().unwrap()).unwrap();
            if !review.verifiers.contains(&verifier) {
                review.verifiers.push_back(verifier);
                reviews.set(i.try_into().unwrap(), review);
                env.storage().persistent().set(&reviews_key, &reviews);
            }
        } else {
            panic!("review not found");
        }
    }

    /// Allows an educator to formally dispute a review.
    pub fn dispute_review(env: &Env, educator: Address, review_id: u32, reason_hash: String) {
        educator.require_auth();

        let reviews_key = DataKey::Reviews(educator.clone());
        let mut reviews: Vec<Review> = env.storage().persistent().get(&reviews_key).expect("no reviews found");
        
        let mut reviewer_address: Option<Address> = None;
        let index = reviews.iter().position(|r| r.review_id == review_id);

        if let Some(i) = index {
            let mut review = reviews.get(i.try_into().unwrap()).unwrap();
            review.dispute_status = DisputeStatus::Active;
            reviewer_address = Some(review.reviewer.clone());
            reviews.set(i.try_into().unwrap(), review);
        } else {
            panic!("review not found");
        }
        
        env.storage().persistent().set(&reviews_key, &reviews);

        let mut disputes: Vec<Dispute> = env.storage().persistent().get(&DISPUTES).unwrap_or(Vec::new(env));
        disputes.push_back(Dispute { review_id, educator, reason_hash, status: DisputeStatus::Active });
        env.storage().persistent().set(&DISPUTES, &disputes);
        
        analytics::AnalyticsSystem::update_dispute_analytics(env, &reviewer_address.unwrap());
    }

    /// Allows an admin to resolve a dispute.
    pub fn resolve_dispute(env: &Env, admin: Address, educator_address: Address, review_id: u32) {
        admin.require_auth();
        VerificationSystem::verify_admin(env, &admin);

        let reviews_key = DataKey::Reviews(educator_address.clone());
        let mut reviews: Vec<Review> = env.storage().persistent().get(&reviews_key).expect("no reviews found");

        let index = reviews.iter().position(|r| r.review_id == review_id);

        if let Some(i) = index {
            let mut review = reviews.get(i.try_into().unwrap()).unwrap();
            review.dispute_status = DisputeStatus::Resolved;
            reviews.set(i.try_into().unwrap(), review);
            env.storage().persistent().set(&reviews_key, &reviews);
        }
    }
}