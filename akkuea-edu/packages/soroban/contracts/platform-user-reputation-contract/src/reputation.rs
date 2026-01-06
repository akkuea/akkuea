use soroban_sdk::{symbol_short, Address, Env, Symbol};

use crate::storage::{ReputationEvent, UserStorage};

/// Update a user's reputation with a delta score and reason.
///
/// - Only registered users can be updated
/// - Ensures reputation never goes below 0
/// - Increments contributions for positive deltas
/// - Emits an event on change
pub fn _update_reputation(env: &Env, user: Address, score_delta: i64, reason: Symbol) {
    // Ensure user is registered
    let Some(mut user_data) = UserStorage::get(env, &user) else {
        panic!("User not registered");
    };

    // Compute new reputation safely
    let updated_reputation = if score_delta >= 0 {
        user_data.reputation.saturating_add(score_delta as u64)
    } else {
        let delta_abs = score_delta.unsigned_abs();
        if user_data.reputation < delta_abs {
            panic!("Reputation underflow prevented");
        }
        user_data.reputation.saturating_sub(delta_abs)
    };

    // Update fields
    user_data.reputation = updated_reputation;

    if score_delta > 0 {
        user_data.contributions = user_data.contributions.saturating_add(1);
    }

    // Persist updated user
    UserStorage::set(env, &user, &user_data);

    // Emit reputation event
    let event = ReputationEvent {
        from: None, // could later support admin/mod address
        to: user.clone(),
        score_delta,
        reason,
        timestamp: env.ledger().timestamp(),
    };
    _emit_reputation_event(env, event);
}

/// Emit a structured reputation change event.
fn _emit_reputation_event(env: &Env, event: ReputationEvent) {
    env.events().publish(
        (symbol_short!("rep_upt"), event.to.clone()),
        (event.score_delta, event.reason, event.timestamp),
    );
}
