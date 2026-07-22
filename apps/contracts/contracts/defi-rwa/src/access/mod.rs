pub mod admin;
pub mod emergency;
pub mod roles;

pub use admin::{AdminControl, ContractError, PauseControl};
pub use emergency::TimelockControl;
pub use roles::{PendingRecoveryData, Role, RoleStorage};

use soroban_sdk::{Address, Env};

pub fn require_role(env: &Env, caller: &Address, role: &Role) -> Result<(), ContractError> {
    if !RoleStorage::has_role(env, caller, role) {
        return Err(ContractError::Unauthorized);
    }
    Ok(())
}

pub fn require_admin_or_role(
    env: &Env,
    caller: &Address,
    role: &Role,
) -> Result<(), ContractError> {
    let is_admin = AdminControl::is_admin(env, caller);
    let has_role = RoleStorage::has_role(env, caller, role);

    if !is_admin && !has_role {
        return Err(ContractError::Unauthorized);
    }
    Ok(())
}

pub fn require_active_and_authorized(
    env: &Env,
    address: &Address,
    role: Option<&Role>,
) -> Result<(), ContractError> {
    PauseControl::require_not_paused(env)?;

    match role {
        Some(r) => require_admin_or_role(env, address, r),
        None => AdminControl::require_admin(env, address),
    }
}
