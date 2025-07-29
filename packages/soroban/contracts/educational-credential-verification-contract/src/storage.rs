use soroban_sdk::{contracttype, symbol_short, Address, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    ReviewCounter(Address),
    Reviews(Address),
}

pub const ADMIN: Symbol = symbol_short!("admin");
pub const REVIEWERS: Symbol = symbol_short!("reviewers");
pub const EDUCATORS: Symbol = symbol_short!("EDU");
pub const DISPUTES: Symbol = symbol_short!("disputes");
pub const ANALYTICS: Symbol = symbol_short!("analytics");
pub const REVOKED: Symbol = symbol_short!("REVOKE");
pub const VERIFIED_CREDS: Symbol = symbol_short!("vcreds");
pub const SIGNATURES: Symbol = symbol_short!("sigs");
pub const AUTH_INST: Symbol = symbol_short!("AUTH_INST");
