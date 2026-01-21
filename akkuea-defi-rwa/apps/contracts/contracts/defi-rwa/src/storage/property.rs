use soroban_sdk::{contracttype, Address, Env, String};

use super::keys::StorageKey;

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
    /// Creates a new property metadata instance
    ///
    /// # Arguments
    /// * `property_id` - Unique property identifier
    /// * `owner` - Address of the property owner
    /// * `name` - Property name
    /// * `description` - Property description
    /// * `location` - Physical location
    /// * `valuation` - Total property valuation
    /// * `total_shares` - Number of shares to create
    /// * `created_at` - Registration timestamp
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

    /// Stores the property metadata in contract storage
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    pub fn save(&self, env: &Env) {
        let key = StorageKey::Property(self.property_id);
        env.storage().instance().set(&key, self);
    }

    /// Retrieves property metadata from storage
    ///
    /// # Arguments
    /// * `env` - Soroban environment
    /// * `property_id` - ID of the property to retrieve
    ///
    /// # Returns
    /// * `Option<PropertyMetadata>` - Property metadata if found, None otherwise
    pub fn load(env: &Env, property_id: u64) -> Option<PropertyMetadata> {
        let key = StorageKey::Property(property_id);
        env.storage().instance().get(&key)
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
        env.storage().instance().remove(&key);
    }
}
