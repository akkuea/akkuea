extern crate std;

use crate::{
    marketplace::{Bid, Listing, PriceHistory, Sale},
    EducationalNFTContract, EducationalNFTContractClient, MockEducatorVerificationNft,
};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Bytes, Env, String, Vec,
};

fn setup_marketplace_test_environment() -> (
    Env,
    Address,
    Address,
    Address,
    Address,
    EducationalNFTContractClient<'static>,
    u32,
) {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let educator = Address::generate(&env);
    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);

    let educator_verification_id = env.register(MockEducatorVerificationNft, ());

    let contract_id = env.register(
        EducationalNFTContract,
        (owner.clone(), educator_verification_id.clone()),
    );
    let client = EducationalNFTContractClient::new(&env, &contract_id);

    let collection_id = 1u64;
    let fractions = 100u32;
    let metadata_hash = Bytes::from_array(&env, &[1; 32]);

    let token_id = client.mint_nft(&seller, &collection_id, &fractions, &metadata_hash);

    (env, owner, educator, seller, buyer, client, token_id)
}

#[test]
fn test_list_nft_for_sale() {
    let (env, _owner, _educator, seller, _buyer, client, token_id) =
        setup_marketplace_test_environment();

    let price = 1000i128;
    let auction_end = 0u64;
    let royalty_rate = 500u32;

    client.list_nft(
        &seller,
        &(token_id as u64),
        &price,
        &auction_end,
        &royalty_rate,
    );

    let listing = client.get_listing(&(token_id as u64));
    assert!(listing.is_some());

    let listing = listing.unwrap();
    assert_eq!(listing.token_id, token_id as u64);
    assert_eq!(listing.seller, seller);
    assert_eq!(listing.price, price);
    assert_eq!(listing.auction_end, auction_end);
    assert_eq!(listing.royalty_rate, royalty_rate);
    assert!(listing.is_active);
}

#[test]
fn test_list_nft_for_auction() {
    let (env, _owner, _educator, seller, _buyer, client, token_id) =
        setup_marketplace_test_environment();

    let price = 1000i128;
    let auction_end = env.ledger().timestamp() + 3600;
    let royalty_rate = 750u32;

    client.list_nft(
        &seller,
        &(token_id as u64),
        &price,
        &auction_end,
        &royalty_rate,
    );

    let listing = client.get_listing(&(token_id as u64));
    assert!(listing.is_some());

    let listing = listing.unwrap();
    assert_eq!(listing.auction_end, auction_end);
    assert!(listing.is_active);
}

#[test]
fn test_buy_nft_direct_sale() {
    let (env, _owner, _educator, seller, buyer, client, token_id) =
        setup_marketplace_test_environment();

    let price = 1000i128;
    let auction_end = 0u64;
    let royalty_rate = 500u32;

    client.list_nft(
        &seller,
        &(token_id as u64),
        &price,
        &auction_end,
        &royalty_rate,
    );

    client.buy_nft(&buyer, &(token_id as u64), &price);

    let listing = client.get_listing(&(token_id as u64));
    assert!(listing.is_none());

    let sales_history = client.get_sales_history(&(token_id as u64));
    assert!(!sales_history.is_empty());

    let sale = &sales_history.get(0).unwrap();
    assert_eq!(sale.token_id, token_id as u64);
    assert_eq!(sale.seller, seller);
    assert_eq!(sale.buyer, buyer);
    assert_eq!(sale.price, price);
    assert_eq!(sale.royalty_paid, (price * royalty_rate as i128) / 10000);
}

#[test]
fn test_place_bid_on_auction() {
    let (env, _owner, _educator, seller, buyer, client, token_id) =
        setup_marketplace_test_environment();

    let price = 1000i128;
    let auction_end = env.ledger().timestamp() + 3600;
    let royalty_rate = 500u32;

    client.list_nft(
        &seller,
        &(token_id as u64),
        &price,
        &auction_end,
        &royalty_rate,
    );

    let bid_amount = 1500i128;
    client.place_bid(&buyer, &(token_id as u64), &bid_amount);

    let bids = client.get_bids(&(token_id as u64));
    assert!(!bids.is_empty());

    let bid = &bids.get(0).unwrap();
    assert_eq!(bid.token_id, token_id as u64);
    assert_eq!(bid.bidder, buyer);
    assert_eq!(bid.amount, bid_amount);

    let highest_bid = client.get_highest_bid(&(token_id as u64));
    assert!(highest_bid.is_some());
    assert_eq!(highest_bid.unwrap().amount, bid_amount);
}

