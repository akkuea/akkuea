# C1-007: Implement Lending Pool Storage Structures

## Detailed Implementation Guide

## Issue Metadata

| Attribute       | Value                                     |
| --------------- | ----------------------------------------- |
| Issue ID        | C1-007                                    |
| Title           | Implement lending pool storage structures |
| Area            | CONTRACT                                  |
| Difficulty      | High                                      |
| Labels          | smart-contract, soroban, high             |
| Dependencies    | None                                      |
| Estimated Lines | 300-400                                   |

## Overview

This issue establishes the storage layer for the DeFi lending protocol on Soroban. The lending module requires precise tracking of pools, positions, and interest accrual to ensure correct financial operations.

## Prerequisites

- Rust and Cargo installed
- Soroban CLI installed
- Understanding of DeFi lending mechanics
- Knowledge of fixed-point arithmetic

## Implementation Steps

### Step 1: Create Lending Storage Keys

Create `apps/contracts/contracts/defi-rwa/src/lending/keys.rs`:

```rust
use soroban_sdk::{contracttype, Address, String};

/// Storage key types for the lending module
#[derive(Clone)]
#[contracttype]
pub enum LendingKey {
    /// Lending pool configuration
    /// Storage: Persistent
    Pool(String),

    /// List of all pool IDs
    /// Storage: Persistent
    PoolList,

    /// Total number of pools
    /// Storage: Instance
    PoolCount,

    /// Deposit position for user in pool
    /// Storage: Persistent
    DepositPosition(Address, String),

    /// Borrow position for user in pool
    /// Storage: Persistent
    BorrowPosition(Address, String),

    /// User's deposit positions list
    /// Storage: Persistent
    UserDeposits(Address),

    /// User's borrow positions list
    /// Storage: Persistent
    UserBorrows(Address),

    /// Pool's total deposits
    /// Storage: Persistent
    PoolTotalDeposits(String),

    /// Pool's total borrows
    /// Storage: Persistent
    PoolTotalBorrows(String),

    /// Pool's accumulated interest index
    /// Storage: Persistent
    PoolInterestIndex(String),

    /// Last accrual timestamp
    /// Storage: Persistent
    PoolLastAccrual(String),

    /// Reserve balance for pool
    /// Storage: Persistent
    PoolReserves(String),

    /// Interest rate model parameters
    /// Storage: Instance
    InterestRateModel(String),

    /// Global lending configuration
    /// Storage: Instance
    LendingConfig,

    /// Pool pause status
    /// Storage: Instance
    PoolPaused(String),
}

/// TTL bump amounts for lending storage
pub mod lending_bump {
    pub const INSTANCE_BUMP: u32 = 518400; // ~60 days
    pub const PERSISTENT_BUMP: u32 = 2592000; // ~300 days
}
```

### Step 2: Define Interest Rate Model

Create `apps/contracts/contracts/defi-rwa/src/lending/interest.rs`:

