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

#[allow(dead_code)]
impl PositionStorage {
    // Deposit Position Methods

    /// Store deposit position
    pub fn set_deposit(env: &Env, position: &DepositPosition) {
        let key = LendingKey::DepositPosition(position.depositor.clone(), position.pool_id.clone());

        // Only add to user's deposit list when this is a NEW position (O(1) check)
        let is_new = !env.storage().persistent().has(&key);

        env.storage().persistent().set(&key, position);
        env.storage().persistent().extend_ttl(
            &key,
            lending_bump::PERSISTENT_BUMP,
            lending_bump::PERSISTENT_BUMP,
        );

        if is_new {
            Self::add_to_user_deposits(env, &position.depositor, &position.pool_id);
        }
    }

    /// Get deposit position
    pub fn get_deposit(
        env: &Env,
        depositor: &Address,
        pool_id: &String,
    ) -> Option<DepositPosition> {
        let key = LendingKey::DepositPosition(depositor.clone(), pool_id.clone());
        if env.storage().persistent().has(&key) {
            env.storage().persistent().extend_ttl(
                &key,
                lending_bump::PERSISTENT_BUMP,
                lending_bump::PERSISTENT_BUMP,
            );
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

    /// Add pool to user's deposit list.
    ///
    /// Uses the deposit position's own existence (checked *before* calling this
    /// function) to gate the append, avoiding an O(n) duplicate scan.
    /// The caller must only invoke this when creating a **new** position.
    fn add_to_user_deposits(env: &Env, user: &Address, pool_id: &String) {
        let key = LendingKey::UserDeposits(user.clone());
        let mut list = Self::get_user_deposits(env, user);
        list.push_back(pool_id.clone());
        env.storage().persistent().set(&key, &list);
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

    // Borrow Position Methods

    /// Store borrow position
    pub fn set_borrow(env: &Env, position: &BorrowPosition) {
        let key = LendingKey::BorrowPosition(position.borrower.clone(), position.pool_id.clone());
        env.storage().persistent().set(&key, position);
        env.storage().persistent().extend_ttl(
            &key,
            lending_bump::PERSISTENT_BUMP,
            lending_bump::PERSISTENT_BUMP,
        );

        Self::add_to_user_borrows(env, &position.borrower, &position.pool_id);
    }

    /// Get borrow position
    pub fn get_borrow(env: &Env, borrower: &Address, pool_id: &String) -> Option<BorrowPosition> {
        let key = LendingKey::BorrowPosition(borrower.clone(), pool_id.clone());
        if env.storage().persistent().has(&key) {
            env.storage().persistent().extend_ttl(
                &key,
                lending_bump::PERSISTENT_BUMP,
                lending_bump::PERSISTENT_BUMP,
            );
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

    /// Apply a repayment to a borrow position.
    ///
    /// Returns `(updated_position, repaid_amount, remaining_debt, collateral_released)`.
    /// When the repayment fully closes the debt, `updated_position` is `None`.
    pub fn apply_repayment(
        env: &Env,
        position: &BorrowPosition,
        amount: i128,
    ) -> (Option<BorrowPosition>, i128, i128, i128) {
        if amount <= 0 {
            panic!("amount must be positive");
        }

        let current_debt = Self::calculate_current_debt(env, position);
        if current_debt <= 0 {
            panic!("borrow position has no debt");
        }

        let repaid_amount = if amount > current_debt {
            current_debt
        } else {
            amount
        };
        let remaining_debt = current_debt - repaid_amount;

        let collateral_released = if remaining_debt == 0 {
            position.collateral_amount
        } else {
            (position.collateral_amount * repaid_amount) / current_debt
        };

        if remaining_debt == 0 {
            return (None, repaid_amount, 0, collateral_released);
        }

        let updated_position = BorrowPosition {
            pool_id: position.pool_id.clone(),
            borrower: position.borrower.clone(),
            principal: remaining_debt,
            index_at_borrow: InterestStorage::get_interest_index(env, &position.pool_id),
            collateral_amount: position.collateral_amount - collateral_released,
            collateral_asset: position.collateral_asset.clone(),
            borrowed_at: position.borrowed_at,
        };

        (
            Some(updated_position),
            repaid_amount,
            remaining_debt,
            collateral_released,
        )
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
    /// Calculate health factor for position
    ///
    /// Returns health factor in PRECISION units (1.0 = PRECISION).
    /// Formula: (collateral_value * liquidation_threshold) / debt_value
    pub fn calculate_health_factor(
        collateral_value: i128,
        debt_value: i128,
        liquidation_threshold: i128,
    ) -> i128 {
        if debt_value == 0 {
            return i128::MAX;
        }

        // health = (collateral * liquidation_threshold / PRECISION) / debt * PRECISION
        // Result is in PRECISION units: e.g., 1.5 * PRECISION
        (collateral_value * liquidation_threshold) / debt_value
    }
}
