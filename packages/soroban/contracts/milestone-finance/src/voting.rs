use soroban_sdk::{contracttype, symbol_short, Address, Env, Map, Symbol, Vec};

use crate::reputation::get_voting_power;
use crate::utils::*;

// Storage keys for voting data
const VOTING_PERIODS_KEY: Symbol = symbol_short!("vote_per");
const VOTES_KEY: Symbol = symbol_short!("votes");
const PERIOD_VOTES_KEY: Symbol = symbol_short!("per_vote");
const VOTER_LIST_KEY: Symbol = symbol_short!("voter_lst");

/// Project category types for different threshold requirements
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ProjectCategory {
    STEM,
    ARTS,
    COMMUNITY,
    RESEARCH,
}

/// Individual vote record
#[contracttype]
#[derive(Clone, Debug)]
pub struct Vote {
    pub project_id: u64,
    pub voter: Address,
    pub weight: u32, // Quadratic vote weight
    pub timestamp: u64,
}

/// Voting period configuration
#[contracttype]
#[derive(Clone, Debug)]
pub struct VotingPeriod {
    pub project_id: u64,
    pub start_time: u64,
    pub end_time: u64,
    pub threshold: u32, // Required votes for approval
    pub category: ProjectCategory,
    pub is_active: bool,
    pub is_approved: bool,
}

/// Current voting status for a project
#[contracttype]
#[derive(Clone, Debug)]
pub struct VotingStatus {
    pub project_id: u64,
    pub total_votes: u32,
    pub is_active: bool,
    pub is_approved: bool,
    pub unique_voters: u32,
}
/// Get voting threshold based on project category enum
pub fn get_category_threshold(category: &ProjectCategory) -> u32 {
    match category {
        ProjectCategory::STEM => 1000,
        ProjectCategory::RESEARCH => 1200,
        ProjectCategory::ARTS => 800,
        ProjectCategory::COMMUNITY => 500,
    }
}

/// Create a new voting period for a project
pub fn create_voting_period(
    env: Env,
    admin: Address,
    project_id: u64,
    start_time: u64,
    end_time: u64,
    category: ProjectCategory,
) {
    admin.require_auth();

    // Validate time parameters
    if start_time >= end_time {
        panic!("Invalid voting period: start_time must be before end_time");
    }

    // Validate project ID
    validate_project_id(project_id).unwrap();

    // Set threshold based on category
    let threshold = get_category_threshold(&category);

    let period = VotingPeriod {
        project_id,
        start_time,
        end_time,
        threshold,
        category,
        is_active: false,
        is_approved: false,
    };

    // Store voting period
    let mut voting_periods: Map<u64, VotingPeriod> = env
        .storage()
        .instance()
        .get(&VOTING_PERIODS_KEY)
        .unwrap_or_else(|| Map::new(&env));

    voting_periods.set(project_id, period);
    env.storage()
        .instance()
        .set(&VOTING_PERIODS_KEY, &voting_periods);

    // Initialize vote counters
    let mut period_votes: Map<u64, u32> = env
        .storage()
        .instance()
        .get(&PERIOD_VOTES_KEY)
        .unwrap_or_else(|| Map::new(&env));
    period_votes.set(project_id, 0);
    env.storage()
        .instance()
        .set(&PERIOD_VOTES_KEY, &period_votes);

    // Emit event
    env.events().publish(
        (symbol_short!("vote_new"), project_id),
        (start_time, end_time, threshold),
    );
}

/// Cast a vote on a project using quadratic voting with reputation-based weights
pub fn cast_vote(env: Env, voter: Address, project_id: u64, weight: u32) -> Result<u32, Error> {
    voter.require_auth();

    // Validate all conditions before state changes
    let voting_periods: Map<u64, VotingPeriod> = env
        .storage()
        .instance()
        .get(&VOTING_PERIODS_KEY)
        .unwrap_or_else(|| Map::new(&env));

    let period = voting_periods
        .get(project_id)
        .ok_or(Error::VotingPeriodNotFound)?;

    let current_time = env.ledger().timestamp();
    validate_voting_active(current_time, period.start_time, period.end_time)?;

    let votes: Map<(u64, Address), Vote> = env
        .storage()
        .instance()
        .get(&VOTES_KEY)
        .unwrap_or_else(|| Map::new(&env));

    if votes.contains_key((project_id, voter.clone())) {
        return Err(Error::DuplicateVote);
    }

    let voting_power = get_voting_power(env.clone(), voter.clone());
    if voting_power < 1 {
        return Err(Error::InvalidVotingPower);
    }

    let reputation = crate::reputation::get_reputation(env.clone(), voter.clone());
    validate_voting_reputation(reputation.score)?;
    validate_voting_power_for_weight(weight, voting_power)?;

    // Update state
    let final_weight = apply_vote_reputation_multiplier(weight, reputation.score);

    let vote = Vote {
        project_id,
        voter: voter.clone(),
        weight: final_weight,
        timestamp: current_time,
    };

    let mut updated_votes = votes;
    updated_votes.set((project_id, voter.clone()), vote);
    env.storage().instance().set(&VOTES_KEY, &updated_votes);

    let mut period_votes: Map<u64, u32> = env
        .storage()
        .instance()
        .get(&PERIOD_VOTES_KEY)
        .unwrap_or_else(|| Map::new(&env));

    let total_votes = period_votes.get(project_id).unwrap_or(0);
    let new_total = total_votes
        .checked_add(final_weight)
        .ok_or(Error::VoteCountOverflow)?;

    period_votes.set(project_id, new_total);
    env.storage()
        .instance()
        .set(&PERIOD_VOTES_KEY, &period_votes);

    let mut voter_lists: Map<u64, Vec<Address>> = env
        .storage()
        .instance()
        .get(&VOTER_LIST_KEY)
        .unwrap_or_else(|| Map::new(&env));

    let mut voter_list = voter_lists
        .get(project_id)
        .unwrap_or_else(|| Vec::new(&env));
    voter_list.push_back(voter.clone());
    voter_lists.set(project_id, voter_list);
    env.storage().instance().set(&VOTER_LIST_KEY, &voter_lists);

    emit_vote_cast_event(&env, project_id, voter, final_weight, current_time);

    Ok(final_weight)
}