#[test]
fn test_multiple_bids() {
    let (env, _owner, _educator, seller, _buyer, client, token_id) =
        setup_marketplace_test_environment();

    let bidder1 = Address::generate(&env);
    let bidder2 = Address::generate(&env);
    let bidder3 = Address::generate(&env);

    let price = 1000i128;
    let auction_end = env.ledger().timestamp() + 3600;
    let royalty_rate = 500u32;

    client.list_nft(
        &seller,
        &(token_id as u64),
        &price,
        &auction_end,
        &royalty_rate,
    );

    client.place_bid(&bidder1, &(token_id as u64), &1200i128);
    client.place_bid(&bidder2, &(token_id as u64), &1500i128);
    client.place_bid(&bidder3, &(token_id as u64), &1800i128);

    let bids = client.get_bids(&(token_id as u64));
    assert_eq!(bids.len(), 3);

    let highest_bid = client.get_highest_bid(&(token_id as u64));
    assert!(highest_bid.is_some());
    let highest_bid = highest_bid.unwrap();
    assert_eq!(highest_bid.amount, 1800i128);
    assert_eq!(highest_bid.bidder, bidder3);
}

#[test]
fn test_settle_auction() {
    let (env, _owner, _educator, seller, buyer, client, token_id) =
        setup_marketplace_test_environment();

    let price = 1000i128;
    let auction_end = env.ledger().timestamp() + 100;
    let royalty_rate = 500u32;

    client.list_nft(
        &seller,
        &(token_id as u64),
        &price,
        &auction_end,
        &royalty_rate,
    );

    let bid_amount = 1500i128;
    client.place_bid(&buyer, &(token_id as u64), &bid_amount);

    env.ledger().with_mut(|li| {
        li.timestamp = auction_end + 1;
    });

    client.settle_auction(&seller, &(token_id as u64));

    let listing = client.get_listing(&(token_id as u64));
    assert!(listing.is_none());

    let sales_history = client.get_sales_history(&(token_id as u64));
    assert!(!sales_history.is_empty());

    let sale = &sales_history.get(0).unwrap();
    assert_eq!(sale.buyer, buyer);
    assert_eq!(sale.price, bid_amount);
}

#[test]
fn test_cancel_listing() {
    let (env, _owner, _educator, seller, _buyer, client, token_id) =
        setup_marketplace_test_environment();

    let price = 1000i128;
    let auction_end = 0u64;
    let royalty_rate = 500u32;

    client.list_nft(
        &seller,
        &(token_id as u64),
        &price,
        &auction_end,
        &royalty_rate,
    );

    let listing = client.get_listing(&(token_id as u64));
    assert!(listing.is_some());

    client.cancel_listing(&seller, &(token_id as u64));

    let listing = client.get_listing(&(token_id as u64));
    assert!(listing.is_none());
}

#[test]
fn test_price_history_tracking() {
    let (env, _owner, _educator, seller, buyer, client, token_id) =
        setup_marketplace_test_environment();

    let price1 = 1000i128;

    client.list_nft(&seller, &(token_id as u64), &price1, &0u64, &500u32);
    client.buy_nft(&buyer, &(token_id as u64), &price1);

    let price_history = client.get_price_history(&(token_id as u64));
    assert!(price_history.is_some());

    let history = price_history.unwrap();
    assert!(!history.prices.is_empty());
    assert_eq!(history.prices.get(0).unwrap(), price1);

    let average_price = client.get_average_price(&(token_id as u64));
    assert!(average_price.is_some());
    assert_eq!(average_price.unwrap(), price1);
}

#[test]
fn test_royalty_calculation() {
    let (env, _owner, _educator, seller, buyer, client, token_id) =
        setup_marketplace_test_environment();

    let price = 2000i128;
    let royalty_rate = 1000u32;

    client.list_nft(&seller, &(token_id as u64), &price, &0u64, &royalty_rate);

    client.buy_nft(&buyer, &(token_id as u64), &price);

    let sales_history = client.get_sales_history(&(token_id as u64));
    let sale = &sales_history.get(0).unwrap();

    let expected_royalty = (price * royalty_rate as i128) / 10000;
    assert_eq!(sale.royalty_paid, expected_royalty);
    assert_eq!(sale.royalty_paid, 200i128);
}

