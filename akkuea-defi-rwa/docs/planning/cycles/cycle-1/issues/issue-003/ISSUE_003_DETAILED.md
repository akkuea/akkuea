# C1-003: Implement Property Token Storage Structures

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                                       |
| --------------- | ------------------------------------------- |
| Issue ID        | C1-003                                      |
| Title           | Implement property token storage structures |
| Area            | CONTRACT                                    |
| Difficulty      | High                                        |
| Labels          | smart-contract, soroban, high               |
| Dependencies    | None                                        |
| Estimated Lines | 250-350                                     |

## Overview

This issue establishes the storage layer for property tokenization on Soroban. Proper storage design is critical for gas efficiency and contract upgradability.

## Prerequisites

- Rust and Cargo installed
- Soroban CLI installed
- Understanding of Soroban storage model (Instance, Persistent, Temporary)

## Implementation Steps

### Step 1: Create Storage Module Structure

```
apps/contracts/contracts/defi-rwa/src/
├── storage/
│   ├── mod.rs
│   ├── keys.rs
│   ├── property.rs
│   ├── shares.rs
│   └── config.rs
└── lib.rs
```

### Step 2: Define Storage Keys

Create `apps/contracts/contracts/defi-rwa/src/storage/keys.rs`:

```rust
use soroban_sdk::{contracttype, Address, String};

/// Storage key types for the property token contract.
/// Using enums ensures type-safe, collision-free storage access.
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Contract administrator address
    /// Storage: Instance
    Admin,

    /// Global token configuration
    /// Storage: Instance
    TokenConfig,

    /// Property metadata by property ID
    /// Storage: Persistent
    Property(String),

    /// Share balance for a specific owner and property
    /// Storage: Persistent
    ShareBalance(Address, String),

    /// Total shares issued for a property
    /// Storage: Persistent
    TotalShares(String),

    /// List of all property IDs
    /// Storage: Persistent
    PropertyList,

    /// Total number of properties registered
    /// Storage: Instance
    PropertyCount,

    /// Whether a property ID exists
    /// Storage: Persistent
    PropertyExists(String),

    /// Allowance for share transfers
    /// Storage: Temporary
    Allowance(Address, Address, String),

    /// Nonce for replay protection
    /// Storage: Persistent
    Nonce(Address),
}

/// Storage bump amounts for different data types
pub mod bump_amount {
    /// Instance storage bump (admin, config)
    pub const INSTANCE_BUMP: u32 = 518400; // ~60 days

    /// Persistent storage bump (balances, properties)
    pub const PERSISTENT_BUMP: u32 = 2592000; // ~300 days

    /// Temporary storage bump (allowances)
    pub const TEMPORARY_BUMP: u32 = 120960; // ~14 days
}
```

### Step 3: Define Property Storage Types

Create `apps/contracts/contracts/defi-rwa/src/storage/property.rs`:

