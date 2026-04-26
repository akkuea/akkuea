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

impl Default for InterestRateModel {
    /// Create default interest rate model
    /// Base: 2%, Slope1: 4%, Slope2: 75%, Optimal: 80%
    fn default() -> Self {
        Self {
            base_rate: 20_000_000_000_000_000,            // 2%
            slope1: 40_000_000_000_000_000,               // 4%
            slope2: 750_000_000_000_000_000,              // 75%
            optimal_utilization: 800_000_000_000_000_000, // 80%
        }
    }
}

impl InterestRateModel {
    /// Calculate borrow rate based on utilization
    /// Uses checked arithmetic to prevent overflow
    pub fn calculate_borrow_rate(&self, utilization: i128) -> i128 {
        if utilization <= self.optimal_utilization {
            // Below optimal: base + utilization * slope1 / optimal
            let slope_component = utilization
                .checked_mul(self.slope1)
                .expect("Borrow rate overflow: utilization * slope1")
                / self.optimal_utilization;
            self.base_rate
                .checked_add(slope_component)
                .expect("Borrow rate overflow: base + slope_component")
        } else {
            // Above optimal: rate_at_optimal + (utilization - optimal) * slope2 / (1 - optimal)
            let rate_at_optimal = self
                .base_rate
                .checked_add(self.slope1)
                .expect("Borrow rate overflow: base + slope1");
            let excess_utilization = utilization - self.optimal_utilization;
            let remaining = PRECISION - self.optimal_utilization;
            let excess_component = excess_utilization
                .checked_mul(self.slope2)
                .expect("Borrow rate overflow: excess * slope2")
                / remaining;
            rate_at_optimal
                .checked_add(excess_component)
                .expect("Borrow rate overflow: rate_at_optimal + excess_component")
        }
    }

    /// Calculate supply rate based on borrow rate and utilization
    /// Uses checked arithmetic to prevent overflow
    pub fn calculate_supply_rate(
        &self,
        borrow_rate: i128,
        utilization: i128,
        reserve_factor: i128,
    ) -> i128 {
        // supply_rate = borrow_rate * utilization * (1 - reserve_factor)
        let effective_rate = borrow_rate
            .checked_mul(utilization)
            .expect("Supply rate overflow: borrow_rate * utilization")
            / PRECISION;
        let factor = PRECISION - reserve_factor;
        effective_rate
            .checked_mul(factor)
            .expect("Supply rate overflow: effective_rate * factor")
            / PRECISION
    }
}

/// Interest rate storage helpers
pub struct InterestStorage;

impl InterestStorage {
    /// Store interest rate model for pool
    pub fn set_model(env: &Env, pool_id: &String, model: &InterestRateModel) {
        let key = LendingKey::InterestRateModel(pool_id.clone());
        env.storage().persistent().set(&key, model);
        env.storage().persistent().extend_ttl(
            &key,
            lending_bump::PERSISTENT_BUMP,
            lending_bump::PERSISTENT_BUMP,
        );
    }

    /// Get interest rate model for pool
    pub fn get_model(env: &Env, pool_id: &String) -> InterestRateModel {
        let key = LendingKey::InterestRateModel(pool_id.clone());
        if env.storage().persistent().has(&key) {
            env.storage().persistent().extend_ttl(
                &key,
                lending_bump::PERSISTENT_BUMP,
                lending_bump::PERSISTENT_BUMP,
            );
            env.storage().persistent().get(&key).unwrap_or_default()
        } else {
            InterestRateModel::default()
        }
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
        env.storage().persistent().extend_ttl(
            &key,
            lending_bump::PERSISTENT_BUMP,
            lending_bump::PERSISTENT_BUMP,
        );
    }

    /// Calculate new interest index with **compound** interest.
    ///
    /// Uses per-second compounding via iterative squaring (exponentiation by
    /// squaring) to compute: `new_index = current_index * (1 + rate_per_second) ^ time_elapsed`.
    ///
    /// This avoids the underestimation inherent in the linear approximation
    /// `index * (1 + rate * time)` for longer accrual intervals.
    /// Uses checked arithmetic to prevent overflow.
    pub fn calculate_new_index(current_index: i128, borrow_rate: i128, time_elapsed: u64) -> i128 {
        if time_elapsed == 0 {
            return current_index;
        }

        // rate_per_second in PRECISION units
        let rate_per_second = borrow_rate / (SECONDS_PER_YEAR as i128);

        // base = 1 + rate_per_second  (in PRECISION units)
        let base = PRECISION
            .checked_add(rate_per_second)
            .expect("Interest calculation base overflow");

        // Compute base^time_elapsed using exponentiation by squaring
        let compound_factor = Self::pow_precision(base, time_elapsed);

        current_index
            .checked_mul(compound_factor)
            .expect("Interest calculation index overflow")
            / PRECISION
    }

    /// Fixed-point exponentiation by squaring.
    ///
    /// Computes `base ^ exp` where `base` is in PRECISION units.
    /// Returns the result in PRECISION units.
    fn pow_precision(base: i128, exp: u64) -> i128 {
        if exp == 0 {
            return PRECISION;
        }

        let mut result = PRECISION;
        let mut b = base;
        let mut e = exp;

        while e > 0 {
            if e & 1 == 1 {
                result = (result * b) / PRECISION;
            }
            b = (b * b) / PRECISION;
            e >>= 1;
        }

        result
    }
}
