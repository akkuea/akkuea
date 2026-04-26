use soroban_sdk::{contractevent, Address, Env};

/// Emitted when the contract is paused via the emergency path
#[contractevent]
pub struct EmergencyPaused {
    pub by: Address,
    pub timestamp: u64,
}

/// Emitted when a timelocked recovery is scheduled
#[contractevent]
pub struct RecoveryScheduled {
    pub by: Address,
    pub earliest_execution: u64,
    pub timestamp: u64,
}

/// Emitted when a pending recovery is cancelled without unpausing
#[contractevent]
pub struct RecoveryCancelled {
    pub by: Address,
    pub timestamp: u64,
}

/// Emitted when the recovery is executed and the contract resumes
#[contractevent]
pub struct RecoveryExecuted {
    pub by: Address,
    pub timestamp: u64,
}

pub struct EmergencyEvents;

impl EmergencyEvents {
    /// Emit an emergency-pause event
    pub fn emergency_paused(env: &Env, by: Address) {
        EmergencyPaused {
            by,
            timestamp: env.ledger().timestamp(),
        }
        .publish(env);
    }

    /// Emit a recovery-scheduled event
    pub fn recovery_scheduled(env: &Env, by: Address, earliest_execution: u64) {
        RecoveryScheduled {
            by,
            earliest_execution,
            timestamp: env.ledger().timestamp(),
        }
        .publish(env);
    }

    /// Emit a recovery-cancelled event
    pub fn recovery_cancelled(env: &Env, by: Address) {
        RecoveryCancelled {
            by,
            timestamp: env.ledger().timestamp(),
        }
        .publish(env);
    }

    /// Emit a recovery-executed event
    pub fn recovery_executed(env: &Env, by: Address) {
        RecoveryExecuted {
            by,
            timestamp: env.ledger().timestamp(),
        }
        .publish(env);
    }
}
