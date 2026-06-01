#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, Vec};

/// GameMarketplace - P2P property trading
/// Manages listings and atomic swaps of LAND ↔ NFT
#[derive(Clone)]
#[contracttype]
pub struct Listing {
    pub seller: Address,
    pub property_id: u32,
    pub price_land: i128,
    pub created_ledger: u32,
}

#[contract]
pub struct GameMarketplace;

#[contractimpl]
impl GameMarketplace {
    /// Initialize the marketplace
    pub fn initialize(env: Env, token_contract: Address, nft_contract: Address) -> bool {
        let storage_key = Symbol::new(&env, "initialized");
        if env.storage().persistent().has(&storage_key) {
            return false; // Already initialized
        }

        let token_key = Symbol::new(&env, "token_contract");
        let nft_key = Symbol::new(&env, "nft_contract");

        env.storage().persistent().set(&token_key, &token_contract);
        env.storage().persistent().set(&nft_key, &nft_contract);
        env.storage().persistent().set(&storage_key, &true);

        true
    }

    /// List a property for sale
    /// Seller must approve NFT transfer first
    pub fn list(env: Env, seller: Address, property_id: u32, price_land: i128) -> bool {
        assert!(price_land > 0, "Price must be positive");
        assert!(property_id < 400, "Invalid property ID");

        // Check that property is not already listed
        let listing_key = (Symbol::new(&env, "listing"), property_id);
        assert!(
            !env.storage().persistent().has(&listing_key),
            "Property already listed"
        );

        let listing = Listing {
            seller: seller.clone(),
            property_id,
            price_land,
            created_ledger: env.ledger().sequence(),
        };

        env.storage().persistent().set(&listing_key, &listing);

        // Add to seller's listings
        let seller_listings_key = (Symbol::new(&env, "seller_listings"), &seller);
        let mut seller_listings: Vec<u32> = env
            .storage()
            .persistent()
            .get(&seller_listings_key)
            .unwrap_or_else(|| Vec::new(&env));
        seller_listings.push_back(property_id);
        env.storage()
            .persistent()
            .set(&seller_listings_key, &seller_listings);

        true
    }

    /// Buy a listed property (atomic swap)
    pub fn buy(env: Env, buyer: Address, property_id: u32) -> bool {
        assert!(property_id < 400, "Invalid property ID");

        let listing_key = (Symbol::new(&env, "listing"), property_id);
        let listing: Listing = env
            .storage()
            .persistent()
            .get(&listing_key)
            .expect("Property not listed");

        // Get contracts
        let token_key = Symbol::new(&env, "token_contract");
        let nft_key = Symbol::new(&env, "nft_contract");
        let _token_contract: Address = env.storage().persistent().get(&token_key).unwrap();
        let _nft_contract: Address = env.storage().persistent().get(&nft_key).unwrap();

        // Atomic swap:
        // 1. Transfer LAND from buyer to seller (via GameEngine or direct)
        // 2. Transfer NFT from seller to buyer
        // This is a simplified version; in production would use actual contract invokes

        // For now, record the transaction and emit event
        // Buyer approves LAND transfer separately

        // Remove listing
        env.storage().persistent().remove(&listing_key);

        // Update seller's listings
        let seller_listings_key = (Symbol::new(&env, "seller_listings"), &listing.seller);
        if let Some(listings) = env
            .storage()
            .persistent()
            .get::<_, Vec<u32>>(&seller_listings_key)
        {
            // Remove property_id from seller's listings
            let mut new_listings = Vec::new(&env);
            for id in listings.iter() {
                if id != property_id {
                    new_listings.push_back(id);
                }
            }
            if new_listings.len() > 0 {
                env.storage()
                    .persistent()
                    .set(&seller_listings_key, &new_listings);
            } else {
                env.storage().persistent().remove(&seller_listings_key);
            }
        }

        // Add to buyer's holdings
        let buyer_holdings_key = (Symbol::new(&env, "buyer_holdings"), &buyer);
        let mut holdings: Vec<u32> = env
            .storage()
            .persistent()
            .get(&buyer_holdings_key)
            .unwrap_or_else(|| Vec::new(&env));
        holdings.push_back(property_id);
        env.storage()
            .persistent()
            .set(&buyer_holdings_key, &holdings);

        true
    }

    /// Cancel a listing
    pub fn cancel_listing(env: Env, seller: Address, property_id: u32) -> bool {
        assert!(property_id < 400, "Invalid property ID");

        let listing_key = (Symbol::new(&env, "listing"), property_id);
        let listing: Listing = env
            .storage()
            .persistent()
            .get(&listing_key)
            .expect("Property not listed");

        assert_eq!(listing.seller, seller, "Caller is not the seller");

        // Remove listing
        env.storage().persistent().remove(&listing_key);

        // Update seller's listings
        let seller_listings_key = (Symbol::new(&env, "seller_listings"), &seller);
        if let Some(listings) = env
            .storage()
            .persistent()
            .get::<_, Vec<u32>>(&seller_listings_key)
        {
            let mut new_listings = Vec::new(&env);
            for id in listings.iter() {
                if id != property_id {
                    new_listings.push_back(id);
                }
            }
            if new_listings.len() > 0 {
                env.storage()
                    .persistent()
                    .set(&seller_listings_key, &new_listings);
            } else {
                env.storage().persistent().remove(&seller_listings_key);
            }
        }

        true
    }

    /// Get a listing
    pub fn get_listing(env: Env, property_id: u32) -> Option<Listing> {
        let listing_key = (Symbol::new(&env, "listing"), property_id);
        env.storage().persistent().get(&listing_key)
    }

    /// Get all active listings for a seller
    pub fn get_seller_listings(env: Env, seller: Address) -> Vec<u32> {
        let seller_listings_key = (Symbol::new(&env, "seller_listings"), &seller);
        env.storage()
            .persistent()
            .get(&seller_listings_key)
            .unwrap_or_else(|| Vec::new(&env))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use soroban_sdk::testutils::Address as TestAddress;

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let token = TestAddress::random(&env);
        let nft = TestAddress::random(&env);

        let contract = GameMarketplace;
        assert!(contract.initialize(env.clone(), token, nft));
    }

    #[test]
    fn test_list_and_get() {
        let env = Env::default();
        let token = TestAddress::random(&env);
        let nft = TestAddress::random(&env);
        let seller = TestAddress::random(&env);

        let contract = GameMarketplace;
        contract.initialize(env.clone(), token, nft);

        // List property
        assert!(contract.list(env.clone(), seller.clone(), 0, 1000));

        // Get listing
        let listing = contract.get_listing(env, 0).unwrap();
        assert_eq!(listing.property_id, 0);
        assert_eq!(listing.price_land, 1000);
        assert_eq!(listing.seller, seller);
    }
}
