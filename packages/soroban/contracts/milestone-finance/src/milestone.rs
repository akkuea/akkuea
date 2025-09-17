use soroban_sdk::{contracttype, symbol_short, Address, Env, Vec};

/// Milestone status enumeration
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum MilestoneStatus {
    Pending,            // Milestone created but not yet active
    Active,             // Milestone is currently active and can receive work
    PartiallyCompleted, // Milestone is partially completed
    Completed,          // Milestone is fully completed
    Expired,            // Milestone deadline has passed
}

/// Core milestone data structure
#[derive(Clone, Debug)]
#[contracttype]
pub struct Milestone {
    pub milestone_id: u64,          // Unique identifier for the milestone
    pub project_id: u64,            // Associated project ID
    pub dependencies: Vec<u64>,     // List of prerequisite milestone IDs
    pub status: MilestoneStatus,    // Current status of the milestone
    pub funding_amount: i128,       // XLM amount (in Stroops) for milestone
    pub deadline: u64,              // Deadline timestamp
    pub completion_percentage: u32, // Percentage of completion (0-100)
    pub created_at: u64,            // Creation timestamp
    pub creator: Address,           // Address of the milestone creator
    pub verifiers: Vec<Address>,    // List of addresses that can verify this milestone
}

/// Stakeholder verification record
#[derive(Clone, Debug)]
#[contracttype]
pub struct Verification {
    pub verifier: Address,                   // Address of the verifier
    pub verified_at: u64,                    // Timestamp of verification
    pub verification_type: VerificationType, // Type of verification
}

/// Types of verification
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum VerificationType {
    PartialCompletion, // Verification of partial completion
    FullCompletion,    // Verification of full completion
}

/// Project funding information
#[derive(Clone, Debug)]
#[contracttype]
pub struct ProjectFunding {
    pub project_id: u64,         // Project identifier
    pub total_funding: i128,     // Total funding allocated to project
    pub released_funding: i128,  // Amount of funding already released
    pub available_funding: i128, // Available funding for new milestones
}

/// Storage keys for the contract
const MILESTONE_COUNTER: &str = "mil_cnt";
const MILESTONES: &str = "milestones";
const PROJECT_FUNDING: &str = "proj_fund";
const STAKEHOLDERS: &str = "stakeholders";
const VERIFICATIONS: &str = "verifications";

/// Initialize a new milestone counter
pub fn initialize_milestone_counter(env: &Env) {
    if !env.storage().instance().has(&symbol_short!("mil_cnt")) {
        env.storage()
            .instance()
            .set(&symbol_short!("mil_cnt"), &0u64);
    }
}

/// Get the next milestone ID
pub fn get_next_milestone_id(env: &Env) -> u64 {
    let current_id: u64 = env
        .storage()
        .instance()
        .get(&symbol_short!("mil_cnt"))
        .unwrap_or(0);
    let next_id = current_id + 1;
    env.storage()
        .instance()
        .set(&symbol_short!("mil_cnt"), &next_id);
    next_id
}

/// Store a milestone
pub fn store_milestone(env: &Env, milestone: &Milestone) {
    let key = (symbol_short!("milestone"), milestone.milestone_id);
    env.storage().instance().set(&key, milestone);
}

/// Get a milestone by ID
pub fn get_milestone(env: &Env, milestone_id: u64) -> Option<Milestone> {
    let key = (symbol_short!("milestone"), milestone_id);
    env.storage().instance().get(&key)
}

/// Get all milestones for a project
pub fn get_project_milestones(env: &Env, project_id: u64) -> Vec<Milestone> {
    let mut milestones = Vec::new(env);
    let mut milestone_id = 1u64;

    // Iterate through potential milestone IDs to find project milestones
    // In a production system, you might want to maintain a separate index
    // We'll check up to a reasonable limit to avoid infinite loops
    while milestone_id <= 1000u64 {
        if let Some(milestone) = get_milestone(env, milestone_id) {
            if milestone.project_id == project_id {
                milestones.push_back(milestone);
            }
        } else {
            // If we can't find a milestone with this ID, we've likely reached the end
            // But we'll continue for a few more IDs to be safe
            if milestone_id > 10u64 {
                break;
            }
        }
        milestone_id += 1;
    }

    milestones
}

