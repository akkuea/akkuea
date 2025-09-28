use super::storage::{get_auction, save_auction};
use crate::datatype::{AuctionStatus, ShippingInfo, ShippingStatus};
use soroban_sdk::{BytesN, Env, String, Symbol};

// Add shipping information
pub fn add_shipping_info(
    env: &Env,
    auction_id: &BytesN<32>,
    tracking_number: &String,
    carrier: &String,
    estimated_delivery: &u64,
    shipping_cost: &i128,
    recipient_address: &String,
) {
    let mut auction = get_auction(env, auction_id);

    // Only the seller can add shipping info
    auction.product.seller.require_auth();

    if auction.status != AuctionStatus::Ended {
        panic!("Can only add shipping info for ended auctions");
    }

    if !auction.has_highest_bid {
        panic!("No winning bid for this auction");
    }

    // Create shipping info
    let shipping_info = ShippingInfo {
        status: ShippingStatus::Shipped,
        tracking_number: tracking_number.clone(),
        carrier: carrier.clone(),
        estimated_delivery: *estimated_delivery,
        shipping_cost: *shipping_cost,
        recipient_address: recipient_address.clone(),
    };

    auction.set_shipping_info(Some(shipping_info), env);
    save_auction(env, auction_id, &auction);

    // Emit event
    env.events().publish(
        (Symbol::new(env, "product_shipped"), auction_id.clone()),
        (auction_id.clone(), tracking_number.clone()),
    );
}

// Update shipping status
pub fn update_shipping_status(env: &Env, auction_id: &BytesN<32>, new_status: &ShippingStatus) {
    let mut auction = get_auction(env, auction_id);

    // Only the seller can update shipping status
    auction.product.seller.require_auth();

    if !auction.has_shipping {
        panic!("No shipping information available");
    }

    // Update the shipping status
    auction.shipping_status = *new_status;

    // If delivered, update auction status
    if *new_status == ShippingStatus::Delivered {
        auction.status = AuctionStatus::Completed;

        // Emit delivery event
        env.events().publish(
            (Symbol::new(env, "product_delivered"), auction_id.clone()),
            auction_id.clone(),
        );
    }

    save_auction(env, auction_id, &auction);
}
