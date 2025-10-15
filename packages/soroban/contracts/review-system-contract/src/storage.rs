use soroban_sdk::{contracttype, symbol_short, Address, Env, String, Symbol, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Review {
    pub review_id: u64,
    pub content_id: u64,
    pub reviewer: Address,
    pub text: String,
    pub sentiment: i32, // Score from -100 to 100
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageKey {
    Review(u64),
    ContentReviews(u64),
    ReviewerReviews(Address),
}

const REVIEW_COUNTER: Symbol = symbol_short!("REV_CNT");

pub struct ReviewStorage;

impl ReviewStorage {
    pub fn initialize(env: &Env) {
        env.storage().instance().set(&REVIEW_COUNTER, &0u64);
    }

    pub fn get_next_review_id(env: &Env) -> u64 {
        let current = env
            .storage()
            .instance()
            .get(&REVIEW_COUNTER)
            .unwrap_or(0u64);
        let next = current + 1;
        env.storage().instance().set(&REVIEW_COUNTER, &next);
        next
    }

    pub fn get_review(env: &Env, review_id: u64) -> Option<Review> {
        let key = StorageKey::Review(review_id);
        env.storage().persistent().get(&key)
    }

    pub fn set_review(env: &Env, review: &Review) {
        let key = StorageKey::Review(review.review_id);
        env.storage().persistent().set(&key, review);
        env.storage().persistent().extend_ttl(&key, 50, 100);
    }

    pub fn get_content_reviews(env: &Env, content_id: u64) -> Vec<u64> {
        let key = StorageKey::ContentReviews(content_id);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env))
    }

    pub fn add_content_review(env: &Env, content_id: u64, review_id: u64) {
        let key = StorageKey::ContentReviews(content_id);
        let mut reviews = Self::get_content_reviews(env, content_id);
        reviews.push_back(review_id);
        env.storage().persistent().set(&key, &reviews);
        env.storage().persistent().extend_ttl(&key, 50, 100);
    }

    pub fn get_reviewer_reviews(env: &Env, reviewer: &Address) -> Vec<u64> {
        let key = StorageKey::ReviewerReviews(reviewer.clone());
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env))
    }

    pub fn add_reviewer_review(env: &Env, reviewer: &Address, review_id: u64) {
        let key = StorageKey::ReviewerReviews(reviewer.clone());
        let mut reviews = Self::get_reviewer_reviews(env, reviewer);
        reviews.push_back(review_id);
        env.storage().persistent().set(&key, &reviews);
        env.storage().persistent().extend_ttl(&key, 50, 100);
    }
}
