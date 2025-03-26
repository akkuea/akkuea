mod admin;
mod auction;
mod bid;
mod dispute;
mod query;
mod shipping;
mod storage;

// Re-export all functions to avoid exposing module structure details
pub use admin::{add_resolver, add_verifier, initialize};
pub use auction::create_auction;
pub use bid::place_bid;
pub use dispute::{open_dispute, resolve_dispute};
pub use query::{
    calculate_shipping_cost, query_auction, query_auctions, query_user_bidding_auctions,
    query_user_selling_auctions,
};
pub use shipping::{add_shipping_info, update_shipping_status};

// Export additional functions defined at module level
pub fn start_auction(env: &soroban_sdk::Env, auction_id: &soroban_sdk::BytesN<32>) {
    let mut auction = storage::get_auction(env, auction_id);

    // Only the seller can start the auction
    auction.product.seller.require_auth();

    if auction.status != crate::datatype::AuctionStatus::Pending {
        panic!("Auction is not in pending state");
    }

    let current_time = env.ledger().timestamp();
    if current_time < auction.start_time {
        panic!("Auction start time has not been reached");
    }

    auction.status = crate::datatype::AuctionStatus::Active;
    storage::save_auction(env, auction_id, &auction);

    // Emit event
    env.events().publish(
        (
            soroban_sdk::Symbol::new(env, "auction_started"),
            auction_id.clone(),
        ),
        auction_id.clone(),
    );
}

pub fn end_auction(env: &soroban_sdk::Env, auction_id: &soroban_sdk::BytesN<32>) {
    let mut auction = storage::get_auction(env, auction_id);

    if auction.status != crate::datatype::AuctionStatus::Active {
        panic!("Auction is not active");
    }

    let current_time = env.ledger().timestamp();
    if current_time < auction.end_time {
        panic!("Auction end time has not been reached");
    }

    auction.status = crate::datatype::AuctionStatus::Ended;
    storage::save_auction(env, auction_id, &auction);

    // Emit event
    env.events().publish(
        (
            soroban_sdk::Symbol::new(env, "auction_ended"),
            auction_id.clone(),
        ),
        auction_id.clone(),
    );
}

pub fn cancel_auction(env: &soroban_sdk::Env, auction_id: &soroban_sdk::BytesN<32>) {
    let mut auction = storage::get_auction(env, auction_id);

    // Only the seller can cancel an auction
    auction.product.seller.require_auth();

    // Can only cancel pending auctions
    if auction.status != crate::datatype::AuctionStatus::Pending {
        panic!("Only pending auctions can be cancelled");
    }

    auction.status = crate::datatype::AuctionStatus::Cancelled;
    storage::save_auction(env, auction_id, &auction);

    // Emit event
    env.events().publish(
        (
            soroban_sdk::Symbol::new(env, "auction_cancelled"),
            auction_id.clone(),
        ),
        auction_id.clone(),
    );
}

pub fn verify_product(
    env: &soroban_sdk::Env,
    verifier: &soroban_sdk::Address,
    auction_id: &soroban_sdk::BytesN<32>,
    is_authentic: &bool,
) {
    verifier.require_auth();

    // Check if verifier is authorized
    if !storage::is_verifier(env, verifier) {
        panic!("Not authorized to verify products");
    }

    let mut auction = storage::get_auction(env, auction_id);

    // Update authentication status
    auction.product.is_authenticated = *is_authentic;
    storage::save_auction(env, auction_id, &auction);

    // Emit event
    env.events().publish(
        (
            soroban_sdk::Symbol::new(env, "product_verified"),
            auction_id.clone(),
        ),
        (auction_id.clone(), *is_authentic),
    );
}