```rust
use soroban_sdk::{contracttype, Env, String};

use super::keys::{lending_bump, LendingKey};

/// Precision for fixed-point calculations (18 decimals)
pub const PRECISION: i128 = 1_000_000_000_000_000_000;

/// Seconds per year for APY calculations
pub const SECONDS_PER_YEAR: u64 = 31_536_000;

/// Interest rate model parameters
/// Uses linear model: rate = base + (utilization * slope)
#[derive(Clone)]
#[contracttype]
pub struct InterestRateModel {
    /// Base rate (in PRECISION units, e.g., 2% = 0.02 * PRECISION)
    pub base_rate: i128,
    /// Slope below optimal utilization
    pub slope1: i128,
    /// Slope above optimal utilization
    pub slope2: i128,
    /// Optimal utilization rate (e.g., 80% = 0.8 * PRECISION)
    pub optimal_utilization: i128,
}

impl InterestRateModel {
    /// Create default interest rate model
    /// Base: 2%, Slope1: 4%, Slope2: 75%, Optimal: 80%
    pub fn default() -> Self {
        Self {
            base_rate: 20_000_000_000_000_000,      // 2%
            slope1: 40_000_000_000_000_000,          // 4%
            slope2: 750_000_000_000_000_000,         // 75%
            optimal_utilization: 800_000_000_000_000_000, // 80%
        }
    }

    /// Calculate borrow rate based on utilization
    pub fn calculate_borrow_rate(&self, utilization: i128) -> i128 {
        if utilization <= self.optimal_utilization {
            // Below optimal: base + utilization * slope1 / optimal
            self.base_rate + (utilization * self.slope1) / self.optimal_utilization
        } else {
            // Above optimal: rate_at_optimal + (utilization - optimal) * slope2 / (1 - optimal)
            let rate_at_optimal = self.base_rate + self.slope1;
            let excess_utilization = utilization - self.optimal_utilization;
            let remaining = PRECISION - self.optimal_utilization;
            rate_at_optimal + (excess_utilization * self.slope2) / remaining
        }
    }

    /// Calculate supply rate based on borrow rate and utilization
    pub fn calculate_supply_rate(&self, borrow_rate: i128, utilization: i128, reserve_factor: i128) -> i128 {
        // supply_rate = borrow_rate * utilization * (1 - reserve_factor)
        let effective_rate = (borrow_rate * utilization) / PRECISION;
        (effective_rate * (PRECISION - reserve_factor)) / PRECISION
    }
}

/// Interest rate storage helpers
pub struct InterestStorage;

impl InterestStorage {
    /// Store interest rate model for pool
    pub fn set_model(env: &Env, pool_id: &String, model: &InterestRateModel) {
        let key = LendingKey::InterestRateModel(pool_id.clone());
        env.storage().instance().set(&key, model);
    }

    /// Get interest rate model for pool
    pub fn get_model(env: &Env, pool_id: &String) -> InterestRateModel {
        let key = LendingKey::InterestRateModel(pool_id.clone());
        env.storage()
            .instance()
            .get(&key)
            .unwrap_or_else(InterestRateModel::default)
    }

    /// Get accumulated interest index
    pub fn get_interest_index(env: &Env, pool_id: &String) -> i128 {
        let key = LendingKey::PoolInterestIndex(pool_id.clone());
        env.storage().persistent().get(&key).unwrap_or(PRECISION)
    }

    /// Set accumulated interest index
    pub fn set_interest_index(env: &Env, pool_id: &String, index: i128) {
        let key = LendingKey::PoolInterestIndex(pool_id.clone());
        env.storage().persistent().set(&key, &index);
        env.storage()
            .persistent()
            .extend_ttl(&key, lending_bump::PERSISTENT_BUMP, lending_bump::PERSISTENT_BUMP);
    }

    /// Get last accrual timestamp
    pub fn get_last_accrual(env: &Env, pool_id: &String) -> u64 {
        let key = LendingKey::PoolLastAccrual(pool_id.clone());
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    /// Set last accrual timestamp
    pub fn set_last_accrual(env: &Env, pool_id: &String, timestamp: u64) {
        let key = LendingKey::PoolLastAccrual(pool_id.clone());
        env.storage().persistent().set(&key, &timestamp);
    }

    /// Calculate new interest index based on time elapsed
    pub fn calculate_new_index(
        current_index: i128,
        borrow_rate: i128,
        time_elapsed: u64,
    ) -> i128 {
        if time_elapsed == 0 {
            return current_index;
        }

        // Calculate rate per second
        let rate_per_second = borrow_rate / (SECONDS_PER_YEAR as i128);

        // Calculate accumulated interest: index * (1 + rate * time)
        let interest_factor = PRECISION + (rate_per_second * (time_elapsed as i128));
        (current_index * interest_factor) / PRECISION
    }
}
```

### Step 3: Define Pool Storage

Create `apps/contracts/contracts/defi-rwa/src/lending/pool.rs`:

