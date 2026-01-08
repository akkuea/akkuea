use crate::error::Error;
use crate::storage;
use crate::types::*;
use soroban_sdk::{Address, Env, String};

pub fn update_reputation(
    env: Env,
    caller: Address,
    user_id: u64,
    subject: String,
    score: u32,
) -> Result<(), Error> {
    caller.require_auth();

    // Check if user is on probation
    if storage::get_probation_status(&env, user_id).active {
        return Err(Error::ProbationActive);
    }

    // Only verified users can update reputation
    let user = storage::get_user(&env, user_id)?;
    if !user.verified {
        return Err(Error::NotVerified);
    }

    // Get current reputation for history tracking
    let old_score = match storage::get_reputation(&env, user_id, subject.clone()) {
        Ok(rep) => rep.score,
        Err(_) => 0, // New reputation entry
    };

    // Update or create reputation entry
    let reputation = Reputation {
        user_id,
        subject: subject.clone(),
        score,
    };
    storage::store_reputation(&env, &reputation);

    // Record reputation history
    record_reputation_change(
        &env,
        user_id,
        subject,
        old_score,
        score,
        String::from_str(&env, "Manual update"),
    );

    Ok(())
}

pub fn get_reputation(env: Env, user_id: u64, subject: String) -> Result<u32, Error> {
    let reputation = storage::get_reputation(&env, user_id, subject)?;
    Ok(reputation.score)
}

/// Record reputation change in history
fn record_reputation_change(
    env: &Env,
    user_id: u64,
    subject: String,
    _old_score: u32,
    new_score: u32,
    reason: String,
) {
    let mut history = storage::get_reputation_history(env, user_id, subject.clone());

    let timestamp = env.ledger().timestamp();
    history.scores.set(timestamp, new_score);
    history.changes.set(timestamp, reason);

    storage::store_reputation_history(env, &history);
}

/// Get reputation with history
pub fn get_reputation_with_history(
    env: Env,
    user_id: u64,
    subject: String,
) -> Result<(u32, ReputationHistory), Error> {
    let reputation = storage::get_reputation(&env, user_id, subject.clone())?;
    let history = storage::get_reputation_history(&env, user_id, subject);
    Ok((reputation.score, history))
}

/// Calculate reputation change over time
pub fn calculate_reputation_change(
    env: Env,
    user_id: u64,
    subject: String,
    days: u32,
) -> Result<i32, Error> {
    let history = storage::get_reputation_history(&env, user_id, subject);

    if history.scores.len() < 2 {
        return Ok(0);
    }

    let current_time = env.ledger().timestamp();
    let start_time = current_time - (days as u64 * 86400);

    let mut earliest_score: Option<u32> = None;
    let mut latest_score: Option<u32> = None;

    for (timestamp, score) in history.scores.iter() {
        if timestamp >= start_time {
            if earliest_score.is_none() {
                earliest_score = Some(score);
            }
            latest_score = Some(score);
        }
    }

    match (earliest_score, latest_score) {
        (Some(early), Some(late)) => Ok(late as i32 - early as i32),
        _ => Ok(0),
    }
}
