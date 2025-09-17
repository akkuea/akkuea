use soroban_sdk::{contracttype, symbol_short, Address, Env, Map, String, Symbol};

use crate::utils::*;

// Storage keys
const USERS_KEY: Symbol = symbol_short!("users");
const PROJECT_VOTES_KEY: Symbol = symbol_short!("proj_vote");
const PROJECT_VOTERS_KEY: Symbol = symbol_short!("proj_vot");
const NEXT_USER_ID_KEY: Symbol = symbol_short!("next_uid");

/// Reputation data structure as specified in requirements
#[contracttype]
#[derive(Clone, Debug)]
pub struct Reputation {
    pub user: Address,           // Stellar address of the user
    pub score: u32,              // Reputation score (0-100)
    pub projects_completed: u32, // Number of successfully completed projects
    pub milestones_missed: u32,  // Number of missed milestones
    pub total_projects: u32,     // Total number of projects participated in
    pub last_updated: u64,       // Timestamp of last reputation update
}

/// User profile with additional metadata
#[contracttype]
#[derive(Clone, Debug)]
pub struct User {
    pub id: u64,
    pub address: Address,
    pub name: String,
    pub reputation: Reputation,
    pub created_at: u64,
}

/// Project voting data
#[contracttype]
#[derive(Clone, Debug)]
pub struct ProjectVote {
    pub project_id: u64,
    pub total_voting_power: u32,
    pub voter_count: u32,
    pub is_approved: bool,
}

/// Reputation statistics for analytics
#[contracttype]
#[derive(Clone, Debug)]
pub struct ReputationStats {
    pub total_users: u32,
    pub average_reputation: u32,
    pub total_projects_completed: u32,
    pub total_milestones_missed: u32,
    pub highest_reputation: u32,
    pub lowest_reputation: u32,
}

/// Initialize a new user in the reputation system
pub fn initialize_user(env: Env, caller: Address, name: String) -> u64 {
    // Check if user already exists
    let users: Map<Address, User> = env
        .storage()
        .instance()
        .get(&USERS_KEY)
        .unwrap_or_else(|| Map::new(&env));

    if users.contains_key(caller.clone()) {
        panic!("User already exists");
    }

    // Generate new user ID
    let next_user_id: u64 = env
        .storage()
        .instance()
        .get(&NEXT_USER_ID_KEY)
        .unwrap_or(1u64);

    // Create new user with initial reputation
    let reputation = Reputation {
        user: caller.clone(),
        score: 50, // Start with neutral reputation
        projects_completed: 0,
        milestones_missed: 0,
        total_projects: 0,
        last_updated: env.ledger().timestamp(),
    };

    let user = User {
        id: next_user_id,
        address: caller.clone(),
        name,
        reputation,
        created_at: env.ledger().timestamp(),
    };

    // Store user
    let mut updated_users = users;
    updated_users.set(caller, user);
    env.storage().instance().set(&USERS_KEY, &updated_users);

    // Update next user ID
    env.storage()
        .instance()
        .set(&NEXT_USER_ID_KEY, &(next_user_id + 1));

    next_user_id
}