/// Store project funding information
pub fn store_project_funding(env: &Env, project_id: u64, funding: &ProjectFunding) {
    let key = (symbol_short!("proj_fund"), project_id);
    env.storage().instance().set(&key, funding);
}

/// Get project funding information
pub fn get_project_funding(env: &Env, project_id: u64) -> Option<ProjectFunding> {
    let key = (symbol_short!("proj_fund"), project_id);
    env.storage().instance().get(&key)
}

/// Add a stakeholder to a project
pub fn add_stakeholder(env: &Env, project_id: u64, stakeholder: Address) {
    let key = (symbol_short!("stake"), project_id);
    let mut stakeholders: Vec<Address> =
        env.storage().instance().get(&key).unwrap_or(Vec::new(env));

    // Check if stakeholder already exists
    for i in 0..stakeholders.len() {
        if stakeholders.get(i).unwrap() == stakeholder {
            return; // Stakeholder already exists
        }
    }

    stakeholders.push_back(stakeholder);
    env.storage().instance().set(&key, &stakeholders);
}

/// Get stakeholders for a project
pub fn get_stakeholders(env: &Env, project_id: u64) -> Vec<Address> {
    let key = (symbol_short!("stake"), project_id);
    env.storage().instance().get(&key).unwrap_or(Vec::new(env))
}

/// Check if an address is a stakeholder for a project
pub fn is_stakeholder(env: &Env, project_id: u64, address: Address) -> bool {
    let stakeholders = get_stakeholders(env, project_id);
    for i in 0..stakeholders.len() {
        if stakeholders.get(i).unwrap() == address {
            return true;
        }
    }
    false
}

/// Store a verification record
pub fn store_verification(env: &Env, milestone_id: u64, verification: &Verification) {
    let key = (symbol_short!("verify"), milestone_id);
    let mut verifications: Vec<Verification> =
        env.storage().instance().get(&key).unwrap_or(Vec::new(env));
    verifications.push_back(verification.clone());
    env.storage().instance().set(&key, &verifications);
}

/// Get verifications for a milestone
pub fn get_verifications(env: &Env, milestone_id: u64) -> Vec<Verification> {
    let key = (symbol_short!("verify"), milestone_id);
    env.storage().instance().get(&key).unwrap_or(Vec::new(env))
}

/// Update milestone status
pub fn update_milestone_status(env: &Env, milestone_id: u64, status: MilestoneStatus) {
    if let Some(mut milestone) = get_milestone(env, milestone_id) {
        milestone.status = status;
        store_milestone(env, &milestone);
    }
}

/// Update milestone completion percentage
pub fn update_milestone_completion(env: &Env, milestone_id: u64, percentage: u32) {
    if let Some(mut milestone) = get_milestone(env, milestone_id) {
        milestone.completion_percentage = percentage;
        if percentage == 100 {
            milestone.status = MilestoneStatus::Completed;
        } else if percentage > 0 {
            milestone.status = MilestoneStatus::PartiallyCompleted;
        }
        store_milestone(env, &milestone);
    }
}

/// Check if all dependencies are completed
pub fn check_dependencies_completed(env: &Env, dependencies: &Vec<u64>) -> bool {
    for i in 0..dependencies.len() {
        let dep_id = dependencies.get(i).unwrap();
        if let Some(milestone) = get_milestone(env, dep_id) {
            if milestone.status != MilestoneStatus::Completed {
                return false;
            }
        } else {
            return false; // Dependency milestone not found
        }
    }
    true
}

