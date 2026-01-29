# C1-011: Add Contract Event Definitions

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                                   |
| --------------- | --------------------------------------- |
| Issue ID        | C1-011                                  |
| Title           | Add contract event definitions          |
| Area            | CONTRACT                                |
| Difficulty      | Medium                                  |
| Labels          | smart-contract, soroban, events, medium |
| Dependencies    | None                                    |
| Estimated Lines | 80-120                                  |

## Overview

Events in Soroban contracts allow external systems to monitor and react to on-chain activities. This issue defines a comprehensive event system for tracking all important state changes.

## Prerequisites

- Understanding of Soroban event system
- Knowledge of event indexing and querying
- Familiarity with contract event best practices

## Implementation Steps

### Step 1: Create Property Events

Create `apps/contracts/contracts/defi-rwa/src/events/property.rs`:

```rust
use soroban_sdk::{symbol_short, Address, Env, String, Symbol};

/// Event topics for property operations
pub struct PropertyEvents;

impl PropertyEvents {
    /// Emitted when a new property is registered
    ///
    /// Topics: ["property_registered", property_id]
    /// Data: (owner, name, total_shares, price_per_share)
    pub fn property_registered(
        env: &Env,
        property_id: &String,
        owner: &Address,
        name: &String,
        total_shares: i128,
        price_per_share: i128,
    ) {
        let topics = (symbol_short!("prop_reg"), property_id.clone());
        env.events().publish(
            topics,
            (owner.clone(), name.clone(), total_shares, price_per_share),
        );
    }

    /// Emitted when a property is verified by admin
    ///
    /// Topics: ["property_verified", property_id]
    /// Data: (verified_by, timestamp)
    pub fn property_verified(
        env: &Env,
        property_id: &String,
        verified_by: &Address,
    ) {
        let topics = (symbol_short!("prop_ver"), property_id.clone());
        let timestamp = env.ledger().timestamp();
        env.events().publish(topics, (verified_by.clone(), timestamp));
    }

    /// Emitted when shares are transferred
    ///
    /// Topics: ["share_transfer", property_id, from]
    /// Data: (to, amount)
    pub fn share_transfer(
        env: &Env,
        property_id: &String,
        from: &Address,
        to: &Address,
        amount: i128,
    ) {
        let topics = (symbol_short!("share_xfr"), property_id.clone(), from.clone());
        env.events().publish(topics, (to.clone(), amount));
    }

    /// Emitted when shares are purchased from pool
    ///
    /// Topics: ["share_purchase", property_id, buyer]
    /// Data: (shares, total_cost)
    pub fn share_purchase(
        env: &Env,
        property_id: &String,
        buyer: &Address,
        shares: i128,
        total_cost: i128,
    ) {
        let topics = (symbol_short!("share_buy"), property_id.clone(), buyer.clone());
        env.events().publish(topics, (shares, total_cost));
    }

    /// Emitted when shares are sold back to pool
    ///
    /// Topics: ["share_sale", property_id, seller]
    /// Data: (shares, proceeds)
    pub fn share_sale(
        env: &Env,
        property_id: &String,
        seller: &Address,
        shares: i128,
        proceeds: i128,
    ) {
        let topics = (symbol_short!("share_sel"), property_id.clone(), seller.clone());
        env.events().publish(topics, (shares, proceeds));
    }

    /// Emitted when dividends are distributed
    ///
    /// Topics: ["dividend", property_id]
    /// Data: (total_amount, per_share_amount, timestamp)
    pub fn dividend_distributed(
        env: &Env,
        property_id: &String,
        total_amount: i128,
        per_share_amount: i128,
    ) {
        let topics = (symbol_short!("dividend"), property_id.clone());
        let timestamp = env.ledger().timestamp();
        env.events()
            .publish(topics, (total_amount, per_share_amount, timestamp));
    }

    /// Emitted when dividends are claimed
    ///
    /// Topics: ["dividend_claim", property_id, claimer]
    /// Data: (amount)
    pub fn dividend_claimed(
        env: &Env,
        property_id: &String,
        claimer: &Address,
        amount: i128,
    ) {
        let topics = (
            symbol_short!("div_claim"),
            property_id.clone(),
            claimer.clone(),
        );
        env.events().publish(topics, amount);
    }
}
```

