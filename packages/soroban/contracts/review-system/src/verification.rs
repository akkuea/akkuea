use soroban_sdk::{
    contractimpl, contracttype, Address, BytesN, Env, Symbol, Vec, IntoVal, TryFromVal,
};

use crate::utils::{
    get_review_key, read_review_verification, set_review_verification, ReviewVerification,
    StorageKeys, VERIFICATION_FAILED_EVENT, VERIFICATION_SUCCESS_EVENT,
};

/// The trait for an external verification service contract.
/// The external contract should expose a function:
///    fn check_purchase(env, buyer: Address, content_id: u64) -> bool
/// We call it using contract id (BytesN<32>).
pub trait ExternalVerifier {
    fn check_purchase(e: Env, buyer: Address, content_id: u64) -> bool;
}

/// Attempt verification (internal function).
///
/// Flow:
/// 1. If a verification service is configured: call it (cross-contract call).
/// 2. If external call returns true -> mark verified and emit success event.
/// 3. If no service or external fails/returns false -> fall back to local checks via utils.
/// 4. Store ReviewVerification in storage no matter the result (with purchase_verified true/false).
pub fn verify_purchase_internal(env: &Env, reviewer: Address, content_id: u64, review_id: u64) {
    // Try external verifier if set
    let maybe_service = env
        .storage()
        .get::<crate::DataKey, BytesN<32>>(&crate::DataKey::VerificationService);

    let mut verified = false;
    if let Some(service_bytes) = maybe_service {
        // Perform cross-contract call to verification contract.
        // We assume the other contract has a function named "check_purchase"
        // with signature (Address, u64) -> bool.
        // Build the contract id as bytes and call it.
        // Using `Env::invoke_contract` interface:
        let fn_sym = Symbol::new(env, "check_purchase");
        // Prepare args
        let args = (reviewer.clone(), content_id).into_val(env);
        // call_contract expects contract_id as bytesn; behind the scenes host will resolve to ContractId::from(...)
        // Using try/catch approach: if call panics, we treat as not verified.
        let call_result: Result<bool, _> = env.invoke_contract(&service_bytes, &fn_sym, &args);
        match call_result {
            Ok(b) => {
                verified = b;
            }
            Err(_) => {
                // External call failed — treat as not verified and fall back to local
                verified = false;
            }
        }
    }

    // Fall back to local purchase check if not yet verified
    if !verified {
        verified = crate::utils::has_local_purchase(env, &reviewer, content_id);
    }

    // Build verification struct and store it
    let vr = ReviewVerification {
        review_id,
        reviewer: reviewer.clone(),
        content_id,
        purchase_verified: verified,
    };

    set_review_verification(env, review_id, &vr);

    // Emit appropriate event
    if verified {
        let sym = VERIFICATION_SUCCESS_EVENT;
        env.events().publish((sym,), vr);
    } else {
        let sym = VERIFICATION_FAILED_EVENT;
        env.events().publish((sym,), vr);
    }
}

/// Internal getter
pub fn get_verification_status_internal(env: &Env, review_id: u64) -> ReviewVerification {
    match read_review_verification(env, review_id) {
        Some(v) => v,
        None => {
            // Return a default "not present" entry with purchase_verified = false and reviewer set to contract invoker
            let invoker = env.invoker();
            ReviewVerification {
                review_id,
                reviewer: invoker.into(),
                content_id: 0u64,
                purchase_verified: false,
            }
        }
    }
}

/// Admin-only setter for verification service id.
pub fn set_verification_service_internal(env: &Env, service_id: BytesN<32>) {
    // Only owner can set
    let owner: Address = env
        .storage()
        .get::<crate::DataKey, Address>(&crate::DataKey::Owner)
        .expect("owner must be set");
    // check invoker is owner
    let invoker = env.invoker();
    if invoker != owner.clone().into() {
        panic!("only owner can set verification service");
    }
    env.storage()
        .set::<crate::DataKey, BytesN<32>>(&crate::DataKey::VerificationService, &service_id);
}
