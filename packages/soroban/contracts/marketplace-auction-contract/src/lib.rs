#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, Vec};

mod datatype;
mod operations;

pub use datatype::{
    Auction, AuctionStatus, Bid, DisputeStatus, ProductCondition, ShippingInfo, ShippingStatus,
};

#[contract]
pub struct AuctionContract;

#[contractimpl]
impl AuctionContract {
    // Initialize the contract with an admin
    pub fn initialize(env: Env, admin: Address) {
        operations::initialize(&env, &admin);
    }

    // Create a new auction for a product
    pub fn create_auction(
        env: Env,
        seller: Address,
        name: String,
        description: String,
        condition: ProductCondition,
        images: Vec<String>,
        inventory_count: u32,
        reserve_price: i128,
        start_time: u64,
        end_time: u64,
    ) -> BytesN<32> {
        operations::create_auction(
            &env,
            &seller,
            &name,
            &description,
            &condition,
            &images,
            &inventory_count,
            &reserve_price,
            &start_time,
            &end_time,
        )
    }

    // Start an auction (transition from Pending to Active)
    pub fn start_auction(env: Env, auction_id: BytesN<32>) {
        operations::start_auction(&env, &auction_id);
    }

    // Place a bid on an auction
    pub fn place_bid(
        env: Env,
        auction_id: BytesN<32>,
        bidder: Address,
        amount: i128,
        quantity: u32,
    ) {
        operations::place_bid(&env, &auction_id, &bidder, &amount, &quantity);
    }

    // End an auction (can be called by anyone after end_time)
    pub fn end_auction(env: Env, auction_id: BytesN<32>) {
        operations::end_auction(&env, &auction_id);
    }

    // Cancel an auction (only possible in Pending status)
    pub fn cancel_auction(env: Env, auction_id: BytesN<32>) {
        operations::cancel_auction(&env, &auction_id);
    }

    // Verify product authenticity (only verifiers can do this)
    pub fn verify_product(env: Env, verifier: Address, auction_id: BytesN<32>, is_authentic: bool) {
        operations::verify_product(&env, &verifier, &auction_id, &is_authentic);
    }

    // Add shipping information (seller only)
    pub fn add_shipping_info(
        env: Env,
        auction_id: BytesN<32>,
        tracking_number: String,
        carrier: String,
        estimated_delivery: u64,
        shipping_cost: i128,
        recipient_address: String,
    ) {
        operations::add_shipping_info(
            &env,
            &auction_id,
            &tracking_number,
            &carrier,
            &estimated_delivery,
            &shipping_cost,
            &recipient_address,
        );
    }

    // Update shipping status
    pub fn update_shipping_status(env: Env, auction_id: BytesN<32>, new_status: ShippingStatus) {
        operations::update_shipping_status(&env, &auction_id, &new_status);
    }

    // Open a dispute (buyer only)
    pub fn open_dispute(env: Env, auction_id: BytesN<32>, buyer: Address, reason: String) {
        operations::open_dispute(&env, &auction_id, &buyer, &reason);
    }

    // Resolve a dispute (admin or dispute resolver only)
    pub fn resolve_dispute(
        env: Env,
        resolver: Address,
        auction_id: BytesN<32>,
        resolution: DisputeStatus,
    ) {
        operations::resolve_dispute(&env, &resolver, &auction_id, &resolution);
    }

    // Add a product verifier (admin only)
    pub fn add_verifier(env: Env, admin: Address, verifier: Address) {
        operations::add_verifier(&env, &admin, &verifier);
    }

    // Add a dispute resolver (admin only)
    pub fn add_resolver(env: Env, admin: Address, resolver: Address) {
        operations::add_resolver(&env, &admin, &resolver);
    }

    // Get auction details
    pub fn get_auction(env: Env, auction_id: BytesN<32>) -> Option<Auction> {
        operations::query_auction(&env, &auction_id)
    }

    // Get auctions where user is seller
    pub fn get_user_selling_auctions(env: Env, user: Address) -> Vec<BytesN<32>> {
        operations::query_user_selling_auctions(&env, &user)
    }

    // Get auctions where user has bid
    pub fn get_user_bidding_auctions(env: Env, user: Address) -> Vec<BytesN<32>> {
        operations::query_user_bidding_auctions(&env, &user)
    }

    // Bulk operations: get multiple auctions at once
    pub fn get_auctions(env: Env, auction_ids: Vec<BytesN<32>>) -> Vec<Auction> {
        operations::query_auctions(&env, &auction_ids)
    }

    // Calculate shipping based on location
    pub fn calculate_shipping_cost(
        env: Env,
        auction_id: BytesN<32>,
        destination: String,
        shipping_speed: u32,
    ) -> i128 {
        operations::calculate_shipping_cost(&env, &auction_id, &destination, &shipping_speed)
    }
}

#[cfg(test)]
mod test;
