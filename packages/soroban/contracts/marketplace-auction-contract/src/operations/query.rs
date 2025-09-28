use super::storage::get_auction;
use crate::datatype::{Auction, StorageKey};
use soroban_sdk::{Address, BytesN, Env, Map, String, Vec};

// Query a single auction
pub fn query_auction(env: &Env, auction_id: &BytesN<32>) -> Option<Auction> {
    let auctions: Map<BytesN<32>, Auction> = env
        .storage()
        .instance()
        .get(&StorageKey::Auctions)
        .unwrap_or_else(|| Map::<BytesN<32>, Auction>::new(env));

    auctions.get(auction_id.clone())
}

// Query auctions by seller
pub fn query_user_selling_auctions(env: &Env, user: &Address) -> Vec<BytesN<32>> {
    env.storage()
        .instance()
        .get(&StorageKey::UserSelling(user.clone()))
        .unwrap_or_else(|| Vec::new(env))
}

// Query auctions by bidder
pub fn query_user_bidding_auctions(env: &Env, user: &Address) -> Vec<BytesN<32>> {
    env.storage()
        .instance()
        .get(&StorageKey::UserBidding(user.clone()))
        .unwrap_or_else(|| Vec::new(env))
}

// Query multiple auctions at once
pub fn query_auctions(env: &Env, auction_ids: &Vec<BytesN<32>>) -> Vec<Auction> {
    let auctions: Map<BytesN<32>, Auction> = env
        .storage()
        .instance()
        .get(&StorageKey::Auctions)
        .unwrap_or_else(|| Map::<BytesN<32>, Auction>::new(env));

    let mut result = Vec::new(env);
    for id in auction_ids.iter() {
        if let Some(auction) = auctions.get(id) {
            result.push_back(auction);
        }
    }
    result
}

// Calculate shipping cost
pub fn calculate_shipping_cost(
    env: &Env,
    auction_id: &BytesN<32>,
    destination: &String,
    shipping_speed: &u32,
) -> i128 {
    let auction = get_auction(env, auction_id);

    // Base cost
    let mut cost: i128 = 500;

    // Add cost based on destination length (proxy for distance)
    cost += destination.len() as i128 * 10;

    // Add cost based on shipping speed
    match shipping_speed {
        1 => cost += 1000, // Express
        2 => cost += 500,  // Standard
        _ => cost += 200,  // Economy
    }

    // Apply bulk shipping discount if applicable
    if auction.has_highest_bid {
        if auction.highest_bid_quantity > 1 {
            // Apply a simple discount for bulk orders
            // For each additional item, reduce cost by 10%
            let discount_factor = 100 - ((auction.highest_bid_quantity - 1) * 10).min(50) as u32;
            cost = cost * (discount_factor as i128) / 100;
        }
    }

    cost
}
