#![no_std]
use soroban_sdk::{contractimpl, contracttype, env::Env, Address, BytesN, Symbol};

mod verification;
mod utils;

use verification::{verify_purchase_internal, get_verification_status_internal, set_verification_service_internal};
use utils::{ReviewVerification};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Contract owner (admin)
    Owner,
    /// External verification contract id (ContractId stored as BytesN<32>)
    VerificationService,
}

/// Public contract interface
pub struct ReviewContract;

#[contractimpl]
impl ReviewContract {
    /// Initialize owner (callable once typically)
    pub fn initialize(env: Env, owner: Address) {
        // Only allow initialize when owner is not set
        if env.storage().has(&DataKey::Owner) {
            panic!("already initialized");
        }
        env.storage().set(&DataKey::Owner, &owner);
    }

    /// Admin function: set the external verification contract id.
    /// external_contract_id is BytesN<32> representing a ContractId
    /// only callable by owner.
    pub fn set_verification_service(env: Env, external_contract_id: BytesN<32>) {
        set_verification_service_internal(&env, external_contract_id);
        let sym = Symbol::new(&env, "VerificationServiceSet");
        env.events().publish((sym,), ());
    }

    /// Verify that `reviewer` purchased `content_id` and store verification status for `review_id`.
    /// Attempts external verification first (if a service is configured), otherwise falls back to local check.
    /// Emits events on success or failure.
    pub fn verify_purchase(env: Env, reviewer: Address, content_id: u64, review_id: u64) {
        verify_purchase_internal(&env, reviewer, content_id, review_id);
    }

    /// Query verification status for a review
    pub fn get_verification_status(env: Env, review_id: u64) -> ReviewVerification {
        get_verification_status_internal(&env, review_id)
    }

    /// Read-only helper: returns the current verification service contract id if set
    pub fn get_verification_service(env: Env) -> Option<BytesN<32>> {
        env.storage().get::<DataKey, BytesN<32>>(&DataKey::VerificationService)
    }

    /// Owner helper to read owner address
    pub fn get_owner(env: Env) -> Option<Address> {
        env.storage().get::<DataKey, Address>(&DataKey::Owner)
    }
}