```rust
use soroban_sdk::{contracttype, Address, Env, String, Vec};

use super::keys::{bump_amount, DataKey};

/// Property type classification
#[derive(Clone, PartialEq)]
#[contracttype]
pub enum PropertyType {
    Residential,
    Commercial,
    Industrial,
    Land,
    Mixed,
}

/// Geographic location of the property
#[derive(Clone)]
#[contracttype]
pub struct PropertyLocation {
    /// Street address
    pub address: String,
    /// City name
    pub city: String,
    /// Country code (ISO 3166-1 alpha-2)
    pub country: String,
    /// Optional postal code
    pub postal_code: String,
}

/// Core property metadata stored on-chain
#[derive(Clone)]
#[contracttype]
pub struct PropertyMetadata {
    /// Unique property identifier
    pub id: String,
    /// Human-readable property name
    pub name: String,
    /// Property type classification
    pub property_type: PropertyType,
    /// Geographic location
    pub location: PropertyLocation,
    /// Total property value in base units (e.g., cents)
    pub total_value: i128,
    /// Total number of shares for this property
    pub total_shares: i128,
    /// Price per share in base units
    pub price_per_share: i128,
    /// Whether property is verified by admin
    pub verified: bool,
    /// Timestamp when property was registered
    pub registered_at: u64,
    /// Original property owner address
    pub owner: Address,
    /// IPFS hash for off-chain documents
    pub documents_hash: String,
}

/// Helper functions for property storage operations
pub struct PropertyStorage;

impl PropertyStorage {
    /// Store property metadata
    pub fn set(env: &Env, property: &PropertyMetadata) {
        let key = DataKey::Property(property.id.clone());
        env.storage().persistent().set(&key, property);
        env.storage()
            .persistent()
            .extend_ttl(&key, bump_amount::PERSISTENT_BUMP, bump_amount::PERSISTENT_BUMP);

        // Mark property as existing
        let exists_key = DataKey::PropertyExists(property.id.clone());
        env.storage().persistent().set(&exists_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&exists_key, bump_amount::PERSISTENT_BUMP, bump_amount::PERSISTENT_BUMP);
    }

    /// Retrieve property metadata by ID
    pub fn get(env: &Env, property_id: &String) -> Option<PropertyMetadata> {
        let key = DataKey::Property(property_id.clone());
        if env.storage().persistent().has(&key) {
            env.storage()
                .persistent()
                .extend_ttl(&key, bump_amount::PERSISTENT_BUMP, bump_amount::PERSISTENT_BUMP);
            env.storage().persistent().get(&key)
        } else {
            None
        }
    }

    /// Check if property exists
    pub fn exists(env: &Env, property_id: &String) -> bool {
        let key = DataKey::PropertyExists(property_id.clone());
        env.storage().persistent().has(&key)
    }

    /// Update property verification status
    pub fn set_verified(env: &Env, property_id: &String, verified: bool) {
        if let Some(mut property) = Self::get(env, property_id) {
            property.verified = verified;
            Self::set(env, &property);
        }
    }

    /// Get total property count
    pub fn get_count(env: &Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::PropertyCount)
            .unwrap_or(0)
    }

    /// Increment property count
    pub fn increment_count(env: &Env) {
        let count = Self::get_count(env) + 1;
        env.storage().instance().set(&DataKey::PropertyCount, &count);
    }

    /// Add property ID to list
    pub fn add_to_list(env: &Env, property_id: &String) {
        let key = DataKey::PropertyList;
        let mut list: Vec<String> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env));
        list.push_back(property_id.clone());
        env.storage().persistent().set(&key, &list);
        env.storage()
            .persistent()
            .extend_ttl(&key, bump_amount::PERSISTENT_BUMP, bump_amount::PERSISTENT_BUMP);
    }

    /// Get all property IDs
    pub fn get_list(env: &Env) -> Vec<String> {
        let key = DataKey::PropertyList;
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env))
    }
}
```

### Step 4: Define Share Balance Storage

Create `apps/contracts/contracts/defi-rwa/src/storage/shares.rs`:

```rust
use soroban_sdk::{Address, Env, String};

use super::keys::{bump_amount, DataKey};

/// Share balance storage operations
pub struct ShareStorage;

impl ShareStorage {
    /// Get share balance for an owner and property
    pub fn get_balance(env: &Env, owner: &Address, property_id: &String) -> i128 {
        let key = DataKey::ShareBalance(owner.clone(), property_id.clone());
        if env.storage().persistent().has(&key) {
            env.storage()
                .persistent()
                .extend_ttl(&key, bump_amount::PERSISTENT_BUMP, bump_amount::PERSISTENT_BUMP);
            env.storage().persistent().get(&key).unwrap_or(0)
        } else {
            0
        }
    }

    /// Set share balance for an owner and property
    pub fn set_balance(env: &Env, owner: &Address, property_id: &String, balance: i128) {
        let key = DataKey::ShareBalance(owner.clone(), property_id.clone());
        if balance > 0 {
            env.storage().persistent().set(&key, &balance);
            env.storage()
                .persistent()
                .extend_ttl(&key, bump_amount::PERSISTENT_BUMP, bump_amount::PERSISTENT_BUMP);
        } else {
            // Remove zero balances to save storage
            env.storage().persistent().remove(&key);
        }
    }

    /// Add to share balance (mint or transfer in)
    pub fn add_balance(env: &Env, owner: &Address, property_id: &String, amount: i128) {
        let current = Self::get_balance(env, owner, property_id);
        Self::set_balance(env, owner, property_id, current + amount);
    }

    /// Subtract from share balance (burn or transfer out)
    /// Returns true if successful, false if insufficient balance
    pub fn sub_balance(env: &Env, owner: &Address, property_id: &String, amount: i128) -> bool {
        let current = Self::get_balance(env, owner, property_id);
        if current < amount {
            return false;
        }
        Self::set_balance(env, owner, property_id, current - amount);
        true
    }

    /// Get total shares issued for a property
    pub fn get_total_shares(env: &Env, property_id: &String) -> i128 {
        let key = DataKey::TotalShares(property_id.clone());
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    /// Set total shares for a property
    pub fn set_total_shares(env: &Env, property_id: &String, total: i128) {
        let key = DataKey::TotalShares(property_id.clone());
        env.storage().persistent().set(&key, &total);
        env.storage()
            .persistent()
            .extend_ttl(&key, bump_amount::PERSISTENT_BUMP, bump_amount::PERSISTENT_BUMP);
    }

    /// Get allowance for share transfers
    pub fn get_allowance(
        env: &Env,
        owner: &Address,
        spender: &Address,
        property_id: &String,
    ) -> i128 {
        let key = DataKey::Allowance(owner.clone(), spender.clone(), property_id.clone());
        env.storage().temporary().get(&key).unwrap_or(0)
    }

    /// Set allowance for share transfers
    pub fn set_allowance(
        env: &Env,
        owner: &Address,
        spender: &Address,
        property_id: &String,
        amount: i128,
    ) {
        let key = DataKey::Allowance(owner.clone(), spender.clone(), property_id.clone());
        if amount > 0 {
            env.storage().temporary().set(&key, &amount);
            env.storage()
                .temporary()
                .extend_ttl(&key, bump_amount::TEMPORARY_BUMP, bump_amount::TEMPORARY_BUMP);
        } else {
            env.storage().temporary().remove(&key);
        }
    }

    /// Spend allowance (reduce after transfer)
    pub fn spend_allowance(
        env: &Env,
        owner: &Address,
        spender: &Address,
        property_id: &String,
        amount: i128,
    ) -> bool {
        let current = Self::get_allowance(env, owner, spender, property_id);
        if current < amount {
            return false;
        }
        Self::set_allowance(env, owner, spender, property_id, current - amount);
        true
    }
}
```

