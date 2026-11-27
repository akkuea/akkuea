use soroban_sdk::{token, Address, Env, String};

use crate::access::ContractError;

use super::keys::{lending_bump, LendingKey};
use super::oracle::PriceOracle;

/// Direction to round a fixed-point result.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Rounding {
    Down,
    Up,
}

/// Values token amounts in a common 18-decimal unit of the oracle's quote
/// currency, so that debt and collateral are compared on the same scale
/// whatever each token is worth and however many decimals it uses.
///
/// Decimals are read from each token contract once and cached:
/// * the pool asset's decimals are stored per pool when the pool is created,
///   and read and stored on first use for pools created before that;
/// * collateral decimals are cached per asset address on first use.
///
/// Stellar token decimals cannot change after issuance, so the cache never
/// goes stale.
pub struct Valuation;

impl Valuation {
    /// Value of `amount` base units of `asset` in 18-decimal quote units:
    /// `amount * guarded_price / 10^decimals`.
    ///
    /// The price goes through [`PriceOracle::try_get_price`], so staleness,
    /// future-timestamp and floor checks apply to every valued asset.
    pub fn value(
        env: &Env,
        asset: &Address,
        decimals: u32,
        amount: i128,
        rounding: Rounding,
    ) -> Result<i128, ContractError> {
        let price = PriceOracle::try_get_price(env, asset)?;
        Self::value_at_price(price, decimals, amount, rounding)
    }

    /// Same as [`Valuation::value`] with a price already fetched.
    pub fn value_at_price(
        price: i128,
        decimals: u32,
        amount: i128,
        rounding: Rounding,
    ) -> Result<i128, ContractError> {
        mul_div(amount, price, pow10(decimals)?, rounding)
    }

    /// Base units of an asset worth `value` (18-decimal quote units) at
    /// `price`, rounded down so the amount is never worth more than `value`.
    pub fn amount_for_value(
        price: i128,
        decimals: u32,
        value: i128,
    ) -> Result<i128, ContractError> {
        mul_div(value, pow10(decimals)?, price, Rounding::Down)
    }

    /// `a * b / c` without requiring the full product to fit in an `i128`.
    ///
    /// Values in 18-decimal units multiplied by an 18-decimal factor (health
    /// factor, collateral factor, penalty) overflow a plain `checked_mul` at a
    /// few hundred tokens, so those products go through this helper.
    pub fn mul_div(a: i128, b: i128, c: i128, rounding: Rounding) -> Result<i128, ContractError> {
        mul_div(a, b, c, rounding)
    }

    /// Decimals of a pool's asset, read from the token and stored on the
    /// pool if this pool predates the stored value.
    pub fn pool_asset_decimals(env: &Env, pool_id: &String, asset: &Address) -> u32 {
        let key = LendingKey::PoolAssetDecimals(pool_id.clone());
        if let Some(decimals) = env.storage().persistent().get(&key) {
            return decimals;
        }
        let decimals = token::Client::new(env, asset).decimals();
        Self::set_pool_asset_decimals(env, pool_id, decimals);
        decimals
    }

    /// Store a pool asset's decimals.
    pub fn set_pool_asset_decimals(env: &Env, pool_id: &String, decimals: u32) {
        let key = LendingKey::PoolAssetDecimals(pool_id.clone());
        env.storage().persistent().set(&key, &decimals);
        env.storage().persistent().extend_ttl(
            &key,
            lending_bump::PERSISTENT_BUMP,
            lending_bump::PERSISTENT_BUMP,
        );
    }

    /// Decimals of a collateral asset, read from the token on first use and
    /// cached per asset address.
    pub fn collateral_decimals(env: &Env, asset: &Address) -> u32 {
        let key = LendingKey::AssetDecimals(asset.clone());
        if let Some(decimals) = env.storage().persistent().get(&key) {
            return decimals;
        }
        let decimals = token::Client::new(env, asset).decimals();
        env.storage().persistent().set(&key, &decimals);
        env.storage().persistent().extend_ttl(
            &key,
            lending_bump::PERSISTENT_BUMP,
            lending_bump::PERSISTENT_BUMP,
        );
        decimals
    }
}

fn pow10(decimals: u32) -> Result<i128, ContractError> {
    10_i128
        .checked_pow(decimals)
        .ok_or(ContractError::BalanceOverflow)
}

/// `a * b / c` for non-negative operands, computed as
/// `(a / c) * b + (a % c) * b / c` so the full product never has to fit in
/// an `i128`. Every step is checked.
fn mul_div(a: i128, b: i128, c: i128, rounding: Rounding) -> Result<i128, ContractError> {
    if a < 0 || b < 0 || c <= 0 {
        return Err(ContractError::BalanceOverflow);
    }
    let quotient = a.checked_div(c).ok_or(ContractError::BalanceOverflow)?;
    let remainder = a.checked_rem(c).ok_or(ContractError::BalanceOverflow)?;
    let whole = quotient
        .checked_mul(b)
        .ok_or(ContractError::BalanceOverflow)?;
    let part_numerator = remainder
        .checked_mul(b)
        .ok_or(ContractError::BalanceOverflow)?;
    let part = part_numerator
        .checked_div(c)
        .ok_or(ContractError::BalanceOverflow)?;
    let part_remainder = part_numerator
        .checked_rem(c)
        .ok_or(ContractError::BalanceOverflow)?;
    let result = whole
        .checked_add(part)
        .ok_or(ContractError::BalanceOverflow)?;
    if rounding == Rounding::Up && part_remainder != 0 {
        result.checked_add(1).ok_or(ContractError::BalanceOverflow)
    } else {
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PRECISION: i128 = 1_000_000_000_000_000_000;

    #[test]
    fn mul_div_rounds_in_the_requested_direction() {
        assert_eq!(mul_div(10, 1, 3, Rounding::Down), Ok(3));
        assert_eq!(mul_div(10, 1, 3, Rounding::Up), Ok(4));
        assert_eq!(mul_div(9, 1, 3, Rounding::Up), Ok(3));
        assert_eq!(mul_div(0, 7, 3, Rounding::Up), Ok(0));
    }

    #[test]
    fn mul_div_handles_products_wider_than_i128() {
        // 1e30 * 1e18 overflows i128, the result 1e30 does not.
        let a = 1_000_000_000_000_000_000_000_000_000_000_i128;
        assert_eq!(mul_div(a, PRECISION, PRECISION, Rounding::Down), Ok(a));
    }

    #[test]
    fn mul_div_rejects_invalid_operands() {
        assert_eq!(
            mul_div(-1, 1, 1, Rounding::Down),
            Err(ContractError::BalanceOverflow)
        );
        assert_eq!(
            mul_div(1, 1, 0, Rounding::Down),
            Err(ContractError::BalanceOverflow)
        );
    }

    #[test]
    fn value_is_independent_of_token_decimals() {
        // 1.5 tokens at 2.0 is worth 3.0, whether the token uses 6 or 7 decimals.
        let price = 2 * PRECISION;
        let six = Valuation::value_at_price(price, 6, 1_500_000, Rounding::Down);
        let seven = Valuation::value_at_price(price, 7, 15_000_000, Rounding::Down);
        assert_eq!(six, Ok(3 * PRECISION));
        assert_eq!(six, seven);
        assert_eq!(
            Valuation::amount_for_value(price, 6, 3 * PRECISION),
            Ok(1_500_000)
        );
        assert_eq!(
            Valuation::amount_for_value(price, 7, 3 * PRECISION),
            Ok(15_000_000)
        );
    }
}
