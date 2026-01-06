#![no_std]

use soroban_sdk::{contract, contractimpl, vec, Address, Env, String, Symbol, Vec};

use soroban_sdk::symbol_short;

mod register;
mod reputation;
mod storage;

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    /// Greeting function (sample)
    pub fn hello(env: Env, to: String) -> Vec<String> {
        vec![&env, String::from_str(&env, "Hello"), to]
    }

    /// Register a new user and emit event
    pub fn register(env: Env, user: Address, expertise: Vec<Symbol>) {
        register::register_user(env.clone(), user.clone(), expertise.clone());

        env.events()
            .publish((symbol_short!("usr_reg"), user.clone()), expertise);
    }

    /// Update user's expertise and emit event
    pub fn update_expertise(env: Env, user: Address, new_expertise: Vec<Symbol>) {
        register::update_expertise(env.clone(), user.clone(), new_expertise.clone());

        env.events()
            .publish((symbol_short!("expertise"), user.clone()), new_expertise);
    }

    /// Check if a user is already registered
    pub fn is_registered(env: Env, user: Address) -> bool {
        register::is_registered(env, user)
    }

    /// Get full user profile
    pub fn get_user(env: Env, user: Address) -> storage::User {
        storage::UserStorage::get_full_profile(&env, &user)
    }

    /// Update a user's reputation and emit event
    pub fn update_reputation(env: Env, user: Address, score_delta: i64, reason: Symbol) {
        storage::UserStorage::increment_reputation(&env, &user, score_delta);

        // Emit reputation change event
        env.events().publish(
            (symbol_short!("rep_upt"), user.clone()),
            (score_delta, reason),
        );
    }

    /// Reset a user's reputation to 0
    pub fn reset_reputation(env: Env, user: Address) {
        storage::UserStorage::increment_reputation(
            &env,
            &user,
            -(storage::UserStorage::get_reputation(&env, &user) as i64),
        );

        env.events().publish((symbol_short!("rep_reset"), user), ());
    }

    /// Remove a user and emit event
    pub fn remove_user(env: Env, user: Address) {
        storage::UserStorage::remove(&env, &user);

        env.events().publish((symbol_short!("usr_rem"), user), ());
    }

    /// Get all registered users
    pub fn get_all_users(env: Env) -> Vec<Address> {
        storage::UserStorage::get_all_users(&env)
    }

    /// Get recent users within a specific time window
    pub fn get_recent_users(env: Env, cutoff_time: u64) -> Vec<storage::User> {
        storage::UserStorage::get_recent_users(&env, cutoff_time)
    }

    /// Get the number of registered users
    pub fn get_user_count(env: Env) -> u64 {
        storage::UserStorage::get_user_count(&env)
    }

    /// Add expertise to a user's profile and emit event
    pub fn add_expertise(env: Env, user: Address, expertise: Symbol) {
        storage::UserStorage::add_expertise(&env, &user, &expertise);

        env.events()
            .publish((symbol_short!("exp_added"), user), expertise);
    }

    /// Remove expertise from a user's profile and emit event
    pub fn remove_expertise(env: Env, user: Address, expertise: Symbol) {
        storage::UserStorage::remove_expertise(&env, &user, &expertise);

        env.events()
            .publish((symbol_short!("exp_rem"), user), expertise);
    }

    /// Reset all reputations and emit event
    pub fn reset_all_reputations(env: Env) {
        storage::UserStorage::reset_all_reputations(&env);

        env.events().publish(
            (symbol_short!("rep_reset"), env.current_contract_address()),
            (),
        );
    }

    /// Remove all users and emit event
    pub fn remove_all_users(env: Env) {
        storage::UserStorage::remove_all_users(&env);

        env.events().publish(
            (symbol_short!("usr_rem"), env.current_contract_address()),
            (),
        );
    }
}

mod test;
