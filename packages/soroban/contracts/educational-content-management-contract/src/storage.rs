use soroban_sdk::{contracttype, Address, BytesN, Env, String, Vec};

// Content data structure as per requirements
#[contracttype]
pub struct Content {
    pub id: u64,
    pub creator: Address,
    pub title: String,
    pub content_hash: BytesN<32>,
    pub creation_date: u64,
    pub subject_tags: Vec<String>,
    pub upvotes: u32,
    pub is_verified: bool,
}

// Keys for contract data
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Content(u64),            // Content ID -> Content
    ContentCounter,          // Counter for content IDs
    UserVotes(Address, u64), // (User, Content ID) -> Has voted?
}

// Get the next content ID and increment the counter
pub fn get_next_content_id(env: &Env) -> u64 {
    let key = DataKey::ContentCounter;
    let id = env.storage().instance().get(&key).unwrap_or(0u64);
    env.storage().instance().set(&key, &(id + 1));
    id
}

// Store content in contract storage
pub fn save_content(env: &Env, content: &Content) {
    let key = DataKey::Content(content.id);
    env.storage().instance().set(&key, content);
}

// Retrieve content from contract storage
pub fn get_content(env: &Env, content_id: u64) -> Content {
    let key = DataKey::Content(content_id);
    env.storage().instance().get(&key).unwrap_or_else(|| {
        panic!("content with ID {} not found", content_id)
    })
}

// Record a user's vote for a specific content
pub fn record_user_vote(env: &Env, voter: Address, content_id: u64) {
    let key = DataKey::UserVotes(voter, content_id);
    env.storage().instance().set(&key, &true);
}

// Check if a user has already voted for a specific content
pub fn has_user_voted(env: &Env, voter: &Address, content_id: u64) -> bool {
    let key = DataKey::UserVotes(voter.clone(), content_id);
    env.storage().instance().has(&key)
}

// Get the current content counter (total number of content items created)
pub fn get_content_counter(env: &Env) -> u64 {
    let key = DataKey::ContentCounter;
    env.storage().instance().get(&key).unwrap_or(0u64)
}

// Check if content exists by ID
pub fn content_exists(env: &Env, content_id: u64) -> bool {
    let key = DataKey::Content(content_id);
    env.storage().instance().has(&key)
}

// Get all existing content IDs (for filtering operations)
pub fn get_all_content_ids(env: &Env) -> Vec<u64> {
    let mut content_ids = Vec::new(env);
    let total_content = get_content_counter(env);

    // Iterate through all possible content IDs and check if they exist
    for id in 0..total_content {
        if content_exists(env, id) {
            content_ids.push_back(id);
        }
    }

    content_ids
}

// Get multiple content items by their IDs
pub fn get_multiple_content(env: &Env, content_ids: &Vec<u64>) -> Vec<Content> {
    let mut contents = Vec::new(env);

    for i in 0..content_ids.len() {
        let content_id = content_ids.get(i).unwrap();
        if content_exists(env, content_id) {
            let content = get_content(env, content_id);
            contents.push_back(content);
        }
    }

    contents
}