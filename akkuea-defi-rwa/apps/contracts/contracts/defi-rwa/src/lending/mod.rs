// Lending module for DeFi RWA
// This module provides storage structures and helpers for the lending pool functionality.
// This module is used to store the lending pool configuration, deposit positions, borrow positions, and interest rate model.

mod interest;
mod keys;
mod pool;
mod positions;

pub use interest::{InterestRateModel, InterestStorage, PRECISION, SECONDS_PER_YEAR};
pub use keys::{lending_bump, LendingKey};
pub use pool::{LendingPool, PoolStorage};
pub use positions::{BorrowPosition, DepositPosition, PositionStorage};