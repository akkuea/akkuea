use sep_40_oracle::{Asset, PriceData, PriceFeedClient};
use soroban_sdk::{Address, Env};

use super::keys::LendingKey;

/// Default maximum age for price data (1 hour in seconds).
const DEFAULT_MAX_AGE: u64 = 3600;

/// Oracle price consumer with production-grade guardrails.
///
/// Every price-sensitive code path in the contract MUST go through
/// [`get_price`] (or the equivalent [`get_guarded_price`] alias) so that
/// staleness, validity, and floor checks are applied uniformly.
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
    pub fn get_oracle_address(env: &Env) -> Address {
        env.storage()
            .instance()
            .get(&LendingKey::OracleAddress)
            .expect("Oracle address not configured")
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

    // ─── Guarded Price Fetch ────────────────────────

    /// Fetch the price for `asset` with full production guardrails:
    ///
    /// 1. Rejects missing prices (`None` from oracle).
    /// 2. Rejects zero or negative raw prices.
    /// 3. Rejects stale prices (age > configurable max age).
    /// 4. Normalizes decimals to 18-decimal precision using checked math.
    /// 5. Enforces the configurable minimum price floor after normalization.
    pub fn get_price(env: &Env, asset: &Address) -> i128 {
        let oracle_address = Self::get_oracle_address(env);
        let price_feed_client = PriceFeedClient::new(env, &oracle_address);

        // 1. Fetch price — reject if missing
        let asset_enum = Asset::Stellar(asset.clone());
        let price_data: PriceData = price_feed_client
            .lastprice(&asset_enum)
            .expect("Price not available for asset");

        // 2. Reject zero or negative raw price
        if price_data.price <= 0 {
            panic!("Invalid price: price must be positive");
        }

        // 3. Staleness check — configurable max age
        let current_time = env.ledger().timestamp();
        let max_age = Self::get_max_age(env);
        if current_time > price_data.timestamp && (current_time - price_data.timestamp) > max_age {
            panic!("Price data is stale");
        }

        // 4. Decimal normalization (target = 18 decimals, overflow-safe)
        let oracle_decimals = price_feed_client.decimals();
        let normalized_price = Self::normalize_price(price_data.price, oracle_decimals);

        // 5. Minimum price floor
        let min_price = Self::get_min_price(env);
        if min_price > 0 && normalized_price < min_price {
            panic!("Price below minimum threshold");
        }

        normalized_price
    }

    /// Canonical safe entry point — alias for [`get_price`].
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
    /// purposes — never in risk-sensitive code paths.
    pub fn get_raw_price_data(env: &Env, asset: &Address) -> PriceData {
        let oracle_address = Self::get_oracle_address(env);
        let price_feed_client = PriceFeedClient::new(env, &oracle_address);
        let asset_enum = Asset::Stellar(asset.clone());
        price_feed_client
            .lastprice(&asset_enum)
            .expect("Price not available for asset")
    }

    // ─── Internal Helpers ───────────────────────────

    /// Normalize a price from `oracle_decimals` to 18-decimal precision.
    ///
    /// Uses checked arithmetic to prevent silent overflow.
    fn normalize_price(raw_price: i128, oracle_decimals: u32) -> i128 {
        let decimals_diff = 18_i32 - oracle_decimals as i32;
        if decimals_diff >= 0 {
            let scale_factor = 10_i128.pow(decimals_diff as u32);
            raw_price
                .checked_mul(scale_factor)
                .expect("Price scaling overflow")
        } else {
            let scale_factor = 10_i128.pow((-decimals_diff) as u32);
            raw_price
                .checked_div(scale_factor)
                .expect("Price scaling underflow")
        }
    }
}
