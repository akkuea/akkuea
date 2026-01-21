use soroban_sdk::{contracttype, Address, String, Env};

use super::keys::StorageKey;

/// Token configuration for the property tokenization contract
///
/// This structure stores global configuration for the token, including
/// metadata like symbol, name, and admin settings. Storage is optimized
/// by using a single instance per contract.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenConfig {
    /// Token symbol (e.g., "PRPT")
    pub symbol: String,

    /// Token name (e.g., "Property Token")
    pub name: String,

    /// Number of decimal places (typically 7 for Soroban)
    pub decimals: u32,

    /// Admin address with special permissions
    pub admin: Address,

    /// Whether the contract is initialized
    pub initialized: bool,
}

impl TokenConfig {
    /// Creates a new token configuration
    ///
    /// # Arguments
    /// * `symbol` - Token symbol
    /// * `name` - Token name
    /// * `decimals` - Number of decimal places
    /// * `admin` - Admin address
    pub fn new(symbol: String, name: String, decimals: u32, admin: Address) -> Self {
        Self {
            symbol,
            name,
            decimals,
            admin,
            initialized: true,
        }
    }

    /// Stores the token configuration in contract storage
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    pub fn save(&self, env: &Env) {
        let key = StorageKey::TokenConfig;
        env.storage().instance().set(&key, self);
    }

    /// Retrieves token configuration from storage
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    ///
    /// # Returns
    /// * `Option<TokenConfig>` - Configuration if found, None otherwise
    pub fn load(env: &Env) -> Option<TokenConfig> {
        let key = StorageKey::TokenConfig;
        env.storage().instance().get(&key)
    }

    /// Checks if the contract is initialized
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    ///
    /// # Returns
    /// * `bool` - True if initialized, false otherwise
    pub fn is_initialized(env: &Env) -> bool {
        Self::load(env).map_or(false, |config| config.initialized)
    }

    /// Updates the admin address
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `new_admin` - New admin address
    pub fn update_admin(&mut self, env: &Env, new_admin: Address) {
        self.admin = new_admin;
        self.save(env);
    }
}

/// Gets the admin address from storage
///
/// # Arguments
/// * `env` - Soroban environment
///
/// # Returns
/// * `Option<Address>` - Admin address if found, None otherwise
pub fn get_admin(env: &Env) -> Option<Address> {
    TokenConfig::load(env).map(|config| config.admin)
}

/// Sets the admin address in storage
///
/// # Arguments
/// * `env` - Soroban environment
/// * `admin` - Admin address
///
/// # Storage Optimization
/// This uses a dedicated storage key for quick admin lookups
pub fn set_admin(env: &Env, admin: &Address) {
    let key = StorageKey::Admin;
    env.storage().instance().set(&key, admin);
}

/// Gets the property counter for generating unique IDs
///
/// # Arguments
/// * `env` - Soroban environment
///
/// # Returns
/// * `u64` - Current counter value (0 if not set)
pub fn get_property_counter(env: &Env) -> u64 {
    let key = StorageKey::PropertyCounter;
    env.storage().instance().get(&key).unwrap_or(0)
}

/// Increments and returns the next property ID
///
/// # Arguments
/// * `env` - Soroban environment
///
/// # Returns
/// * `u64` - Next available property ID
///
/// # Storage Optimization
/// Counter is stored separately for efficient ID generation
pub fn increment_property_counter(env: &Env) -> u64 {
    let current = get_property_counter(env);
    let next = current.checked_add(1)
        .expect("Property counter overflow");
    let key = StorageKey::PropertyCounter;
    env.storage().instance().set(&key, &next);
    next
}