/// Check for circular dependencies
pub fn check_circular_dependencies(env: &Env, milestone_id: u64, dependencies: &Vec<u64>) -> bool {
    for i in 0..dependencies.len() {
        let dep_id = dependencies.get(i).unwrap();
        if dep_id == milestone_id {
            return true; // Direct self-reference
        }

        // Check if this dependency creates a cycle
        if let Some(dep_milestone) = get_milestone(env, dep_id) {
            if check_circular_dependencies_recursive(
                env,
                dep_id,
                milestone_id,
                &dep_milestone.dependencies,
            ) {
                return true;
            }
        }
    }
    false
}

/// Recursive helper for circular dependency checking
fn check_circular_dependencies_recursive(
    env: &Env,
    _current_id: u64,
    target_id: u64,
    dependencies: &Vec<u64>,
) -> bool {
    for i in 0..dependencies.len() {
        let dep_id = dependencies.get(i).unwrap();
        if dep_id == target_id {
            return true; // Found a cycle
        }

        if let Some(dep_milestone) = get_milestone(env, dep_id) {
            if check_circular_dependencies_recursive(
                env,
                dep_id,
                target_id,
                &dep_milestone.dependencies,
            ) {
                return true;
            }
        }
    }
    false
}

/// Calculate proportional funding release
pub fn calculate_proportional_funding(funding_amount: i128, percentage: u32) -> i128 {
    (funding_amount * percentage as i128) / 100
}

/// Release funding for a milestone
pub fn release_funding(env: &Env, project_id: u64, _milestone_id: u64, amount: i128) -> bool {
    if let Some(mut project_funding) = get_project_funding(env, project_id) {
        if project_funding.available_funding >= amount {
            project_funding.available_funding -= amount;
            project_funding.released_funding += amount;
            store_project_funding(env, project_id, &project_funding);
            return true;
        }
    }
    false
}

/// Check if milestone deadline has passed
pub fn is_milestone_expired(env: &Env, milestone: &Milestone) -> bool {
    let current_time = env.ledger().timestamp();
    current_time > milestone.deadline
}

/// Update expired milestones
pub fn update_expired_milestones(env: &Env, project_id: u64) {
    let milestones = get_project_milestones(env, project_id);
    for i in 0..milestones.len() {
        let milestone = milestones.get(i).unwrap();
        if is_milestone_expired(env, &milestone) && milestone.status != MilestoneStatus::Completed {
            update_milestone_status(env, milestone.milestone_id, MilestoneStatus::Expired);
        }
    }
}

/// Activate milestones that have all their dependencies completed
pub fn activate_dependent_milestones(env: &Env, project_id: u64) {
    let milestones = get_project_milestones(env, project_id);
    for i in 0..milestones.len() {
        let milestone = milestones.get(i).unwrap();
        if milestone.status == MilestoneStatus::Pending
            && check_dependencies_completed(env, &milestone.dependencies)
        {
            update_milestone_status(env, milestone.milestone_id, MilestoneStatus::Active);
        }
    }
}

/// Emit milestone creation event
pub fn emit_milestone_created_event(
    env: &Env,
    milestone_id: u64,
    project_id: u64,
    creator: Address,
    funding_amount: i128,
) {
    env.events().publish(
        (symbol_short!("mil_new"), milestone_id),
        (project_id, creator, funding_amount),
    );
}

/// Emit milestone completion event
pub fn emit_milestone_completed_event(
    env: &Env,
    milestone_id: u64,
    project_id: u64,
    completion_percentage: u32,
    funding_released: i128,
) {
    env.events().publish(
        (symbol_short!("mil_done"), milestone_id),
        (project_id, completion_percentage, funding_released),
    );
}

/// Emit milestone verification event
pub fn emit_milestone_verified_event(
    env: &Env,
    milestone_id: u64,
    verifier: Address,
    verification_type: VerificationType,
) {
    env.events().publish(
        (symbol_short!("mil_ok"), milestone_id),
        (verifier, verification_type),
    );
}