### Step 2: Create Lending Events

Create `apps/contracts/contracts/defi-rwa/src/events/lending.rs`:

```rust
use soroban_sdk::{symbol_short, Address, Env, String};

/// Event topics for lending operations
pub struct LendingEvents;

impl LendingEvents {
    /// Emitted when a new lending pool is created
    ///
    /// Topics: ["pool_created", pool_id]
    /// Data: (asset, asset_address, collateral_factor)
    pub fn pool_created(
        env: &Env,
        pool_id: &String,
        asset: &String,
        asset_address: &Address,
        collateral_factor: i128,
    ) {
        let topics = (symbol_short!("pool_new"), pool_id.clone());
        env.events().publish(
            topics,
            (asset.clone(), asset_address.clone(), collateral_factor),
        );
    }

    /// Emitted when assets are deposited into a pool
    ///
    /// Topics: ["deposit", pool_id, depositor]
    /// Data: (amount, shares_minted, new_total_deposits)
    pub fn deposit(
        env: &Env,
        pool_id: &String,
        depositor: &Address,
        amount: i128,
        shares_minted: i128,
        new_total_deposits: i128,
    ) {
        let topics = (symbol_short!("deposit"), pool_id.clone(), depositor.clone());
        env.events()
            .publish(topics, (amount, shares_minted, new_total_deposits));
    }

    /// Emitted when assets are withdrawn from a pool
    ///
    /// Topics: ["withdraw", pool_id, withdrawer]
    /// Data: (amount, shares_burned, new_total_deposits)
    pub fn withdraw(
        env: &Env,
        pool_id: &String,
        withdrawer: &Address,
        amount: i128,
        shares_burned: i128,
        new_total_deposits: i128,
    ) {
        let topics = (symbol_short!("withdraw"), pool_id.clone(), withdrawer.clone());
        env.events()
            .publish(topics, (amount, shares_burned, new_total_deposits));
    }

    /// Emitted when assets are borrowed from a pool
    ///
    /// Topics: ["borrow", pool_id, borrower]
    /// Data: (amount, collateral_amount, collateral_asset, health_factor)
    pub fn borrow(
        env: &Env,
        pool_id: &String,
        borrower: &Address,
        amount: i128,
        collateral_amount: i128,
        collateral_asset: &Address,
        health_factor: i128,
    ) {
        let topics = (symbol_short!("borrow"), pool_id.clone(), borrower.clone());
        env.events().publish(
            topics,
            (amount, collateral_amount, collateral_asset.clone(), health_factor),
        );
    }

    /// Emitted when a loan is repaid
    ///
    /// Topics: ["repay", pool_id, borrower]
    /// Data: (amount, remaining_debt, collateral_released)
    pub fn repay(
        env: &Env,
        pool_id: &String,
        borrower: &Address,
        amount: i128,
        remaining_debt: i128,
        collateral_released: i128,
    ) {
        let topics = (symbol_short!("repay"), pool_id.clone(), borrower.clone());
        env.events()
            .publish(topics, (amount, remaining_debt, collateral_released));
    }

    /// Emitted when a position is liquidated
    ///
    /// Topics: ["liquidate", pool_id, borrower]
    /// Data: (liquidator, debt_repaid, collateral_seized, penalty)
    pub fn liquidation(
        env: &Env,
        pool_id: &String,
        borrower: &Address,
        liquidator: &Address,
        debt_repaid: i128,
        collateral_seized: i128,
        penalty: i128,
    ) {
        let topics = (symbol_short!("liquidate"), pool_id.clone(), borrower.clone());
        env.events().publish(
            topics,
            (liquidator.clone(), debt_repaid, collateral_seized, penalty),
        );
    }

    /// Emitted when interest is accrued
    ///
    /// Topics: ["accrue", pool_id]
    /// Data: (interest_accrued, new_index, reserves_added, timestamp)
    pub fn interest_accrued(
        env: &Env,
        pool_id: &String,
        interest_accrued: i128,
        new_index: i128,
        reserves_added: i128,
    ) {
        let topics = (symbol_short!("accrue"), pool_id.clone());
        let timestamp = env.ledger().timestamp();
        env.events()
            .publish(topics, (interest_accrued, new_index, reserves_added, timestamp));
    }

    /// Emitted when pool parameters are updated
    ///
    /// Topics: ["pool_update", pool_id]
    /// Data: (parameter_name, old_value, new_value)
    pub fn pool_updated(
        env: &Env,
        pool_id: &String,
        parameter: &String,
        old_value: i128,
        new_value: i128,
    ) {
        let topics = (symbol_short!("pool_upd"), pool_id.clone());
        env.events()
            .publish(topics, (parameter.clone(), old_value, new_value));
    }

    /// Emitted when pool is paused/unpaused
    ///
    /// Topics: ["pool_pause", pool_id]
    /// Data: (paused, by_admin)
    pub fn pool_pause_toggled(
        env: &Env,
        pool_id: &String,
        paused: bool,
        by_admin: &Address,
    ) {
        let topics = (symbol_short!("pool_pse"), pool_id.clone());
        env.events().publish(topics, (paused, by_admin.clone()));
    }
}
```

