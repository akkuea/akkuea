use soroban_sdk::{contracttype, Address, Env, String};

use super::keys::StorageKey;

/// TTL bump amounts for property storage (in ledgers)
/// Approximately 1 day = 17280 ledgers (5 second ledger time)
pub mod property_bump {
    /// TTL bump for persistent storage (~30 days)
    pub const PERSISTENT_BUMP: u32 = 518_400;
    /// Threshold before extending TTL (~7 days)
    pub const PERSISTENT_THRESHOLD: u32 = 120_960;
}

/// Property metadata stored on-chain
///
/// This structure contains all essential information about a tokenized property.
/// Fields are optimized for storage cost while maintaining necessary data integrity.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PropertyMetadata {
    /// Unique identifier for the property
    pub property_id: u64,

    /// Address of the property owner/creator
    pub owner: Address,

    /// Property name or title
    pub name: String,

    /// Detailed description of the property
    pub description: String,

    /// Physical location or address
    pub location: String,

    /// Total valuation in base currency units
    pub valuation: i128,

    /// Total number of shares available for this property
    pub total_shares: u64,

    /// Timestamp when the property was registered
    pub created_at: u64,

    /// Whether the property is active for trading
    pub is_active: bool,
}

impl PropertyMetadata {
    /// Creates a new property metadata instance with validation
    ///
    /// # Arguments
    /// * `property_id` - Unique property identifier
    /// * `owner` - Address of the property owner
    /// * `name` - Property name (must not be empty)
    /// * `description` - Property description
    /// * `location` - Physical location (must not be empty)
    /// * `valuation` - Total property valuation (must be positive)
    /// * `total_shares` - Number of shares to create (must be positive)
    /// * `created_at` - Registration timestamp
    ///
    /// # Panics
    /// Panics if validation fails
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        property_id: u64,
        owner: Address,
        name: String,
        description: String,
        location: String,
        valuation: i128,
        total_shares: u64,
        created_at: u64,
    ) -> Self {
        // Validation
        if valuation <= 0 {
            panic!("Property valuation must be positive");
        }
        if total_shares == 0 {
            panic!("Total shares must be greater than zero");
        }

        Self {
            property_id,
            owner,
            name,
            description,
            location,
            valuation,
            total_shares,
            created_at,
            is_active: true,
        }
    }

    /// Stores the property metadata in persistent storage with TTL management
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    pub fn save(&self, env: &Env) {
        let key = StorageKey::Property(self.property_id);
        env.storage().persistent().set(&key, self);
        // Extend TTL to ensure data persists
        env.storage().persistent().extend_ttl(
            &key,
            property_bump::PERSISTENT_THRESHOLD,
            property_bump::PERSISTENT_BUMP,
        );
    }

    /// Retrieves property metadata from storage and extends TTL if found
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `property_id` - ID of the property to retrieve
    ///
    /// # Returns
    /// * `Option<PropertyMetadata>` - Property metadata if found, None otherwise
    pub fn load(env: &Env, property_id: u64) -> Option<PropertyMetadata> {
        let key = StorageKey::Property(property_id);
        let result: Option<PropertyMetadata> = env.storage().persistent().get(&key);

        // Extend TTL on access to keep frequently used data alive
        if result.is_some() {
            env.storage().persistent().extend_ttl(
                &key,
                property_bump::PERSISTENT_THRESHOLD,
                property_bump::PERSISTENT_BUMP,
            );
        }

        result
    }

    /// Checks if a property exists without loading full data
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `property_id` - ID of the property to check
    pub fn exists(env: &Env, property_id: u64) -> bool {
        let key = StorageKey::Property(property_id);
        env.storage().persistent().has(&key)
    }

    /// Updates the active status of the property
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `is_active` - New active status
    pub fn set_active(&mut self, env: &Env, is_active: bool) {
        self.is_active = is_active;
        self.save(env);
    }

    /// Removes property metadata from storage
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `property_id` - ID of the property to remove
    pub fn remove(env: &Env, property_id: u64) {
        let key = StorageKey::Property(property_id);
        env.storage().persistent().remove(&key);
    }
}

/// Gets the available shares for a property
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
///
/// # Returns
/// * `u64` - Number of available shares (0 if not set)
pub fn get_available_shares(env: &Env, property_id: u64) -> u64 {
    let key = StorageKey::AvailableShares(property_id);
    env.storage().instance().get(&key).unwrap_or(0)
}

/// Sets the available shares for a property
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
/// * `available` - Number of available shares
pub fn set_available_shares(env: &Env, property_id: u64, available: u64) {
    let key = StorageKey::AvailableShares(property_id);
    env.storage().instance().set(&key, &available);
}

/// Decreases available shares for a property
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
/// * `amount` - Number of shares to decrease
///
/// # Panics
/// Panics if the subtraction would underflow (insufficient available shares)
pub fn decrease_available_shares(env: &Env, property_id: u64, amount: u64) {
    let current = get_available_shares(env, property_id);
    let new_available = current
        .checked_sub(amount)
        .expect("Insufficient available shares");
    set_available_shares(env, property_id, new_available);
}

/// Gets the price per share for a property
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
///
/// # Returns
/// * `i128` - Price per share (0 if not set)
pub fn get_price_per_share(env: &Env, property_id: u64) -> i128 {
    let key = StorageKey::PricePerShare(property_id);
    env.storage().instance().get(&key).unwrap_or(0)
}

/// Sets the price per share for a property
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
/// * `price` - Price per share (must be positive)
pub fn set_price_per_share(env: &Env, property_id: u64, price: i128) {
    if price <= 0 {
        panic!("Price per share must be positive");
    }
    let key = StorageKey::PricePerShare(property_id);
    env.storage().instance().set(&key, &price);
}

/// Checks if a property is verified
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
///
/// # Returns
/// * `bool` - True if verified, false otherwise
pub fn is_verified(env: &Env, property_id: u64) -> bool {
    let key = StorageKey::PropertyVerified(property_id);
    env.storage().instance().get(&key).unwrap_or(false)
}

/// Sets the verified status for a property
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
/// * `verified` - Verified status
pub fn set_verified(env: &Env, property_id: u64, verified: bool) {
    let key = StorageKey::PropertyVerified(property_id);
    env.storage().instance().set(&key, &verified);
}
