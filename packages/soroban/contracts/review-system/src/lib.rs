#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracterror, contracttype, Address, Env, String, Symbol, Vec,
};

mod response;
mod utils;

#[cfg(test)]
mod test;

pub use response::ThreadNode;
pub use utils::ResponseStats;

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
    Response(u64), // response_id -> Response
    ResponsesByReview(u64), // review_id -> Vec<u64> (response_ids)
    ResponsesByParent(u64), // parent_response_id -> Vec<u64> (child response_ids)
    VoteRecord(Address, u64), // (voter, response_id) -> bool (true for helpful, false for not helpful)
    VerificationContract, // Address of the contract that verifies Stellar accounts
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
        env.storage().persistent().set(&DataKey::ResponseCounter, &0u64);

        env.events().publish(
            (Symbol::new(&env, "contract_initialized"), admin),
            (moderation_contract, verification_contract),
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
            Self::validate_parent_response(&env, parent_response, review_id).expect("Invalid parent response");

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
    pub fn vote_helpful(
        env: Env,
        voter: Address,
        response_id: u64,
        helpful: bool,
    ) {
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
    pub fn update_moderation_status(
        env: Env,
        response_id: u64,
        status: ModerationStatus,
    ) {
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
}