### Step 3: Create Events Module Index

Create `apps/contracts/contracts/defi-rwa/src/events/mod.rs`:

```rust
//! Events module for DeFi RWA contracts
//!
//! This module defines all events emitted by the contracts.
//! Events are indexed and can be queried by off-chain services.

mod lending;
mod property;

pub use lending::LendingEvents;
pub use property::PropertyEvents;
```

### Step 4: Update Main Library

Update `apps/contracts/contracts/defi-rwa/src/lib.rs`:

```rust
#![no_std]

mod events;
mod lending;
mod storage;

pub use events::*;
pub use lending::*;
pub use storage::*;
```

## Usage Example

```rust
use crate::events::{PropertyEvents, LendingEvents};

// In property registration function
pub fn register_property(env: Env, /* params */) {
    // ... registration logic ...

    // Emit event
    PropertyEvents::property_registered(
        &env,
        &property_id,
        &owner,
        &name,
        total_shares,
        price_per_share,
    );
}

// In deposit function
pub fn deposit(env: Env, pool_id: String, amount: i128) {
    // ... deposit logic ...

    // Emit event
    LendingEvents::deposit(
        &env,
        &pool_id,
        &depositor,
        amount,
        shares_minted,
        new_total,
    );
}
```

## Testing Guidelines

### Unit Test Example

```rust
#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Events, Address, Env, String, IntoVal};

#[test]
fn test_property_registered_event() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let property_id = String::from_str(&env, "PROP001");
    let name = String::from_str(&env, "Test Property");

    PropertyEvents::property_registered(
        &env,
        &property_id,
        &owner,
        &name,
        1000,
        1000_00,
    );

    let events = env.events().all();
    assert_eq!(events.len(), 1);

    // Verify event data
    let event = events.get(0).unwrap();
    // Event verification logic...
}

#[test]
fn test_deposit_event() {
    let env = Env::default();
    let depositor = Address::generate(&env);
    let pool_id = String::from_str(&env, "USDC-POOL");

    LendingEvents::deposit(
        &env,
        &pool_id,
        &depositor,
        1000_000_000,
        1000_000_000,
        5000_000_000,
    );

    let events = env.events().all();
    assert_eq!(events.len(), 1);
}
```

## Related Resources

| Resource             | Link                                              |
| -------------------- | ------------------------------------------------- |
| Soroban Events       | https://soroban.stellar.org/docs/learn/events     |
| Event Best Practices | https://soroban.stellar.org/docs/tutorials/events |

## Verification Checklist

| Item                     | Status |
| ------------------------ | ------ |
| Property events defined  |        |
| Lending events defined   |        |
| Events module created    |        |
| Helper functions working |        |
| Unit tests passing       |        |
| Documentation complete   |        |
