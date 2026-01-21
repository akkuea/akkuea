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