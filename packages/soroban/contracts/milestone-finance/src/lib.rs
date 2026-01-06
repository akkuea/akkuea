#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Map, String, Vec};

mod milestone;
mod reputation;
mod utils;
mod voting;

pub use milestone::*;
pub use reputation::{
    complete_milestone,
    get_project_voters as get_reputation_project_voters, // Rename to avoid conflict
    get_project_voting_power,
    get_reputation,
    get_reputation_stats,
    get_voting_power,
    initialize_user,
    penalize_missed_milestone,
    update_reputation,
    vote_for_project,
    ProjectVote,
    Reputation,
    ReputationStats,
    User,
};
pub use utils::*;
pub use voting::*;

#[cfg(test)]
mod test;

#[contract]
pub struct MilestoneFinance;

#[contractimpl]
impl MilestoneFinance {
    /// Initialize a new user in the reputation system
    pub fn initialize_user(env: Env, caller: Address, name: String) -> u64 {
        caller.require_auth();
        reputation::initialize_user(env, caller, name)
    }

    /// Update reputation based on project or milestone outcomes
    pub fn update_reputation(
        env: Env,
        caller: Address,
        user: Address,
        project_id: u64,
        success: bool,
    ) {
        caller.require_auth();
        reputation::update_reputation(env, caller, user, project_id, success)
    }

    /// Get voting power based on reputation score
    pub fn get_voting_power(env: Env, user: Address) -> u32 {
        reputation::get_voting_power(env, user)
    }

    /// Apply reputation penalty for missed milestones
    pub fn penalize_missed_milestone(env: Env, caller: Address, user: Address, milestone_id: u64) {
        caller.require_auth();
        reputation::penalize_missed_milestone(env, caller, user, milestone_id)
    }

    /// Get user reputation details
    pub fn get_reputation(env: Env, user: Address) -> Reputation {
        reputation::get_reputation(env, user)
    }

    /// Vote for a project with reputation-based voting power
    pub fn vote_for_project(env: Env, voter: Address, project_id: u64) -> u32 {
        voter.require_auth();
        reputation::vote_for_project(env, voter, project_id)
    }

    /// Get total voting power for a project
    pub fn get_project_voting_power(env: Env, project_id: u64) -> u32 {
        reputation::get_project_voting_power(env, project_id)
    }

    /// Get project voters with their voting power
    pub fn get_project_voters(env: Env, project_id: u64) -> Map<Address, u32> {
        reputation::get_project_voters(env, project_id)
    }

    /// Complete a milestone and update creator reputation
    pub fn complete_milestone(
        env: Env,
        caller: Address,
        project_id: u64,
        milestone_id: u64,
        creator: Address,
    ) {
        caller.require_auth();
        reputation::complete_milestone(env, caller, project_id, milestone_id, creator)
    }

    /// Get reputation statistics for analytics
    pub fn get_reputation_stats(env: Env) -> ReputationStats {
        reputation::get_reputation_stats(env)
    }

    // ===== MILESTONE MANAGEMENT FUNCTIONS =====

    /// Initialize the milestone system
    pub fn initialize_milestone_system(env: Env) {
        milestone::initialize_milestone_counter(&env);
    }

    /// Create a new milestone with dependencies and funding details
    pub fn create_milestone(
        env: Env,
        caller: Address,
        project_id: u64,
        dependencies: Vec<u64>,
        funding_amount: i128,
        deadline: u64,
    ) -> u64 {
        caller.require_auth();

        // Validate inputs
        validate_project_id(project_id).unwrap();
        validate_funding_amount(funding_amount).unwrap();
        validate_deadline(deadline, env.ledger().timestamp()).unwrap();

        // Validate dependencies
        if !dependencies.is_empty() {
            validate_dependencies(&env, &dependencies, project_id).unwrap();

            // Check for circular dependencies
            let milestone_id = get_next_milestone_id(&env);
            if check_circular_dependencies(&env, milestone_id, &dependencies) {
                panic!("Circular dependency detected");
            }
        }

        // Check if project has sufficient funding
        if let Some(project_funding) = get_project_funding(&env, project_id) {
            if project_funding.available_funding < funding_amount {
                panic!("Insufficient project funding");
            }
        } else {
            panic!("Project funding not found");
        }

        // Create milestone
        let milestone_id = get_next_milestone_id(&env);
        let milestone = Milestone {
            milestone_id,
            project_id,
            dependencies: dependencies.clone(),
            status: MilestoneStatus::Pending,
            funding_amount,
            deadline,
            completion_percentage: 0,
            created_at: env.ledger().timestamp(),
            creator: caller.clone(),
            verifiers: Vec::new(&env),
        };

        // Check if dependencies are completed to activate milestone
        let status = if dependencies.is_empty() || check_dependencies_completed(&env, &dependencies)
        {
            MilestoneStatus::Active
        } else {
            MilestoneStatus::Pending
        };

        let mut active_milestone = milestone.clone();
        active_milestone.status = status;
        store_milestone(&env, &active_milestone);

        // Emit event
        emit_milestone_created_event(&env, milestone_id, project_id, caller, funding_amount);

        milestone_id
    }

