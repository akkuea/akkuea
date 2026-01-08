use soroban_sdk::{token, Address, Env};

use crate::project::{get_project, save_project};

/// Complete a milestone after project approval
pub fn complete_milestone(env: &Env, project_id: u64, milestone_id: u64, caller: Address) {
    caller.require_auth();

    let mut project = get_project(env, project_id).unwrap_or_else(|| panic!("Project not found"));

    if project.creator != caller {
        panic!("Only the project creator can complete a milestone");
    }

    if !project.is_approved {
        panic!("Project not approved for funding");
    }

    let mut found = false;
    let milestones_len = project.milestones.len();

    for i in 0..milestones_len {
        let milestone = project.milestones.get(i).unwrap();
        if milestone.id == milestone_id {
            if milestone.is_completed {
                panic!("Milestone already completed");
            }

            // Create a modified copy
            let mut updated_milestone = milestone.clone();
            updated_milestone.is_completed = true;

            // Update the vector with the modified milestone
            project.milestones.set(i, updated_milestone);
            found = true;
            break;
        }
    }

    if !found {
        panic!("Milestone not found");
    }

    save_project(env, project_id, project);
}

/// Release funds for all completed, unfunded milestones and send tokens
pub fn release_funds(
    env: &Env,
    project_id: u64,
    caller: Address,
    token_address: Address,
    treasury_address: Address,
) {
    caller.require_auth();

    let mut project = get_project(env, project_id).unwrap_or_else(|| panic!("Project not found"));

    if project.creator != caller {
        panic!("Only the project creator can release funds");
    }

    if !project.is_approved {
        panic!("Project not approved");
    }

    let mut total_to_release: u64 = 0;
    let milestones_len = project.milestones.len();

    // Create a new vector for the updated milestones
    let mut updated_milestones = soroban_sdk::Vec::new(env);

    // Process each milestone
    for i in 0..milestones_len {
        let milestone = project.milestones.get(i).unwrap();
        let mut updated = milestone.clone();

        if milestone.is_completed && milestone.release_amount > 0 {
            if project.funded_amount + milestone.release_amount > project.total_funds {
                panic!("Releasing this milestone would exceed total project funds");
            }

            total_to_release += milestone.release_amount;
            updated.release_amount = 0;
        }

        updated_milestones.push_back(updated);
    }

    project.milestones = updated_milestones;

    if total_to_release == 0 {
        panic!("No completed milestones to release");
    }

    // ✅ Do the token transfer from treasury to creator
    let token = token::Client::new(env, &token_address);
    token.transfer(
        &treasury_address,
        &project.creator,
        &total_to_release.into(),
    );

    // Update state
    project.funded_amount += total_to_release;
    save_project(env, project_id, project);
}
