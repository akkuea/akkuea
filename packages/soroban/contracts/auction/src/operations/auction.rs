use super::storage::{add_to_user_selling, get_and_increment_auction_counter, save_auction};
use crate::datatype::{Auction, AuctionStatus, DisputeStatus, Product, ProductCondition};
use crate::ShippingStatus;
use soroban_sdk::{Address, Bytes, BytesN, Env, String, Symbol, Vec};

pub fn create_auction(
    env: &Env,
    seller: &Address,
    name: &String,
    description: &String,
    condition: &ProductCondition,
    images: &Vec<String>,
    inventory_count: &u32,
    reserve_price: &i128,
    start_time: &u64,
    end_time: &u64,
) -> BytesN<32> {
    seller.require_auth();

    // Validate inputs
    if start_time >= end_time {
        panic!("End time must be after start time");
    }
    if *inventory_count == 0 {
        panic!("Inventory count must be greater than 0");
    }
    if *reserve_price <= 0 {
        panic!("Reserve price must be greater than 0");
    }

    // Generate counter for unique ID
    let counter = get_and_increment_auction_counter(env);

    // Create auction ID by hashing counter and timestamp bytes
    let counter_bytes = Bytes::from_slice(env, &counter.to_be_bytes());
    let auction_id: BytesN<32> = env.crypto().sha256(&counter_bytes).into();

    // Create product ID using a different input
    let product_counter = counter + 1;
    let product_bytes = Bytes::from_slice(env, &product_counter.to_be_bytes());
    let product_id: BytesN<32> = env.crypto().sha256(&product_bytes).into();

    // Create product
    let product = Product {
        id: product_id,
        name: name.clone(),
        description: description.clone(),
        condition: *condition,
        images: images.clone(),
        seller: seller.clone(),
        inventory_count: *inventory_count,
        is_authenticated: false,
    };

    // Create auction with Option<T> fields
    let auction = Auction {
        id: auction_id.clone(),
        product,
        status: AuctionStatus::Pending,
        start_time: *start_time,
        end_time: *end_time,
        reserve_price: *reserve_price,
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
    };

    // Save the auction
    save_auction(env, &auction_id, &auction);
    add_to_user_selling(env, seller, &auction_id);

    // Emit event
    env.events().publish(
        (Symbol::new(env, "auction_created"), auction_id.clone()),
        auction_id.clone(),
    );

    auction_id
}
