use soroban_sdk::{contracttype, Address, Env, String, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Achievement {
    pub token_id: u64,
    pub user: Address,
    pub educator: Address,
    pub course_title: String,
    pub completion_status: u32, // 0-100 percentage
    pub quiz_results: Vec<u32>, // Array of quiz scores
    pub certified: bool,
    pub created_at: u64,
    pub updated_at: u64,
    pub certified_at: Option<u64>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageKey {
    Achievement(u64),              // token_id -> Achievement
    UserAchievements(Address),     // user -> Vec<token_id>
    EducatorAchievements(Address), // educator -> Vec<token_id>
}

// Achievement storage functions
pub fn get_achievement(env: &Env, token_id: u64) -> Option<Achievement> {
    let key = StorageKey::Achievement(token_id);
    env.storage().persistent().get(&key)
}

pub fn set_achievement(env: &Env, achievement: &Achievement) {
    let key = StorageKey::Achievement(achievement.token_id);
    env.storage().persistent().set(&key, achievement);
}

// User achievements storage
pub fn get_user_achievements(env: &Env, user: &Address) -> Vec<u64> {
    let key = StorageKey::UserAchievements(user.clone());
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env))
}

pub fn add_user_achievement(env: &Env, user: &Address, token_id: u64) {
    let key = StorageKey::UserAchievements(user.clone());
    let mut achievements = get_user_achievements(env, user);
    if !achievements.contains(&token_id) {
        achievements.push_back(token_id);
        env.storage().persistent().set(&key, &achievements);
    }
}

// Educator achievements storage
pub fn get_educator_achievements(env: &Env, educator: &Address) -> Vec<u64> {
    let key = StorageKey::EducatorAchievements(educator.clone());
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env))
}

pub fn add_educator_achievement(env: &Env, educator: &Address, token_id: u64) {
    let key = StorageKey::EducatorAchievements(educator.clone());
    let mut achievements = get_educator_achievements(env, educator);
    if !achievements.contains(&token_id) {
        achievements.push_back(token_id);
        env.storage().persistent().set(&key, &achievements);
    }
}
