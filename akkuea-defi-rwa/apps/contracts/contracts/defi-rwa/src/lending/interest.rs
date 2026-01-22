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
            base_rate: 20_000_000_000_000_000,            // 2%
            slope1: 40_000_000_000_000_000,               // 4%
            slope2: 750_000_000_000_000_000,              // 75%
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
    pub fn calculate_supply_rate(
        &self,
        borrow_rate: i128,
        utilization: i128,
        reserve_factor: i128,
    ) -> i128 {
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
        env.storage().persistent().extend_ttl(
            &key,
            lending_bump::PERSISTENT_BUMP,
            lending_bump::PERSISTENT_BUMP,
        );
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
    pub fn calculate_new_index(current_index: i128, borrow_rate: i128, time_elapsed: u64) -> i128 {
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
