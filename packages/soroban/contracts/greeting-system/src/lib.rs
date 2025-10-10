#![no_std]
extern crate alloc;
use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};

mod batch;
mod datatype;
mod error;
mod events;
mod interactions;
mod interface;
mod storage;
mod utils;
mod roles;

pub use batch::*;
pub use datatype::*;
pub use error::*;
pub use events::*;
pub use interactions::*;
pub use interface::*;
pub use storage::*;
pub use utils::*;
pub use roles::*;

// Move the storage use to top level (impl no fit hold use statements)
// But since pub use storage::*, the fns like has_premium_tier dey direct in scope—no need extra use

#[contract]
pub struct GreetingSystem;

#[contractimpl]
impl GreetingSystem {
    // ==================== Premium Tier Functions ====================

    /// Assign a premium tier to a user based on their contribution
    pub fn assign_premium_tier(
        env: Env,
        user: Address,
        contribution: i128,
    ) -> Result<(), Error> {
        verify_user_authorization(&env, &user)?;
        validate_contribution(contribution)?;

        if has_premium_tier(&env, &user) {
            return Err(Error::TierAlreadyExists);
        }

        let tier_level = TierLevel::from_contribution(contribution);
        let features = tier_level.get_features();
        let timestamp = get_current_timestamp(&env);

        let premium_tier = PremiumTier {
            user: user.clone(),
            tier: tier_level.clone(),
            contribution,
            assigned_at: timestamp,
            features,
        };

        save_premium_tier(&env, &premium_tier)?;

        let event = TierAssignmentEvent {
            user: user.clone(),
            tier: tier_level,
            contribution,
            timestamp,
        };
        emit_tier_assigned(&env, &event)?;

        Ok(())
    }

    /// Upgrade a user's premium tier with additional contribution
    pub fn upgrade_premium_tier(
        env: Env,
        user: Address,
        additional_contribution: i128,
    ) -> Result<(), Error> {
        verify_user_authorization(&env, &user)?;
        validate_contribution(additional_contribution)?;

        let mut existing_tier = load_premium_tier(&env, &user)?;
        let new_total_contribution = existing_tier.contribution + additional_contribution;
        let new_tier_level = TierLevel::from_contribution(new_total_contribution);

        if new_tier_level < existing_tier.tier {
            return Err(Error::DowngradeNotAllowed);
        }

        let old_tier = existing_tier.tier.clone();
        existing_tier.tier = new_tier_level.clone();
        existing_tier.contribution = new_total_contribution;
        existing_tier.features = new_tier_level.get_features();

        save_premium_tier(&env, &existing_tier)?;

        let timestamp = get_current_timestamp(&env);
        let event = TierUpgradeEvent {
            user: user.clone(),
            old_tier,
            new_tier: new_tier_level,
            contribution: new_total_contribution,
            timestamp,
        };
        emit_tier_upgraded(&env, &event)?;

        Ok(())
    }

    /// Get the premium status of a user
    pub fn get_premium_status(env: Env, user: Address) -> Result<PremiumTier, Error> {
        load_premium_tier(&env, &user)
    }

    /// Get features available to a user
    pub fn get_user_features(env: Env, user: Address) -> Result<PremiumFeatures, Error> {
        let tier = load_premium_tier(&env, &user)?;
        Ok(tier.features)
    }

    /// Get the tier level of a user
    pub fn get_tier_level(env: Env, user: Address) -> Result<TierLevel, Error> {
        let tier = load_premium_tier(&env, &user)?;
        Ok(tier.tier)
    }

    /// Get the total contribution amount for a user
    pub fn get_total_contribution(env: Env, user: Address) -> Result<i128, Error> {
        let tier = load_premium_tier(&env, &user)?;
        Ok(tier.contribution)
    }

    // ==================== Batch Operation Functions ====================
    
    /// Batch update multiple greetings in a single transaction
    pub fn batch_update_greetings(
        env: Env,
        user: Address,
        greeting_ids: Vec<u64>,
        updates: Vec<String>,
    ) -> Result<u64, Error> {
        batch::batch_update_greetings(&env, user, greeting_ids, updates)
    }

    /// Get the status of a batch update operation
    pub fn get_batch_status(env: Env, batch_id: u64) -> Result<BatchUpdate, Error> {
        batch::get_batch_status(&env, batch_id)
    }

