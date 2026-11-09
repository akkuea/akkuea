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

/// Emitted when an emergency guard role is granted
#[contractevent]
pub struct EmergencyRoleGranted {
    pub admin: Address,
    pub target: Address,
    pub timestamp: u64,
}

/// Emitted when an emergency guard role is revoked
#[contractevent]
pub struct EmergencyRoleRevoked {
    pub admin: Address,
    pub target: Address,
    pub timestamp: u64,
}

/// Emitted when a two-step admin transfer is initiated
#[contractevent]
pub struct AdminTransferStarted {
    pub current_admin: Address,
    pub pending_admin: Address,
    pub timestamp: u64,
}

/// Emitted when a pending admin accepts the admin transfer
#[contractevent]
pub struct AdminTransferAccepted {
    pub old_admin: Option<Address>,
    pub new_admin: Address,
    pub timestamp: u64,
}

/// Emitted when a pending admin transfer is cancelled
#[contractevent]
pub struct AdminTransferCancelled {
    pub admin: Address,
    pub timestamp: u64,
}

/// Emitted when the price oracle contract address is updated
#[contractevent]
pub struct OracleAddressUpdated {
    pub admin: Address,
    pub oracle_address: Address,
    pub timestamp: u64,
}

/// Emitted when the price oracle guardrail configuration is updated
#[contractevent]
pub struct OracleConfigUpdated {
    pub admin: Address,
    pub max_age: u64,
    pub min_price: i128,
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

    /// Emit an emergency-role-granted event
    pub fn emergency_role_granted(env: &Env, admin: Address, target: Address) {
        EmergencyRoleGranted {
            admin,
            target,
            timestamp: env.ledger().timestamp(),
        }
        .publish(env);
    }

    /// Emit an emergency-role-revoked event
    pub fn emergency_role_revoked(env: &Env, admin: Address, target: Address) {
        EmergencyRoleRevoked {
            admin,
            target,
            timestamp: env.ledger().timestamp(),
        }
        .publish(env);
    }

    /// Emit an admin-transfer-started event
    pub fn admin_transfer_started(env: &Env, current_admin: Address, pending_admin: Address) {
        AdminTransferStarted {
            current_admin,
            pending_admin,
            timestamp: env.ledger().timestamp(),
        }
        .publish(env);
    }

    /// Emit an admin-transfer-accepted event
    pub fn admin_transfer_accepted(env: &Env, old_admin: Option<Address>, new_admin: Address) {
        AdminTransferAccepted {
            old_admin,
            new_admin,
            timestamp: env.ledger().timestamp(),
        }
        .publish(env);
    }

    /// Emit an admin-transfer-cancelled event
    pub fn admin_transfer_cancelled(env: &Env, admin: Address) {
        AdminTransferCancelled {
            admin,
            timestamp: env.ledger().timestamp(),
        }
        .publish(env);
    }

    /// Emit an oracle-address-updated event
    pub fn oracle_updated(env: &Env, admin: Address, oracle_address: Address) {
        OracleAddressUpdated {
            admin,
            oracle_address,
            timestamp: env.ledger().timestamp(),
        }
        .publish(env);
    }

    /// Emit an oracle-config-updated event
    pub fn oracle_config_updated(env: &Env, admin: Address, max_age: u64, min_price: i128) {
        OracleConfigUpdated {
            admin,
            max_age,
            min_price,
            timestamp: env.ledger().timestamp(),
        }
        .publish(env);
    }
}
