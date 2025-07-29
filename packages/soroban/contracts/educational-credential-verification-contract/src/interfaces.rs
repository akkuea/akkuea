use soroban_sdk::{Address, Env, Map, String, Vec};
use crate::datatype::{AnalyticsData, Educator, VerificationLevel, Review, Dispute, ReviewerPerformance};

pub trait EducatorVerificationInterface {
    // --- Administration Functions ---
    fn initialize(env: Env, admin: Address);
    fn add_reviewer(env: Env, admin: Address, reviewer: Address);
    fn remove_reviewer(env: Env, admin: Address, reviewer: Address);
    fn add_authorized_institution(env: Env, admin: Address, institution_id: String);
    
    // --- Educator Functions ---
    fn register_educator(env: Env, educator_address: Address, name: String, credential_hashes: Vec<String>, specialty_areas: Vec<String>) -> Address;
    fn update_educator_profile(env: Env, educator_address: Address, name: Option<String>, specialty_areas: Option<Vec<String>>) -> bool;
    fn add_credentials(env: Env, educator_address: Address, new_credentials: Vec<String>) -> bool;
    
    // --- Verification Functions ---
    fn verify_educator(env: Env, reviewer: Address, educator_address: Address, verification_level: VerificationLevel);
    fn revoke_verification(env: Env, admin: Address, educator_address: Address, reason: String);
    fn add_verified_credential(env: Env, reviewer: Address, credential: String);

    // --- Review System Functions ---
    fn submit_review(env: Env, reviewer: Address, educator_address: Address, ratings: Map<String, u32>, comment_hash: String);
    fn verify_review(env: Env, verifier: Address, educator_address: Address, review_id: u32);
    fn dispute_review(env: Env, educator: Address, review_id: u32, reason_hash: String);
    fn resolve_dispute(env: Env, admin: Address, educator_address: Address, review_id: u32);

    // --- Query Functions ---
    fn get_educator(env: Env, educator_address: Address) -> Option<Educator>;
    fn get_verified_educators(env: Env) -> Vec<Address>;
    fn get_educators_by_specialty(env: Env, specialty: String) -> Vec<Address>;
    fn get_educator_reviews(env: Env, educator_address: Address) -> Vec<Review>;
    fn get_disputes(env: Env) -> Vec<Dispute>;

    // --- Analytics Functions (UPDATED) ---
    fn get_analytics(env: Env) -> AnalyticsData;
    fn recalculate_analytics(env: Env, admin: Address);
    // Function to get performance metrics for a specific reviewer.
    fn get_reviewer_performance(env: Env, reviewer: Address) -> Option<ReviewerPerformance>;
}