/// Close voting period and determine approval
pub fn close_voting_period(env: Env, admin: Address, project_id: u64) -> bool {
    admin.require_auth();
    // Get voting period
    let mut voting_periods: Map<u64, VotingPeriod> = env
        .storage()
        .instance()
        .get(&VOTING_PERIODS_KEY)
        .unwrap_or_else(|| Map::new(&env));

    let Some(mut period) = voting_periods.get(project_id) else {
        panic!("Voting period not found");
    };

    let current_time = env.ledger().timestamp();

    // Ensure voting period has ended
    if current_time <= period.end_time {
        panic!("Voting period is still active");
    }

    // Get total votes
    let period_votes: Map<u64, u32> = env
        .storage()
        .instance()
        .get(&PERIOD_VOTES_KEY)
        .unwrap_or_else(|| Map::new(&env));

    let total_votes = period_votes.get(project_id).unwrap_or(0);

    // Determine if threshold is met
    let is_approved = total_votes >= period.threshold;

    // Update voting period status
    period.is_active = false;
    period.is_approved = is_approved;
    voting_periods.set(project_id, period.clone());
    env.storage()
        .instance()
        .set(&VOTING_PERIODS_KEY, &voting_periods);

    // Emit event
    env.events().publish(
        (symbol_short!("vote_end"), project_id),
        (total_votes, period.threshold, is_approved),
    );

    is_approved
}

/// Get current voting status for a project
pub fn get_voting_status(env: Env, project_id: u64) -> VotingStatus {
    let voting_periods: Map<u64, VotingPeriod> = env
        .storage()
        .instance()
        .get(&VOTING_PERIODS_KEY)
        .unwrap_or_else(|| Map::new(&env));

    let Some(period) = voting_periods.get(project_id) else {
        panic!("Voting period not found");
    };

    let current_time = env.ledger().timestamp();
    let is_active = current_time >= period.start_time && current_time <= period.end_time;

    let period_votes: Map<u64, u32> = env
        .storage()
        .instance()
        .get(&PERIOD_VOTES_KEY)
        .unwrap_or_else(|| Map::new(&env));

    let total_votes = period_votes.get(project_id).unwrap_or(0);

    let voter_lists: Map<u64, Vec<Address>> = env
        .storage()
        .instance()
        .get(&VOTER_LIST_KEY)
        .unwrap_or_else(|| Map::new(&env));

    let voter_list = voter_lists
        .get(project_id)
        .unwrap_or_else(|| Vec::new(&env));
    let unique_voters = voter_list.len();

    let is_approved = if current_time > period.end_time {
        total_votes >= period.threshold
    } else {
        false
    };

    VotingStatus {
        project_id,
        total_votes,
        is_active,
        is_approved,
        unique_voters,
    }
}

/// Get voting period details
pub fn get_voting_period(env: Env, project_id: u64) -> VotingPeriod {
    let voting_periods: Map<u64, VotingPeriod> = env
        .storage()
        .instance()
        .get(&VOTING_PERIODS_KEY)
        .unwrap_or_else(|| Map::new(&env));

    voting_periods
        .get(project_id)
        .unwrap_or_else(|| panic!("Voting period not found"))
}

/// Get vote record for a specific voter and project
pub fn get_vote(env: Env, project_id: u64, voter: Address) -> Option<Vote> {
    let votes: Map<(u64, Address), Vote> = env
        .storage()
        .instance()
        .get(&VOTES_KEY)
        .unwrap_or_else(|| Map::new(&env));

    votes.get((project_id, voter))
}

/// Get all voters for a project
pub fn get_project_voters(env: Env, project_id: u64) -> Vec<Address> {
    let voter_lists: Map<u64, Vec<Address>> = env
        .storage()
        .instance()
        .get(&VOTER_LIST_KEY)
        .unwrap_or_else(|| Map::new(&env));

    voter_lists
        .get(project_id)
        .unwrap_or_else(|| Vec::new(&env))
}

/// Get total votes for a project
pub fn get_total_votes(env: Env, project_id: u64) -> u32 {
    let period_votes: Map<u64, u32> = env
        .storage()
        .instance()
        .get(&PERIOD_VOTES_KEY)
        .unwrap_or_else(|| Map::new(&env));

    period_votes.get(project_id).unwrap_or(0)
}

/// Check if a voter has voted for a project
pub fn has_voted(env: Env, project_id: u64, voter: Address) -> bool {
    let votes: Map<(u64, Address), Vote> = env
        .storage()
        .instance()
        .get(&VOTES_KEY)
        .unwrap_or_else(|| Map::new(&env));

    votes.contains_key((project_id, voter))
}

/// Get voter's maximum affordable vote weight
pub fn get_max_vote_weight(env: Env, voter: Address) -> u32 {
    let voting_power = get_voting_power(env, voter);
    calculate_max_vote_weight_from_power(voting_power)
}
