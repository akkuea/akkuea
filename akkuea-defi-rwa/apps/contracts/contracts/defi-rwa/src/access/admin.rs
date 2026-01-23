use soroban_sdk::{Address, Env};

use crate::access::{roles::{RoleKey, RoleStorage, Role}};

#[derive(Debug)]
pub enum AdminError {
    NotAdmin,
    NotPendingAdmin,
    AlreadyInitialized,
    ZeroAddress
}

pub struct AdminControl;

impl AdminControl {
    pub fn initialize(env: &Env, admin: &Address) {
        if Self::is_initialized(env) {
            panic!("Admin already initialized")
        }

        env.storage().instance().set(&RoleKey::Admin, admin);
        RoleStorage::grant_role(env, admin, &Role::ADMIN);
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
            None => false
        }
    }

    pub fn require_admin(env: &Env, caller: &Address) {
        if !Self::is_admin(env, caller) {
            panic!("Caller not admin")
        }
    }

    pub fn transfer_admin_start(env: &Env, caller: &Address, new_admin: &Address) {
        Self::require_admin(env, caller);
        env.storage().instance().set(&RoleKey::PendingAdmin, new_admin);
    }

    pub fn transfer_admin_accept(env: &Env, new_admin: &Address) {
        let pending: Option<Address> = env.storage().instance().get(&RoleKey::PendingAdmin);

        match pending {
            Some(pending_admin) => if pending_admin == new_admin.clone() {
                if let Some(old_admin) = Self::get_admin(env) {
                    RoleStorage::revoke_role(env, &old_admin, &Role::ADMIN);
                }

                env.storage().instance().set(&RoleKey::Admin, new_admin);
                RoleStorage::grant_role(env, new_admin, &Role::ADMIN);
                env.storage().instance().remove(&RoleKey::PendingAdmin);
            },
            _ => panic!("Caller is not pending admin"),
        }
    }

    pub fn transfer_admin_cancel(env: &Env, caller: &Address) {
        Self::require_admin(env, caller);
        env.storage().instance().remove(&RoleKey::PendingAdmin);
    }

    pub fn get_pending_admin(env: &Env) -> Option<Address> {
        env.storage().instance().get(&RoleKey::PendingAdmin)
    }
}

pub struct PauseControl;

impl PauseControl {
    pub fn is_paused(env: &Env) -> bool {
        env.storage().instance().get(&RoleKey::Paused).unwrap_or(false)
    }

    pub fn can_pause(env: &Env, address: &Address) -> bool {
        let is_admin = AdminControl::is_admin(env, address);
        let is_pauser = RoleStorage::has_role(env, address, &Role::PAUSER);

        is_admin || is_pauser
    }

    pub fn require_can_pause(env: &Env, address: &Address) {
        let can_pause = Self::can_pause(env, address);
        if !can_pause {
            panic!("Caller does not have permission to pause")
        }
    }

    pub fn pause(env: &Env, caller: &Address) {
        Self::require_can_pause(env, caller);
        env.storage().instance().set(&RoleKey::Paused, &true);
    }

    pub fn unpause(env: &Env, caller: &Address) {
        Self::require_can_pause(env, caller);
        env.storage().instance().remove(&RoleKey::Paused);
    }

    pub fn require_paused(env: &Env) {
        if !Self::is_paused(env) {
            panic!("Contract not paused")
        }
    }

    pub fn require_not_paused(env: &Env) {
        if Self::is_paused(env) {
            panic!("Contract paused")
        }
    }

}