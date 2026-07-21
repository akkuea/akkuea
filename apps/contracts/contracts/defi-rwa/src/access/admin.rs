use soroban_sdk::{contracterror, Address, Env};

use crate::access::roles::{Role, RoleKey, RoleStorage};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    NotAdmin = 1,
    NotPendingAdmin = 2,
    AlreadyInitialized = 3,
    Unauthorized = 4,
    ContractPaused = 5,
    ContractNotPaused = 6,
}

pub struct AdminControl;

impl AdminControl {
    pub fn initialize(env: &Env, admin: &Address) -> Result<(), ContractError> {
        if Self::is_initialized(env) {
            return Err(ContractError::AlreadyInitialized);
        }

        env.storage().instance().set(&RoleKey::Admin, admin);
        RoleStorage::grant_role(env, admin, &Role::Admin);
        Ok(())
    }

    pub fn is_initialized(env: &Env) -> bool {
        env.storage().instance().has(&RoleKey::Admin)
    }

    pub fn get_admin(env: &Env) -> Option<Address> {
        env.storage().instance().get(&RoleKey::Admin)
    }

    pub fn is_admin(env: &Env, address: &Address) -> bool {
        match Self::get_admin(env) {
            Some(admin) => admin == address.clone(),
            None => false,
        }
    }

    pub fn require_admin(env: &Env, caller: &Address) -> Result<(), ContractError> {
        if !Self::is_admin(env, caller) {
            return Err(ContractError::NotAdmin);
        }
        Ok(())
    }

    pub fn transfer_admin_start(
        env: &Env,
        caller: &Address,
        new_admin: &Address,
    ) -> Result<(), ContractError> {
        Self::require_admin(env, caller)?;
        env.storage()
            .instance()
            .set(&RoleKey::PendingAdmin, new_admin);
        Ok(())
    }

    pub fn transfer_admin_accept(env: &Env, new_admin: &Address) -> Result<(), ContractError> {
        let pending: Option<Address> = env.storage().instance().get(&RoleKey::PendingAdmin);

        match pending {
            Some(pending_admin) if pending_admin == new_admin.clone() => {
                if let Some(old_admin) = Self::get_admin(env) {
                    RoleStorage::revoke_role(env, &old_admin, &Role::Admin);
                }

                env.storage().instance().set(&RoleKey::Admin, new_admin);
                RoleStorage::grant_role(env, new_admin, &Role::Admin);
                env.storage().instance().remove(&RoleKey::PendingAdmin);
                Ok(())
            }
            _ => Err(ContractError::NotPendingAdmin),
        }
    }

    pub fn transfer_admin_cancel(env: &Env, caller: &Address) -> Result<(), ContractError> {
        Self::require_admin(env, caller)?;
        env.storage().instance().remove(&RoleKey::PendingAdmin);
        Ok(())
    }

    pub fn get_pending_admin(env: &Env) -> Option<Address> {
        env.storage().instance().get(&RoleKey::PendingAdmin)
    }
}

pub struct PauseControl;

impl PauseControl {
    pub fn is_paused(env: &Env) -> bool {
        env.storage()
            .instance()
            .get(&RoleKey::Paused)
            .unwrap_or(false)
    }

    pub fn can_pause(env: &Env, address: &Address) -> bool {
        let is_admin = AdminControl::is_admin(env, address);
        let is_pauser = RoleStorage::has_role(env, address, &Role::Pauser);
        let is_emergency_guard = RoleStorage::has_role(env, address, &Role::EmergencyGuard);

        is_admin || is_pauser || is_emergency_guard
    }

    pub fn require_can_pause(env: &Env, address: &Address) -> Result<(), ContractError> {
        if !Self::can_pause(env, address) {
            return Err(ContractError::Unauthorized);
        }
        Ok(())
    }

    pub fn pause(env: &Env, caller: &Address) -> Result<(), ContractError> {
        Self::require_can_pause(env, caller)?;
        env.storage().instance().set(&RoleKey::Paused, &true);
        Ok(())
    }

    pub fn unpause(env: &Env, caller: &Address) -> Result<(), ContractError> {
        Self::require_can_pause(env, caller)?;
        env.storage().instance().remove(&RoleKey::Paused);
        Ok(())
    }

    pub fn require_paused(env: &Env) -> Result<(), ContractError> {
        if !Self::is_paused(env) {
            return Err(ContractError::ContractNotPaused);
        }
        Ok(())
    }

    pub fn require_not_paused(env: &Env) -> Result<(), ContractError> {
        if Self::is_paused(env) {
            return Err(ContractError::ContractPaused);
        }
        Ok(())
    }
}
