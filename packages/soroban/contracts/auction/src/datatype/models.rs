use super::enums::{AuctionStatus, DisputeStatus, ProductCondition, ShippingStatus};
use soroban_sdk::{contracttype, Address, BytesN, String, Vec};

/// Product information
#[contracttype]
#[derive(Clone)]
pub struct Product {
    pub id: BytesN<32>,
    pub name: String,
    pub description: String,
    pub condition: ProductCondition,
    pub images: Vec<String>,
    pub seller: Address,
    pub inventory_count: u32,
    pub is_authenticated: bool,
}

/// Bid information
#[contracttype]
#[derive(Clone)]
pub struct Bid {
    pub bidder: Address,
    pub amount: i128,
    pub timestamp: u64,
    pub quantity: u32,
}

/// Shipping information
#[contracttype]
#[derive(Clone)]
pub struct ShippingInfo {
    pub status: ShippingStatus,
    pub tracking_number: String,
    pub carrier: String,
    pub estimated_delivery: u64,
    pub shipping_cost: i128,
    pub recipient_address: String,
}

/// Standard auction data (flattened)
#[contracttype]
#[derive(Clone)]
pub struct Auction {
    pub id: BytesN<32>,
    pub product: Product,
    pub status: AuctionStatus,
    pub start_time: u64,
    pub end_time: u64,
    pub reserve_price: i128,

    // For current_highest_bid
    pub has_highest_bid: bool,
    pub highest_bidder: Address,
    pub highest_bid_amount: i128,
    pub highest_bid_timestamp: u64,
    pub highest_bid_quantity: u32,

    pub all_bids: Vec<Bid>,

    // For shipping
    pub has_shipping: bool,
    pub shipping_status: ShippingStatus,
    pub shipping_tracking: String,
    pub shipping_carrier: String,
    pub shipping_delivery_estimate: u64,
    pub shipping_cost: i128,
    pub shipping_recipient: String,

    pub dispute_status: DisputeStatus,

    // For dispute_reason
    pub has_dispute_reason: bool,
    pub dispute_reason: String,
}

impl Auction {
    // Helper methods to work with the flattened structure

    // Get the highest bid if it exists
    pub fn highest_bid(&self) -> Option<Bid> {
        if self.has_highest_bid {
            Some(Bid {
                bidder: self.highest_bidder.clone(),
                amount: self.highest_bid_amount,
                timestamp: self.highest_bid_timestamp,
                quantity: self.highest_bid_quantity,
            })
        } else {
            None
        }
    }

    // Set the highest bid
    pub fn set_highest_bid(&mut self, bid: Option<Bid>) {
        if let Some(b) = bid {
            self.has_highest_bid = true;
            self.highest_bidder = b.bidder.clone();
            self.highest_bid_amount = b.amount;
            self.highest_bid_timestamp = b.timestamp;
            self.highest_bid_quantity = b.quantity;
        } else {
            self.has_highest_bid = false;
        }
    }

    // Get shipping info if it exists
    pub fn shipping_info(&self) -> Option<ShippingInfo> {
        if self.has_shipping {
            Some(ShippingInfo {
                status: self.shipping_status,
                tracking_number: self.shipping_tracking.clone(),
                carrier: self.shipping_carrier.clone(),
                estimated_delivery: self.shipping_delivery_estimate,
                shipping_cost: self.shipping_cost,
                recipient_address: self.shipping_recipient.clone(),
            })
        } else {
            None
        }
    }

    // Set shipping info
    pub fn set_shipping_info(&mut self, shipping: Option<ShippingInfo>, env: &soroban_sdk::Env) {
        if let Some(s) = shipping {
            self.has_shipping = true;
            self.shipping_status = s.status;
            self.shipping_tracking = s.tracking_number;
            self.shipping_carrier = s.carrier;
            self.shipping_delivery_estimate = s.estimated_delivery;
            self.shipping_cost = s.shipping_cost;
            self.shipping_recipient = s.recipient_address;
        } else {
            self.has_shipping = false;
            self.shipping_status = ShippingStatus::NotShipped;
            self.shipping_tracking = String::from_str(env, "");
            self.shipping_carrier = String::from_str(env, "");
            self.shipping_delivery_estimate = 0;
            self.shipping_cost = 0;
            self.shipping_recipient = String::from_str(env, "");
        }
    }

    // Get dispute reason if it exists
    pub fn dispute_reason_text(&self) -> Option<String> {
        if self.has_dispute_reason {
            Some(self.dispute_reason.clone())
        } else {
            None
        }
    }

    // Set dispute reason
    pub fn set_dispute_reason(&mut self, reason: Option<String>, env: &soroban_sdk::Env) {
        if let Some(r) = reason {
            self.has_dispute_reason = true;
            self.dispute_reason = r;
        } else {
            self.has_dispute_reason = false;
            self.dispute_reason = String::from_str(env, "");
        }
    }

    // Create a new auction (constructor)
    pub fn new(
        env: &soroban_sdk::Env,
        id: BytesN<32>,
        product: Product,
        start_time: u64,
        end_time: u64,
        reserve_price: i128,
    ) -> Self {
        Auction {
            id,
            product,
            status: AuctionStatus::Pending,
            start_time,
            end_time,
            reserve_price,

            has_highest_bid: false,
            highest_bidder: env.current_contract_address(),
            highest_bid_amount: 0,
            highest_bid_timestamp: 0,
            highest_bid_quantity: 0,

            all_bids: Vec::new(env),

            has_shipping: false,
            shipping_status: ShippingStatus::NotShipped,
            shipping_tracking: String::from_str(env, ""),
            shipping_carrier: String::from_str(env, ""),
            shipping_delivery_estimate: 0,
            shipping_cost: 0,
            shipping_recipient: String::from_str(env, ""),

            dispute_status: DisputeStatus::None,

            has_dispute_reason: false,
            dispute_reason: String::from_str(env, ""),
        }
    }
}
