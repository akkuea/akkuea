use soroban_sdk::{contracttype, Address, Env};

use crate::{Error, PremiumTier};
use crate::datatype::{Greeting, BatchUpdate, UserProfile, Interaction};

/// Storage keys for the premium tier system and greetings/batches
#[contracttype]
#[derive(Clone)]
pub enum StorageKey {
    PremiumTier(Address),
    Greeting(u64),
    Batch(u64),
    BatchCounter,
    UserProfile(Address),  // Add this variant
    Interaction(u64),  // Interaction data keyed by greeting_id
}

/// Save a premium tier to storage
pub fn save_premium_tier(env: &Env, tier: &PremiumTier) -> Result<(), Error> {
    let key = StorageKey::PremiumTier(tier.user.clone());
    env.storage().persistent().set(&key, tier);
    Ok(())
}

/// Load a premium tier from storage
pub fn load_premium_tier(env: &Env, user: &Address) -> Result<PremiumTier, Error> {
    let key = StorageKey::PremiumTier(user.clone());
    env.storage()
        .persistent()
        .get(&key)
        .ok_or(Error::TierNotFound)
}

/// Check if a user has a premium tier
pub fn has_premium_tier(env: &Env, user: &Address) -> bool {
    let key = StorageKey::PremiumTier(user.clone());
    env.storage().persistent().has(&key)
}

/// Remove a premium tier from storage
pub fn remove_premium_tier(env: &Env, user: &Address) -> Result<(), Error> {
    let key = StorageKey::PremiumTier(user.clone());
    env.storage().persistent().remove(&key);
    Ok(())
}

/// Read a greeting from storage
pub fn read_greeting(env: &Env, id: u64) -> Result<Greeting, Error> {
    let key = StorageKey::Greeting(id);
    env.storage()
        .persistent()
        .get(&key)
        .ok_or(Error::UnauthorizedGreeting) // Map to a custom Error if needed, e.g., add NotFound variant
}

/// Write a greeting to storage
pub fn write_greeting(env: &Env, greeting: &Greeting) -> Result<(), Error> {
    let key = StorageKey::Greeting(greeting.id);
    env.storage().persistent().set(&key, greeting);
    Ok(())
}

/// Read a batch update record from storage
pub fn read_batch(env: &Env, batch_id: u64) -> Result<BatchUpdate, Error> {
    let key = StorageKey::Batch(batch_id);
    env.storage()
        .persistent()
        .get(&key)
        .ok_or(Error::BatchNotFound)
}

/// Write a batch update record to storage
pub fn write_batch(env: &Env, batch: &BatchUpdate) -> Result<(), Error> {
    let key = StorageKey::Batch(batch.batch_id);
    env.storage().persistent().set(&key, batch);
    Ok(())
}

/// Get the next available batch ID (auto-increments)
pub fn next_batch_id(env: &Env) -> u64 {
    let counter_key = StorageKey::BatchCounter;
    let mut counter: u64 = env.storage()
        .persistent()
        .get(&counter_key)
        .unwrap_or(0);
    counter += 1;
    env.storage().persistent().set(&counter_key, &counter);
    counter
}

/// Check if a user has a profile
pub fn has_user_profile(env: &Env, user: &Address) -> bool {
    let key = StorageKey::UserProfile(user.clone());
    env.storage().persistent().has(&key)
}

/// Save a user profile to storage
pub fn save_user_profile(env: &Env, profile: &UserProfile) -> Result<(), Error> {
    let key = StorageKey::UserProfile(profile.user.clone());
    env.storage().persistent().set(&key, profile);
    Ok(())
}

/// Load a user profile from storage
pub fn load_user_profile(env: &Env, user: &Address) -> Result<UserProfile, Error> {
    let key = StorageKey::UserProfile(user.clone());
    env.storage()
        .persistent()
        .get(&key)
        .ok_or(Error::UserNotFound)
}

/// Check if an interaction exists for a greeting
pub fn has_interaction(env: &Env, greeting_id: u64) -> bool {
    let key = StorageKey::Interaction(greeting_id);
    env.storage().persistent().has(&key)
}

/// Save interaction data to storage
pub fn save_interaction(env: &Env, interaction: &Interaction) -> Result<(), Error> {
    let key = StorageKey::Interaction(interaction.greeting_id);
    env.storage().persistent().set(&key, interaction);
    Ok(())
}

/// Load interaction data from storage
pub fn load_interaction(env: &Env, greeting_id: u64) -> Result<Interaction, Error> {
    let key = StorageKey::Interaction(greeting_id);
    env.storage()
        .persistent()
        .get(&key)
        .ok_or(Error::GreetingNotFound)
}