```rust
use soroban_sdk::{contracttype, Address, Env, String, Vec};

use super::interest::{InterestRateModel, InterestStorage, PRECISION};
use super::keys::{lending_bump, LendingKey};

/// Lending pool configuration and state
#[derive(Clone)]
#[contracttype]
pub struct LendingPool {
    /// Unique pool identifier
    pub id: String,
    /// Pool display name
    pub name: String,
    /// Asset symbol (e.g., "USDC")
    pub asset: String,
    /// Asset contract address
    pub asset_address: Address,
    /// Collateral factor (e.g., 75% = 750000000000000000)
    pub collateral_factor: i128,
    /// Liquidation threshold (e.g., 80% = 800000000000000000)
    pub liquidation_threshold: i128,
    /// Liquidation penalty (e.g., 5% = 50000000000000000)
    pub liquidation_penalty: i128,
    /// Reserve factor in basis points (e.g., 1000 = 10%)
    pub reserve_factor: u32,
    /// Whether pool is active
    pub is_active: bool,
    /// Pool creation timestamp
    pub created_at: u64,
}

/// Pool storage helpers
pub struct PoolStorage;

impl PoolStorage {
    /// Store lending pool
    pub fn set(env: &Env, pool: &LendingPool) {
        let key = LendingKey::Pool(pool.id.clone());
        env.storage().persistent().set(&key, pool);
        env.storage()
            .persistent()
            .extend_ttl(&key, lending_bump::PERSISTENT_BUMP, lending_bump::PERSISTENT_BUMP);
    }

    /// Get lending pool by ID
    pub fn get(env: &Env, pool_id: &String) -> Option<LendingPool> {
        let key = LendingKey::Pool(pool_id.clone());
        if env.storage().persistent().has(&key) {
            env.storage()
                .persistent()
                .extend_ttl(&key, lending_bump::PERSISTENT_BUMP, lending_bump::PERSISTENT_BUMP);
            env.storage().persistent().get(&key)
        } else {
            None
        }
    }

    /// Check if pool exists
    pub fn exists(env: &Env, pool_id: &String) -> bool {
        let key = LendingKey::Pool(pool_id.clone());
        env.storage().persistent().has(&key)
    }

    /// Get total deposits for pool
    pub fn get_total_deposits(env: &Env, pool_id: &String) -> i128 {
        let key = LendingKey::PoolTotalDeposits(pool_id.clone());
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    /// Set total deposits for pool
    pub fn set_total_deposits(env: &Env, pool_id: &String, amount: i128) {
        let key = LendingKey::PoolTotalDeposits(pool_id.clone());
        env.storage().persistent().set(&key, &amount);
        env.storage()
            .persistent()
            .extend_ttl(&key, lending_bump::PERSISTENT_BUMP, lending_bump::PERSISTENT_BUMP);
    }

    /// Get total borrows for pool
    pub fn get_total_borrows(env: &Env, pool_id: &String) -> i128 {
        let key = LendingKey::PoolTotalBorrows(pool_id.clone());
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    /// Set total borrows for pool
    pub fn set_total_borrows(env: &Env, pool_id: &String, amount: i128) {
        let key = LendingKey::PoolTotalBorrows(pool_id.clone());
        env.storage().persistent().set(&key, &amount);
        env.storage()
            .persistent()
            .extend_ttl(&key, lending_bump::PERSISTENT_BUMP, lending_bump::PERSISTENT_BUMP);
    }

    /// Get pool reserves
    pub fn get_reserves(env: &Env, pool_id: &String) -> i128 {
        let key = LendingKey::PoolReserves(pool_id.clone());
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    /// Add to pool reserves
    pub fn add_reserves(env: &Env, pool_id: &String, amount: i128) {
        let current = Self::get_reserves(env, pool_id);
        let key = LendingKey::PoolReserves(pool_id.clone());
        env.storage().persistent().set(&key, &(current + amount));
    }

    /// Calculate utilization rate
    pub fn calculate_utilization(total_deposits: i128, total_borrows: i128) -> i128 {
        if total_deposits == 0 {
            return 0;
        }
        (total_borrows * PRECISION) / total_deposits
    }

    /// Calculate available liquidity
    pub fn calculate_available_liquidity(total_deposits: i128, total_borrows: i128) -> i128 {
        if total_deposits <= total_borrows {
            return 0;
        }
        total_deposits - total_borrows
    }

    /// Get pool list
    pub fn get_list(env: &Env) -> Vec<String> {
        let key = LendingKey::PoolList;
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env))
    }

    /// Add pool to list
    pub fn add_to_list(env: &Env, pool_id: &String) {
        let key = LendingKey::PoolList;
        let mut list = Self::get_list(env);
        list.push_back(pool_id.clone());
        env.storage().persistent().set(&key, &list);
    }

    /// Check if pool is paused
    pub fn is_paused(env: &Env, pool_id: &String) -> bool {
        let key = LendingKey::PoolPaused(pool_id.clone());
        env.storage().instance().get(&key).unwrap_or(false)
    }

    /// Set pool pause status
    pub fn set_paused(env: &Env, pool_id: &String, paused: bool) {
        let key = LendingKey::PoolPaused(pool_id.clone());
        env.storage().instance().set(&key, &paused);
    }
}
```

