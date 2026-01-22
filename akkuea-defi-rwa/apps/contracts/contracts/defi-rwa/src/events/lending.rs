use soroban_sdk::{contractevent, Address, Env, String};

/// Emitted when a new lending pool is created
#[contractevent]
pub struct PoolCreated {
    pub pool_id: String,
    pub asset: String,
    pub asset_address: Address,
    pub collateral_factor: i128,
}

/// Emitted when assets are deposited into a pool
#[contractevent]
pub struct Deposit {
    pub pool_id: String,
    pub depositor: Address,
    pub amount: i128,
    pub shares_minted: i128,
    pub new_total_deposits: i128,
}

/// Emitted when assets are withdrawn from a pool
#[contractevent]
pub struct Withdraw {
    pub pool_id: String,
    pub withdrawer: Address,
    pub amount: i128,
    pub shares_burned: i128,
    pub new_total_deposits: i128,
}

/// Emitted when assets are borrowed from a pool
#[contractevent]
pub struct Borrow {
    pub pool_id: String,
    pub borrower: Address,
    pub amount: i128,
    pub collateral_amount: i128,
    pub collateral_asset: Address,
    pub health_factor: i128,
}

/// Emitted when a loan is repaid
#[contractevent]
pub struct Repay {
    pub pool_id: String,
    pub borrower: Address,
    pub amount: i128,
    pub remaining_debt: i128,
    pub collateral_released: i128,
}

/// Emitted when a position is liquidated
#[contractevent]
pub struct Liquidation {
    pub pool_id: String,
    pub borrower: Address,
    pub liquidator: Address,
    pub debt_repaid: i128,
    pub collateral_seized: i128,
    pub penalty: i128,
}

/// Emitted when interest is accrued
#[contractevent]
pub struct InterestAccrued {
    pub pool_id: String,
    pub interest_accrued: i128,
    pub new_index: i128,
    pub reserves_added: i128,
    pub timestamp: u64,
}

/// Emitted when pool parameters are updated
#[contractevent]
pub struct PoolUpdated {
    pub pool_id: String,
    pub parameter: String,
    pub old_value: i128,
    pub new_value: i128,
}

/// Emitted when pool is paused/unpaused
#[contractevent]
pub struct PoolPauseToggled {
    pub pool_id: String,
    pub paused: bool,
    pub by_admin: Address,
}

/// Event helper functions for lending operations
pub struct LendingEvents;

impl LendingEvents {
    /// Emitted when a new lending pool is created
    pub fn pool_created(
        env: &Env,
        pool_id: String,
        asset: String,
        asset_address: Address,
        collateral_factor: i128,
    ) {
        PoolCreated {
            pool_id,
            asset,
            asset_address,
            collateral_factor,
        }
        .publish(env);
    }

    /// Emitted when assets are deposited into a pool
    pub fn deposit(
        env: &Env,
        pool_id: String,
        depositor: Address,
        amount: i128,
        shares_minted: i128,
        new_total_deposits: i128,
    ) {
        Deposit {
            pool_id,
            depositor,
            amount,
            shares_minted,
            new_total_deposits,
        }
        .publish(env);
    }

    /// Emitted when assets are withdrawn from a pool
    pub fn withdraw(
        env: &Env,
        pool_id: String,
        withdrawer: Address,
        amount: i128,
        shares_burned: i128,
        new_total_deposits: i128,
    ) {
        Withdraw {
            pool_id,
            withdrawer,
            amount,
            shares_burned,
            new_total_deposits,
        }
        .publish(env);
    }

    /// Emitted when assets are borrowed from a pool
    pub fn borrow(
        env: &Env,
        pool_id: String,
        borrower: Address,
        amount: i128,
        collateral_amount: i128,
        collateral_asset: Address,
        health_factor: i128,
    ) {
        Borrow {
            pool_id,
            borrower,
            amount,
            collateral_amount,
            collateral_asset,
            health_factor,
        }
        .publish(env);
    }

    /// Emitted when a loan is repaid
    pub fn repay(
        env: &Env,
        pool_id: String,
        borrower: Address,
        amount: i128,
        remaining_debt: i128,
        collateral_released: i128,
    ) {
        Repay {
            pool_id,
            borrower,
            amount,
            remaining_debt,
            collateral_released,
        }
        .publish(env);
    }

    /// Emitted when a position is liquidated
    pub fn liquidation(
        env: &Env,
        pool_id: String,
        borrower: Address,
        liquidator: Address,
        debt_repaid: i128,
        collateral_seized: i128,
        penalty: i128,
    ) {
        Liquidation {
            pool_id,
            borrower,
            liquidator,
            debt_repaid,
            collateral_seized,
            penalty,
        }
        .publish(env);
    }

    /// Emitted when interest is accrued
    pub fn interest_accrued(
        env: &Env,
        pool_id: String,
        interest_accrued: i128,
        new_index: i128,
        reserves_added: i128,
    ) {
        InterestAccrued {
            pool_id,
            interest_accrued,
            new_index,
            reserves_added,
            timestamp: env.ledger().timestamp(),
        }
        .publish(env);
    }

    /// Emitted when pool parameters are updated
    pub fn pool_updated(
        env: &Env,
        pool_id: String,
        parameter: String,
        old_value: i128,
        new_value: i128,
    ) {
        PoolUpdated {
            pool_id,
            parameter,
            old_value,
            new_value,
        }
        .publish(env);
    }

    /// Emitted when pool is paused/unpaused
    pub fn pool_pause_toggled(env: &Env, pool_id: String, paused: bool, by_admin: Address) {
        PoolPauseToggled {
            pool_id,
            paused,
            by_admin,
        }
        .publish(env);
    }
}