#![cfg(test)]

use crate::{
    AuctionContract, AuctionContractClient, DisputeStatus, ProductCondition, ShippingStatus,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    vec, Address, BytesN, Env, String,
};

// Helper function to create a standard test environment
fn setup_test() -> (
    Env,
    AuctionContractClient<'static>,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    let contract_id = env.register(AuctionContract, ());
    let client = AuctionContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let seller = Address::generate(&env);
    let bidder = Address::generate(&env);

    // Initialize the contract
    env.mock_all_auths();
    client.initialize(&admin);

    (env, client, admin, seller, bidder)
}

// Helper function to create a test auction
fn create_test_auction(
    env: &Env,
    client: &AuctionContractClient<'_>,
    seller: &Address,
) -> BytesN<32> {
    let name = String::from_str(env, "Test Item");
    let description = String::from_str(env, "A test auction item");
    let condition = ProductCondition::Good;
    let images = vec![
        env,
        String::from_str(env, "https://example.com/image1.jpg"),
        String::from_str(env, "https://example.com/image2.jpg"),
    ];

    let current_time = env.ledger().timestamp();
    let start_time = current_time + 100;
    let end_time = start_time + 3600; // 1 hour auction

    env.mock_all_auths();

    // Use the correct parameter signatures based on your lib.rs
    client.create_auction(
        seller,       // &Address
        &name,        // &String
        &description, // &String
        &condition,   // &ProductCondition
        &images,      // &Vec<String>
        &2,           // &u32
        &1000,        // &i128
        &start_time,  // &u64
        &end_time,    // &u64
    )
}

// Test initialization
#[test]
fn test_initialize() {
    let env = Env::default();
    let contract_id = env.register(AuctionContract, ());
    let client = AuctionContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    // Initialize the contract
    env.mock_all_auths();
    client.initialize(&admin);

    // Try to initialize again - should fail
    env.mock_all_auths();
    let result = client.try_initialize(&admin);
    assert!(result.is_err());
}

// Test auction lifecycle
#[test]
fn test_auction_lifecycle() {
    let (env, client, admin, seller, bidder1) = setup_test();
    let bidder2 = Address::generate(&env);

    // Create verifier
    let verifier = Address::generate(&env);
    env.mock_all_auths();
    client.add_verifier(&admin, &verifier);

    // Create auction
    let auction_id = create_test_auction(&env, &client, &seller);

    // Get auction and verify details
    let auction = client.get_auction(&auction_id).unwrap();
    assert_eq!(auction.product.name, String::from_str(&env, "Test Item"));
    assert_eq!(auction.product.seller, seller);

    // Start auction
    env.ledger().set_timestamp(auction.start_time + 10);
    env.mock_all_auths();
    client.start_auction(&auction_id);

    // Place a bid
    env.mock_all_auths();
    client.place_bid(&auction_id, &bidder1, &1200, &1);

    // Check bid was recorded
    let auction = client.get_auction(&auction_id).unwrap();
    assert!(auction.has_highest_bid);
    assert_eq!(auction.highest_bidder, bidder1);
    assert_eq!(auction.highest_bid_amount, 1200);

    // Higher bid from second bidder
    env.mock_all_auths();
    client.place_bid(&auction_id, &bidder2, &1500, &1);

    // Verify second bidder is now highest
    let auction = client.get_auction(&auction_id).unwrap();
    assert_eq!(auction.highest_bidder, bidder2);
    assert!(auction.has_highest_bid);

    // End auction
    env.ledger().set_timestamp(auction.end_time + 10);
    client.end_auction(&auction_id);

    // Verify product authenticity
    env.mock_all_auths();
    client.verify_product(&verifier, &auction_id, &true);

    // Add shipping info
    env.mock_all_auths();
    let tracking = String::from_str(&env, "TRK123456789");
    let carrier = String::from_str(&env, "Express Shipping");
    let est_delivery = auction.end_time + 86400; // 1 day
    let shipping_cost = 500; // 5.00 units
    let recipient = String::from_str(&env, "123 Buyer St, City");

    client.add_shipping_info(
        &auction_id,
        &tracking,
        &carrier,
        &est_delivery,
        &shipping_cost,
        &recipient,
    );

    // Update shipping status
    env.mock_all_auths();
    client.update_shipping_status(&auction_id, &ShippingStatus::InTransit);

    let auction = client.get_auction(&auction_id).unwrap();
    assert!(auction.has_shipping);
    assert_eq!(auction.shipping_status, ShippingStatus::InTransit);

    // Mark as delivered
    env.mock_all_auths();
    client.update_shipping_status(&auction_id, &ShippingStatus::Delivered);

    // Check auction is now completed
    let auction = client.get_auction(&auction_id).unwrap();
    assert_eq!(auction.status, crate::datatype::AuctionStatus::Completed);
}

// Test dispute resolution
#[test]
fn test_dispute_resolution() {
    let (env, client, admin, seller, buyer) = setup_test();

    // Add resolver
    let resolver = Address::generate(&env);
    env.mock_all_auths();
    client.add_resolver(&admin, &resolver);

    // Create and run auction
    let auction_id = create_test_auction(&env, &client, &seller);

    // Start auction
    let auction = client.get_auction(&auction_id).unwrap();
    env.ledger().set_timestamp(auction.start_time + 10);
    env.mock_all_auths();
    client.start_auction(&auction_id);

    // Place bid
    env.mock_all_auths();
    client.place_bid(&auction_id, &buyer, &1500, &1);

    // End auction
    env.ledger().set_timestamp(auction.end_time + 10);
    client.end_auction(&auction_id);

    // Buyer opens dispute
    let reason = String::from_str(&env, "Item not as described");
    env.mock_all_auths();
    client.open_dispute(&auction_id, &buyer, &reason);

    // Check dispute status
    let auction = client.get_auction(&auction_id).unwrap();
    assert_eq!(auction.dispute_status, DisputeStatus::Open);
    assert_eq!(auction.status, crate::datatype::AuctionStatus::Disputed);
    assert!(auction.has_dispute_reason);
    assert_eq!(auction.dispute_reason, reason);

    // Resolver resolves in favor of buyer
    env.mock_all_auths();
    client.resolve_dispute(&resolver, &auction_id, &DisputeStatus::ResolvedForBuyer);

    // Check final status
    let auction = client.get_auction(&auction_id).unwrap();
    assert_eq!(auction.dispute_status, DisputeStatus::ResolvedForBuyer);
    assert_eq!(auction.status, crate::datatype::AuctionStatus::Completed);
}

#[test]
fn test_shipping_cost_calculation() {
    let (env, client, _admin, seller, _bidder) = setup_test();

    // Create auction
    let auction_id = create_test_auction(&env, &client, &seller);

    // Calculate shipping for different speeds
    let destination = String::from_str(&env, "123 Ship St, Cityville");

    let express_cost = client.calculate_shipping_cost(&auction_id, &destination, &1);
    let standard_cost = client.calculate_shipping_cost(&auction_id, &destination, &2);
    let economy_cost = client.calculate_shipping_cost(&auction_id, &destination, &3);

    // Express should be more expensive than standard, which should be more than economy
    assert!(express_cost > standard_cost);
    assert!(standard_cost > economy_cost);
}
