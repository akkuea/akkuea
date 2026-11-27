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
    /// Per-member role flag: stored in instance storage.
    /// Presence (= true) means the address holds the role.
    HasRole(Address, Role),
    /// DEPRECATED: previously held a Vec<Address> of all members for a role.
    /// Replaced by per-member HasRole keys to avoid a growing Vec in instance
    /// storage that was scanned linearly on every grant/revoke and loaded on
    /// every contract invocation. Kept as a variant so existing storage slots
    /// can be cleaned up during migration, but no new writes use it (#1411).
    RoleMembers(Role),
    PendingAdmin,
    PendingRecovery,
}

pub struct RoleStorage;

impl RoleStorage {
    /// Check whether `address` holds `role`.
    /// Uses a per-member persistent key â€” O(1) on every call.
    pub fn has_role(env: &Env, address: &Address, role: &Role) -> bool {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().instance().get(&key).unwrap_or(false)
    }

    /// Grant `role` to `address`.
    ///
    /// Writes only the per-member flag key (#1411).  The deprecated
    /// `RoleMembers` Vec is no longer updated, so instance storage size stays
    /// constant regardless of how many members hold a given role.
    pub fn grant_role(env: &Env, address: &Address, role: &Role) {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().instance().set(&key, &true);
    }

    /// Revoke `role` from `address`.
    pub fn revoke_role(env: &Env, address: &Address, role: &Role) {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().instance().remove(&key);
    }

    /// List all members of `role`.
    ///
    /// Reads from the deprecated `RoleMembers` Vec for backward compatibility
    /// with any existing data. New code should not rely on this being complete
    /// because `grant_role` no longer writes to it. This function is preserved
    /// so off-chain tooling that reads the member list still compiles; a
    /// follow-up migration can delete the old entries and remove this method.
    pub fn get_role_members(env: &Env, role: &Role) -> Vec<Address> {
        let key = RoleKey::RoleMembers(role.clone());
        env.storage().instance().get(&key).unwrap_or(Vec::new(env))
    }
}
