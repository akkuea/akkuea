use crate::error::Error;
use crate::types::*;
use soroban_sdk::{Address, Env, Map, String, Vec};

/// Submit a dispute for unfair reputation changes
pub fn submit_dispute(
    env: Env,
    caller: Address,
    user_id: u64,
    subject: String,
    disputed_score: u32,
    evidence: String,
) -> Result<u64, Error> {
    caller.require_auth();

    // Verify user exists
    let _user: User = env
        .storage()
        .instance()
        .get(&DataKey::User(user_id))
        .ok_or(Error::UserNotFound)?;

    // Get current reputation
    let reputation_key = DataKey::Reputation(user_id, subject.clone());
    let reputation: Reputation = env
        .storage()
        .instance()
        .get(&reputation_key)
        .ok_or(Error::ReputationNotFound)?;

    // Check if dispute already exists for this reputation
    let user_disputes_key = DataKey::UserDisputes(user_id);
    let user_disputes: Vec<u64> = env
        .storage()
        .instance()
        .get(&user_disputes_key)
        .unwrap_or(Vec::new(&env));

    // Check for existing pending disputes on same subject
    for dispute_id in user_disputes.iter() {
        let dispute: Dispute = env
            .storage()
            .instance()
            .get(&DataKey::Dispute(dispute_id))
            .unwrap_or_else(|| panic!("Dispute not found"));

        if dispute.subject == subject
            && matches!(
                dispute.status,
                DisputeStatus::Pending | DisputeStatus::UnderReview
            )
        {
            return Err(Error::DisputeAlreadyExists);
        }
    }

    // Create new dispute
    let dispute_id = env
        .storage()
        .instance()
        .get(&DataKey::NextDisputeId)
        .unwrap_or(1u64);
    env.storage()
        .instance()
        .set(&DataKey::NextDisputeId, &(dispute_id + 1));

    let dispute = Dispute {
        id: dispute_id,
        user_id,
        subject,
        original_score: reputation.score,
        disputed_score,
        evidence,
        status: DisputeStatus::Pending,
        created_at: env.ledger().timestamp(),
        resolved_at: None,
        resolver: None,
    };

    env.storage()
        .instance()
        .set(&DataKey::Dispute(dispute_id), &dispute);

    // Update user disputes list
    let mut updated_disputes = user_disputes;
    updated_disputes.push_back(dispute_id);
    env.storage()
        .instance()
        .set(&user_disputes_key, &updated_disputes);

    Ok(dispute_id)
}

/// Resolve a dispute (admin function)
pub fn resolve_dispute(
    env: Env,
    caller: Address,
    dispute_id: u64,
    approved: bool,
    resolver_name: String,
) -> Result<(), Error> {
    caller.require_auth();

    // Get dispute
    let mut dispute: Dispute = env
        .storage()
        .instance()
        .get(&DataKey::Dispute(dispute_id))
        .ok_or(Error::DisputeNotFound)?;

    // Check if already resolved
    if !matches!(
        dispute.status,
        DisputeStatus::Pending | DisputeStatus::UnderReview
    ) {
        return Err(Error::DisputeAlreadyResolved);
    }

    // Update dispute status
    dispute.status = if approved {
        DisputeStatus::Approved
    } else {
        DisputeStatus::Rejected
    };
    dispute.resolved_at = Some(env.ledger().timestamp());
    dispute.resolver = Some(resolver_name);

    // If approved, update the reputation
    if approved {
        let reputation_key = DataKey::Reputation(dispute.user_id, dispute.subject.clone());
        let mut reputation: Reputation = env
            .storage()
            .instance()
            .get(&reputation_key)
            .ok_or(Error::ReputationNotFound)?;

        // Record history before changing
        record_reputation_change(
            &env,
            dispute.user_id,
            dispute.subject.clone(),
            reputation.score,
            dispute.disputed_score,
            String::from_str(&env, "Dispute resolution"),
        );

        reputation.score = dispute.disputed_score;
        env.storage().instance().set(&reputation_key, &reputation);
    }

    env.storage()
        .instance()
        .set(&DataKey::Dispute(dispute_id), &dispute);
    Ok(())
}

