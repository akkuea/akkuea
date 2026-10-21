//! Inline SEP-40 oracle types (from sep-40-oracle crate)
//!
//! These types are copied from the sep-40-oracle crate to avoid a dependency
//! on that crate, which is pinned to soroban-sdk 25.x and incompatible with 26.x.
//!
//! See: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0040.md

use soroban_sdk::{contractclient, contracttype, Address, Env, Symbol, Vec};

/// Price data for an asset at a specific timestamp
#[contracttype]
#[derive(Clone)]
pub struct PriceData {
    pub price: i128,
    pub timestamp: u64,
}

/// Asset type
#[contracttype]
#[derive(Clone)]
pub enum Asset {
    Stellar(Address),
    Other(Symbol),
}

/// Oracle feed interface description
#[allow(dead_code)]
#[contractclient(name = "PriceFeedClient")]
trait PriceFeedTrait {
    /// Return the base asset the price is reported in
    fn base(env: Env) -> Asset;

    /// Return all assets quoted by the price feed
    fn assets(env: Env) -> Vec<Asset>;

    /// Return the number of decimals for all assets quoted by the oracle
    fn decimals(env: Env) -> u32;

    /// Return default tick period timeframe (in seconds)
    fn resolution(env: Env) -> u32;

    /// Get price in base asset at specific timestamp
    fn price(env: Env, asset: Asset, timestamp: u64) -> Option<PriceData>;

    /// Get last N price records
    fn prices(env: Env, asset: Asset, records: u32) -> Option<Vec<PriceData>>;

    /// Get the most recent price for an asset
    fn lastprice(env: Env, asset: Asset) -> Option<PriceData>;
}