    /// Verify partial completion of a milestone and release proportional funds
    pub fn verify_partial_completion(
        env: Env,
        caller: Address,
        milestone_id: u64,
        percentage: u32,
    ) {
        caller.require_auth();

        // Validate inputs
        validate_milestone_id(milestone_id).unwrap();
        validate_completion_percentage(percentage).unwrap();

        // Get milestone
        let milestone = get_milestone(&env, milestone_id).unwrap_or_else(|| {
            panic!("Milestone not found");
        });

        // Check if caller is authorized to verify
        if !is_stakeholder(&env, milestone.project_id, caller.clone()) {
            panic!("Unauthorized verifier");
        }

        // Check if milestone is active
        if milestone.status != MilestoneStatus::Active
            && milestone.status != MilestoneStatus::PartiallyCompleted
        {
            panic!("Milestone is not active");
        }

        // Check if milestone is expired
        if is_milestone_expired(&env, &milestone) {
            update_milestone_status(&env, milestone_id, MilestoneStatus::Expired);
            panic!("Milestone has expired");
        }

        // Update completion percentage
        update_milestone_completion(&env, milestone_id, percentage);

        // Calculate and release proportional funding
        let funding_to_release =
            calculate_proportional_funding(milestone.funding_amount, percentage);
        let previous_funding = calculate_proportional_funding(
            milestone.funding_amount,
            milestone.completion_percentage,
        );
        let new_funding = funding_to_release - previous_funding;

        if new_funding > 0 {
            if !release_funding(&env, milestone.project_id, milestone_id, new_funding) {
                panic!("Failed to release funding");
            }
        }

        // Record verification
        let verification = Verification {
            verifier: caller.clone(),
            verified_at: env.ledger().timestamp(),
            verification_type: VerificationType::PartialCompletion,
        };
        store_verification(&env, milestone_id, &verification);

        // Emit events
        emit_milestone_completed_event(
            &env,
            milestone_id,
            milestone.project_id,
            percentage,
            new_funding,
        );
        emit_milestone_verified_event(
            &env,
            milestone_id,
            caller,
            VerificationType::PartialCompletion,
        );
    }

    /// Verify milestone completion by stakeholders
    pub fn verify_milestone(env: Env, caller: Address, milestone_id: u64) {
        caller.require_auth();

        // Validate inputs
        validate_milestone_id(milestone_id).unwrap();

        // Get milestone
        let milestone = get_milestone(&env, milestone_id).unwrap_or_else(|| {
            panic!("Milestone not found");
        });

        // Check if caller is authorized to verify
        if !is_stakeholder(&env, milestone.project_id, caller.clone()) {
            panic!("Unauthorized verifier");
        }

        // Check if milestone is active or partially completed
        if milestone.status != MilestoneStatus::Active
            && milestone.status != MilestoneStatus::PartiallyCompleted
        {
            panic!("Milestone is not in a verifiable state");
        }

        // Check if milestone is expired
        if is_milestone_expired(&env, &milestone) {
            update_milestone_status(&env, milestone_id, MilestoneStatus::Expired);
            panic!("Milestone has expired");
        }

        // Check for duplicate verification
        let verifications = get_verifications(&env, milestone_id);
        for i in 0..verifications.len() {
            let verification = verifications.get(i).unwrap();
            if verification.verifier == caller
                && verification.verification_type == VerificationType::FullCompletion
            {
                panic!("Duplicate verification");
            }
        }

        // Update milestone to completed
        update_milestone_status(&env, milestone_id, MilestoneStatus::Completed);
        update_milestone_completion(&env, milestone_id, 100);

        // Release remaining funding if any
        let remaining_funding = milestone.funding_amount
            - calculate_proportional_funding(
                milestone.funding_amount,
                milestone.completion_percentage,
            );
        if remaining_funding > 0 {
            if !release_funding(&env, milestone.project_id, milestone_id, remaining_funding) {
                panic!("Failed to release remaining funding");
            }
        }

        // Record verification
        let verification = Verification {
            verifier: caller.clone(),
            verified_at: env.ledger().timestamp(),
            verification_type: VerificationType::FullCompletion,
        };
        store_verification(&env, milestone_id, &verification);

        // Check if any pending milestones can now be activated
        activate_dependent_milestones(&env, milestone.project_id);

        // Emit events
        emit_milestone_completed_event(
            &env,
            milestone_id,
            milestone.project_id,
            100,
            remaining_funding,
        );
        emit_milestone_verified_event(&env, milestone_id, caller, VerificationType::FullCompletion);
    }

