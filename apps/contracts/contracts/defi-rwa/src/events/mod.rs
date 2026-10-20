//! Events module for DeFi RWA contracts
///
/// This module defines all events emitted by the contracts.
/// Events are indexed and can be queried by off-chain services.
mod admin;
mod emergency;
mod lending;
mod property;

pub use admin::{
    AdminEvents, EmergencyRoleGranted, EmergencyRoleRevoked, OracleConfigSet, OracleSet,
};
pub use emergency::EmergencyEvents;
pub use lending::LendingEvents;
pub use property::PropertyEvents;
