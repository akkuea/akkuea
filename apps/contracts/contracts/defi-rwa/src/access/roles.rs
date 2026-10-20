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
    /// Bounded per-member role index: `RoleMember(Role, index) -> Address`.
    /// Backs `get_role_members` without growing the instance footprint.
    RoleMember(Role, u32),
    /// Number of members currently holding `Role`.
    RoleMemberCount(Role),
    PendingAdmin,
    PendingRecovery,
}

pub struct RoleStorage;

// TTL bump constants (mirror lending module's lending_bump)
pub const ROLE_TTL_THRESHOLD: u32 = 100_000;
pub const ROLE_TTL_EXTEND: u32 = 500_000;

/// Upper bound on members tracked per role. Grants beyond this bound are
/// rejected by callers so the per-member index stays bounded.
pub const MAX_ROLE_MEMBERS: u32 = 100;

impl RoleStorage {
    pub fn has_role(env: &Env, address: &Address, role: &Role) -> bool {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().persistent().get(&key).unwrap_or(false)
    }

    pub fn grant_role(env: &Env, address: &Address, role: &Role) {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        if env.storage().persistent().has(&key) {
            env.storage()
                .persistent()
                .extend_ttl(&key, ROLE_TTL_THRESHOLD, ROLE_TTL_EXTEND);
            return;
        }
        env.storage().persistent().set(&key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&key, ROLE_TTL_THRESHOLD, ROLE_TTL_EXTEND);

        let count_key = RoleKey::RoleMemberCount(role.clone());
        let count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
        let member_key = RoleKey::RoleMember(role.clone(), count);
        env.storage().persistent().set(&member_key, address);
        env.storage()
            .persistent()
            .extend_ttl(&member_key, ROLE_TTL_THRESHOLD, ROLE_TTL_EXTEND);
        env.storage().persistent().set(&count_key, &(count + 1));
        env.storage()
            .persistent()
            .extend_ttl(&count_key, ROLE_TTL_THRESHOLD, ROLE_TTL_EXTEND);
    }

    pub fn revoke_role(env: &Env, address: &Address, role: &Role) {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        if !env.storage().persistent().has(&key) {
            return;
        }
        env.storage().persistent().remove(&key);

        let count_key = RoleKey::RoleMemberCount(role.clone());
        let count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
        let mut i: u32 = 0;
        while i < count {
            let member_key = RoleKey::RoleMember(role.clone(), i);
            let member: Option<Address> = env.storage().persistent().get(&member_key);
            if let Some(m) = member {
                if &m == address {
                    let last_key = RoleKey::RoleMember(role.clone(), count - 1);
                    let last: Option<Address> = env.storage().persistent().get(&last_key);
                    if let Some(last_addr) = last {
                        env.storage().persistent().set(&member_key, &last_addr);
                        env.storage()
                            .persistent()
                            .extend_ttl(&member_key, ROLE_TTL_THRESHOLD, ROLE_TTL_EXTEND);
                    }
                    env.storage().persistent().remove(&last_key);
                    env.storage().persistent().set(&count_key, &(count - 1));
                    env.storage()
                        .persistent()
                        .extend_ttl(&count_key, ROLE_TTL_THRESHOLD, ROLE_TTL_EXTEND);
                    return;
                }
            }
            i += 1;
        }
    }

    /// Returns the bounded list of members currently holding `role`.
    pub fn get_role_members(env: &Env, role: &Role) -> soroban_sdk::Vec<Address> {
        let count_key = RoleKey::RoleMemberCount(role.clone());
        let count: u32 = env.storage().persistent().get(&count_key).unwrap_or(0);
        let mut members = soroban_sdk::Vec::new(env);
        let mut i: u32 = 0;
        while i < count {
            let member_key = RoleKey::RoleMember(role.clone(), i);
            if let Some(m) = env
                .storage()
                .persistent()
                .get::<RoleKey, Address>(&member_key)
            {
                members.push_back(m);
            }
            i += 1;
        }
        members
    }
}
