use crate::oracle_types::{Asset, PriceData, PriceFeedClient};
use soroban_sdk::{contracttype, panic_with_error, symbol_short, Address, Env, U256};

use crate::access::ContractError;

use super::keys::{lending_bump, LendingKey, OraclePriceSnapshot};

/// Default maximum age for price data (1 hour in seconds).
pub(crate) const DEFAULT_MAX_AGE: u64 = 3600;
const MAX_RECORDS: u32 = 12;
const MIN_HISTORY: usize = 3;

#[contracttype]
#[derive(Clone)]
pub struct OracleGuardConfig {
    pub max_age: u64,
    pub min_price: i128,
    pub max_price: i128,
    pub deviation_bps: u32,
    pub records: u32,
}

/// Maximum acceptable time in the future for a price timestamp.
/// Allows for small clock drift between nodes.
const MAX_FUTURE_TIME: u64 = 5; // 5 seconds

/// Oracle price consumer with production-grade guardrails.
///
/// Every price-sensitive code path in the contract MUST go through
/// [`try_get_price`] (or the panic wrappers [`get_price`] / [`get_guarded_price`])
/// so that staleness, validity, and floor checks are applied uniformly.
///
pub struct PriceOracle;

impl PriceOracle {
    pub fn get_asset_guard(env: &Env, asset: &Address) -> Option<OracleGuardConfig> {
        env.storage()
            .instance()
            .get(&(symbol_short!("or_guard"), asset))
    }

    pub fn set_asset_guard(
        env: &Env,
        asset: &Address,
        config: &OracleGuardConfig,
    ) -> Result<(), ContractError> {
        if config.max_age == 0
            || config.min_price < 0
            || config.max_price <= config.min_price
            || !(1..=10_000).contains(&config.deviation_bps)
            || !(4..=MAX_RECORDS).contains(&config.records)
        {
            return Err(ContractError::InvalidOracleGuard);
        }
        let old = Self::get_asset_guard(env, asset);
        env.storage()
            .instance()
            .set(&(symbol_short!("or_guard"), asset), config);
        env.events()
            .publish((symbol_short!("or_guard"), asset), (old, config.clone()));
        Ok(())
    }

    // ─── Oracle Address ─────────────────────────────

    /// Set the address of the SEP-40 oracle contract.
    pub fn set_oracle_address(env: &Env, oracle_address: &Address) {
        env.storage()
            .instance()
            .set(&LendingKey::OracleAddress, oracle_address);
    }

    /// Retrieve the configured oracle address.
    pub fn get_oracle_address(env: &Env) -> Result<Address, ContractError> {
        env.storage()
            .instance()
            .get(&LendingKey::OracleAddress)
            .ok_or(ContractError::OracleNotConfigured)
    }

    // ─── Configurable Guardrail Parameters ──────────

    /// Set the maximum acceptable age (seconds) for price data.
    ///
    /// Any price older than `max_age` seconds relative to the current ledger
    /// timestamp will be rejected as stale.
    pub fn set_max_age(env: &Env, max_age: u64) {
        env.storage()
            .instance()
            .set(&LendingKey::OracleMaxAge, &max_age);
    }

    /// Get the configured maximum age. Returns [`DEFAULT_MAX_AGE`] if not set.
    pub fn get_max_age(env: &Env) -> u64 {
        env.storage()
            .instance()
            .get(&LendingKey::OracleMaxAge)
            .unwrap_or(DEFAULT_MAX_AGE)
    }

    /// Set the minimum acceptable *normalized* price (floor).
    ///
    /// After decimal normalization the price must be ≥ `min_price`.
    /// Set to `0` to disable the floor (default behaviour).
    pub fn set_min_price(env: &Env, min_price: i128) {
        env.storage()
            .instance()
            .set(&LendingKey::OracleMinPrice, &min_price);
    }

    /// Get the configured minimum price floor. Returns `0` if not set.
    pub fn get_min_price(env: &Env) -> i128 {
        env.storage()
            .instance()
            .get(&LendingKey::OracleMinPrice)
            .unwrap_or(0_i128)
    }

    // ─── Snapshot storage ───────────────────────────