/// Create a recovery plan for users with negative reputation
pub fn create_recovery_plan(
    env: Env,
    caller: Address,
    user_id: u64,
    target_score: u32,
    milestones: Map<String, u32>,
    duration_days: u32,
) -> Result<(), Error> {
    caller.require_auth();

    // Verify user exists
    let user: User = env
        .storage()
        .instance()
        .get(&DataKey::User(user_id))
        .ok_or(Error::UserNotFound)?;

    // Check if user is eligible for recovery (has low reputation)
    let mut has_low_reputation = false;
    for (subject, _) in user.expertise_areas.iter() {
        let reputation_key = DataKey::Reputation(user_id, subject.clone());
        if let Some(reputation) = env
            .storage()
            .instance()
            .get::<DataKey, Reputation>(&reputation_key)
        {
            if reputation.score < 50 {
                // Threshold for recovery eligibility
                has_low_reputation = true;
                break;
            }
        }
    }

    if !has_low_reputation {
        return Err(Error::RecoveryNotAllowed);
    }

    let recovery_plan = RecoveryPlan {
        user_id,
        target_score,
        milestones,
        created_at: env.ledger().timestamp(),
        deadline: env.ledger().timestamp() + (duration_days as u64 * 86400), // Convert days to seconds
        progress: Map::new(&env),
        completed: false,
    };

    env.storage()
        .instance()
        .set(&DataKey::RecoveryPlan(user_id), &recovery_plan);
    Ok(())
}

/// Update recovery plan progress
pub fn update_recovery_progress(
    env: Env,
    caller: Address,
    user_id: u64,
    subject: String,
    new_score: u32,
) -> Result<(), Error> {
    caller.require_auth();

    let mut recovery_plan: RecoveryPlan = env
        .storage()
        .instance()
        .get(&DataKey::RecoveryPlan(user_id))
        .ok_or(Error::RecoveryNotAllowed)?;

    // Update progress
    recovery_plan.progress.set(subject.clone(), new_score);

    // Check if all milestones are met
    let mut all_completed = true;
    for (milestone_subject, target) in recovery_plan.milestones.iter() {
        let current_progress = recovery_plan
            .progress
            .get(milestone_subject.clone())
            .unwrap_or(0);
        if current_progress < target {
            all_completed = false;
            break;
        }
    }

    recovery_plan.completed = all_completed;
    env.storage()
        .instance()
        .set(&DataKey::RecoveryPlan(user_id), &recovery_plan);
    Ok(())
}

/// Set probation status for a user
pub fn set_probation(
    env: Env,
    caller: Address,
    user_id: u64,
    duration_days: u32,
    reason: String,
    restrictions: Map<String, bool>,
) -> Result<(), Error> {
    caller.require_auth();

    // Verify user exists
    let _user: User = env
        .storage()
        .instance()
        .get(&DataKey::User(user_id))
        .ok_or(Error::UserNotFound)?;

    let probation = ProbationStatus {
        user_id,
        active: true,
        start_date: env.ledger().timestamp(),
        end_date: env.ledger().timestamp() + (duration_days as u64 * 86400),
        reason,
        restrictions,
    };

    env.storage()
        .instance()
        .set(&DataKey::ProbationStatus(user_id), &probation);
    Ok(())
}

/// Check if user is on probation
pub fn is_on_probation(env: Env, user_id: u64) -> Result<bool, Error> {
    let probation: ProbationStatus = env
        .storage()
        .instance()
        .get(&DataKey::ProbationStatus(user_id))
        .unwrap_or(ProbationStatus {
            user_id,
            active: false,
            start_date: 0,
            end_date: 0,
            reason: String::from_str(&env, ""),
            restrictions: Map::new(&env),
        });

    if !probation.active {
        return Ok(false);
    }

    // Check if probation period has ended
    if env.ledger().timestamp() > probation.end_date {
        // Auto-expire probation
        let mut expired_probation = probation;
        expired_probation.active = false;
        env.storage()
            .instance()
            .set(&DataKey::ProbationStatus(user_id), &expired_probation);
        return Ok(false);
    }

    Ok(true)
}

/// Get user's recovery plan
pub fn get_recovery_plan(env: Env, user_id: u64) -> Result<RecoveryPlan, Error> {
    env.storage()
        .instance()
        .get(&DataKey::RecoveryPlan(user_id))
        .ok_or(Error::RecoveryNotAllowed)
}

/// Get dispute details
pub fn get_dispute(env: Env, dispute_id: u64) -> Result<Dispute, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Dispute(dispute_id))
        .ok_or(Error::DisputeNotFound)
}

/// Get user's disputes
pub fn get_user_disputes(env: Env, user_id: u64) -> Result<Vec<u64>, Error> {
    Ok(env
        .storage()
        .instance()
        .get(&DataKey::UserDisputes(user_id))
        .unwrap_or(Vec::new(&env)))
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
    let history_key = DataKey::ReputationHistory(user_id, subject.clone());
    let mut history: ReputationHistory =
        env.storage()
            .instance()
            .get(&history_key)
            .unwrap_or(ReputationHistory {
                user_id,
                subject: subject.clone(),
                scores: Map::new(env),
                changes: Map::new(env),
            });

    let timestamp = env.ledger().timestamp();
    history.scores.set(timestamp, new_score);
    history.changes.set(timestamp, reason);

    env.storage().instance().set(&history_key, &history);
}
