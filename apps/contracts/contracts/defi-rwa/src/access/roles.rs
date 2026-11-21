use soroban_sdk::{contracttype, Address, Env, Vec};

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
    RoleMembers(Role),
    PendingAdmin,
    PendingRecovery,
}

pub struct RoleStorage;

impl RoleStorage {
    pub fn has_role(env: &Env, address: &Address, role: &Role) -> bool {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().persistent().get(&key).unwrap_or(false)
    }

    pub fn grant_role(env: &Env, address: &Address, role: &Role) {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().persistent().set(&key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&key, crate::storage::keys::LEDGER_BUMP_THRESHOLD, crate::storage::keys::LEDGER_BUMP_EXTEND);
    }

    pub fn revoke_role(env: &Env, address: &Address, role: &Role) {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().persistent().remove(&key);
    }

    pub fn get_role_members(env: &Env, role: &Role) -> Vec<Address> {
        let key = RoleKey::RoleMembers(role.clone());
        env.storage().instance().get(&key).unwrap_or(Vec::new(env))
    }
}