    /// Persist a validated price snapshot (price + timestamp) for `asset`.
    fn store_price_snapshot(env: &Env, asset: &Address, snapshot: &OraclePriceSnapshot) {
        let key = LendingKey::LastOraclePrice(asset.clone());
        env.storage().persistent().set(&key, snapshot);
        env.storage().persistent().extend_ttl(
            &key,
            lending_bump::PERSISTENT_BUMP,
            lending_bump::PERSISTENT_BUMP,
        );
    }

    /// Read the last validated oracle snapshot for `asset`, if any.
    pub fn get_last_oracle_price(env: &Env, asset: &Address) -> Option<OraclePriceSnapshot> {
        let key = LendingKey::LastOraclePrice(asset.clone());
        env.storage().persistent().get(&key)
    }

    // ─── Guarded Price Fetch ────────────────────────

    /// Fetch the price for `asset` with full production guardrails.
    ///
    /// Returns `Result::Err` with a typed [`ContractError`] when any guardrail
    /// fails (including staleness). This path does not record a snapshot.
    ///
    /// Guardrails:
    /// 1. Oracle address must be configured
    /// 2. Rejects missing prices (`None` from oracle)
    /// 3. Rejects zero or negative raw prices
    /// 4. Rejects stale prices (age > configurable max age)
    /// 5. Normalizes decimals to 18-decimal precision using checked math
    /// 6. Enforces the configurable minimum price floor after normalization
    pub fn try_get_price(env: &Env, asset: &Address) -> Result<i128, ContractError> {
        Ok(Self::validated_snapshot(env, asset)?.price)
    }

    pub fn try_record_price(env: &Env, asset: &Address) -> Result<i128, ContractError> {
        let snapshot = Self::validated_snapshot(env, asset)?;
        Self::store_price_snapshot(env, asset, &snapshot);
        Ok(snapshot.price)
    }

    fn validated_snapshot(
        env: &Env,
        asset: &Address,
    ) -> Result<OraclePriceSnapshot, ContractError> {
        let oracle_address = Self::get_oracle_address(env)?;
        let price_feed_client = PriceFeedClient::new(env, &oracle_address);

        // 1. Fetch price - reject if missing
        let asset_enum = Asset::Stellar(asset.clone());
        let price_data: PriceData = price_feed_client
            .lastprice(&asset_enum)
            .ok_or(ContractError::PriceNotAvailable)?;

        // 2. Reject zero or negative raw price
        if price_data.price <= 0 {
            return Err(ContractError::InvalidPrice);
        }

        // 3. Staleness check - configurable max age
        let current_time = env.ledger().timestamp();
        let guard = Self::get_asset_guard(env, asset);
        let max_age = guard
            .as_ref()
            .map_or_else(|| Self::get_max_age(env), |config| config.max_age);
        if price_data.timestamp > current_time {
            // Reject prices that are too far in the future
            let future_delta = price_data
                .timestamp
                .checked_sub(current_time)
                .ok_or(ContractError::OraclePriceInFuture)?;
            if future_delta > MAX_FUTURE_TIME {
                return Err(ContractError::OraclePriceInFuture);
            }
        } else {
            // Price is in the past or present, check staleness
            let price_age = current_time
                .checked_sub(price_data.timestamp)
                .ok_or(ContractError::StalePrice)?;
            if price_age > max_age {
                return Err(ContractError::StalePrice);
            }
        }

        // 4. Decimal normalization (target = 18 decimals, overflow-safe)
        let oracle_decimals = price_feed_client.decimals();
        let normalized_price = Self::normalize_price(price_data.price, oracle_decimals)?;

        // 5. Minimum price floor
        let min_price = guard
            .as_ref()
            .map_or_else(|| Self::get_min_price(env), |config| config.min_price);
        if min_price > 0 && normalized_price < min_price {
            return Err(ContractError::PriceBelowFloor);
        }

        if let Some(config) = guard {
            if normalized_price > config.max_price {
                return Err(ContractError::PriceAboveCeiling);
            }
            let history = price_feed_client
                .try_prices(&asset_enum, &config.records)
                .ok()
                .and_then(Result::ok)
                .flatten()
                .ok_or(ContractError::InsufficientOracleHistory)?;
            if history.len() > config.records {
                return Err(ContractError::InsufficientOracleHistory);
            }
            let mut timestamps = [0_u64; MAX_RECORDS as usize];
            let mut prices = [0_i128; MAX_RECORDS as usize];
            let mut count = 0;
            for tick in history {
                if tick.price <= 0
                    || tick.timestamp >= price_data.timestamp
                    || tick.timestamp > current_time
                    || current_time.saturating_sub(tick.timestamp) > max_age
                    || timestamps[..count].contains(&tick.timestamp)
                {
                    continue;
                }
                let price = Self::normalize_price(tick.price, oracle_decimals)?;
                if price <= 0 {
                    continue;
                }
                timestamps[count] = tick.timestamp;
                prices[count] = price;
                count += 1;
            }
            if count < MIN_HISTORY {
                return Err(ContractError::InsufficientOracleHistory);
            }
            prices[..count].sort_unstable();
            let lower = prices[(count - 1) / 2];
            let upper = prices[count / 2];
            let reference = lower + (upper - lower) / 2;
            let deviation = U256::from_u128(env, normalized_price.abs_diff(reference));
            let scale = U256::from_u32(env, 10_000);
            let limit = U256::from_u128(env, reference as u128)
                .mul(&U256::from_u32(env, config.deviation_bps));
            if deviation.mul(&scale) > limit {
                return Err(ContractError::OraclePriceDeviation);
            }
        }

        Ok(OraclePriceSnapshot {
            price: normalized_price,
            timestamp: price_data.timestamp,
        })
    }

