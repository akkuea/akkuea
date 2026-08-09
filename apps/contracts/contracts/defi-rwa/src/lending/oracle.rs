use sep_40_oracle::{Asset, PriceData, PriceFeedClient};
use soroban_sdk::{panic_with_error, Address, Env};

use crate::access::ContractError;

use super::keys::{lending_bump, LendingKey, OraclePriceSnapshot};

/// Default maximum age for price data (1 hour in seconds).
const DEFAULT_MAX_AGE: u64 = 3600;

/// Oracle price consumer with production-grade guardrails.
///
/// Every price-sensitive code path in the contract MUST go through
/// [`try_get_price`] (or the panic wrappers [`get_price`] / [`get_guarded_price`])
/// so that staleness, validity, and floor checks are applied uniformly.
///
/// On a successful fetch the contract also persists an [`OraclePriceSnapshot`]
/// (normalized price + oracle timestamp) under [`LendingKey::LastOraclePrice`].
pub struct PriceOracle;

impl PriceOracle {
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

    // ─── Guarded Price Fetch ────────────────────────

    /// Fetch the price for `asset` with full production guardrails.
    ///
    /// Returns `Result::Err` with a typed [`ContractError`] when any guardrail
    /// fails (including staleness). On success, stores an
    /// [`OraclePriceSnapshot`] alongside the normalized price and returns it.
    ///
    /// Guardrails:
    /// 1. Oracle address must be configured
    /// 2. Rejects missing prices (`None` from oracle)
    /// 3. Rejects zero or negative raw prices
    /// 4. Rejects stale prices (age > configurable max age)
    /// 5. Normalizes decimals to 18-decimal precision using checked math
    /// 6. Enforces the configurable minimum price floor after normalization
    pub fn try_get_price(env: &Env, asset: &Address) -> Result<i128, ContractError> {
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
        let max_age = Self::get_max_age(env);
        if current_time > price_data.timestamp && (current_time - price_data.timestamp) > max_age {
            return Err(ContractError::StalePrice);
        }

        // 4. Decimal normalization (target = 18 decimals, overflow-safe)
        let oracle_decimals = price_feed_client.decimals();
        let normalized_price = Self::normalize_price(price_data.price, oracle_decimals)?;

        // 5. Minimum price floor
        let min_price = Self::get_min_price(env);
        if min_price > 0 && normalized_price < min_price {
            return Err(ContractError::PriceBelowFloor);
        }

        // 6. Persist price + timestamp together in contract storage
        let snapshot = OraclePriceSnapshot {
            price: normalized_price,
            timestamp: price_data.timestamp,
        };
        Self::store_price_snapshot(env, asset, &snapshot);

        Ok(normalized_price)
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
        let decimals_diff = 18_i32 - oracle_decimals as i32;
        if decimals_diff >= 0 {
            let scale_factor = 10_i128.pow(decimals_diff as u32);
            raw_price
                .checked_mul(scale_factor)
                .ok_or(ContractError::PriceScalingOverflow)
        } else {
            let scale_factor = 10_i128.pow((-decimals_diff) as u32);
            raw_price
                .checked_div(scale_factor)
                .ok_or(ContractError::PriceScalingOverflow)
        }
    }
}