### Step 4: Define Position Storage

Create `apps/contracts/contracts/defi-rwa/src/lending/positions.rs`:

```rust
use soroban_sdk::{contracttype, Address, Env, String, Vec};

use super::interest::{InterestStorage, PRECISION};
use super::keys::{lending_bump, LendingKey};

/// Deposit position for a user in a pool
#[derive(Clone)]
#[contracttype]
pub struct DepositPosition {
    /// Pool ID
    pub pool_id: String,
    /// Depositor address
    pub depositor: Address,
    /// Deposit amount in underlying tokens
    pub amount: i128,
    /// Share of pool (for interest calculation)
    pub shares: i128,
    /// Interest index at deposit time
    pub index_at_deposit: i128,
    /// Timestamp of deposit
    pub deposited_at: u64,
}

/// Borrow position for a user in a pool
#[derive(Clone)]
#[contracttype]
pub struct BorrowPosition {
    /// Pool ID
    pub pool_id: String,
    /// Borrower address
    pub borrower: Address,
    /// Principal borrowed
    pub principal: i128,
    /// Interest index at borrow time
    pub index_at_borrow: i128,
    /// Collateral amount
    pub collateral_amount: i128,
    /// Collateral asset address
    pub collateral_asset: Address,
    /// Timestamp of borrow
    pub borrowed_at: u64,
}

/// Position storage helpers
pub struct PositionStorage;

impl PositionStorage {
    // ============ Deposit Position Methods ============

    /// Store deposit position
    pub fn set_deposit(env: &Env, position: &DepositPosition) {
        let key = LendingKey::DepositPosition(
            position.depositor.clone(),
            position.pool_id.clone(),
        );
        env.storage().persistent().set(&key, position);
        env.storage()
            .persistent()
            .extend_ttl(&key, lending_bump::PERSISTENT_BUMP, lending_bump::PERSISTENT_BUMP);

        // Add to user's deposit list
        Self::add_to_user_deposits(env, &position.depositor, &position.pool_id);
    }

    /// Get deposit position
    pub fn get_deposit(
        env: &Env,
        depositor: &Address,
        pool_id: &String,
    ) -> Option<DepositPosition> {
        let key = LendingKey::DepositPosition(depositor.clone(), pool_id.clone());
        if env.storage().persistent().has(&key) {
            env.storage()
                .persistent()
                .extend_ttl(&key, lending_bump::PERSISTENT_BUMP, lending_bump::PERSISTENT_BUMP);
            env.storage().persistent().get(&key)
        } else {
            None
        }
    }

    /// Remove deposit position
    pub fn remove_deposit(env: &Env, depositor: &Address, pool_id: &String) {
        let key = LendingKey::DepositPosition(depositor.clone(), pool_id.clone());
        env.storage().persistent().remove(&key);
        Self::remove_from_user_deposits(env, depositor, pool_id);
    }

    /// Get user's deposit pool IDs
    pub fn get_user_deposits(env: &Env, user: &Address) -> Vec<String> {
        let key = LendingKey::UserDeposits(user.clone());
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env))
    }

    /// Add pool to user's deposit list
    fn add_to_user_deposits(env: &Env, user: &Address, pool_id: &String) {
        let key = LendingKey::UserDeposits(user.clone());
        let mut list = Self::get_user_deposits(env, user);

        // Check if already exists
        let mut exists = false;
        for i in 0..list.len() {
            if list.get(i).unwrap() == pool_id.clone() {
                exists = true;
                break;
            }
        }

        if !exists {
            list.push_back(pool_id.clone());
            env.storage().persistent().set(&key, &list);
        }
    }

    /// Remove pool from user's deposit list
    fn remove_from_user_deposits(env: &Env, user: &Address, pool_id: &String) {
        let key = LendingKey::UserDeposits(user.clone());
        let list = Self::get_user_deposits(env, user);
        let mut new_list: Vec<String> = Vec::new(env);

        for i in 0..list.len() {
            let id = list.get(i).unwrap();
            if id != pool_id.clone() {
                new_list.push_back(id);
            }
        }

        env.storage().persistent().set(&key, &new_list);
    }

    /// Calculate accrued interest for deposit
    pub fn calculate_deposit_interest(env: &Env, position: &DepositPosition) -> i128 {
        let current_index = InterestStorage::get_interest_index(env, &position.pool_id);
        if position.index_at_deposit == 0 || current_index <= position.index_at_deposit {
            return 0;
        }

        // interest = amount * (current_index / deposit_index - 1)
        let index_ratio = (current_index * PRECISION) / position.index_at_deposit;
        (position.amount * (index_ratio - PRECISION)) / PRECISION
    }

    // ============ Borrow Position Methods ============

    /// Store borrow position
    pub fn set_borrow(env: &Env, position: &BorrowPosition) {
        let key = LendingKey::BorrowPosition(
            position.borrower.clone(),
            position.pool_id.clone(),
        );
        env.storage().persistent().set(&key, position);
        env.storage()
            .persistent()
            .extend_ttl(&key, lending_bump::PERSISTENT_BUMP, lending_bump::PERSISTENT_BUMP);

        Self::add_to_user_borrows(env, &position.borrower, &position.pool_id);
    }

    /// Get borrow position
    pub fn get_borrow(
        env: &Env,
        borrower: &Address,
        pool_id: &String,
    ) -> Option<BorrowPosition> {
        let key = LendingKey::BorrowPosition(borrower.clone(), pool_id.clone());
        if env.storage().persistent().has(&key) {
            env.storage()
                .persistent()
                .extend_ttl(&key, lending_bump::PERSISTENT_BUMP, lending_bump::PERSISTENT_BUMP);
            env.storage().persistent().get(&key)
        } else {
            None
        }
    }

    /// Remove borrow position
    pub fn remove_borrow(env: &Env, borrower: &Address, pool_id: &String) {
        let key = LendingKey::BorrowPosition(borrower.clone(), pool_id.clone());
        env.storage().persistent().remove(&key);
        Self::remove_from_user_borrows(env, borrower, pool_id);
    }

    /// Get user's borrow pool IDs
    pub fn get_user_borrows(env: &Env, user: &Address) -> Vec<String> {
        let key = LendingKey::UserBorrows(user.clone());
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env))
    }

    /// Add pool to user's borrow list
    fn add_to_user_borrows(env: &Env, user: &Address, pool_id: &String) {
        let key = LendingKey::UserBorrows(user.clone());
        let mut list = Self::get_user_borrows(env, user);

        let mut exists = false;
        for i in 0..list.len() {
            if list.get(i).unwrap() == pool_id.clone() {
                exists = true;
                break;
            }
        }

        if !exists {
            list.push_back(pool_id.clone());
            env.storage().persistent().set(&key, &list);
        }
    }

    /// Remove pool from user's borrow list
    fn remove_from_user_borrows(env: &Env, user: &Address, pool_id: &String) {
        let key = LendingKey::UserBorrows(user.clone());
        let list = Self::get_user_borrows(env, user);
        let mut new_list: Vec<String> = Vec::new(env);

        for i in 0..list.len() {
            let id = list.get(i).unwrap();
            if id != pool_id.clone() {
                new_list.push_back(id);
            }
        }

        env.storage().persistent().set(&key, &new_list);
    }

    /// Calculate current debt including accrued interest
    pub fn calculate_current_debt(env: &Env, position: &BorrowPosition) -> i128 {
        let current_index = InterestStorage::get_interest_index(env, &position.pool_id);
        if position.index_at_borrow == 0 {
            return position.principal;
        }

        // debt = principal * current_index / borrow_index
        (position.principal * current_index) / position.index_at_borrow
    }

    /// Calculate health factor for position
    pub fn calculate_health_factor(
        collateral_value: i128,
        debt_value: i128,
        liquidation_threshold: i128,
    ) -> i128 {
        if debt_value == 0 {
            return i128::MAX;
        }

        // health = (collateral * liquidation_threshold) / debt
        (collateral_value * liquidation_threshold) / (debt_value * PRECISION)
    }
}
```

