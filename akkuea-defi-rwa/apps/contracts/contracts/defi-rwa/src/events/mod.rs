//! Events module for DeFi RWA contracts
//!
//! This module defines all events emitted by the contracts.
//! Events are indexed and can be queried by off-chain services.

mod lending;
mod property;

pub use lending::LendingEvents;
pub use property::PropertyEvents;
