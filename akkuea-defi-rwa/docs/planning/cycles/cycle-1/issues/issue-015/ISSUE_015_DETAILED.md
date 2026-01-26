# C1-015: Implement Admin Access Control Module

## Detailed Implementation Guide

## Issue Metadata

| Attribute | Value |
|-----------|-------|
| Issue ID | C1-015 |
| Title | Implement admin access control module |
| Area | CONTRACT |
| Difficulty | Medium |
| Labels | smart-contract, soroban, security, medium |
| Dependencies | None |
| Estimated Lines | 100-150 |

## Overview

Access control is critical for smart contract security. This module provides admin management, role-based access control, and emergency pause capabilities for the DeFi RWA contracts.

## Prerequisites

- Understanding of Soroban authorization
- Knowledge of smart contract security patterns
- Familiarity with role-based access control (RBAC)

## Implementation Steps

### Step 1: Create Role Definitions

Create `apps/contracts/contracts/defi-rwa/src/access/roles.rs`:

```rust
use soroban_sdk::{contracttype, Address, Env, Vec};

/// Contract roles
#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum Role {
    /// Full administrative privileges
    Admin,
    /// Can pause/unpause contracts
    Pauser,
    /// Can update oracle prices
    Oracle,
    /// Can verify properties
    Verifier,
    /// Can execute liquidations
    Liquidator,
}

/// Storage key for roles
#[derive(Clone)]
#[contracttype]
pub enum RoleKey {
    /// Single admin address
    Admin,
    /// Contract pause state
    Paused,
    /// Address has specific role
    HasRole(Address, Role),
    /// All addresses with a specific role
    RoleMembers(Role),
    /// Pending admin (for 2-step transfer)
    PendingAdmin,
}

/// Role storage helpers
pub struct RoleStorage;

impl RoleStorage {
    /// Check if address has a specific role
    pub fn has_role(env: &Env, address: &Address, role: &Role) -> bool {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().instance().get(&key).unwrap_or(false)
    }

    /// Grant role to address
    pub fn grant_role(env: &Env, address: &Address, role: &Role) {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().instance().set(&key, &true);

        // Add to role members list
        let members_key = RoleKey::RoleMembers(role.clone());
        let mut members: Vec<Address> = env
            .storage()
            .instance()
            .get(&members_key)
            .unwrap_or(Vec::new(env));

        // Check if already exists
        let mut exists = false;
        for i in 0..members.len() {
            if members.get(i).unwrap() == address.clone() {
                exists = true;
                break;
            }
        }

        if !exists {
            members.push_back(address.clone());
            env.storage().instance().set(&members_key, &members);
        }
    }

    /// Revoke role from address
    pub fn revoke_role(env: &Env, address: &Address, role: &Role) {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().instance().remove(&key);

        // Remove from role members list
        let members_key = RoleKey::RoleMembers(role.clone());
        if let Some(members) = env
            .storage()
            .instance()
            .get::<RoleKey, Vec<Address>>(&members_key)
        {
            let mut new_members: Vec<Address> = Vec::new(env);
            for i in 0..members.len() {
                let member = members.get(i).unwrap();
                if member != address.clone() {
                    new_members.push_back(member);
                }
            }
            env.storage().instance().set(&members_key, &new_members);
        }
    }

    /// Get all addresses with a specific role
    pub fn get_role_members(env: &Env, role: &Role) -> Vec<Address> {
        let key = RoleKey::RoleMembers(role.clone());
        env.storage()
            .instance()
            .get(&key)
            .unwrap_or(Vec::new(env))
    }
}
```

### Step 2: Create Admin Management

Create `apps/contracts/contracts/defi-rwa/src/access/admin.rs`:

```rust
use soroban_sdk::{Address, Env};

use super::roles::{Role, RoleKey, RoleStorage};

/// Admin management errors
#[derive(Debug)]
pub enum AdminError {
    NotAdmin,
    NotPendingAdmin,
    AlreadyInitialized,
    ZeroAddress,
}

/// Admin storage and management
pub struct AdminControl;

impl AdminControl {
    /// Initialize admin (can only be called once)
    pub fn initialize(env: &Env, admin: &Address) {
        if Self::is_initialized(env) {
            panic!("Admin already initialized");
        }

        env.storage().instance().set(&RoleKey::Admin, admin);
        RoleStorage::grant_role(env, admin, &Role::Admin);
    }

    /// Check if admin is initialized
    pub fn is_initialized(env: &Env) -> bool {
        env.storage().instance().has(&RoleKey::Admin)
    }

    /// Get current admin address
    pub fn get_admin(env: &Env) -> Option<Address> {
        env.storage().instance().get(&RoleKey::Admin)
    }

    /// Check if address is admin
    pub fn is_admin(env: &Env, address: &Address) -> bool {
        match Self::get_admin(env) {
            Some(admin) => admin == address.clone(),
            None => false,
        }
    }

    /// Require caller to be admin (panics if not)
    pub fn require_admin(env: &Env, caller: &Address) {
        if !Self::is_admin(env, caller) {
            panic!("Caller is not admin");
        }
    }

    /// Start two-step admin transfer
    pub fn transfer_admin_start(env: &Env, current_admin: &Address, new_admin: &Address) {
        Self::require_admin(env, current_admin);
        env.storage().instance().set(&RoleKey::PendingAdmin, new_admin);
    }

    /// Accept admin transfer (called by new admin)
    pub fn transfer_admin_accept(env: &Env, new_admin: &Address) {
        let pending: Option<Address> = env.storage().instance().get(&RoleKey::PendingAdmin);

        match pending {
            Some(pending_admin) if pending_admin == new_admin.clone() => {
                // Get old admin and revoke role
                if let Some(old_admin) = Self::get_admin(env) {
                    RoleStorage::revoke_role(env, &old_admin, &Role::Admin);
                }

                // Set new admin
                env.storage().instance().set(&RoleKey::Admin, new_admin);
                RoleStorage::grant_role(env, new_admin, &Role::Admin);

                // Clear pending
                env.storage().instance().remove(&RoleKey::PendingAdmin);
            }
            _ => panic!("Caller is not pending admin"),
        }
    }

    /// Cancel pending admin transfer
    pub fn transfer_admin_cancel(env: &Env, current_admin: &Address) {
        Self::require_admin(env, current_admin);
        env.storage().instance().remove(&RoleKey::PendingAdmin);
    }

    /// Get pending admin
    pub fn get_pending_admin(env: &Env) -> Option<Address> {
        env.storage().instance().get(&RoleKey::PendingAdmin)
    }
}

/// Pause control
pub struct PauseControl;

impl PauseControl {
    /// Check if contract is paused
    pub fn is_paused(env: &Env) -> bool {
        env.storage()
            .instance()
            .get(&RoleKey::Paused)
            .unwrap_or(false)
    }

    /// Pause contract (admin or pauser only)
    pub fn pause(env: &Env, caller: &Address) {
        Self::require_can_pause(env, caller);
        env.storage().instance().set(&RoleKey::Paused, &true);
    }

    /// Unpause contract (admin only)
    pub fn unpause(env: &Env, caller: &Address) {
        AdminControl::require_admin(env, caller);
        env.storage().instance().set(&RoleKey::Paused, &false);
    }

    /// Require contract is not paused
    pub fn require_not_paused(env: &Env) {
        if Self::is_paused(env) {
            panic!("Contract is paused");
        }
    }

    /// Check if address can pause
    fn require_can_pause(env: &Env, caller: &Address) {
        let is_admin = AdminControl::is_admin(env, caller);
        let is_pauser = RoleStorage::has_role(env, caller, &Role::Pauser);

        if !is_admin && !is_pauser {
            panic!("Caller cannot pause");
        }
    }
}
```

### Step 3: Create Access Module Index

Create `apps/contracts/contracts/defi-rwa/src/access/mod.rs`:

