use soroban_sdk::{contracttype, symbol_short, Address, Env, String, Symbol};

use crate::error::Error;
use crate::datatype::{TierAssignmentEvent, TierUpgradeEvent, TierLevel, OperationStatus};
use crate::{Error, GreetingReward, TierAssignmentEvent, TierLevel, TierUpgradeEvent, UserProfile};

/// Event symbol for tier assignment
pub const TIER_ASSIGNED: Symbol = symbol_short!("TIER_ASGN");

/// Event symbol for tier upgrade
pub const TIER_UPGRADED: Symbol = symbol_short!("TIER_UPG");

/// Event symbol for tier downgrade (if allowed in future)
pub const TIER_DOWNGRADED: Symbol = symbol_short!("TIER_DWN");

/// Event symbol for greeting reward issuance
pub const GREETING_REWARD: Symbol = symbol_short!("GRT_RWD");
/// Event symbol for user registration
pub const USER_REGISTERED: Symbol = symbol_short!("USR_REG");

/// Emit a tier assignment event
pub fn emit_tier_assigned(env: &Env, event: &TierAssignmentEvent) -> Result<(), Error> {
    let tier_str = event.tier.to_str();

    env.events().publish(
        (TIER_ASSIGNED, symbol_short!("assigned")),
        (
            event.user.clone(),
            String::from_str(env, tier_str),
            event.contribution,
            event.timestamp,
        ),
    );

    Ok(())
}

/// Emit a tier upgrade event
pub fn emit_tier_upgraded(env: &Env, event: &TierUpgradeEvent) -> Result<(), Error> {
    let old_tier_str = event.old_tier.to_str();
    let new_tier_str = event.new_tier.to_str();

    env.events().publish(
        (TIER_UPGRADED, symbol_short!("upgraded")),
        (
            event.user.clone(),
            String::from_str(env, old_tier_str),
            String::from_str(env, new_tier_str),
            event.contribution,
            event.timestamp,
        ),
    );

    Ok(())
}

/// Emit a greeting reward issuance event
pub fn emit_greeting_reward(env: &Env, reward: &GreetingReward) -> Result<(), Error> {
    env.events().publish(
        (GREETING_REWARD, symbol_short!("issued")),
        (
            reward.greeting_id,
            reward.creator.clone(),
            reward.token_amount,
            reward.timestamp,
        ),
    );
    Ok(())
}

/// Emit a tier downgrade event
pub fn emit_tier_downgraded(
    env: &Env,
    user: &Address,
    old_tier: &TierLevel,
    new_tier: &TierLevel,
    timestamp: u64,
) -> Result<(), Error> {
    let old_tier_str = old_tier.to_str();
    let new_tier_str = new_tier.to_str();

    env.events().publish(
        (TIER_DOWNGRADED, symbol_short!("downgrade")),
        (
            user.clone(),
            String::from_str(env, old_tier_str),
            String::from_str(env, new_tier_str),
            timestamp,
        ),
    );

    Ok(())
}

/// Emit a user registration event
pub fn emit_user_registered(env: &Env, profile: &UserProfile) -> Result<(), Error> {
    env.events().publish(
        (USER_REGISTERED, symbol_short!("reg")),
        (
            profile.user.clone(),
            profile.name.clone(),
            profile.preferences.clone(),
            profile.registered_at,
        ),
    );
    Ok(())
}

/// Event for batch update initiation/completion.
#[contracttype]
#[derive(Clone)]
pub struct BatchUpdateEvent {
    pub batch_id: u64,
    pub num_greetings: u32,
    pub status: OperationStatus,
    pub processed_by: Address,
}

/// Emit batch update event.
pub fn emit_batch_update(env: &Env, event: &BatchUpdateEvent) -> Result<(), crate::Error> {
    // Fix: Use two symbols for topics (no b""—change to symbol_short!)
    env.events().publish(
        (symbol_short!("batch_upd"), symbol_short!("update")),
        event.clone(),
    );
    Ok(())
}