/// Update reputation based on project or milestone outcomes
pub fn update_reputation(
    env: Env,
    _caller: Address,
    user: Address,
    _project_id: u64,
    success: bool,
) {
    // Get current user data
    let mut users: Map<Address, User> = env
        .storage()
        .instance()
        .get(&USERS_KEY)
        .unwrap_or_else(|| Map::new(&env));

    let Some(mut user_data) = users.get(user.clone()) else {
        panic!("User not found");
    };

    let old_score = user_data.reputation.score;
    let reputation_change = calculate_reputation_change(success);

    // Calculate new reputation score
    let new_score = if reputation_change >= 0 {
        user_data
            .reputation
            .score
            .saturating_add(reputation_change as u32)
            .min(100)
    } else {
        let change_abs = reputation_change.unsigned_abs();
        if user_data.reputation.score < change_abs {
            panic!("Reputation underflow");
        }
        user_data.reputation.score.saturating_sub(change_abs)
    };

    // Update reputation data
    user_data.reputation.score = new_score;
    user_data.reputation.total_projects = user_data.reputation.total_projects.saturating_add(1);
    user_data.reputation.last_updated = env.ledger().timestamp();

    if success {
        user_data.reputation.projects_completed =
            user_data.reputation.projects_completed.saturating_add(1);
    }

    // Store updated user
    users.set(user.clone(), user_data);
    env.storage().instance().set(&USERS_KEY, &users);

    // Emit reputation update event
    let reason = if success {
        String::from_str(&env, "Project completed successfully")
    } else {
        String::from_str(&env, "Project failed")
    };
    emit_reputation_event(&env, user, old_score, new_score, reason);
}

/// Get voting power based on reputation score
pub fn get_voting_power(env: Env, user: Address) -> u32 {
    let users: Map<Address, User> = env
        .storage()
        .instance()
        .get(&USERS_KEY)
        .unwrap_or_else(|| Map::new(&env));

    let Some(user_data) = users.get(user) else {
        panic!("User not found");
    };

    let voting_power = calculate_voting_power(user_data.reputation.score);
    if voting_power > 20 {
        panic!("Invalid voting power");
    }

    voting_power
}

/// Apply reputation penalty for missed milestones
pub fn penalize_missed_milestone(env: Env, _caller: Address, user: Address, _milestone_id: u64) {
    // Get current user data
    let mut users: Map<Address, User> = env
        .storage()
        .instance()
        .get(&USERS_KEY)
        .unwrap_or_else(|| Map::new(&env));

    let Some(mut user_data) = users.get(user.clone()) else {
        panic!("User not found");
    };

    let old_score = user_data.reputation.score;
    let penalty = calculate_milestone_penalty();

    // Apply penalty
    let penalty_abs = penalty.unsigned_abs();
    if user_data.reputation.score < penalty_abs {
        panic!("Reputation underflow");
    }
    let new_score = user_data.reputation.score.saturating_sub(penalty_abs);

    // Update reputation data
    user_data.reputation.score = new_score;
    user_data.reputation.milestones_missed =
        user_data.reputation.milestones_missed.saturating_add(1);
    user_data.reputation.last_updated = env.ledger().timestamp();

    // Store updated user
    users.set(user.clone(), user_data);
    env.storage().instance().set(&USERS_KEY, &users);

    // Emit reputation update event
    let reason = String::from_str(&env, "Missed milestone penalty");
    emit_reputation_event(&env, user, old_score, new_score, reason);
}

/// Get user reputation details
pub fn get_reputation(env: Env, user: Address) -> Reputation {
    let users: Map<Address, User> = env
        .storage()
        .instance()
        .get(&USERS_KEY)
        .unwrap_or_else(|| Map::new(&env));

    let Some(user_data) = users.get(user) else {
        panic!("User not found");
    };

    user_data.reputation
}

