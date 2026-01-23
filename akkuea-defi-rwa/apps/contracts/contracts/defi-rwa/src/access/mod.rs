pub mod roles;
pub mod admin;

pub use admin::{AdminControl, PauseControl};
pub use roles::{RoleStorage, Role};

use soroban_sdk::{Env, Address};

pub fn require_role(env: &Env, caller: &Address, role: &Role) {
    if !RoleStorage::has_role(env, caller, role) {
        panic!("Caller does not have required role");
    }
}

pub fn required_admin_or_role(env: &Env, caller: &Address, role: &Role) {
    let is_admin = RoleStorage::has_role(env, caller, role);
    let has_role = RoleStorage::has_role(env, caller, role);

    if !is_admin || !has_role {
        panic!("Caller is not authorized")
    }
}

pub fn require_active_and_authorized(env: &Env, address: &Address, role: Option<&Role>) {
    PauseControl::require_not_paused(env);

    match role {
        Some(r) => required_admin_or_role(env, address, r),
        _ => AdminControl::require_admin(env, address),
    }
}