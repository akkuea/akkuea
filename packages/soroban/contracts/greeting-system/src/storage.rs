use soroban_sdk::{contracttype, Address, Env};

use crate::{Error, PremiumTier};
use crate::datatype::{Greeting, BatchUpdate};
use crate::{Error, GreetingReward, PremiumTier, UserProfile};

/// Storage keys for the premium tier system and greetings/batches
#[contracttype]
#[derive(Clone)]
pub enum StorageKey {
    PremiumTier(Address),
    Greeting(u64),
    Batch(u64),
    BatchCounter,
    GreetingReward(u64),
    RewardClaimed(u64),
    UserProfile(Address),
    ReputationContract,
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

/// Save a greeting reward record
pub fn save_greeting_reward(env: &Env, reward: &GreetingReward) -> Result<(), Error> {
    let key = StorageKey::GreetingReward(reward.greeting_id);
    env.storage().persistent().set(&key, reward);
    Ok(())
}

/// Load a greeting reward record
pub fn load_greeting_reward(env: &Env, greeting_id: &u64) -> Option<GreetingReward> {
    let key = StorageKey::GreetingReward(*greeting_id);
    env.storage().persistent().get(&key)
}

/// Mark a greeting as having a reward claimed
pub fn mark_reward_claimed(env: &Env, greeting_id: &u64) {
    let key = StorageKey::RewardClaimed(*greeting_id);
    env.storage().persistent().set(&key, &true);
}

/// Check if a reward has been claimed for a greeting
pub fn is_reward_claimed(env: &Env, greeting_id: &u64) -> bool {
    let key = StorageKey::RewardClaimed(*greeting_id);
    env.storage().persistent().get(&key).unwrap_or(false)
}
/// Save user profile to storage
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

/// Check if a user is registered
pub fn has_user_profile(env: &Env, user: &Address) -> bool {
    let key = StorageKey::UserProfile(user.clone());
    env.storage().persistent().has(&key)
}

/// Set the external reputation contract address
pub fn set_reputation_contract(env: &Env, contract: &Address) -> Result<(), Error> {
    let key = StorageKey::ReputationContract;
    env.storage().persistent().set(&key, contract);
    Ok(())
}

/// Get the external reputation contract address, if set
pub fn get_reputation_contract(env: &Env) -> Option<Address> {
    let key = StorageKey::ReputationContract;
    env.storage().persistent().get(&key)
}