#[test]
fn test_marketplace_error_conditions() {
    let (env, _owner, _educator, seller, buyer, client, token_id) =
        setup_marketplace_test_environment();

    let invalid_token = 999u64;
    let result = client.try_list_nft(&seller, &invalid_token, &1000i128, &0u64, &500u32);
    assert!(result.is_err());

    let other_user = Address::generate(&env);
    let result = client.try_list_nft(&other_user, &(token_id as u64), &1000i128, &0u64, &500u32);
    assert!(result.is_err());

    client.list_nft(&seller, &(token_id as u64), &1000i128, &0u64, &500u32);

    let result = client.try_buy_nft(&buyer, &(token_id as u64), &500i128);
    assert!(result.is_err());

    let result = client.try_buy_nft(&seller, &(token_id as u64), &1000i128);
    assert!(result.is_err());
}

#[test]
fn test_auction_error_conditions() {
    let (env, _owner, _educator, seller, buyer, client, token_id) =
        setup_marketplace_test_environment();

    let auction_end = env.ledger().timestamp() + 3600;
    client.list_nft(
        &seller,
        &(token_id as u64),
        &1000i128,
        &auction_end,
        &500u32,
    );

    let result = client.try_buy_nft(&buyer, &(token_id as u64), &1500i128);
    assert!(result.is_err());

    let result = client.try_place_bid(&seller, &(token_id as u64), &1500i128);
    assert!(result.is_err());

    client.place_bid(&buyer, &(token_id as u64), &1500i128);

    let result = client.try_place_bid(&buyer, &(token_id as u64), &1200i128);
    assert!(result.is_err());

    let result = client.try_settle_auction(&seller, &(token_id as u64));
    assert!(result.is_err());
}

#[test]
fn test_marketplace_integration() {
    let (env, _owner, _educator, seller, buyer, client, token_id) =
        setup_marketplace_test_environment();

    client.list_nft(&seller, &(token_id as u64), &1000i128, &0u64, &500u32);

    let active_listings = client.get_active_listings();

    let seller_listings = client.get_listings_by_seller(&seller);

    client.buy_nft(&buyer, &(token_id as u64), &1000i128);

    let sales_history = client.get_sales_history(&(token_id as u64));
    assert!(!sales_history.is_empty());

    let price_history = client.get_price_history(&(token_id as u64));
    assert!(price_history.is_some());

    let average_price = client.get_average_price(&(token_id as u64));
    assert!(average_price.is_some());
    assert_eq!(average_price.unwrap(), 1000i128);
}

#[test]
fn test_data_structures() {
    let env = Env::default();

    let seller = Address::generate(&env);
    let buyer = Address::generate(&env);
    let token_id = 1u64;
    let timestamp = env.ledger().timestamp();

    let listing = Listing {
        token_id,
        seller: seller.clone(),
        price: 1000i128,
        auction_end: 0,
        royalty_rate: 500,
        is_active: true,
        created_at: timestamp,
    };

    assert_eq!(listing.token_id, token_id);
    assert_eq!(listing.seller, seller);
    assert!(listing.is_active);

    let bid = Bid {
        token_id,
        bidder: buyer.clone(),
        amount: 1500i128,
        timestamp,
    };

    assert_eq!(bid.token_id, token_id);
    assert_eq!(bid.bidder, buyer);
    assert_eq!(bid.amount, 1500i128);

    let sale = Sale {
        token_id,
        seller: seller.clone(),
        buyer: buyer.clone(),
        price: 1000i128,
        royalty_paid: 50i128,
        royalty_recipient: seller.clone(),
        timestamp,
    };

    assert_eq!(sale.token_id, token_id);
    assert_eq!(sale.seller, seller);
    assert_eq!(sale.buyer, buyer);
    assert_eq!(sale.royalty_paid, 50i128);

    let mut prices = Vec::new(&env);
    prices.push_back(1000i128);
    prices.push_back(1200i128);

    let mut timestamps = Vec::new(&env);
    timestamps.push_back(timestamp);
    timestamps.push_back(timestamp + 100);

    let price_history = PriceHistory {
        token_id,
        prices,
        timestamps,
        last_updated: timestamp + 100,
    };

    assert_eq!(price_history.token_id, token_id);
    assert_eq!(price_history.prices.len(), 2);
    assert_eq!(price_history.timestamps.len(), 2);
}
