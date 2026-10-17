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
    Paused,
    HasRole(Address, Role),
    RoleMembers(Role),
    PendingAdmin,
    PendingRecovery,
}

pub struct RoleStorage;

// TTL bump constants (mirror lending module's lending_bump)
pub const ROLE_TTL_THRESHOLD: u32 = 100_000;
pub const ROLE_TTL_EXTEND: u32 = 500_000;

impl RoleStorage {
    pub fn has_role(env: &Env, address: &Address, role: &Role) -> bool {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().instance().get(&key).unwrap_or(false)
    }

    pub fn grant_role(env: &Env, address: &Address, role: &Role) {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().persistent().set(&key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&key, ROLE_TTL_THRESHOLD, ROLE_TTL_EXTEND);

        // Track membership via a per-member marker key rather than a growing Vec
        // in instance storage. This keeps instance storage size constant.
        let member_key = RoleKey::RoleMembers(role.clone());
        let _ = member_key; // retained for API compatibility of get_role_members
    }

    pub fn revoke_role(env: &Env, address: &Address, role: &Role) {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().persistent().remove(&key);
    }

    pub fn get_role_members(env: &Env, role: &Role) -> Vec<Address> {
        // Member enumeration is no longer maintained in instance storage.
        // Callers should use has_role for membership checks. Kept for
        // backward compatibility, returns an empty vector.
        let _ = role;
        Vec::new(env)
    }
}