### Step 5: Create Lending Module Index

Create `apps/contracts/contracts/defi-rwa/src/lending/mod.rs`:

```rust
//! Lending module for DeFi RWA
//!
//! This module provides storage structures and helpers for the
//! lending pool functionality.

mod interest;
mod keys;
mod pool;
mod positions;

pub use interest::{InterestRateModel, InterestStorage, PRECISION, SECONDS_PER_YEAR};
pub use keys::{lending_bump, LendingKey};
pub use pool::{LendingPool, PoolStorage};
pub use positions::{BorrowPosition, DepositPosition, PositionStorage};
```

### Step 6: Update Main Library

Update `apps/contracts/contracts/defi-rwa/src/lib.rs` to include the lending module:

```rust
#![no_std]

mod lending;
mod storage;

pub use lending::*;
pub use storage::*;
```

## Testing Guidelines

### Unit Test Example

```rust
#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn test_interest_rate_calculation() {
    let model = InterestRateModel::default();

    // Test at 0% utilization
    let rate_0 = model.calculate_borrow_rate(0);
    assert_eq!(rate_0, model.base_rate);

    // Test at optimal utilization (80%)
    let rate_optimal = model.calculate_borrow_rate(model.optimal_utilization);
    assert_eq!(rate_optimal, model.base_rate + model.slope1);

    // Test at 100% utilization
    let rate_100 = model.calculate_borrow_rate(PRECISION);
    assert!(rate_100 > rate_optimal);
}

#[test]
fn test_position_storage() {
    let env = Env::default();
    let user = Address::generate(&env);
    let pool_id = String::from_str(&env, "USDC-POOL");

    let position = DepositPosition {
        pool_id: pool_id.clone(),
        depositor: user.clone(),
        amount: 1_000_000_000, // 1000 USDC (6 decimals)
        shares: 1_000_000_000,
        index_at_deposit: PRECISION,
        deposited_at: 1700000000,
    };

    PositionStorage::set_deposit(&env, &position);

    let retrieved = PositionStorage::get_deposit(&env, &user, &pool_id).unwrap();
    assert_eq!(retrieved.amount, 1_000_000_000);

    let user_deposits = PositionStorage::get_user_deposits(&env, &user);
    assert_eq!(user_deposits.len(), 1);
}
```

## Related Resources

| Resource                    | Link                                                       |
| --------------------------- | ---------------------------------------------------------- |
| Compound Finance Whitepaper | https://compound.finance/documents/Compound.Whitepaper.pdf |
| Aave Protocol Documentation | https://docs.aave.com/developers/                          |
| Soroban Storage             | https://soroban.stellar.org/docs/learn/persisting-data     |

## Verification Checklist

| Item                            | Status |
| ------------------------------- | ------ |
| Interest rate model implemented |        |
| Pool storage complete           |        |
| Position storage complete       |        |
| Storage keys unique             |        |
| Unit tests passing              |        |
| cargo clippy clean              |        |
