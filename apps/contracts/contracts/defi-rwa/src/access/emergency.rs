use soroban_sdk::{Address, Env};

use crate::access::admin::AdminControl;
use crate::access::admin::PauseControl;
use crate::access::roles::{PendingRecoveryData, RoleKey, TIMELOCK_DURATION};
use crate::events::EmergencyEvents;

pub struct TimelockControl;

impl TimelockControl {
    pub fn get_pending_recovery(env: &Env) -> Option<PendingRecoveryData> {
        env.storage().instance().get(&RoleKey::PendingRecovery)
    }

    pub fn schedule_recovery(env: &Env, caller: &Address) {
        AdminControl::require_admin(env, caller);
        PauseControl::require_paused(env);

        if Self::get_pending_recovery(env).is_some() {
            panic!("Recovery already scheduled");
        }

        let now = env.ledger().timestamp();
        let earliest_execution = now
            .checked_add(TIMELOCK_DURATION)
            .expect("Timelock timestamp overflow");

        let record = PendingRecoveryData {
            scheduled_by: caller.clone(),
            scheduled_at: now,
            earliest_execution,
        };

        env.storage()
            .instance()
            .set(&RoleKey::PendingRecovery, &record);

        EmergencyEvents::recovery_scheduled(env, caller.clone(), earliest_execution);
    }

    pub fn cancel_recovery(env: &Env, caller: &Address) {
        AdminControl::require_admin(env, caller);

        if Self::get_pending_recovery(env).is_none() {
            panic!("No recovery scheduled");
        }

        env.storage().instance().remove(&RoleKey::PendingRecovery);

        EmergencyEvents::recovery_cancelled(env, caller.clone());
    }

    pub fn execute_recovery(env: &Env, caller: &Address) {
        AdminControl::require_admin(env, caller);

        let record = Self::get_pending_recovery(env).expect("No recovery scheduled");

        let now = env.ledger().timestamp();
        if now < record.earliest_execution {
            panic!("Timelock not expired");
        }

        env.storage().instance().remove(&RoleKey::Paused);
        env.storage().instance().remove(&RoleKey::PendingRecovery);

        EmergencyEvents::recovery_executed(env, caller.clone());
    }
}
