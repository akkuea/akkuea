use soroban_sdk::{contracttype, Address, Bytes, BytesN, Env, Map, Symbol, Vec};

/// Struct that represents a registered user
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct User {
    pub address: Address,
    pub reputation: u64,
    pub expertise: Vec<Symbol>, // Symbol is used for string-like keys in Soroban
    pub contributions: u64,
    pub registered_at: u64,
}

/// Event emitted on reputation updates or key actions
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ReputationEvent {
    pub from: Option<Address>,
    pub to: Address,
    pub score_delta: i64,
    pub reason: Symbol,
    pub timestamp: u64,
}

/// USER_STORAGE is a Map<Address, User>
pub struct UserStorage;

impl UserStorage {
    const _STORAGE_KEY: &'static str = "user_storage";

    pub fn get(env: &Env, user: &Address) -> Option<User> {
        let storage: Map<Address, User> = env
            .storage()
            .persistent()
            .get(&Self::key(env))
            .unwrap_or(Map::new(env));
        storage.get(user.clone())
    }

    pub fn set(env: &Env, user: &Address, user_data: &User) {
        let mut storage: Map<Address, User> = env
            .storage()
            .persistent()
            .get(&Self::key(env))
            .unwrap_or(Map::new(env));

        storage.set(user.clone(), user_data.clone());
        env.storage().persistent().set(&Self::key(env), &storage);
    }

    pub fn has(env: &Env, user: &Address) -> bool {
        Self::get(env, user).is_some()
    }

    // Remove a user from storage
    pub fn remove(env: &Env, user: &Address) {
        let mut storage: Map<Address, User> = env
            .storage()
            .persistent()
            .get(&Self::key(env))
            .unwrap_or(Map::new(env));

        storage.remove(user.clone());
        env.storage().persistent().set(&Self::key(env), &storage);
    }

    // Get all users' addresses (for mass actions like reset)
    pub fn get_all_users(env: &Env) -> Vec<Address> {
        let storage: Map<Address, User> = env
            .storage()
            .persistent()
            .get(&Self::key(env))
            .unwrap_or(Map::new(env));
        let keys = storage.keys();
        let mut result = soroban_sdk::Vec::new(env);
        for key in keys {
            result.push_back(key);
        }
        result
    }

    // Get users registered in the last N seconds
    pub fn get_recent_users(env: &Env, cutoff_time: u64) -> Vec<User> {
        let storage: Map<Address, User> = env
            .storage()
            .persistent()
            .get(&Self::key(env))
            .unwrap_or(Map::new(env));

        let mut recent_users = Vec::new(&env);
        for (_, user) in storage.iter() {
            if user.registered_at > cutoff_time {
                recent_users.push_back(user.clone());
            }
        }
        recent_users
    }

    // Get the total number of registered users
    pub fn get_user_count(env: &Env) -> u64 {
        let storage: Map<Address, User> = env
            .storage()
            .persistent()
            .get(&Self::key(env))
            .unwrap_or(Map::new(env));

        storage.len() as u64
    }

    // Increment user reputation by a specific amount
    pub fn increment_reputation(env: &Env, user: &Address, delta: i64) {
        let mut user_data = Self::get(env, user).expect("User not registered");
        if delta > 0 {
            user_data.reputation += delta as u64;
        } else {
            user_data.reputation = user_data.reputation.saturating_sub(-delta as u64);
        }
        Self::set(env, user, &user_data);
    }

    // Reset all user reputations (e.g., during a contest or event reset)
    pub fn reset_all_reputations(env: &Env) {
        let all_users = Self::get_all_users(env);
        for user in all_users {
            let mut user_data = Self::get(env, &user).expect("User not registered");
            user_data.reputation = 0;
            Self::set(env, &user, &user_data);
        }
    }

    // Remove all users (a complete reset of user data)
    pub fn remove_all_users(env: &Env) {
        let storage: Map<Address, User> = env
            .storage()
            .persistent()
            .get(&Self::key(env))
            .unwrap_or(Map::new(env));

        for (user, _) in storage.iter() {
            Self::remove(env, &user);
        }
    }

    // Check if a user has expertise in a specific area
    pub fn _has_expertise(env: &Env, user: &Address, expertise: &Symbol) -> bool {
        let user_data = Self::get(env, user).expect("User not registered");
        user_data.expertise.contains(expertise)
    }

    // Add new expertise to a user's profile
    pub fn add_expertise(env: &Env, user: &Address, new_expertise: &Symbol) {
        let mut user_data = Self::get(env, user).expect("User not registered");
        if !user_data.expertise.contains(new_expertise) {
            user_data.expertise.push_back(new_expertise.clone());
        }
        Self::set(env, user, &user_data);
    }

    // Remove expertise from a user's profile
    pub fn remove_expertise(env: &Env, user: &Address, expertise_to_remove: &Symbol) {
        let mut user_data = Self::get(env, user).expect("User not registered");
        if let Some(index) = user_data
            .expertise
            .iter()
            .position(|expertise| expertise == *expertise_to_remove)
        {
            user_data.expertise.remove(index.try_into().unwrap());
        }
        Self::set(env, user, &user_data);
    }

    // Get the user's most recent contribution
    pub fn _get_most_recent_contribution(env: &Env, user: &Address) -> Option<u64> {
        let user_data = Self::get(env, user).expect("User not registered");
        Some(user_data.contributions)
    }

    // Reset user's contributions to 0
    pub fn _reset_contributions(env: &Env, user: &Address) {
        let mut user_data = Self::get(env, user).expect("User not registered");
        user_data.contributions = 0;
        Self::set(env, user, &user_data);
    }

    // Get user's reputation
    pub fn get_reputation(env: &Env, user: &Address) -> u64 {
        let user_data = Self::get(env, user).expect("User not registered");
        user_data.reputation
    }

    // Get the full user profile (address, reputation, expertise, contributions, etc.)
    pub fn get_full_profile(env: &Env, user: &Address) -> User {
        Self::get(env, user).expect("User not registered")
    }

    // Get registration timestamp of the user
    pub fn _get_registration_time(env: &Env, user: &Address) -> u64 {
        let user_data = Self::get(env, user).expect("User not registered");
        user_data.registered_at
    }

    // Helper function to generate the key for storage access
    fn key(env: &Env) -> BytesN<32> {
        let mut key_bytes = Bytes::new(&env);
        key_bytes.append(&Bytes::from_slice(&env, "user_storage".as_bytes()));
        let hash = env.crypto().sha256(&key_bytes);
        BytesN::from_array(&env, &hash.to_array())
    }
}