### Step 5: Define Token Config Storage

Create `apps/contracts/contracts/defi-rwa/src/storage/config.rs`:

```rust
use soroban_sdk::{contracttype, Address, Env};

use super::keys::{bump_amount, DataKey};

/// Global token configuration
#[derive(Clone)]
#[contracttype]
pub struct TokenConfig {
    /// Contract administrator
    pub admin: Address,
    /// Whether contract is paused
    pub paused: bool,
    /// Minimum shares per property
    pub min_shares: i128,
    /// Maximum shares per property
    pub max_shares: i128,
    /// Fee percentage in basis points (100 = 1%)
    pub fee_bps: u32,
    /// Fee recipient address
    pub fee_recipient: Address,
    /// Whether new registrations are allowed
    pub registrations_open: bool,
}

/// Config storage helper
pub struct ConfigStorage;

impl ConfigStorage {
    /// Initialize token configuration
    pub fn initialize(env: &Env, config: &TokenConfig) {
        env.storage().instance().set(&DataKey::TokenConfig, config);
        env.storage().instance().set(&DataKey::Admin, &config.admin);
        env.storage()
            .instance()
            .extend_ttl(bump_amount::INSTANCE_BUMP, bump_amount::INSTANCE_BUMP);
    }

    /// Get token configuration
    pub fn get(env: &Env) -> Option<TokenConfig> {
        env.storage()
            .instance()
            .extend_ttl(bump_amount::INSTANCE_BUMP, bump_amount::INSTANCE_BUMP);
        env.storage().instance().get(&DataKey::TokenConfig)
    }

    /// Update token configuration
    pub fn set(env: &Env, config: &TokenConfig) {
        env.storage().instance().set(&DataKey::TokenConfig, config);
    }

    /// Get admin address
    pub fn get_admin(env: &Env) -> Option<Address> {
        env.storage()
            .instance()
            .extend_ttl(bump_amount::INSTANCE_BUMP, bump_amount::INSTANCE_BUMP);
        env.storage().instance().get(&DataKey::Admin)
    }

    /// Set admin address
    pub fn set_admin(env: &Env, admin: &Address) {
        env.storage().instance().set(&DataKey::Admin, admin);
    }

    /// Check if contract is paused
    pub fn is_paused(env: &Env) -> bool {
        Self::get(env).map(|c| c.paused).unwrap_or(false)
    }

    /// Set pause state
    pub fn set_paused(env: &Env, paused: bool) {
        if let Some(mut config) = Self::get(env) {
            config.paused = paused;
            Self::set(env, &config);
        }
    }

    /// Get nonce for an address (replay protection)
    pub fn get_nonce(env: &Env, address: &Address) -> u64 {
        let key = DataKey::Nonce(address.clone());
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    /// Increment and return nonce
    pub fn increment_nonce(env: &Env, address: &Address) -> u64 {
        let key = DataKey::Nonce(address.clone());
        let nonce = Self::get_nonce(env, address) + 1;
        env.storage().persistent().set(&key, &nonce);
        env.storage()
            .persistent()
            .extend_ttl(&key, bump_amount::PERSISTENT_BUMP, bump_amount::PERSISTENT_BUMP);
        nonce
    }
}
```

