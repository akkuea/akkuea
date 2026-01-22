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

/// Event helper functions for property operations
pub struct PropertyEvents;

impl PropertyEvents {
    /// Emitted when a new property is registered
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

    /// Emitted when a property is verified by admin
    pub fn property_verified(env: &Env, property_id: String, verified_by: Address) {
        PropertyVerified {
            property_id,
            verified_by,
            timestamp: env.ledger().timestamp(),
        }
        .publish(env);
    }

    /// Emitted when shares are transferred
    pub fn share_transfer(env: &Env, property_id: String, from: Address, to: Address, amount: i128) {
        ShareTransfer {
            property_id,
            from,
            to,
            amount,
        }
        .publish(env);
    }

    /// Emitted when shares are purchased from pool
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

    /// Emitted when shares are sold back to pool
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

    /// Emitted when dividends are distributed
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

    /// Emitted when dividends are claimed
    pub fn dividend_claimed(env: &Env, property_id: String, claimer: Address, amount: i128) {
        DividendClaimed {
            property_id,
            claimer,
            amount,
        }
        .publish(env);
    }
}