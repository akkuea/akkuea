use soroban_sdk::{contracterror, symbol_short, Address, Env, String, Vec};

/// Custom error types for the milestone finance contract
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    // User errors (1-10)
    UserNotFound = 1,
    UserAlreadyExists = 2,

    // Project errors (11-20)
    ProjectNotFound = 11,
    InvalidProjectId = 12,

    // Milestone errors (21-40)
    MilestoneNotFound = 21,
    InvalidMilestoneId = 22,
    InvalidDependencies = 23,
    CircularDependency = 24,
    InvalidFundingAmount = 25,
    InsufficientFunding = 26,
    InvalidCompletionPercentage = 27,
    MilestoneExpired = 28,
    DependencyNotCompleted = 29,
    InvalidStakeholder = 30,
    DuplicateVerification = 31,
    InvalidVerificationType = 32,
    MilestoneNotActive = 33,
    InvalidDeadline = 34,

    // Reputation errors (41-50)
    InsufficientReputation = 41,
    InvalidReputationScore = 42,
    ReputationUnderflow = 43,
    ReputationOverflow = 44,

    // Voting errors (51-70)
    InvalidVotingPower = 51,
    DuplicateVote = 52,
    InvalidTimeRange = 53,
    VotingNotStarted = 54,
    VotingEnded = 55,
    VotingPeriodNotFound = 56,
    VotingStillActive = 57,
    VoteCountOverflow = 58,
    InsufficientVotingPowerForWeight = 59,

    // Authorization errors (71-80)
    Unauthorized = 71,
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

// ===== VOTING UTILITY FUNCTIONS =====

/// Validate voting time range
pub fn validate_voting_time_range(start_time: u64, end_time: u64) -> Result<(), Error> {
    if start_time >= end_time {
        return Err(Error::InvalidTimeRange);
    }
    Ok(())
}

/// Validate voting is active
pub fn validate_voting_active(
    current_time: u64,
    start_time: u64,
    end_time: u64,
) -> Result<(), Error> {
    if current_time < start_time {
        return Err(Error::VotingNotStarted);
    }
    if current_time > end_time {
        return Err(Error::VotingEnded);
    }
    Ok(())
}

/// Validate voting has ended
pub fn validate_voting_ended(current_time: u64, end_time: u64) -> Result<(), Error> {
    if current_time <= end_time {
        return Err(Error::VotingStillActive);
    }
    Ok(())
}

/// Calculate quadratic cost for voting
/// Returns the cost = weight^2 or Error on overflow
pub fn calculate_vote_quadratic_cost(weight: u32) -> Result<u32, Error> {
    weight.checked_mul(weight).ok_or(Error::VoteCountOverflow)
}

/// Apply reputation multiplier to vote weight
pub fn apply_vote_reputation_multiplier(base_weight: u32, reputation_score: u32) -> u32 {
    let multiplier = if reputation_score >= 90 {
        120 // 20% bonus for highest reputation (90-100)
    } else if reputation_score >= 70 {
        115 // 15% bonus for high reputation (70-89)
    } else if reputation_score >= 50 {
        110 // 10% bonus for medium reputation (50-69)
    } else if reputation_score >= 30 {
        105 // 5% bonus for low-medium reputation (30-49)
    } else {
        100 // No bonus for low reputation (0-29)
    };

    base_weight
        .checked_mul(multiplier)
        .and_then(|v| v.checked_div(100))
        .unwrap_or(base_weight)
}

/// Validate reputation is sufficient for voting
pub fn validate_voting_reputation(reputation_score: u32) -> Result<(), Error> {
    if reputation_score < 10 {
        return Err(Error::InsufficientReputation);
    }
    Ok(())
}

/// Validate voting power is sufficient for weight
pub fn validate_voting_power_for_weight(weight: u32, voting_power: u32) -> Result<(), Error> {
    let cost = calculate_vote_quadratic_cost(weight)?;
    if cost > voting_power {
        return Err(Error::InsufficientVotingPowerForWeight);
    }
    Ok(())
}

/// Calculate maximum vote weight from voting power
pub fn calculate_max_vote_weight_from_power(voting_power: u32) -> u32 {
    if voting_power == 0 {
        return 0;
    }

    // Integer square root calculation
    let mut x = voting_power;
    let mut y = (x + 1) / 2;

    while y < x {
        x = y;
        y = (x + voting_power / x) / 2;
    }

    x
}

/// Get voting threshold based on project category
pub fn get_voting_category_threshold(category: &str) -> u32 {
    match category {
        "STEM" => 1000,
        "RESEARCH" => 1200,
        "ARTS" => 800,
        "COMMUNITY" => 500,
        _ => 500, // Default to Community threshold
    }
}

/// Emit voting period created event
pub fn emit_voting_period_created_event(
    env: &Env,
    project_id: u64,
    start_time: u64,
    end_time: u64,
    threshold: u32,
) {
    env.events().publish(
        (symbol_short!("vote_new"), project_id),
        (start_time, end_time, threshold),
    );
}

/// Emit vote cast event
pub fn emit_vote_cast_event(
    env: &Env,
    project_id: u64,
    voter: Address,
    weight: u32,
    timestamp: u64,
) {
    env.events().publish(
        (symbol_short!("vote_ok"), project_id),
        (voter, weight, timestamp),
    );
}

/// Emit voting period closed event
pub fn emit_voting_closed_event(
    env: &Env,
    project_id: u64,
    total_votes: u32,
    threshold: u32,
    is_approved: bool,
) {
    env.events().publish(
        (symbol_short!("vote_end"), project_id),
        (total_votes, threshold, is_approved),
    );
}
