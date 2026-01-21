use soroban_sdk::{Address, Env};

use super::keys::StorageKey;

/// Share balance tracking for property ownership
///
/// This module manages the ownership of property shares. Each balance entry
/// represents how many shares a specific address owns for a given property.
/// Storage is optimized by using composite keys (property_id, owner_address).

/// Gets the share balance for a specific owner and property
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
/// * `owner` - Address of the share owner
///
/// # Returns
/// * `u64` - Number of shares owned (0 if no balance exists)
pub fn get_balance(env: &Env, property_id: u64, owner: &Address) -> u64 {
    let key = StorageKey::ShareBalance(property_id, owner.clone());
    env.storage().instance().get(&key).unwrap_or(0)
}

/// Sets the share balance for a specific owner and property
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
/// * `owner` - Address of the share owner
/// * `balance` - New balance amount
///
/// # Storage Optimization
/// If balance is 0, the storage entry is removed to save costs
pub fn set_balance(env: &Env, property_id: u64, owner: &Address, balance: u64) {
    let key = StorageKey::ShareBalance(property_id, owner.clone());

    if balance == 0 {
        // Remove storage entry to save costs when balance is zero
        env.storage().instance().remove(&key);
    } else {
        env.storage().instance().set(&key, &balance);
    }
}

/// Increases the share balance for an owner
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
/// * `owner` - Address of the share owner
/// * `amount` - Number of shares to add
///
/// # Panics
/// Panics if the addition would overflow u64
pub fn increase_balance(env: &Env, property_id: u64, owner: &Address, amount: u64) {
    let current = get_balance(env, property_id, owner);
    let new_balance = current.checked_add(amount)
        .expect("Share balance overflow");
    set_balance(env, property_id, owner, new_balance);
}

/// Decreases the share balance for an owner
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
/// * `owner` - Address of the share owner
/// * `amount` - Number of shares to subtract
///
/// # Panics
/// Panics if the subtraction would underflow (insufficient balance)
pub fn decrease_balance(env: &Env, property_id: u64, owner: &Address, amount: u64) {
    let current = get_balance(env, property_id, owner);
    let new_balance = current.checked_sub(amount)
        .expect("Insufficient share balance");
    set_balance(env, property_id, owner, new_balance);
}

/// Gets the total shares issued for a property
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
///
/// # Returns
/// * `u64` - Total shares issued (0 if not set)
pub fn get_total_shares(env: &Env, property_id: u64) -> u64 {
    let key = StorageKey::TotalShares(property_id);
    env.storage().instance().get(&key).unwrap_or(0)
}

/// Sets the total shares for a property
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
/// * `total` - Total number of shares
pub fn set_total_shares(env: &Env, property_id: u64, total: u64) {
    let key = StorageKey::TotalShares(property_id);
    env.storage().instance().set(&key, &total);
}

/// Transfers shares from one owner to another
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
/// * `from` - Address of the sender
/// * `to` - Address of the recipient
/// * `amount` - Number of shares to transfer
///
/// # Panics
/// Panics if sender has insufficient balance
pub fn transfer_shares(
    env: &Env,
    property_id: u64,
    from: &Address,
    to: &Address,
    amount: u64,
) {
    decrease_balance(env, property_id, from, amount);
    increase_balance(env, property_id, to, amount);
}
