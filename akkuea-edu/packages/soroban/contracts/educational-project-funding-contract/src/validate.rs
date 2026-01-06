use soroban_sdk::{symbol_short, Address, Env, Map, Symbol};

const _VOTE_TRACKER_KEY: Symbol = symbol_short!("vote_tck");

/// Checks if an address has already voted for a project
pub fn _has_already_voted(env: &Env, project_id: u64, voter: &Address) -> bool {
    let key = (_VOTE_TRACKER_KEY, project_id);
    let tracker: Map<Address, bool> = env
        .storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| Map::new(env));

    tracker.get(voter.clone()).unwrap_or(false)
}

/// Marks that an address has voted for a project
pub fn _mark_voted(env: &Env, project_id: u64, voter: &Address) {
    let key = (_VOTE_TRACKER_KEY, project_id);
    let mut tracker: Map<Address, bool> = env
        .storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| Map::new(env));

    tracker.set(voter.clone(), true);
    env.storage().instance().set(&key, &tracker);
}

/// Validates the project ID input exists and is valid
pub fn validate_project_exists<F>(env: &Env, project_id: u64, fetch_project_fn: F)
where
    F: Fn(&Env, u64) -> Option<crate::project::Project>,
{
    let project_opt = fetch_project_fn(env, project_id);
    if project_opt.is_none() {
        panic!("Project does not exist");
    }
}

/// Validates milestone ID exists within project
pub fn validate_milestone_exists(
    env: &Env,
    project_id: u64,
    milestone_id: u64,
    fetch_project_fn: fn(&Env, u64) -> Option<crate::project::Project>,
) {
    let project = fetch_project_fn(env, project_id).unwrap_or_else(|| panic!("Project not found"));

    let found = project.milestones.iter().any(|m| m.id == milestone_id);

    if !found {
        panic!("Milestone not found");
    }
}
