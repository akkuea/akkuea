use crate::access::ContractError;
use crate::lending::lending_bump;
use soroban_sdk::{Address, Env};

use super::keys::StorageKey;

// Share balance tracking for property ownership
//
// This module manages the ownership of property shares. Each balance entry
// represents how many shares a specific address owns for a given property.
// Storage is optimized by using composite keys (property_id, owner_address).

/// Extends the TTL of a persistent share balance entry if it exists.
///
/// Follows the lending module's Persistent bump constant so balances do not
/// expire between interactions.
fn bump_balance_ttl(env: &Env, key: &StorageKey) {
    if env.storage().persistent().has(key) {
        env.storage().persistent().extend_ttl(
            key,
            lending_bump::PERSISTENT_BUMP,
            lending_bump::PERSISTENT_BUMP,
        );
    }
}

/// Extends the TTL of a persistent allowance entry if it exists.
fn bump_allowance_ttl(env: &Env, key: &StorageKey) {
    if env.storage().persistent().has(key) {
        env.storage().persistent().extend_ttl(
            key,
            lending_bump::PERSISTENT_BUMP,
            lending_bump::PERSISTENT_BUMP,
        );
    }
}

/// Gets the share balance for a specific owner and property
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
/// * `owner` - Address of the share owner
///
/// # Returns
/// * `u64` - Number of shares owned (0 if no balance exists)
#[allow(dead_code)]
pub fn get_balance(env: &Env, property_id: u64, owner: &Address) -> u64 {
    let key = StorageKey::ShareBalance(property_id, owner.clone());
    // Critical read: extend TTL on access so active balances never expire.
    bump_balance_ttl(env, &key);
    env.storage().persistent().get(&key).unwrap_or_default()
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
#[allow(dead_code)]
pub fn set_balance(env: &Env, property_id: u64, owner: &Address, balance: u64) {
    let key = StorageKey::ShareBalance(property_id, owner.clone());

    if balance == 0 {
        // Remove storage entry to save costs when balance is zero
        env.storage().persistent().remove(&key);
    } else {
        env.storage().persistent().set(&key, &balance);
        // Extend TTL on write so the entry survives between interactions.
        env.storage().persistent().extend_ttl(
            &key,
            lending_bump::PERSISTENT_BUMP,
            lending_bump::PERSISTENT_BUMP,
        );
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
/// # Errors
/// Returns `ContractError::BalanceOverflow` if the addition would overflow u64
#[allow(dead_code)]
pub fn increase_balance(
    env: &Env,
    property_id: u64,
    owner: &Address,
    amount: u64,
) -> Result<u64, ContractError> {
    let current = get_balance(env, property_id, owner);
    let new_balance = current
        .checked_add(amount)
        .ok_or(ContractError::BalanceOverflow)?;
    set_balance(env, property_id, owner, new_balance);
    Ok(new_balance)
}

/// Decreases the share balance for an owner
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
/// * `owner` - Address of the share owner
/// * `amount` - Number of shares to subtract
///
/// # Errors
/// Returns `ContractError::InsufficientBalance` if the balance is insufficient
#[allow(dead_code)]
pub fn decrease_balance(
    env: &Env,
    property_id: u64,
    owner: &Address,
    amount: u64,
) -> Result<u64, ContractError> {
    let current = get_balance(env, property_id, owner);
    let new_balance = current
        .checked_sub(amount)
        .ok_or(ContractError::InsufficientBalance)?;
    set_balance(env, property_id, owner, new_balance);
    Ok(new_balance)
}

/// Gets the total shares issued for a property
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
///
/// # Returns
/// * `u64` - Total shares issued (0 if not set)
#[allow(dead_code)]
pub fn get_total_shares(env: &Env, property_id: u64) -> u64 {
    let key = StorageKey::TotalShares(property_id);
    env.storage().persistent().get(&key).unwrap_or_default()
}

/// Sets the total shares for a property
///
/// # Arguments
/// * `env` - Soroban environment
/// * `property_id` - ID of the property
/// * `total` - Total number of shares
#[allow(dead_code)]
pub fn set_total_shares(env: &Env, property_id: u64, total: u64) {
    let key = StorageKey::TotalShares(property_id);
    env.storage().persistent().set(&key, &total);
    env.storage().persistent().extend_ttl(
        &key,
        lending_bump::PERSISTENT_BUMP,
        lending_bump::PERSISTENT_BUMP,
    );
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
/// # Errors
/// Returns `ContractError::InsufficientBalance` if sender has insufficient balance
/// Returns `ContractError::BalanceOverflow` if recipient balance would overflow
#[allow(dead_code)]
pub fn transfer_shares(
    env: &Env,
    property_id: u64,
    from: &Address,
    to: &Address,
    amount: u64,
) -> Result<u64, ContractError> {
    decrease_balance(env, property_id, from, amount)?;
    increase_balance(env, property_id, to, amount)
}

/// Helper to get approved allowance
#[allow(dead_code)]
pub fn get_allowance(env: &Env, property_id: u64, owner: &Address, spender: &Address) -> u64 {
    let key = StorageKey::Allowance(property_id, owner.clone(), spender.clone());
    // Critical read: extend TTL on access.
    bump_allowance_ttl(env, &key);
    env.storage().persistent().get(&key).unwrap_or_default()
}

/// Helper to set approved allowance
#[allow(dead_code)]
pub fn set_allowance(env: &Env, property_id: u64, owner: &Address, spender: &Address, amount: u64) {
    let key = StorageKey::Allowance(property_id, owner.clone(), spender.clone());
    if amount == 0 {
        env.storage().persistent().remove(&key);
    } else {
        env.storage().persistent().set(&key, &amount);
        // Extend TTL on write.
        env.storage().persistent().extend_ttl(
            &key,
            lending_bump::PERSISTENT_BUMP,
            lending_bump::PERSISTENT_BUMP,
        );
    }
}

/// Helper to consume approved allowance
///
/// # Errors
/// Returns `ContractError::InsufficientAllowance` if allowance is insufficient
#[allow(dead_code)]
pub fn spend_allowance(
    env: &Env,
    property_id: u64,
    owner: &Address,
    spender: &Address,
    amount: u64,
) -> Result<u64, ContractError> {
    let current_allowance = get_allowance(env, property_id, owner, spender);
    let new_allowance = current_allowance
        .checked_sub(amount)
        .ok_or(ContractError::InsufficientAllowance)?;
    set_allowance(env, property_id, owner, spender, new_allowance);
    Ok(new_allowance)
}