    /// Add a stakeholder to a project
    pub fn add_stakeholder(env: Env, caller: Address, project_id: u64, stakeholder: Address) {
        caller.require_auth();

        validate_project_id(project_id).unwrap();

        // Check if caller is authorized to add stakeholders
        // Allow if caller is not yet a stakeholder (first stakeholder) or if caller is already a stakeholder
        let stakeholders = get_stakeholders(&env, project_id);
        if stakeholders.len() > 0 && !is_stakeholder(&env, project_id, caller) {
            panic!("Unauthorized to add stakeholders");
        }

        add_stakeholder(&env, project_id, stakeholder.clone());
        emit_stakeholder_added_event(&env, project_id, stakeholder);
    }

    /// Initialize project funding
    pub fn initialize_project_funding(
        env: Env,
        caller: Address,
        project_id: u64,
        total_funding: i128,
    ) {
        caller.require_auth();

        validate_project_id(project_id).unwrap();
        validate_funding_amount(total_funding).unwrap();

        let project_funding = ProjectFunding {
            project_id,
            total_funding,
            released_funding: 0,
            available_funding: total_funding,
        };

        store_project_funding(&env, project_id, &project_funding);
        emit_project_funding_event(&env, project_id, total_funding, 0);
    }

    /// Get milestone details
    pub fn get_milestone_details(env: Env, milestone_id: u64) -> Option<Milestone> {
        get_milestone(&env, milestone_id)
    }

    /// Get all milestones for a project
    pub fn get_project_milestones(env: Env, project_id: u64) -> Vec<Milestone> {
        get_project_milestones(&env, project_id)
    }

    /// Get project funding information
    pub fn get_project_funding_info(env: Env, project_id: u64) -> Option<ProjectFunding> {
        get_project_funding(&env, project_id)
    }

    /// Get stakeholders for a project
    pub fn get_project_stakeholders(env: Env, project_id: u64) -> Vec<Address> {
        get_stakeholders(&env, project_id)
    }

    /// Update expired milestones for a project
    pub fn update_expired_milestones(env: Env, project_id: u64) {
        update_expired_milestones(&env, project_id);
    }

    /// Get verifications for a milestone
    pub fn get_milestone_verifications(env: Env, milestone_id: u64) -> Vec<Verification> {
        get_verifications(&env, milestone_id)
    }

    /// Manually activate dependent milestones for a project
    pub fn activate_dependent_milestones(env: Env, project_id: u64) {
        milestone::activate_dependent_milestones(&env, project_id);
    }

    // ===== VOTING SYSTEM FUNCTIONS =====

    /// Create a new voting period for a project with category-based thresholds
    pub fn create_voting_period(
        env: Env,
        admin: Address,
        project_id: u64,
        start_time: u64,
        end_time: u64,
        category: ProjectCategory,
    ) {
        voting::create_voting_period(env, admin, project_id, start_time, end_time, category);
    }

    /// Cast a vote on a project using quadratic voting with reputation-based weights
    pub fn cast_vote(env: Env, voter: Address, project_id: u64, weight: u32) -> Result<u32, Error> {
        voting::cast_vote(env, voter, project_id, weight)
    }

    /// Close a voting period and determine project approval status
    pub fn close_voting_period(env: Env, admin: Address, project_id: u64) -> bool {
        voting::close_voting_period(env, admin, project_id)
    }

    /// Get current voting status for a project
    pub fn get_voting_status(env: Env, project_id: u64) -> VotingStatus {
        voting::get_voting_status(env, project_id)
    }

    /// Get voting period details for a project
    pub fn get_voting_period_details(env: Env, project_id: u64) -> VotingPeriod {
        voting::get_voting_period(env, project_id)
    }

    /// Get vote record for a specific voter and project
    pub fn get_voter_vote(env: Env, project_id: u64, voter: Address) -> Option<Vote> {
        voting::get_vote(env, project_id, voter)
    }

    /// Get list of all voters for a project
    pub fn get_voting_project_voters(env: Env, project_id: u64) -> Vec<Address> {
        voting::get_project_voters(env, project_id)
    }

    /// Get total votes accumulated for a project
    pub fn get_voting_total_votes(env: Env, project_id: u64) -> u32 {
        voting::get_total_votes(env, project_id)
    }

    /// Check if a voter has already voted for a project
    pub fn has_voter_voted(env: Env, project_id: u64, voter: Address) -> bool {
        voting::has_voted(env, project_id, voter)
    }

    /// Get maximum vote weight a voter can afford based on their voting power
    pub fn get_voter_max_weight(env: Env, voter: Address) -> u32 {
        voting::get_max_vote_weight(env, voter)
    }
}
