use soroban_sdk::{contracttype, Address, Env, Vec};

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
}

#[derive(Clone)]
#[contracttype]
pub enum RoleKey {
    Admin,
    Paused,
    HasRole(Address, Role),
    RoleMembers(Role),
    PendingAdmin,
}

pub struct RoleStorage;

impl RoleStorage {
    pub fn has_role(env: &Env, address: &Address, role: &Role) -> bool {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().instance().get(&key).unwrap_or(false)
    }

    pub fn grant_role(env: &Env, address: &Address, role: &Role) {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().instance().set(&key, &true);

        let members_key = RoleKey::RoleMembers(role.clone());
        let mut members: Vec<Address> = env
            .storage()
            .instance()
            .get(&members_key)
            .unwrap_or(Vec::new(env));

        let mut exists = false;
        for i in 0..members.len() {
            if members.get(i).unwrap() == address.clone() {
                exists = true;
                break;
            }
        }
        if !exists {
            members.push_back(address.clone());
            env.storage().instance().set(&members_key, &members);
        }
    }

    pub fn revoke_role(env: &Env, address: &Address, role: &Role) {
        let key = RoleKey::HasRole(address.clone(), role.clone());
        env.storage().instance().remove(&key);

        let members_key = RoleKey::RoleMembers(role.clone());
        if let Some(members) = env
            .storage()
            .instance()
            .get::<RoleKey, Vec<Address>>(&members_key)
        {
            let mut new_members: Vec<Address> = Vec::new(env);
            for i in 0..members.len() {
                let member = members.get(i).unwrap();
                if member != address.clone() {
                    new_members.push_back(member);
                }
            }
            env.storage().instance().set(&members_key, &new_members);
        }
    }

    pub fn get_role_members(env: &Env, role: &Role) -> Vec<Address> {
        let key = RoleKey::RoleMembers(role.clone());
        env.storage().instance().get(&key).unwrap_or(Vec::new(env))
    }
}