    /// Create a new greeting (helper function)
    pub fn create_greeting(
        env: Env,
        greeting_id: u64,
        text: String,
        creator: Address,
    ) -> Result<(), Error> {
        batch::create_greeting(&env, greeting_id, text, creator)
    }

    // ==================== User Profile Functions ====================

    /// Register a new user profile
    pub fn register_user(
        env: Env,
        user: Address,
        name: String,
        preferences: String,
    ) -> Result<(), Error> {
        verify_user_authorization(&env, &user)?;

        // Optional: Add validation for name/preferences if needed
        if name.is_empty() {
            return Err(Error::InvalidName);
        }
        if preferences.is_empty() {
            return Err(Error::InvalidPreferences);
        }

        if has_user_profile(&env, &user) {
            return Err(Error::UserAlreadyRegistered);
        }

        let profile = UserProfile {
            user: user.clone(),
            name,
            preferences,
        };

        save_user_profile(&env, &profile)?;

        Ok(())
    }

    /// Get a user's profile
    pub fn get_user_profile(env: Env, user: Address) -> Result<UserProfile, Error> {
        load_user_profile(&env, &user)
    }

    /// Initialize the contract with an owner who becomes the first admin
    pub fn initialize_roles(env: Env, owner: Address) -> Result<(), Error> {
        verify_user_authorization(&env, &owner)?;
        roles::initialize_owner(&env, &owner)
    }

    /// Assign a role to a user (Admin only)
    pub fn assign_role(
        env: Env,
        caller: Address,
        user: Address,
        role: String,
    ) -> Result<(), Error> {
        verify_user_authorization(&env, &caller)?;
        roles::require_admin(&env, &caller)?;

        let role_enum = Role::from_string(&env, &role)?;
        roles::set_role_internal(&env, &user, role_enum, &caller)
    }

    /// Get the role of a user
    pub fn get_role(env: Env, user: Address) -> String {
        let role = roles::get_role_internal(&env, &user);
        role.to_string(&env)
    }

    /// Remove a role from a user (set to None) - Admin only
    pub fn revoke_role(env: Env, caller: Address, user: Address) -> Result<(), Error> {
        verify_user_authorization(&env, &caller)?;
        roles::require_admin(&env, &caller)?;

        // Prevent owner from revoking their own admin role
        let owner = roles::get_owner(&env)?;
        if user == owner {
            return Err(Error::CannotRevokeOwnerRole);
        }

        roles::set_role_internal(&env, &user, Role::None, &caller)
    }

    /// Check if a user has a specific role
    pub fn has_role(env: Env, user: Address, role: String) -> Result<bool, Error> {
        let role_enum = Role::from_string(&env, &role)?;
        Ok(roles::has_role(&env, &user, &role_enum))
    }

    /// Get the contract owner
    pub fn get_contract_owner(env: Env) -> Result<Address, Error> {
        roles::get_owner(&env)
    }

    /// Check if caller is admin (helper for other functions)
    pub fn is_admin(env: Env, user: Address) -> bool {
        roles::has_role(&env, &user, &Role::Admin)
    
    // ==================== Interaction Functions ====================

    /// Like a greeting
    pub fn like_greeting(env: Env, user: Address, greeting_id: u64) -> Result<(), Error> {
        interactions::like_greeting(&env, user, greeting_id)
    }

    /// Add a comment to a greeting
    pub fn add_comment(
        env: Env,
        user: Address,
        greeting_id: u64,
        text: String,
    ) -> Result<(), Error> {
        interactions::add_comment(&env, user, greeting_id, text)
    }

    /// Get interaction data for a greeting
    pub fn get_interaction(env: Env, greeting_id: u64) -> Result<Interaction, Error> {
        interactions::get_interaction(&env, greeting_id)
    }

    /// Get the number of likes for a greeting
    pub fn get_likes_count(env: Env, greeting_id: u64) -> Result<u32, Error> {
        interactions::get_likes_count(&env, greeting_id)
    }

    /// Get the number of comments for a greeting
    pub fn get_comments_count(env: Env, greeting_id: u64) -> Result<u32, Error> {
        interactions::get_comments_count(&env, greeting_id)
    }
} 


#[cfg(test)]
mod test;
