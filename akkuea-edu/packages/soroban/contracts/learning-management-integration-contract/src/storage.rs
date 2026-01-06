use soroban_sdk::{contracttype, Address, Env, Vec};

// Storage keys
const ADMIN_KEY: &str = "admin";
const PLATFORMS_KEY: &str = "platforms";
const TOKEN_COUNTER_KEY: &str = "token_counter";

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LearningProgress {
    pub token_id: u64,
    pub user: Address,
    pub course_id: u64,
    pub completion_status: u32,  // 0-100 percentage
    pub prerequisites: Vec<u64>, // List of prerequisite course IDs
    pub created_at: u64,
    pub updated_at: u64,
    pub nft_issued: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageKey {
    Progress(u64),              // token_id -> LearningProgress
    UserProgress(Address, u64), // (user, course_id) -> token_id
    UserNFTs(Address),          // user -> Vec<token_id>
    CourseNFTs(u64),            // course_id -> Vec<token_id>
    CoursePrerequisites(u64),   // course_id -> Vec<prerequisite_course_ids>
}

// Admin functions
pub fn has_admin(env: &Env) -> bool {
    env.storage().instance().has(&ADMIN_KEY)
}

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&ADMIN_KEY).unwrap()
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&ADMIN_KEY, admin);
}

pub fn is_admin(env: &Env, address: &Address) -> bool {
    if !has_admin(env) {
        return false;
    }
    get_admin(env) == *address
}

// Platform management
pub fn get_platforms(env: &Env) -> Vec<Address> {
    env.storage()
        .instance()
        .get(&PLATFORMS_KEY)
        .unwrap_or(Vec::new(env))
}

pub fn add_platform(env: &Env, platform: &Address) {
    let mut platforms = get_platforms(env);
    if !platforms.contains(platform) {
        platforms.push_back(platform.clone());
        env.storage().instance().set(&PLATFORMS_KEY, &platforms);
    }
}

pub fn remove_platform(env: &Env, platform: &Address) {
    let platforms = get_platforms(env);
    let mut new_platforms = Vec::new(env);

    for addr in platforms.iter() {
        if addr != *platform {
            new_platforms.push_back(addr);
        }
    }

    env.storage().instance().set(&PLATFORMS_KEY, &new_platforms);
}

pub fn is_platform(env: &Env, platform: &Address) -> bool {
    let platforms = get_platforms(env);
    platforms.contains(platform)
}

// Token counter for auto-incrementing NFT IDs
pub fn get_next_token_id(env: &Env) -> u64 {
    let current: u64 = env
        .storage()
        .instance()
        .get(&TOKEN_COUNTER_KEY)
        .unwrap_or(0);
    let next = current + 1;
    env.storage().instance().set(&TOKEN_COUNTER_KEY, &next);
    next
}

// Learning progress storage
pub fn get_progress(env: &Env, token_id: u64) -> Option<LearningProgress> {
    let key = StorageKey::Progress(token_id);
    env.storage().persistent().get(&key)
}

pub fn set_progress(env: &Env, progress: &LearningProgress) {
    let key = StorageKey::Progress(progress.token_id);
    env.storage().persistent().set(&key, progress);
}

// User progress lookup
pub fn get_user_progress_token_id(env: &Env, user: &Address, course_id: u64) -> Option<u64> {
    let key = StorageKey::UserProgress(user.clone(), course_id);
    env.storage().persistent().get(&key)
}

pub fn set_user_progress_token_id(env: &Env, user: &Address, course_id: u64, token_id: u64) {
    let key = StorageKey::UserProgress(user.clone(), course_id);
    env.storage().persistent().set(&key, &token_id);
}

// User NFT tracking
pub fn get_user_nfts(env: &Env, user: &Address) -> Vec<u64> {
    let key = StorageKey::UserNFTs(user.clone());
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env))
}

pub fn add_user_nft(env: &Env, user: &Address, token_id: u64) {
    let key = StorageKey::UserNFTs(user.clone());
    let mut nfts = get_user_nfts(env, user);
    if !nfts.contains(&token_id) {
        nfts.push_back(token_id);
        env.storage().persistent().set(&key, &nfts);
    }
}

// Course NFT tracking
pub fn get_course_nfts(env: &Env, course_id: u64) -> Vec<u64> {
    let key = StorageKey::CourseNFTs(course_id);
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env))
}

pub fn add_course_nft(env: &Env, course_id: u64, token_id: u64) {
    let key = StorageKey::CourseNFTs(course_id);
    let mut nfts = get_course_nfts(env, course_id);
    if !nfts.contains(&token_id) {
        nfts.push_back(token_id);
        env.storage().persistent().set(&key, &nfts);
    }
}

// Course prerequisites management
pub fn get_course_prerequisites(env: &Env, course_id: u64) -> Vec<u64> {
    let key = StorageKey::CoursePrerequisites(course_id);
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env))
}

pub fn set_course_prerequisites(env: &Env, course_id: u64, prerequisites: &Vec<u64>) {
    let key = StorageKey::CoursePrerequisites(course_id);
    env.storage().persistent().set(&key, prerequisites);
}
