use soroban_sdk::{contracttype, Address, Env};

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

/// Storage keys owned by the access module.
///
/// `Admin` is the single canonical admin key for the contract. It is written
/// and read only through `AdminControl`; the former `StorageKey::Admin` and
/// `LendingKey::Admin` variants were deleted so no second admin copy can drift.
#[derive(Clone)]
#[contracttype]
pub enum RoleKey {
    /// Canonical admin address. Managed exclusively by `AdminControl`.
    Admin,
    Paused,
    /// Per-member role marker: `HasRole(address, role)`. Stored in persistent
    /// storage so role grants never grow the instance footprint.
    HasRole(Address, Role),
    /// Reserved. The former unbounded member `Vec` is no longer written;
    /// the variant is kept so the keys after it keep their existing
    /// storage discriminants.
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
        env.storage().persistent().get(&key).unwrap_or(false)
    }

    pub fn grant_role(env: &Env, address: &Address, role: &Role) {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().persistent().set(&key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&key, ROLE_TTL_THRESHOLD, ROLE_TTL_EXTEND);
    }

    pub fn revoke_role(env: &Env, address: &Address, role: &Role) {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().persistent().remove(&key);
    }
}