    /// Fetch the price for `asset` with full production guardrails.
    ///
    /// Panic wrapper around [`try_get_price`] using typed [`ContractError`] codes
    /// (via `panic_with_error`). Prefer [`try_get_price`] in new code that can
    /// propagate `Result`.
    pub fn get_price(env: &Env, asset: &Address) -> i128 {
        Self::try_get_price(env, asset).unwrap_or_else(|e| panic_with_error!(env, e))
    }

    /// Canonical safe entry point - alias for [`get_price`].
    ///
    /// Provided for readability at call sites that want to emphasise the
    /// guarded nature of the price fetch.
    pub fn get_guarded_price(env: &Env, asset: &Address) -> i128 {
        Self::get_price(env, asset)
    }

    /// Fetch raw [`PriceData`] from the oracle with basic availability check.
    ///
    /// This still rejects missing prices but does **not** apply staleness,
    /// validity, or floor checks. Use only for informational / diagnostic
    /// purposes - never in risk-sensitive code paths.
    pub fn get_raw_price_data(env: &Env, asset: &Address) -> Result<PriceData, ContractError> {
        let oracle_address = Self::get_oracle_address(env)?;
        let price_feed_client = PriceFeedClient::new(env, &oracle_address);
        let asset_enum = Asset::Stellar(asset.clone());
        price_feed_client
            .lastprice(&asset_enum)
            .ok_or(ContractError::PriceNotAvailable)
    }

    // ─── Internal Helpers ───────────────────────────

    /// Normalize a price from `oracle_decimals` to 18-decimal precision.
    ///
    /// Uses checked arithmetic to prevent silent overflow.
    fn normalize_price(raw_price: i128, oracle_decimals: u32) -> Result<i128, ContractError> {
        let oracle_decimals =
            i32::try_from(oracle_decimals).map_err(|_| ContractError::PriceScalingOverflow)?;
        let decimals_diff = 18_i32
            .checked_sub(oracle_decimals)
            .ok_or(ContractError::PriceScalingOverflow)?;
        if decimals_diff >= 0 {
            let scale_factor = 10_i128
                .checked_pow(decimals_diff as u32)
                .ok_or(ContractError::PriceScalingOverflow)?;
            raw_price
                .checked_mul(scale_factor)
                .ok_or(ContractError::PriceScalingOverflow)
        } else {
            let scale_digits = decimals_diff
                .checked_neg()
                .and_then(|value| u32::try_from(value).ok())
                .ok_or(ContractError::PriceScalingOverflow)?;
            let scale_factor = 10_i128
                .checked_pow(scale_digits)
                .ok_or(ContractError::PriceScalingOverflow)?;
            raw_price
                .checked_div(scale_factor)
                .ok_or(ContractError::PriceScalingOverflow)
        }
    }
}
