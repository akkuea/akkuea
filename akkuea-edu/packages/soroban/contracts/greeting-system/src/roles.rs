use crate::error::Error;
use crate::events::emit_role_changed;
use crate::storage::{get_owner_key, get_role_key};
use crate::utils::get_current_timestamp;
use soroban_sdk::{contracttype, Address, Env, String};

/// User roles in the system
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
#[contracttype]
pub enum Role {
    Admin,
    Moderator,
    User,
    None,
}

impl Role {
    /// Convert string to Role enum
    pub fn from_string(env: &Env, role_str: &String) -> Result<Role, Error> {
        if role_str == &String::from_str(env, "admin") {
            Ok(Role::Admin)
        } else if role_str == &String::from_str(env, "moderator") {
            Ok(Role::Moderator)
        } else if role_str == &String::from_str(env, "user") {
            Ok(Role::User)
        } else if role_str == &String::from_str(env, "none") {
            Ok(Role::None)
        } else {
            Err(Error::InvalidRole)
        }
    }

    /// Convert Role enum to string
    pub fn to_string(&self, env: &Env) -> String {
        match self {
            Role::Admin => String::from_str(env, "admin"),
            Role::Moderator => String::from_str(env, "moderator"),
            Role::User => String::from_str(env, "user"),
            Role::None => String::from_str(env, "none"),
        }
    }
}

/// Role change event data
#[derive(Clone)]
#[contracttype]
pub struct RoleChangeEvent {
    pub user: Address,
    pub old_role: Role,
    pub new_role: Role,
    pub assigned_by: Address,
    pub timestamp: u64,
}

/// Check if the caller is an admin
pub fn require_admin(env: &Env, caller: &Address) -> Result<(), Error> {
    let role = get_role_internal(env, caller);
    match role {
        Role::Admin => Ok(()),
        _ => Err(Error::UnauthorizedRole),
    }
}

/// Get a user's role (internal helper)
pub fn get_role_internal(env: &Env, user: &Address) -> Role {
    let key = get_role_key(user);
    env.storage().persistent().get(&key).unwrap_or(Role::None)
}

/// Set a user's role (internal helper)
pub fn set_role_internal(
    env: &Env,
    user: &Address,
    role: Role,
    assigned_by: &Address,
) -> Result<(), Error> {
    let old_role = get_role_internal(env, user);
    let key = get_role_key(user);

    env.storage().persistent().set(&key, &role);

    // Emit role change event
    let timestamp = get_current_timestamp(env);
    let event = RoleChangeEvent {
        user: user.clone(),
        old_role,
        new_role: role,
        assigned_by: assigned_by.clone(),
        timestamp,
    };
    emit_role_changed(env, &event)?;

    Ok(())
}

/// Initialize the contract owner as admin
pub fn initialize_owner(env: &Env, owner: &Address) -> Result<(), Error> {
    let owner_key = get_owner_key();

    if env.storage().persistent().has(&owner_key) {
        return Err(Error::ContractAlreadyInitialized);
    }

    env.storage().persistent().set(&owner_key, owner);

    // Set owner as admin
    let role_key = get_role_key(owner);
    env.storage().persistent().set(&role_key, &Role::Admin);

    Ok(())
}

/// Get the contract owner
pub fn get_owner(env: &Env) -> Result<Address, Error> {
    let key = get_owner_key();
    env.storage()
        .persistent()
        .get(&key)
        .ok_or(Error::ContractNotInitialized)
}

/// Check if a user has a specific role
pub fn has_role(env: &Env, user: &Address, role: &Role) -> bool {
    let current_role = get_role_internal(env, user);
    &current_role == role
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_role_from_string() {
        let env = Env::default();
        let admin_str = String::from_str(&env, "admin");
        let role = Role::from_string(&env, &admin_str).unwrap();
        assert_eq!(role, Role::Admin);
    }

    #[test]
    fn test_role_to_string() {
        let env = Env::default();
        let role = Role::Moderator;
        let role_str = role.to_string(&env);
        assert_eq!(role_str, String::from_str(&env, "moderator"));
    }
}
