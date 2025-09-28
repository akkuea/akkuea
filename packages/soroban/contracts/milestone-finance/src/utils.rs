use soroban_sdk::{symbol_short, Address, Env, String, Vec};

/// Custom error types for the milestone finance contract
#[derive(Debug, Clone)]
pub enum Error {
    UserNotFound,
    UserAlreadyExists,
    ProjectNotFound,
    MilestoneNotFound,
    InsufficientReputation,
    InvalidVotingPower,
    DuplicateVote,
    Unauthorized,
    InvalidReputationScore,
    ReputationUnderflow,
    ReputationOverflow,
    // New milestone-specific errors
    InvalidMilestoneId,
    InvalidProjectId,
    InvalidDependencies,
    CircularDependency,
    InvalidFundingAmount,
    InsufficientFunding,
    InvalidCompletionPercentage,
    MilestoneExpired,
    DependencyNotCompleted,
    InvalidStakeholder,
    DuplicateVerification,
    InvalidVerificationType,
    MilestoneNotActive,
    InvalidDeadline,
}

/// Calculate voting power based on reputation score
/// Formula: voting_power = base_power + (reputation_score / 10)
/// This gives higher reputation users more voting influence
pub fn calculate_voting_power(reputation_score: u32) -> u32 {
    const BASE_VOTING_POWER: u32 = 1;
    const REPUTATION_MULTIPLIER: u32 = 10;

    BASE_VOTING_POWER + (reputation_score / REPUTATION_MULTIPLIER)
}

/// Calculate reputation change based on project success/failure
/// Success: +10 points, Failure: -5 points
pub fn calculate_reputation_change(success: bool) -> i32 {
    if success {
        10
    } else {
        -5
    }
}

/// Calculate penalty for missed milestones
/// Penalty: -15 points per missed milestone
pub fn calculate_milestone_penalty() -> i32 {
    -15
}

/// Emit reputation update event
pub fn emit_reputation_event(
    env: &Env,
    user: Address,
    old_score: u32,
    new_score: u32,
    reason: String,
) {
    env.events().publish(
        (symbol_short!("rep_upd"), user),
        (old_score, new_score, reason),
    );
}

/// Emit voting event
pub fn emit_voting_event(env: &Env, voter: Address, project_id: u64, voting_power: u32) {
    env.events().publish(
        (symbol_short!("vote_cast"), voter),
        (project_id, voting_power),
    );
}

/// Emit milestone completion event
pub fn emit_milestone_event(
    env: &Env,
    project_id: u64,
    milestone_id: u64,
    creator: Address,
    success: bool,
) {
    env.events().publish(
        (symbol_short!("milestone"), creator),
        (project_id, milestone_id, success),
    );
}

/// Validate milestone ID
pub fn validate_milestone_id(milestone_id: u64) -> Result<(), Error> {
    if milestone_id == 0 {
        return Err(Error::InvalidMilestoneId);
    }
    Ok(())
}

/// Validate project ID
pub fn validate_project_id(project_id: u64) -> Result<(), Error> {
    if project_id == 0 {
        return Err(Error::InvalidProjectId);
    }
    Ok(())
}

/// Validate funding amount
pub fn validate_funding_amount(amount: i128) -> Result<(), Error> {
    if amount <= 0 {
        return Err(Error::InvalidFundingAmount);
    }
    Ok(())
}

/// Validate completion percentage
pub fn validate_completion_percentage(percentage: u32) -> Result<(), Error> {
    if percentage > 100 {
        return Err(Error::InvalidCompletionPercentage);
    }
    Ok(())
}

/// Validate deadline
pub fn validate_deadline(deadline: u64, current_time: u64) -> Result<(), Error> {
    if deadline <= current_time {
        return Err(Error::InvalidDeadline);
    }
    Ok(())
}

/// Check if address is authorized stakeholder
pub fn is_authorized_stakeholder(
    _env: &Env,
    _project_id: u64,
    _address: Address,
) -> Result<bool, Error> {
    // This would typically check against a whitelist or permission system
    // For now, we'll implement a simple check
    Ok(true) // In production, implement proper authorization logic
}

/// Validate dependencies exist and are valid
pub fn validate_dependencies(
    env: &Env,
    dependencies: &Vec<u64>,
    project_id: u64,
) -> Result<(), Error> {
    for i in 0..dependencies.len() {
        let dep_id = dependencies.get(i).unwrap();
        validate_milestone_id(dep_id)?;

        // Check if dependency exists and belongs to the same project
        if let Some(dep_milestone) = crate::milestone::get_milestone(env, dep_id) {
            if dep_milestone.project_id != project_id {
                return Err(Error::InvalidDependencies);
            }
        } else {
            return Err(Error::MilestoneNotFound);
        }
    }
    Ok(())
}

/// Emit project funding event
pub fn emit_project_funding_event(
    env: &Env,
    project_id: u64,
    total_funding: i128,
    released_funding: i128,
) {
    env.events().publish(
        (symbol_short!("proj_fund"), project_id),
        (total_funding, released_funding),
    );
}

/// Emit stakeholder added event
pub fn emit_stakeholder_added_event(env: &Env, project_id: u64, stakeholder: Address) {
    env.events()
        .publish((symbol_short!("stake_add"), project_id), stakeholder);
}