/// Vote for a project with reputation-based voting power
pub fn vote_for_project(env: Env, voter: Address, project_id: u64) -> u32 {
    // Get voter's voting power
    let voting_power = get_voting_power(env.clone(), voter.clone());

    // Get project votes
    let mut project_votes: Map<u64, ProjectVote> = env
        .storage()
        .instance()
        .get(&PROJECT_VOTES_KEY)
        .unwrap_or_else(|| Map::new(&env));

    let mut project_vote = project_votes
        .get(project_id)
        .unwrap_or_else(|| ProjectVote {
            project_id,
            total_voting_power: 0,
            voter_count: 0,
            is_approved: false,
        });

    // Get project voters
    let mut project_voters: Map<u64, Map<Address, u32>> = env
        .storage()
        .instance()
        .get(&PROJECT_VOTERS_KEY)
        .unwrap_or_else(|| Map::new(&env));

    let mut voters = project_voters
        .get(project_id)
        .unwrap_or_else(|| Map::new(&env));

    // Check for duplicate vote
    if voters.contains_key(voter.clone()) {
        panic!("Duplicate vote not allowed");
    }

    // Add voter and their voting power
    voters.set(voter.clone(), voting_power);
    project_vote.total_voting_power = project_vote.total_voting_power.saturating_add(voting_power);
    project_vote.voter_count = project_vote.voter_count.saturating_add(1);

    // Check if project is approved (threshold: 100 total voting power)
    const APPROVAL_THRESHOLD: u32 = 100;
    if project_vote.total_voting_power >= APPROVAL_THRESHOLD {
        project_vote.is_approved = true;
    }

    // Store updated data
    project_votes.set(project_id, project_vote);
    project_voters.set(project_id, voters);

    env.storage()
        .instance()
        .set(&PROJECT_VOTES_KEY, &project_votes);
    env.storage()
        .instance()
        .set(&PROJECT_VOTERS_KEY, &project_voters);

    // Emit voting event
    emit_voting_event(&env, voter, project_id, voting_power);

    voting_power
}

/// Get total voting power for a project
pub fn get_project_voting_power(env: Env, project_id: u64) -> u32 {
    let project_votes: Map<u64, ProjectVote> = env
        .storage()
        .instance()
        .get(&PROJECT_VOTES_KEY)
        .unwrap_or_else(|| Map::new(&env));

    let Some(project_vote) = project_votes.get(project_id) else {
        return 0; // No votes yet
    };

    project_vote.total_voting_power
}

/// Get project voters with their voting power
pub fn get_project_voters(env: Env, project_id: u64) -> Map<Address, u32> {
    let project_voters: Map<u64, Map<Address, u32>> = env
        .storage()
        .instance()
        .get(&PROJECT_VOTERS_KEY)
        .unwrap_or_else(|| Map::new(&env));

    let voters = project_voters
        .get(project_id)
        .unwrap_or_else(|| Map::new(&env));

    voters
}

/// Complete a milestone and update creator reputation
pub fn complete_milestone(
    env: Env,
    caller: Address,
    project_id: u64,
    milestone_id: u64,
    creator: Address,
) {
    // Update creator reputation for successful milestone completion
    update_reputation(
        env.clone(),
        caller.clone(),
        creator.clone(),
        project_id,
        true,
    );

    // Emit milestone completion event
    emit_milestone_event(&env, project_id, milestone_id, creator, true);
}

/// Get reputation statistics for analytics
pub fn get_reputation_stats(env: Env) -> ReputationStats {
    let users: Map<Address, User> = env
        .storage()
        .instance()
        .get(&USERS_KEY)
        .unwrap_or_else(|| Map::new(&env));

    let mut total_users = 0u32;
    let mut total_reputation = 0u32;
    let mut total_projects_completed = 0u32;
    let mut total_milestones_missed = 0u32;
    let mut highest_reputation = 0u32;
    let mut lowest_reputation = 100u32;

    for (_, user) in users.iter() {
        total_users = total_users.saturating_add(1);
        total_reputation = total_reputation.saturating_add(user.reputation.score);
        total_projects_completed =
            total_projects_completed.saturating_add(user.reputation.projects_completed);
        total_milestones_missed =
            total_milestones_missed.saturating_add(user.reputation.milestones_missed);

        if user.reputation.score > highest_reputation {
            highest_reputation = user.reputation.score;
        }
        if user.reputation.score < lowest_reputation {
            lowest_reputation = user.reputation.score;
        }
    }

    let average_reputation = if total_users > 0 {
        total_reputation / total_users
    } else {
        0
    };

    ReputationStats {
        total_users,
        average_reputation,
        total_projects_completed,
        total_milestones_missed,
        highest_reputation,
        lowest_reputation,
    }
}
