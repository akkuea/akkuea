use soroban_sdk::{contractevent, Address, Env};

/// Emitted when the oracle address is updated.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OracleSet {
    #[topic]
    pub admin: Address,
    pub oracle: Address,
}

/// Emitted when the oracle guardrail configuration is updated.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OracleConfigSet {
    #[topic]
    pub admin: Address,
    pub max_age: u64,
    pub min_price: i128,
}

/// Emitted when an emergency guard role is granted.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmergencyRoleGranted {
    #[topic]
    pub admin: Address,
    pub target: Address,
}

/// Emitted when an emergency guard role is revoked.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EmergencyRoleRevoked {
    #[topic]
    pub admin: Address,
    pub target: Address,
}

/// Event helpers for privileged admin actions.
pub struct AdminEvents;

impl AdminEvents {
    pub fn oracle_set(env: &Env, admin: Address, oracle: Address) {
        OracleSet { admin, oracle }.publish(env);
    }

    pub fn oracle_config_set(env: &Env, admin: Address, max_age: u64, min_price: i128) {
        OracleConfigSet {
            admin,
            max_age,
            min_price,
        }
        .publish(env);
    }

    pub fn emergency_role_granted(env: &Env, admin: Address, target: Address) {
        EmergencyRoleGranted { admin, target }.publish(env);
    }

    pub fn emergency_role_revoked(env: &Env, admin: Address, target: Address) {
        EmergencyRoleRevoked { admin, target }.publish(env);
    }
}
