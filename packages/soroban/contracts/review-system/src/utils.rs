use soroban_sdk::{
    contracttype, Address, Bytes, Env, Symbol, Vec, IntoVal,
};

use crate::DataKey;

/// Event symbols (reused in code)
pub const VERIFICATION_SUCCESS_EVENT: Symbol = Symbol::short("VerificationSuccess");
pub const VERIFICATION_FAILED_EVENT: Symbol = Symbol::short("VerificationFailed");

/// A compact, contract-compatible struct stored in contract storage per review
#[contracttype]
#[derive(Clone)]
pub struct ReviewVerification {
    pub review_id: u64,
    pub reviewer: Address,
    pub content_id: u64,
    pub purchase_verified: bool,
}

/// Storage key namespace helper
pub struct StorageKeys;

impl StorageKeys {
    /// Returns a binary storage key: "review_ver" + review_id bytes
    pub fn review_key(env: &Env, review_id: u64) -> Bytes {
        let mut b = Bytes::new(env);
        b.append(&Bytes::from_slice(env, b"review_ver"));
        b.append(&Bytes::from_slice(env, &review_id.to_le_bytes()));
        b
    }

    /// Returns a Val-encoded tuple storage key: ["review_ver", review_id]
    pub fn review_key_tuple(env: &Env, review_id: u64) -> Vec<Env, soroban_sdk::Val> {
        let mut v = Vec::new(env);
        v.push_back(Symbol::new(env, "review_ver").into_val(env));
        v.push_back(review_id.into_val(env));
        v
    }
}

/// Use tuple (Symbol, u64) as storage key for reviews.
///
/// set_review_verification
pub fn set_review_verification(env: &Env, review_id: u64, vr: &ReviewVerification) {
    let key_sym = Symbol::new(env, "review_ver");
    env.storage().set(&(key_sym, review_id), vr);
}

/// read_review_verification
pub fn read_review_verification(env: &Env, review_id: u64) -> Option<ReviewVerification> {
    let key_sym = Symbol::new(env, "review_ver");
    env.storage().get(&(key_sym, review_id))
}

/// Fallback local purchase registry helpers
pub fn register_local_purchase(env: &Env, buyer: &Address, content_id: u64) {
    let key_sym = Symbol::new(env, "local_purchase");
    env.storage().set(&(key_sym, buyer.clone(), content_id), &true);
}

pub fn has_local_purchase(env: &Env, buyer: &Address, content_id: u64) -> bool {
    let key_sym = Symbol::new(env, "local_purchase");
    env.storage()
        .get(&(key_sym, buyer.clone(), content_id))
        .unwrap_or(false)
}

/// Helper to build a ReviewVerification key
pub fn get_review_key(env: &Env, review_id: u64) -> (Symbol, u64) {
    (Symbol::new(env, "review_ver"), review_id)
}
