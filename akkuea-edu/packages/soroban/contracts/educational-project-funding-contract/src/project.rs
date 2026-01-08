use soroban_sdk::{contracttype, symbol_short, Address, Env, String, Symbol, Vec};

// Storage key prefix
const PROJECT_KEY: Symbol = symbol_short!("project");

/// Project data model
#[derive(Clone)]
#[contracttype]
pub struct Project {
    pub id: u64,
    pub creator: Address,
    pub title: String,
    pub description: String,
    pub total_funds: u64,
    pub milestones: Vec<Milestone>,
    pub votes: u32,
    pub funded_amount: u64,
    pub is_approved: bool,
}
#[derive(Clone)]
#[contracttype]
pub struct Milestone {
    pub id: u64,
    pub description: String,
    pub is_completed: bool,
    pub release_amount: u64,
}

/// Register a new project and save to storage
pub fn register_project(
    env: &Env,
    id: u64,
    creator: Address,
    title: String,
    description: String,
    total_funds: u64,
    milestones: Vec<Milestone>,
) {
    // Require creator's authentication
    creator.require_auth();

    // Ensure the project does not already exist
    if get_project(env, id).is_some() {
        panic!("Project already exists");
    }

    // Construct the project
    let project = Project {
        id,
        creator,
        title,
        description,
        total_funds,
        milestones,
        votes: 0,
        funded_amount: 0,
        is_approved: false,
    };

    save_project(env, id, project);
}

/// Retrieve a project by its ID
pub fn get_project(env: &Env, id: u64) -> Option<Project> {
    let key = (PROJECT_KEY, id);
    env.storage().instance().get(&key)
}

/// Save or update a project in storage
pub fn save_project(env: &Env, id: u64, project: Project) {
    let key = (PROJECT_KEY, id);
    env.storage().instance().set(&key, &project);
}

/// Get metadata about a project (public info)
pub fn get_project_info(env: &Env, id: u64) -> (String, String, u64, u32, bool, u64) {
    let project = get_project(env, id).unwrap_or_else(|| panic!("Project not found"));

    (
        project.title,
        project.description,
        project.total_funds,
        project.votes,
        project.is_approved,
        project.funded_amount,
    )
}

/// List all milestones for a project
pub fn get_milestones(env: &Env, id: u64) -> Vec<Milestone> {
    let project = get_project(env, id).unwrap_or_else(|| panic!("Project not found"));
    project.milestones
}
