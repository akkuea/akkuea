use crate::datatype::{Auction, StorageKey};
use soroban_sdk::{Address, BytesN, Env, Map, Vec};

// Get admin address
pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&StorageKey::Admin).unwrap()
}

// Check if a user is a verifier
pub fn is_verifier(env: &Env, address: &Address) -> bool {
    let verifiers: Vec<Address> = env
        .storage()
        .instance()
        .get(&StorageKey::Verifiers)
        .unwrap_or_else(|| Vec::new(env));
    verifiers.contains(address)
}

// Check if a user is a resolver
pub fn is_resolver(env: &Env, address: &Address) -> bool {
    let resolvers: Vec<Address> = env
        .storage()
        .instance()
        .get(&StorageKey::Resolvers)
        .unwrap_or_else(|| Vec::new(env));
    resolvers.contains(address)
}

// Get auction by ID
pub fn get_auction(env: &Env, auction_id: &BytesN<32>) -> Auction {
    let auctions: Map<BytesN<32>, Auction> = env
        .storage()
        .instance()
        .get(&StorageKey::Auctions)
        .unwrap_or_else(|| Map::<BytesN<32>, Auction>::new(env));

    auctions
        .get(auction_id.clone())
        .unwrap_or_else(|| panic!("Auction not found"))
}
// Save auction
pub fn save_auction(env: &Env, auction_id: &BytesN<32>, auction: &Auction) {
    let mut auctions: Map<BytesN<32>, Auction> = env
        .storage()
        .instance()
        .get(&StorageKey::Auctions)
        .unwrap_or_else(|| Map::<BytesN<32>, Auction>::new(env));

    auctions.set(auction_id.clone(), auction.clone());

    env.storage()
        .instance()
        .set(&StorageKey::Auctions, &auctions);
}

// Get the next auction counter value
pub fn get_and_increment_auction_counter(env: &Env) -> u32 {
    let counter: u32 = env
        .storage()
        .instance()
        .get(&StorageKey::AuctionCounter)
        .unwrap_or(0);

    let new_counter = counter + 1;
    env.storage()
        .instance()
        .set(&StorageKey::AuctionCounter, &new_counter);

    counter
}

// Add auction to user's selling list
pub fn add_to_user_selling(env: &Env, seller: &Address, auction_id: &BytesN<32>) {
    let user_key = StorageKey::UserSelling(seller.clone());
    let mut user_auctions: Vec<BytesN<32>> = env
        .storage()
        .instance()
        .get(&user_key)
        .unwrap_or_else(|| Vec::new(env));

    user_auctions.push_back(auction_id.clone());
    env.storage().instance().set(&user_key, &user_auctions);
}

// Add auction to user's bidding list
#[allow(dead_code)]
pub fn add_to_user_bidding(env: &Env, bidder: &Address, auction_id: &BytesN<32>) {
    let user_key = StorageKey::UserBidding(bidder.clone());
    let mut user_auctions: Vec<BytesN<32>> = env
        .storage()
        .instance()
        .get(&user_key)
        .unwrap_or_else(|| Vec::new(env));

    if !user_auctions.contains(auction_id) {
        user_auctions.push_back(auction_id.clone());
        env.storage().instance().set(&user_key, &user_auctions);
    }
}
