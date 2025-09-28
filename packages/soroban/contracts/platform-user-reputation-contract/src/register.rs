use crate::storage::{User, UserStorage};
use soroban_sdk::{Address, Env, Symbol, Vec};

/// Registers a new user with optional expertise and default values.
pub fn register_user(env: Env, user: Address, expertise: Vec<Symbol>) {
    user.require_auth();

    if is_registered(env.clone(), user.clone()) {
        panic!("User already registered");
    }

    let timestamp = env.ledger().timestamp();
    let new_user = User {
        address: user.clone(),
        reputation: 0,
        expertise: expertise.clone(),
        contributions: 0,
        registered_at: timestamp,
    };

    UserStorage::set(&env, &user, &new_user);
}

/// Deregisters a user by removing from storage.
pub fn _deregister_user(env: Env, user: Address) {
    user.require_auth();

    if !is_registered(env.clone(), user.clone()) {
        panic!("User not registered");
    }

    UserStorage::remove(&env, &user);
}

/// Update expertise field for user profile.
pub fn update_expertise(env: Env, user: Address, new_expertise: Vec<Symbol>) {
    user.require_auth();

    let mut user_data = UserStorage::get(&env, &user).expect("User not registered");
    user_data.expertise = new_expertise.clone();
    UserStorage::set(&env, &user, &user_data);
}

/// Increment contribution count for a user.
pub fn _increment_contributions(env: Env, user: Address) {
    let mut user_data = UserStorage::get(&env, &user).expect("User not registered");
    user_data.contributions += 1;
    UserStorage::set(&env, &user, &user_data);
}

/// Reset the user's reputation to 0.
pub fn _reset_reputation(env: Env, user: Address) {
    user.require_auth();

    let mut user_data = UserStorage::get(&env, &user).expect("User not registered");
    user_data.reputation = 0;
    UserStorage::set(&env, &user, &user_data);
}

/// Check if a user is registered.
pub fn is_registered(env: Env, user: Address) -> bool {
    UserStorage::has(&env, &user)
}

/// Get user full profile or panic.
pub fn _get_user_profile(env: Env, user: Address) -> User {
    UserStorage::get(&env, &user).expect("User not registered")
}

/// Get only user's expertise tags.
pub fn _get_expertise(env: Env, user: Address) -> Vec<Symbol> {
    let user_data = UserStorage::get(&env, &user).expect("User not registered");
    user_data.expertise
}

/// Get user's registration timestamp.
pub fn _get_registration_time(env: Env, user: Address) -> u64 {
    let user_data = UserStorage::get(&env, &user).expect("User not registered");
    user_data.registered_at
}
