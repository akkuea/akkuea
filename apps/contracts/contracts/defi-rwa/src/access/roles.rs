use soroban_sdk::{contracttype, Address, Env};

use crate::storage::property::property_bump;

// Minimum seconds that must elapse between scheduling and executing recovery
pub const TIMELOCK_DURATION: u64 = 86_400; // 24 hours

#[derive(Debug, PartialEq, Clone)]
#[contracttype]
pub enum Role {
    // Full administrative privileges
    Admin,
    // Right to Pause/Resume Contracts
    Pauser,
    // Right to update oracle prices
    Oracle,
    // Right to verify property
    Verifier,
    // Right to execute liquidations
    Liquidator,
    // Right to initiate emergency pause
    EmergencyGuard,
}

#[derive(Clone)]
#[contracttype]
pub struct PendingRecoveryData {
    pub scheduled_by: Address,
    pub scheduled_at: u64,
    pub earliest_execution: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum RoleKey {
    Admin,
    Paused,
    HasRole(Address, Role),
    PendingAdmin,
    PendingRecovery,
}

pub struct RoleStorage;

impl RoleStorage {
    pub fn has_role(env: &Env, address: &Address, role: &Role) -> bool {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        let value = env
            .storage()
            .persistent()
            .get(&key)
            .or_else(|| env.storage().instance().get(&key))
            .unwrap_or(false);
        if env.storage().persistent().has(&key) {
            env.storage().persistent().extend_ttl(
                &key,
                property_bump::PERSISTENT_THRESHOLD,
                property_bump::PERSISTENT_BUMP,
            );
        }
        value
    }

    pub fn grant_role(env: &Env, address: &Address, role: &Role) {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().persistent().set(&key, &true);
        env.storage().persistent().extend_ttl(
            &key,
            property_bump::PERSISTENT_THRESHOLD,
            property_bump::PERSISTENT_BUMP,
        );
    }

    pub fn revoke_role(env: &Env, address: &Address, role: &Role) {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().persistent().remove(&key);
        env.storage().instance().remove(&key);
    }
}
