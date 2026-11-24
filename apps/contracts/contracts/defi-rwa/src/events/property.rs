use soroban_sdk::{contractevent, Address, Env, String};

/// Emitted when a new property is registered
#[contractevent]
pub struct PropertyRegistered {
    pub property_id: String,
    pub owner: Address,
    pub name: String,
    pub total_shares: i128,
    pub price_per_share: i128,
}

/// Emitted when a property is verified by admin
#[contractevent]
pub struct PropertyVerified {
    pub property_id: String,
    pub verified_by: Address,
    pub timestamp: u64,
}

/// Emitted when shares are transferred
#[contractevent]
pub struct ShareTransfer {
    pub property_id: String,
    pub from: Address,
    pub to: Address,
    pub amount: i128,
}

/// Emitted when shares are purchased from pool
#[contractevent]
pub struct SharePurchase {
    pub property_id: String,
    pub buyer: Address,
    pub shares: i128,
    pub total_cost: i128,
}

/// Emitted when shares are sold back to pool
#[contractevent]
pub struct ShareSale {
    pub property_id: String,
    pub seller: Address,
    pub shares: i128,
    pub proceeds: i128,
}

/// Emitted when dividends are distributed
#[contractevent]
pub struct DividendDistributed {
    pub property_id: String,
    pub total_amount: i128,
    pub per_share_amount: i128,
    pub timestamp: u64,
}

/// Emitted when dividends are claimed
#[contractevent]
pub struct DividendClaimed {
    pub property_id: String,
    pub claimer: Address,
    pub amount: i128,
}

// â”€â”€ Admin action events (#1411) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/// Emitted when the oracle address is updated via `set_oracle` (#1411).
#[contractevent]
pub struct OracleUpdated {
    pub new_oracle: Address,
    pub updated_by: Address,
}

/// Emitted when oracle guardrail parameters are updated via `set_oracle_config` (#1411).
#[contractevent]
pub struct OracleConfigUpdated {
    pub max_age: u64,
    pub min_price: i128,
    pub updated_by: Address,
}

/// Emitted when the EmergencyGuard role is granted (#1411).
#[contractevent]
pub struct EmergencyRoleGranted {
    pub target: Address,
    pub granted_by: Address,
}

/// Emitted when the EmergencyGuard role is revoked (#1411).
#[contractevent]
pub struct EmergencyRoleRevoked {
    pub target: Address,
    pub revoked_by: Address,
}

/// Emitted when a two-step admin transfer is initiated (#1411).
#[contractevent]
pub struct AdminTransferStarted {
    pub current_admin: Address,
    pub pending_admin: Address,
}

/// Emitted when the pending admin accepts and the transfer completes (#1411).
#[contractevent]
pub struct AdminTransferCompleted {
    pub old_admin: Address,
    pub new_admin: Address,
}

/// Emitted when a pending admin transfer is cancelled (#1411).
#[contractevent]
pub struct AdminTransferCancelled {
    pub cancelled_by: Address,
}

/// Event helper functions for property operations
pub struct PropertyEvents;

impl PropertyEvents {
    pub fn property_registered(
        env: &Env,
        property_id: String,
        owner: Address,
        name: String,
        total_shares: i128,
        price_per_share: i128,
    ) {
        PropertyRegistered {
            property_id,
            owner,
            name,
            total_shares,
            price_per_share,
        }
        .publish(env);
    }

    pub fn property_verified(env: &Env, property_id: String, verified_by: Address) {
        PropertyVerified {
            property_id,
            verified_by,
            timestamp: env.ledger().timestamp(),
        }
        .publish(env);
    }

    pub fn share_transfer(
        env: &Env,
        property_id: String,
        from: Address,
        to: Address,
        amount: i128,
    ) {
        ShareTransfer {
            property_id,
            from,
            to,
            amount,
        }
        .publish(env);
    }

    pub fn share_purchase(
        env: &Env,
        property_id: String,
        buyer: Address,
        shares: i128,
        total_cost: i128,
    ) {
        SharePurchase {
            property_id,
            buyer,
            shares,
            total_cost,
        }
        .publish(env);
    }

    pub fn share_sale(
        env: &Env,
        property_id: String,
        seller: Address,
        shares: i128,
        proceeds: i128,
    ) {
        ShareSale {
            property_id,
            seller,
            shares,
            proceeds,
        }
        .publish(env);
    }

    pub fn dividend_distributed(
        env: &Env,
        property_id: String,
        total_amount: i128,
        per_share_amount: i128,
    ) {
        DividendDistributed {
            property_id,
            total_amount,
            per_share_amount,
            timestamp: env.ledger().timestamp(),
        }
        .publish(env);
    }

    pub fn dividend_claimed(env: &Env, property_id: String, claimer: Address, amount: i128) {
        DividendClaimed {
            property_id,
            claimer,
            amount,
        }
        .publish(env);
    }

    // â”€â”€ Admin action event helpers (#1411) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    pub fn oracle_updated(env: &Env, new_oracle: Address, updated_by: Address) {
        OracleUpdated {
            new_oracle,
            updated_by,
        }
        .publish(env);
    }

    pub fn oracle_config_updated(env: &Env, max_age: u64, min_price: i128, updated_by: Address) {
        OracleConfigUpdated {
            max_age,
            min_price,
            updated_by,
        }
        .publish(env);
    }

    pub fn emergency_role_granted(env: &Env, target: Address, granted_by: Address) {
        EmergencyRoleGranted {
            target,
            granted_by,
        }
        .publish(env);
    }

    pub fn emergency_role_revoked(env: &Env, target: Address, revoked_by: Address) {
        EmergencyRoleRevoked {
            target,
            revoked_by,
        }
        .publish(env);
    }

    pub fn admin_transfer_started(env: &Env, current_admin: Address, pending_admin: Address) {
        AdminTransferStarted {
            current_admin,
            pending_admin,
        }
        .publish(env);
    }

    pub fn admin_transfer_completed(env: &Env, old_admin: Address, new_admin: Address) {
        AdminTransferCompleted {
            old_admin,
            new_admin,
        }
        .publish(env);
    }
        AdminTransferCompleted { old_admin, new_admin }.publish(env);
    }

    pub fn admin_transfer_cancelled(env: &Env, cancelled_by: Address) {
        AdminTransferCancelled { cancelled_by }.publish(env);
    }
}
