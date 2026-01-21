use soroban_sdk::{symbol_short, Address, Env, String, Symbol};

/// Event topics for property operations
pub struct PropertyEvents;

impl PropertyEvents {
    /// Emitted when a new property is registered
    ///
    /// Topics: ["property_registered", property_id]
    /// Data: (owner, name, total_shares, price_per_share)
    pub fn property_registered(
        env: &Env,
        property_id: &String,
        owner: &Address,
        name: &String,
        total_shares: i128,
        price_per_share: i128,
    ) {
        let topics = (symbol_short!("prop_reg"), property_id.clone());
        env.events().publish(
            topics,
            (owner.clone(), name.clone(), total_shares, price_per_share),
        );
    }

    /// Emitted when a property is verified by admin
    ///
    /// Topics: ["property_verified", property_id]
    /// Data: (verified_by, timestamp)
    pub fn property_verified(
        env: &Env,
        property_id: &String,
        verified_by: &Address,
    ) {
        let topics = (symbol_short!("prop_ver"), property_id.clone());
        let timestamp = env.ledger().timestamp();
        env.events().publish(topics, (verified_by.clone(), timestamp));
    }

    /// Emitted when shares are transferred
    ///
    /// Topics: ["share_transfer", property_id, from]
    /// Data: (to, amount)
    pub fn share_transfer(
        env: &Env,
        property_id: &String,
        from: &Address,
        to: &Address,
        amount: i128,
    ) {
        let topics = (symbol_short!("share_xfr"), property_id.clone(), from.clone());
        env.events().publish(topics, (to.clone(), amount));
    }

    /// Emitted when shares are purchased from pool
    ///
    /// Topics: ["share_purchase", property_id, buyer]
    /// Data: (shares, total_cost)
    pub fn share_purchase(
        env: &Env,
        property_id: &String,
        buyer: &Address,
        shares: i128,
        total_cost: i128,
    ) {
        let topics = (symbol_short!("share_buy"), property_id.clone(), buyer.clone());
        env.events().publish(topics, (shares, total_cost));
    }

    /// Emitted when shares are sold back to pool
    ///
    /// Topics: ["share_sale", property_id, seller]
    /// Data: (shares, proceeds)
    pub fn share_sale(
        env: &Env,
        property_id: &String,
        seller: &Address,
        shares: i128,
        proceeds: i128,
    ) {
        let topics = (symbol_short!("share_sel"), property_id.clone(), seller.clone());
        env.events().publish(topics, (shares, proceeds));
    }

    /// Emitted when dividends are distributed
    ///
    /// Topics: ["dividend", property_id]
    /// Data: (total_amount, per_share_amount, timestamp)
    pub fn dividend_distributed(
        env: &Env,
        property_id: &String,
        total_amount: i128,
        per_share_amount: i128,
    ) {
        let topics = (symbol_short!("dividend"), property_id.clone());
        let timestamp = env.ledger().timestamp();
        env.events()
            .publish(topics, (total_amount, per_share_amount, timestamp));
    }

    /// Emitted when dividends are claimed
    ///
    /// Topics: ["dividend_claim", property_id, claimer]
    /// Data: (amount)
    pub fn dividend_claimed(
        env: &Env,
        property_id: &String,
        claimer: &Address,
        amount: i128,
    ) {
        let topics = (
            symbol_short!("div_claim"),
            property_id.clone(),
            claimer.clone(),
        );
        env.events().publish(topics, amount);
    }
}