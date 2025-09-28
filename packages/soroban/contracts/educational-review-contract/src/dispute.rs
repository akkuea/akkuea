use crate::datatype::{DataKey, Dispute, Review, ReviewError, ReviewStatus};
use soroban_sdk::{Address, Env, String, Symbol};

pub fn dispute_review(env: Env, product_id: u64, review_id: u32) -> Result<u32, ReviewError> {
    let admin: Address = env
        .storage()
        .persistent()
        .get(&DataKey::Admin)
        .ok_or(ReviewError::Unauthorized)?;

    admin.require_auth();

    let review_key = DataKey::Review(product_id, review_id);

    let mut review: Review = env
        .storage()
        .persistent()
        .get(&review_key)
        .ok_or(ReviewError::ReviewNotFound)?;

    if review.dispute_id.is_some() {
        return Err(ReviewError::DisputeNotFound); // Could use "AlreadyDisputed"
    }

    let dispute_id = env
        .storage()
        .persistent()
        .get::<_, u32>(&DataKey::ReviewCount(product_id))
        .unwrap_or(0);
    let dispute = Dispute {
        review_id,
        product_id,
        complainant: admin,
        evidence: String::from_str(&env, "Admin-initiated dispute"),
        resolved: false,
        timestamp: env.ledger().timestamp(),
    };
    env.storage()
        .persistent()
        .set(&DataKey::Dispute(dispute_id), &dispute);

    review.status = ReviewStatus::Disputed;
    review.dispute_id = Some(dispute_id);
    env.storage().persistent().set(&review_key, &review);

    env.events().publish(
        (Symbol::new(&env, "review_disputed"), product_id),
        review_id,
    );

    Ok(dispute_id)
}

pub fn resolve_dispute(env: Env, dispute_id: u32) -> Result<(), ReviewError> {
    let admin: Address = env
        .storage()
        .persistent()
        .get(&DataKey::Admin)
        .ok_or(ReviewError::Unauthorized)?;
    admin.require_auth();

    let dispute_key = DataKey::Dispute(dispute_id);

    let mut dispute: Dispute = env
        .storage()
        .persistent()
        .get(&dispute_key)
        .ok_or(ReviewError::DisputeNotFound)?;

    dispute.resolved = true;
    env.storage().persistent().set(&dispute_key, &dispute);

    let review_key = DataKey::Review(dispute.product_id, dispute.review_id);
    let mut review: Review = env
        .storage()
        .persistent()
        .get(&review_key)
        .ok_or(ReviewError::ReviewNotFound)?;
    review.status = ReviewStatus::Verified; // Reverts to Verified after resolution
    env.storage().persistent().set(&review_key, &review);

    env.events().publish(
        (Symbol::new(&env, "dispute_resolved"), dispute.product_id),
        (dispute.review_id, dispute_id),
    );

    Ok(())
}
