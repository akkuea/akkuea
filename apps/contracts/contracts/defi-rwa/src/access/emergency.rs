use soroban_sdk::Address;
use soroban_sdk::Env;

use crate::access::admin::AdminControl;
use crate::access::admin::ContractError;
use crate::access::admin::PauseControl;
use crate::access::roles::{PendingRecoveryData, RoleKey, TIMELOCK_DURATION};
use crate::events::EmergencyEvents;

pub struct TimelockControl;

impl TimelockControl {
    pub fn get_pending_recovery(env: &Env) -> Option<PendingRecoveryData> {
        env.storage().instance().get(&RoleKey::PendingRecovery)
    }

    pub fn schedule_recovery(env: &Env, caller: &Address) -> Result<(), ContractError> {
        AdminControl::require_admin(env, caller)?;
        PauseControl::require_paused(env)?;

        if Self::get_pending_recovery(env).is_some() {
            return Err(ContractError::RecoveryAlreadyScheduled);
        }

        let now = env.ledger().timestamp();
        let earliest_execution = now
            .checked_add(TIMELOCK_DURATION)
            .ok_or(ContractError::TimelockOverflow)?;

        let record = PendingRecoveryData {
            scheduled_by: caller.clone(),
            scheduled_at: now,
            earliest_execution,
        };

        env.storage()
            .instance()
            .set(&RoleKey::PendingRecovery, &record);

        EmergencyEvents::recovery_scheduled(env, caller.clone(), earliest_execution);
        Ok(())
    }

    pub fn cancel_recovery(env: &Env, caller: &Address) -> Result<(), ContractError> {
        AdminControl::require_admin(env, caller)?;

        if Self::get_pending_recovery(env).is_none() {
            return Err(ContractError::NoRecoveryScheduled);
        }

        env.storage().instance().remove(&RoleKey::PendingRecovery);

        EmergencyEvents::recovery_cancelled(env, caller.clone());
        Ok(())
    }

    pub fn execute_recovery(env: &Env, caller: &Address) -> Result<(), ContractError> {
        AdminControl::require_admin(env, caller)?;

        let record = Self::get_pending_recovery(env)
            .ok_or(ContractError::NoRecoveryScheduled)?;

        let now = env.ledger().timestamp();
        if now < record.earliest_execution {
            return Err(ContractError::TimelockNotExpired);
        }

        env.storage().instance().remove(&RoleKey::Paused);
        env.storage().instance().remove(&RoleKey::PendingRecovery);

        EmergencyEvents::recovery_executed(env, caller.clone());
        Ok(())
    }
}