### Step 6: Create Storage Module Index

Create `apps/contracts/contracts/defi-rwa/src/storage/mod.rs`:

```rust
//! Storage module for the property token contract.
//!
//! This module contains all storage-related types and helpers for
//! managing on-chain state in a gas-efficient manner.

mod config;
mod keys;
mod property;
mod shares;

pub use config::{ConfigStorage, TokenConfig};
pub use keys::{bump_amount, DataKey};
pub use property::{PropertyLocation, PropertyMetadata, PropertyStorage, PropertyType};
pub use shares::ShareStorage;
```

### Step 7: Update Main Library

Update `apps/contracts/contracts/defi-rwa/src/lib.rs`:

```rust
#![no_std]

mod storage;

pub use storage::*;

use soroban_sdk::{contract, contractimpl, Env};

#[contract]
pub struct PropertyTokenContract;

#[contractimpl]
impl PropertyTokenContract {
    /// Initialize the contract with configuration
    pub fn initialize(env: Env, config: TokenConfig) {
        if ConfigStorage::get(&env).is_some() {
            panic!("Contract already initialized");
        }
        ConfigStorage::initialize(&env, &config);
    }

    /// Check if contract is initialized
    pub fn is_initialized(env: Env) -> bool {
        ConfigStorage::get(&env).is_some()
    }
}
```

## Testing Guidelines

### Unit Test Example

```rust
#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn test_property_storage() {
    let env = Env::default();
    let admin = Address::generate(&env);

    let property = PropertyMetadata {
        id: String::from_str(&env, "PROP001"),
        name: String::from_str(&env, "Test Property"),
        property_type: PropertyType::Residential,
        location: PropertyLocation {
            address: String::from_str(&env, "123 Main St"),
            city: String::from_str(&env, "New York"),
            country: String::from_str(&env, "US"),
            postal_code: String::from_str(&env, "10001"),
        },
        total_value: 1_000_000_00, // $1M in cents
        total_shares: 1000,
        price_per_share: 1_000_00, // $1000 in cents
        verified: false,
        registered_at: 1700000000,
        owner: admin.clone(),
        documents_hash: String::from_str(&env, "QmHash..."),
    };

    PropertyStorage::set(&env, &property);

    let retrieved = PropertyStorage::get(&env, &property.id).unwrap();
    assert_eq!(retrieved.name, property.name);
    assert_eq!(retrieved.total_shares, 1000);
}

#[test]
fn test_share_balance() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let property_id = String::from_str(&env, "PROP001");

    // Initial balance should be 0
    assert_eq!(ShareStorage::get_balance(&env, &owner, &property_id), 0);

    // Add balance
    ShareStorage::add_balance(&env, &owner, &property_id, 100);
    assert_eq!(ShareStorage::get_balance(&env, &owner, &property_id), 100);

    // Subtract balance
    let success = ShareStorage::sub_balance(&env, &owner, &property_id, 30);
    assert!(success);
    assert_eq!(ShareStorage::get_balance(&env, &owner, &property_id), 70);

    // Attempt to subtract more than balance
    let fail = ShareStorage::sub_balance(&env, &owner, &property_id, 100);
    assert!(!fail);
    assert_eq!(ShareStorage::get_balance(&env, &owner, &property_id), 70);
}
```

## Related Resources

| Resource                      | Link                                                                      |
| ----------------------------- | ------------------------------------------------------------------------- |
| Soroban Storage Documentation | https://soroban.stellar.org/docs/learn/persisting-data                    |
| Soroban SDK Reference         | https://docs.rs/soroban-sdk/latest/soroban_sdk/                           |
| Storage Best Practices        | https://soroban.stellar.org/docs/fundamentals-and-concepts/state-archival |

## Verification Checklist

| Item                        | Status |
| --------------------------- | ------ |
| All storage structs defined |        |
| Storage keys are unique     |        |
| TTL extensions implemented  |        |
| Helper functions complete   |        |
| Unit tests passing          |        |
| cargo clippy clean          |        |
| Documentation complete      |        |