```rust
//! Access control module for DeFi RWA contracts
//!
//! Provides admin management, role-based access control, and pause functionality.

mod admin;
mod roles;

pub use admin::{AdminControl, PauseControl};
pub use roles::{Role, RoleKey, RoleStorage};

use soroban_sdk::{Address, Env};

/// Convenience macros and functions for access control

/// Require caller to have a specific role
pub fn require_role(env: &Env, caller: &Address, role: &Role) {
    if !RoleStorage::has_role(env, caller, role) {
        panic!("Caller does not have required role");
    }
}

/// Require caller to be admin or have specific role
pub fn require_admin_or_role(env: &Env, caller: &Address, role: &Role) {
    let is_admin = AdminControl::is_admin(env, caller);
    let has_role = RoleStorage::has_role(env, caller, role);

    if !is_admin && !has_role {
        panic!("Caller is not authorized");
    }
}

/// Combined check: not paused and has authorization
pub fn require_active_and_authorized(env: &Env, caller: &Address, role: Option<&Role>) {
    PauseControl::require_not_paused(env);

    match role {
        Some(r) => require_admin_or_role(env, caller, r),
        None => AdminControl::require_admin(env, caller),
    }
}
```

### Step 4: Update Main Library

Update `apps/contracts/contracts/defi-rwa/src/lib.rs`:

```rust
#![no_std]

mod access;
mod events;
mod lending;
mod storage;

pub use access::*;
pub use events::*;
pub use lending::*;
pub use storage::*;
```

## Usage Example

```rust
use crate::access::{AdminControl, PauseControl, Role, RoleStorage, require_role};

#[contractimpl]
impl PropertyTokenContract {
    /// Initialize contract with admin
    pub fn initialize(env: Env, admin: Address) {
        AdminControl::initialize(&env, &admin);
    }

    /// Verify property (verifier role required)
    pub fn verify_property(env: Env, caller: Address, property_id: String) {
        caller.require_auth();
        PauseControl::require_not_paused(&env);
        require_role(&env, &caller, &Role::Verifier);

        // ... verification logic ...
    }

    /// Pause contract (admin or pauser)
    pub fn pause(env: Env, caller: Address) {
        caller.require_auth();
        PauseControl::pause(&env, &caller);
    }

    /// Grant role (admin only)
    pub fn grant_role(env: Env, admin: Address, account: Address, role: Role) {
        admin.require_auth();
        AdminControl::require_admin(&env, &admin);
        RoleStorage::grant_role(&env, &account, &role);
    }
}
```

## Testing Guidelines

### Unit Test Example

```rust
#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_admin_initialization() {
    let env = Env::default();
    let admin = Address::generate(&env);

    AdminControl::initialize(&env, &admin);

    assert!(AdminControl::is_admin(&env, &admin));
    assert!(AdminControl::is_initialized(&env));
}

#[test]
#[should_panic(expected = "Caller is not admin")]
fn test_require_admin_fails() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let other = Address::generate(&env);

    AdminControl::initialize(&env, &admin);
    AdminControl::require_admin(&env, &other);
}

#[test]
fn test_admin_transfer() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);

    AdminControl::initialize(&env, &admin);

    // Start transfer
    AdminControl::transfer_admin_start(&env, &admin, &new_admin);
    assert_eq!(AdminControl::get_pending_admin(&env), Some(new_admin.clone()));

    // Accept transfer
    AdminControl::transfer_admin_accept(&env, &new_admin);
    assert!(AdminControl::is_admin(&env, &new_admin));
    assert!(!AdminControl::is_admin(&env, &admin));
}

#[test]
fn test_pause_unpause() {
    let env = Env::default();
    let admin = Address::generate(&env);

    AdminControl::initialize(&env, &admin);

    assert!(!PauseControl::is_paused(&env));

    PauseControl::pause(&env, &admin);
    assert!(PauseControl::is_paused(&env));

    PauseControl::unpause(&env, &admin);
    assert!(!PauseControl::is_paused(&env));
}
```

## Related Resources

| Resource | Link |
|----------|------|
| Soroban Authorization | https://soroban.stellar.org/docs/learn/authorization |
| OpenZeppelin AccessControl | https://docs.openzeppelin.com/contracts/access-control |

## Verification Checklist

| Item | Status |
|------|--------|
| Admin initialization working | |
| Admin transfer working | |
| Role management working | |
| Pause/unpause working | |
| Authorization checks working | |
| Unit tests passing | |
