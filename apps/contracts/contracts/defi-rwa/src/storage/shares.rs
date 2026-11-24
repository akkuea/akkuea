use crate::access::ContractError;
use soroban_sdk::{Address, Env};

use super::keys::StorageKey;

/// TTL constants for share and allowance persistent entries (#1411).
/// Values mirror the lending module's `lending_bump` constants.
pub mod shares_bump {
    /// Extend to ~300 days on write (matches lending persistent entries).
    pub const PERSISTENT_BUMP: u32 = 2_592_000;
    /// Extend when reading in a critical path (e.g. transfer, spend_allowance).
    pub const PERSISTENT_THRESHOLD: u32 = 1_296_000; // ~150 days
}

/// Share balance tracking for property ownership
///
/// This module manages the ownership of property shares. Each balance entry
/// represents how many shares a specific address owns for a given property.
/// Storage is optimised by using composite keys (property_id, owner_address).

/// Gets the share balance for a specific owner and property
#[allow(dead_code)]
pub fn get_balance(env: &Env, property_id: u64, owner: &Address) -> u64 {
    let key = StorageKey::ShareBalance(property_id, owner.clone());
    env.storage().persistent().get(&key).unwrap_or(0)
}

/// Sets the share balance for a specific owner and property.
///
/// Extends the persistent TTL on every non-zero write so entries do not expire
/// while the holder still owns shares (#1411).
#[allow(dead_code)]
pub fn set_balance(env: &Env, property_id: u64, owner: &Address, balance: u64) {
    let key = StorageKey::ShareBalance(property_id, owner.clone());

    if balance == 0 {
        // Remove the storage entry to save costs when the balance reaches zero.
        env.storage().persistent().remove(&key);
    } else {
        env.storage().persistent().set(&key, &balance);
        env.storage().persistent().extend_ttl(
            &key,
            shares_bump::PERSISTENT_THRESHOLD,
            shares_bump::PERSISTENT_BUMP,
        );
    }
}

/// Increases the share balance for an owner.
///
/// # Errors
/// Returns `ContractError::BalanceOverflow` if the addition would overflow u64.
#[allow(dead_code)]
pub fn increase_balance(
    env: &Env,
    property_id: u64,
    owner: &Address,
    amount: u64,
) -> Result<(), ContractError> {
    let current = get_balance(env, property_id, owner);
    let new_balance = current
        .checked_add(amount)
        .ok_or(ContractError::BalanceOverflow)?;
    set_balance(env, property_id, owner, new_balance);
    Ok(())
}

/// Decreases the share balance for an owner.
///
/// # Errors
/// Returns `ContractError::InsufficientBalance` if the balance is insufficient.
#[allow(dead_code)]
pub fn decrease_balance(
    env: &Env,
    property_id: u64,
    owner: &Address,
    amount: u64,
) -> Result<(), ContractError> {
    let current = get_balance(env, property_id, owner);
    let new_balance = current
        .checked_sub(amount)
        .ok_or(ContractError::InsufficientBalance)?;
    set_balance(env, property_id, owner, new_balance);
    Ok(())
}

/// Gets the total shares issued for a property.
#[allow(dead_code)]
pub fn get_total_shares(env: &Env, property_id: u64) -> u64 {
    let key = StorageKey::TotalShares(property_id);
    env.storage().persistent().get(&key).unwrap_or(0)
}

/// Sets the total shares for a property and bumps the TTL.
#[allow(dead_code)]
pub fn set_total_shares(env: &Env, property_id: u64, total: u64) {
    let key = StorageKey::TotalShares(property_id);
    env.storage().persistent().set(&key, &total);
    env.storage().persistent().extend_ttl(
        &key,
        shares_bump::PERSISTENT_THRESHOLD,
        shares_bump::PERSISTENT_BUMP,
    );
}

/// Transfers shares from one owner to another.
///
/// # Errors
/// Returns `ContractError::InsufficientBalance` if sender has insufficient balance.
/// Returns `ContractError::BalanceOverflow` if recipient balance would overflow.
#[allow(dead_code)]
pub fn transfer_shares(
    env: &Env,
    property_id: u64,
    from: &Address,
    to: &Address,
    amount: u64,
) -> Result<(), ContractError> {
    decrease_balance(env, property_id, from, amount)?;
    increase_balance(env, property_id, to, amount)?;
    Ok(())
}

/// Gets the approved allowance for a spender on an owner's shares.
#[allow(dead_code)]
pub fn get_allowance(env: &Env, property_id: u64, owner: &Address, spender: &Address) -> u64 {
    let key = StorageKey::Allowance(property_id, owner.clone(), spender.clone());
    env.storage().persistent().get(&key).unwrap_or(0)
}

/// Sets the approved allowance for a spender.
///
/// Extends the persistent TTL on every non-zero write (#1411).
#[allow(dead_code)]
pub fn set_allowance(env: &Env, property_id: u64, owner: &Address, spender: &Address, amount: u64) {
    let key = StorageKey::Allowance(property_id, owner.clone(), spender.clone());
    if amount == 0 {
        env.storage().persistent().remove(&key);
    } else {
        env.storage().persistent().set(&key, &amount);
        env.storage().persistent().extend_ttl(
            &key,
            shares_bump::PERSISTENT_THRESHOLD,
            shares_bump::PERSISTENT_BUMP,
        );
    }
}

/// Consumes an approved allowance.
///
/// # Errors
/// Returns `ContractError::InsufficientAllowance` if the allowance is too small.
#[allow(dead_code)]
pub fn spend_allowance(
    env: &Env,
    property_id: u64,
    owner: &Address,
    spender: &Address,
    amount: u64,
) -> Result<(), ContractError> {
    let current_allowance = get_allowance(env, property_id, owner, spender);
    // Bump TTL on the allowance entry when it is read in a critical path so an
    // active spender's allowance does not expire between approval and use.
    if current_allowance > 0 {
        let key = StorageKey::Allowance(property_id, owner.clone(), spender.clone());
        env.storage().persistent().extend_ttl(
            &key,
            shares_bump::PERSISTENT_THRESHOLD,
            shares_bump::PERSISTENT_BUMP,
        );
    }
    let new_allowance = current_allowance
        .checked_sub(amount)
        .ok_or(ContractError::InsufficientAllowance)?;
    set_allowance(env, property_id, owner, spender, new_allowance);
    Ok(())
}
