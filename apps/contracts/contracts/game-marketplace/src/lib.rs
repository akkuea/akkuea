#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, panic_with_error, token, Address, Env, Vec,
};

// ── Errors ────────────────────────────────────────────────────────────────────

#[soroban_sdk::contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MarketError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    AlreadyListed = 3,
    NotListed = 4,
    NotSeller = 5,
    InsufficientBalance = 6,
    Reentrancy = 7,
}

// ── Storage types ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Listing {
    pub seller: Address,
    pub property_id: u32,
    pub price: i128,
}

#[contracttype]
enum DataKey {
    NftContract,
    LandToken,
    Listing(u32),
    AllListings,
    Guard,
}

// ── Re-entrancy guard ─────────────────────────────────────────────────────────

struct ExecutionGuard<'a> {
    env: &'a Env,
}

impl<'a> ExecutionGuard<'a> {
    fn acquire(env: &'a Env) -> Result<Self, MarketError> {
        let locked: bool = env
            .storage()
            .instance()
            .get(&DataKey::Guard)
            .unwrap_or(false);
        if locked {
            return Err(MarketError::Reentrancy);
        }
        env.storage().instance().set(&DataKey::Guard, &true);
        Ok(Self { env })
    }
}

impl Drop for ExecutionGuard<'_> {
    fn drop(&mut self) {
        self.env.storage().instance().set(&DataKey::Guard, &false);
    }
}

// ── Minimal NFT client interface ──────────────────────────────────────────────
//
// We only need `transfer` and `transfer_from` from the PropertyNFT contract.
// Declaring a minimal client avoids importing the full crate in production code.

mod nft_interface {
    use soroban_sdk::{contractclient, Address, Env};

    #[contractclient(name = "NftContractClient")]
    #[allow(dead_code)]
    pub trait NftInterface {
        fn transfer(env: Env, from: Address, to: Address, property_id: u32);
        fn transfer_from(env: Env, spender: Address, from: Address, to: Address, property_id: u32);
    }
}

use nft_interface::NftContractClient;

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct GameMarketplace;

#[contractimpl]
impl GameMarketplace {
    /// One-time initialisation: store the NFT and LAND token contract addresses.
    pub fn initialize(env: Env, nft_contract: Address, land_token: Address) {
        if env.storage().instance().has(&DataKey::NftContract) {
            panic_with_error!(&env, MarketError::AlreadyInitialized);
        }
        env.storage()
            .instance()
            .set(&DataKey::NftContract, &nft_contract);
        env.storage()
            .instance()
            .set(&DataKey::LandToken, &land_token);
        env.storage()
            .instance()
            .set(&DataKey::AllListings, &Vec::<u32>::new(&env));
    }

    /// List a property for sale.
    ///
    /// The seller must have already called `approve(seller, marketplace, property_id)`
    /// on the NFT contract. This function calls `transfer_from` to take custody.
    pub fn list(env: Env, seller: Address, property_id: u32, price: i128) {
        seller.require_auth();

        if env.storage().instance().has(&DataKey::Listing(property_id)) {
            panic_with_error!(&env, MarketError::AlreadyListed);
        }

        let nft: Address = env
            .storage()
            .instance()
            .get(&DataKey::NftContract)
            .unwrap_or_else(|| panic_with_error!(&env, MarketError::NotInitialized));

        // Take custody: transfer NFT from seller to this contract.
        let marketplace = env.current_contract_address();
        let nft_client = NftContractClient::new(&env, &nft);
        nft_client.transfer_from(&marketplace, &seller, &marketplace, &property_id);

        let listing = Listing {
            seller,
            property_id,
            price,
        };
        env.storage()
            .instance()
            .set(&DataKey::Listing(property_id), &listing);

        let mut ids: Vec<u32> = env
            .storage()
            .instance()
            .get(&DataKey::AllListings)
            .unwrap_or_else(|| Vec::new(&env));
        ids.push_back(property_id);
        env.storage().instance().set(&DataKey::AllListings, &ids);
    }

    /// Purchase a listed property.
    ///
    /// Atomically transfers LAND tokens from buyer to seller and the NFT from
    /// escrow to buyer. Uses an ExecutionGuard to prevent re-entrancy.
    pub fn buy(env: Env, buyer: Address, property_id: u32) {
        buyer.require_auth();

        let _guard = ExecutionGuard::acquire(&env).unwrap_or_else(|e| panic_with_error!(&env, e));

        let listing: Listing = env
            .storage()
            .instance()
            .get(&DataKey::Listing(property_id))
            .unwrap_or_else(|| panic_with_error!(&env, MarketError::NotListed));

        let land: Address = env
            .storage()
            .instance()
            .get(&DataKey::LandToken)
            .unwrap_or_else(|| panic_with_error!(&env, MarketError::NotInitialized));

        let nft: Address = env
            .storage()
            .instance()
            .get(&DataKey::NftContract)
            .unwrap_or_else(|| panic_with_error!(&env, MarketError::NotInitialized));

        // Check buyer balance before any state change.
        let land_client = token::Client::new(&env, &land);
        let balance = land_client.balance(&buyer);
        if balance < listing.price {
            panic_with_error!(&env, MarketError::InsufficientBalance);
        }

        // Remove listing atomically before external calls (checks-effects-interactions).
        env.storage()
            .instance()
            .remove(&DataKey::Listing(property_id));
        Self::remove_from_all_listings(&env, property_id);

        // Transfer LAND from buyer to seller.
        land_client.transfer(&buyer, &listing.seller, &listing.price);

        // Transfer NFT from escrow (this contract) to buyer.
        let marketplace = env.current_contract_address();
        let nft_client = NftContractClient::new(&env, &nft);
        nft_client.transfer(&marketplace, &buyer, &property_id);
    }

    /// Cancel a listing and return the NFT to the seller.
    pub fn cancel(env: Env, seller: Address, property_id: u32) {
        seller.require_auth();

        let listing: Listing = env
            .storage()
            .instance()
            .get(&DataKey::Listing(property_id))
            .unwrap_or_else(|| panic_with_error!(&env, MarketError::NotListed));

        if listing.seller != seller {
            panic_with_error!(&env, MarketError::NotSeller);
        }

        let nft: Address = env
            .storage()
            .instance()
            .get(&DataKey::NftContract)
            .unwrap_or_else(|| panic_with_error!(&env, MarketError::NotInitialized));

        env.storage()
            .instance()
            .remove(&DataKey::Listing(property_id));
        Self::remove_from_all_listings(&env, property_id);

        // Return NFT from escrow to seller.
        let marketplace = env.current_contract_address();
        let nft_client = NftContractClient::new(&env, &nft);
        nft_client.transfer(&marketplace, &seller, &property_id);
    }

    /// Return a single listing.
    pub fn get_listing(env: Env, property_id: u32) -> Option<Listing> {
        env.storage().instance().get(&DataKey::Listing(property_id))
    }

    /// Return a paginated slice of active listings.
    pub fn get_all_listings(env: Env, offset: u32, limit: u32) -> Vec<Listing> {
        let ids: Vec<u32> = env
            .storage()
            .instance()
            .get(&DataKey::AllListings)
            .unwrap_or_else(|| Vec::new(&env));

        let mut result: Vec<Listing> = Vec::new(&env);
        let len = ids.len();
        let start = offset.min(len);
        let end = (offset + limit).min(len);

        for i in start..end {
            // safe: i is bounded by end ≤ len
            let id = ids.get(i).unwrap();
            if let Some(listing) = env.storage().instance().get(&DataKey::Listing(id)) {
                result.push_back(listing);
            }
        }
        result
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    fn remove_from_all_listings(env: &Env, property_id: u32) {
        let ids: Vec<u32> = env
            .storage()
            .instance()
            .get(&DataKey::AllListings)
            .unwrap_or_else(|| Vec::new(env));

        let mut updated: Vec<u32> = Vec::new(env);
        for i in 0..ids.len() {
            // safe: i is bounded by ids.len()
            let id = ids.get(i).unwrap();
            if id != property_id {
                updated.push_back(id);
            }
        }
        env.storage()
            .instance()
            .set(&DataKey::AllListings, &updated);
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use game_property_nft::{GamePropertyNft, GamePropertyNftClient};
    use soroban_sdk::{
        testutils::Address as _,
        token::{StellarAssetClient, TokenClient},
        Address, Env,
    };

    struct Setup<'a> {
        env: Env,
        treasury: Address,
        marketplace_id: Address,
        marketplace: GameMarketplaceClient<'a>,
        nft: GamePropertyNftClient<'a>,
        land_id: Address,
    }

    fn setup() -> Setup<'static> {
        let env = Env::default();
        env.cost_estimate().budget().reset_unlimited();
        env.mock_all_auths();

        let treasury = Address::generate(&env);
        let game_engine = Address::generate(&env);
        let land_admin = Address::generate(&env);

        let nft_id = env.register(GamePropertyNft, ());
        let nft = GamePropertyNftClient::new(&env, &nft_id);
        nft.initialize(&treasury, &game_engine);

        let land_id = env.register_stellar_asset_contract_v2(land_admin).address();

        let marketplace_id = env.register(GameMarketplace, ());
        let marketplace = GameMarketplaceClient::new(&env, &marketplace_id);
        marketplace.initialize(&nft_id, &land_id);

        Setup {
            env,
            treasury,
            marketplace_id,
            marketplace,
            nft,
            land_id,
        }
    }

    fn mint_land(s: &Setup, to: &Address, amount: i128) {
        StellarAssetClient::new(&s.env, &s.land_id).mint(to, &amount);
    }

    #[test]
    fn test_list_takes_custody() {
        let s = setup();
        s.nft.approve(&s.treasury, &s.marketplace_id, &0);
        s.marketplace.list(&s.treasury, &0, &1000);

        assert_eq!(s.nft.get_owner(&0), s.marketplace_id);
        let listing = s.marketplace.get_listing(&0).unwrap();
        assert_eq!(listing.seller, s.treasury);
        assert_eq!(listing.price, 1000);
    }

    #[test]
    fn test_buy_transfers_nft_and_land() {
        let s = setup();
        let buyer = Address::generate(&s.env);
        mint_land(&s, &buyer, 2000);

        s.nft.approve(&s.treasury, &s.marketplace_id, &1);
        s.marketplace.list(&s.treasury, &1, &500);
        s.marketplace.buy(&buyer, &1);

        assert_eq!(s.nft.get_owner(&1), buyer);
        assert!(s.marketplace.get_listing(&1).is_none());

        let land = TokenClient::new(&s.env, &s.land_id);
        assert_eq!(land.balance(&buyer), 1500);
        assert_eq!(land.balance(&s.treasury), 500);
    }

    #[test]
    fn test_cancel_returns_nft_to_seller() {
        let s = setup();
        s.nft.approve(&s.treasury, &s.marketplace_id, &2);
        s.marketplace.list(&s.treasury, &2, &300);
        s.marketplace.cancel(&s.treasury, &2);

        assert_eq!(s.nft.get_owner(&2), s.treasury);
        assert!(s.marketplace.get_listing(&2).is_none());
    }

    #[test]
    fn test_double_sell_prevented() {
        let s = setup();
        let buyer1 = Address::generate(&s.env);
        let buyer2 = Address::generate(&s.env);
        mint_land(&s, &buyer1, 1000);
        mint_land(&s, &buyer2, 1000);

        s.nft.approve(&s.treasury, &s.marketplace_id, &3);
        s.marketplace.list(&s.treasury, &3, &100);
        s.marketplace.buy(&buyer1, &3);

        let result = s.marketplace.try_buy(&buyer2, &3);
        assert_eq!(result, Err(Ok(MarketError::NotListed.into())));
        assert_eq!(s.nft.get_owner(&3), buyer1);
    }

    #[test]
    fn test_buy_insufficient_balance_leaves_listing_intact() {
        let s = setup();
        let broke_buyer = Address::generate(&s.env);

        s.nft.approve(&s.treasury, &s.marketplace_id, &4);
        s.marketplace.list(&s.treasury, &4, &999);

        let result = s.marketplace.try_buy(&broke_buyer, &4);
        assert_eq!(result, Err(Ok(MarketError::InsufficientBalance.into())));

        assert!(s.marketplace.get_listing(&4).is_some());
        assert_eq!(s.nft.get_owner(&4), s.marketplace_id);
    }

    #[test]
    fn test_cancel_by_non_seller_fails() {
        let s = setup();
        let attacker = Address::generate(&s.env);

        s.nft.approve(&s.treasury, &s.marketplace_id, &5);
        s.marketplace.list(&s.treasury, &5, &100);

        let result = s.marketplace.try_cancel(&attacker, &5);
        assert_eq!(result, Err(Ok(MarketError::NotSeller.into())));
    }

    #[test]
    fn test_get_all_listings_pagination() {
        let s = setup();
        for id in 0..5_u32 {
            s.nft.approve(&s.treasury, &s.marketplace_id, &id);
            s.marketplace.list(&s.treasury, &id, &(id as i128 * 100));
        }

        assert_eq!(s.marketplace.get_all_listings(&0, &3).len(), 3);
        assert_eq!(s.marketplace.get_all_listings(&3, &3).len(), 2);
    }

    #[test]
    fn test_list_already_listed_fails() {
        let s = setup();
        s.nft.approve(&s.treasury, &s.marketplace_id, &6);
        s.marketplace.list(&s.treasury, &6, &100);

        let result = s.marketplace.try_list(&s.treasury, &6, &200);
        assert_eq!(result, Err(Ok(MarketError::AlreadyListed.into())));
    }

    // ── initialize ────────────────────────────────────────────────────────────

    #[test]
    fn test_initialize_starts_with_no_listings() {
        let s = setup();

        assert!(s.marketplace.get_listing(&0).is_none());
        assert_eq!(s.marketplace.get_all_listings(&0, &10).len(), 0);
    }

    #[test]
    fn test_initialize_twice_fails() {
        let s = setup();

        let result = s.marketplace.try_initialize(&s.nft.address, &s.land_id);
        assert_eq!(result, Err(Ok(MarketError::AlreadyInitialized.into())));
    }

    // ── list ──────────────────────────────────────────────────────────────────

    #[test]
    fn test_list_before_initialize_fails() {
        let s = setup();
        let uninitialized_id = s.env.register(GameMarketplace, ());
        let uninitialized = GameMarketplaceClient::new(&s.env, &uninitialized_id);
        s.nft.approve(&s.treasury, &uninitialized_id, &7);

        let result = uninitialized.try_list(&s.treasury, &7, &100);
        assert_eq!(result, Err(Ok(MarketError::NotInitialized.into())));
    }

    #[test]
    fn test_list_without_nft_approval_fails() {
        let s = setup();

        // No `approve` call: the escrow `transfer_from` is rejected by the NFT
        // contract, so the marketplace must not record a listing either.
        let result = s.marketplace.try_list(&s.treasury, &8, &100);
        assert!(result.is_err());

        assert!(s.marketplace.get_listing(&8).is_none());
        assert_eq!(s.nft.get_owner(&8), s.treasury);
    }

    #[test]
    fn test_list_by_non_owner_fails() {
        let s = setup();
        let attacker = Address::generate(&s.env);

        let result = s.marketplace.try_list(&attacker, &9, &100);
        assert!(result.is_err());

        assert!(s.marketplace.get_listing(&9).is_none());
        assert_eq!(s.nft.get_owner(&9), s.treasury);
    }

    #[test]
    fn test_list_requires_seller_auth() {
        let s = setup();
        s.nft.approve(&s.treasury, &s.marketplace_id, &10);

        s.env.set_auths(&[]);
        let result = s.marketplace.try_list(&s.treasury, &10, &100);
        assert!(result.is_err());

        assert!(s.marketplace.get_listing(&10).is_none());
    }

    // ── buy ───────────────────────────────────────────────────────────────────

    #[test]
    fn test_buy_nonexistent_listing_fails() {
        let s = setup();
        let buyer = Address::generate(&s.env);
        mint_land(&s, &buyer, 1000);

        let result = s.marketplace.try_buy(&buyer, &11);
        assert_eq!(result, Err(Ok(MarketError::NotListed.into())));
    }

    #[test]
    fn test_buy_with_exact_balance_succeeds() {
        let s = setup();
        let buyer = Address::generate(&s.env);
        mint_land(&s, &buyer, 250);

        s.nft.approve(&s.treasury, &s.marketplace_id, &12);
        s.marketplace.list(&s.treasury, &12, &250);
        s.marketplace.buy(&buyer, &12);

        assert_eq!(s.nft.get_owner(&12), buyer);
        assert_eq!(TokenClient::new(&s.env, &s.land_id).balance(&buyer), 0);
    }

    #[test]
    fn test_buy_removes_listing_from_index() {
        let s = setup();
        let buyer = Address::generate(&s.env);
        mint_land(&s, &buyer, 1000);

        for id in 13..16_u32 {
            s.nft.approve(&s.treasury, &s.marketplace_id, &id);
            s.marketplace.list(&s.treasury, &id, &100);
        }
        s.marketplace.buy(&buyer, &14);

        let remaining = s.marketplace.get_all_listings(&0, &10);
        assert_eq!(remaining.len(), 2);
        assert_eq!(remaining.get(0).unwrap().property_id, 13);
        assert_eq!(remaining.get(1).unwrap().property_id, 15);
    }

    #[test]
    fn test_buy_requires_buyer_auth() {
        let s = setup();
        let buyer = Address::generate(&s.env);
        mint_land(&s, &buyer, 1000);

        s.nft.approve(&s.treasury, &s.marketplace_id, &16);
        s.marketplace.list(&s.treasury, &16, &100);

        s.env.set_auths(&[]);
        let result = s.marketplace.try_buy(&buyer, &16);
        assert!(result.is_err());

        assert!(s.marketplace.get_listing(&16).is_some());
        assert_eq!(s.nft.get_owner(&16), s.marketplace_id);
    }

    // ── cancel ────────────────────────────────────────────────────────────────

    #[test]
    fn test_cancel_nonexistent_listing_fails() {
        let s = setup();

        let result = s.marketplace.try_cancel(&s.treasury, &17);
        assert_eq!(result, Err(Ok(MarketError::NotListed.into())));
    }

    #[test]
    fn test_cancel_twice_fails() {
        let s = setup();
        s.nft.approve(&s.treasury, &s.marketplace_id, &18);
        s.marketplace.list(&s.treasury, &18, &100);
        s.marketplace.cancel(&s.treasury, &18);

        let result = s.marketplace.try_cancel(&s.treasury, &18);
        assert_eq!(result, Err(Ok(MarketError::NotListed.into())));
        assert_eq!(s.nft.get_owner(&18), s.treasury);
    }

    #[test]
    fn test_cancel_requires_seller_auth() {
        let s = setup();
        s.nft.approve(&s.treasury, &s.marketplace_id, &19);
        s.marketplace.list(&s.treasury, &19, &100);

        s.env.set_auths(&[]);
        let result = s.marketplace.try_cancel(&s.treasury, &19);
        assert!(result.is_err());

        assert!(s.marketplace.get_listing(&19).is_some());
        assert_eq!(s.nft.get_owner(&19), s.marketplace_id);
    }

    #[test]
    fn test_cancel_removes_listing_from_index_and_allows_relisting() {
        let s = setup();
        s.nft.approve(&s.treasury, &s.marketplace_id, &20);
        s.marketplace.list(&s.treasury, &20, &100);
        s.marketplace.cancel(&s.treasury, &20);

        assert_eq!(s.marketplace.get_all_listings(&0, &10).len(), 0);

        // Re-listing the same property must succeed after a cancellation.
        s.nft.approve(&s.treasury, &s.marketplace_id, &20);
        s.marketplace.list(&s.treasury, &20, &200);

        assert_eq!(s.marketplace.get_listing(&20).unwrap().price, 200);
        assert_eq!(s.marketplace.get_all_listings(&0, &10).len(), 1);
    }

    #[test]
    fn test_cancel_by_non_seller_leaves_nft_in_escrow() {
        let s = setup();
        let alice = Address::generate(&s.env);
        s.nft.transfer(&s.treasury, &alice, &21);
        s.nft.approve(&alice, &s.marketplace_id, &21);
        s.marketplace.list(&alice, &21, &100);

        let result = s.marketplace.try_cancel(&s.treasury, &21);
        assert_eq!(result, Err(Ok(MarketError::NotSeller.into())));

        assert_eq!(s.nft.get_owner(&21), s.marketplace_id);
        assert_eq!(s.marketplace.get_listing(&21).unwrap().seller, alice);
    }

    // ── get_listing / get_all_listings ────────────────────────────────────────

    #[test]
    fn test_get_listing_returns_none_when_not_listed() {
        let s = setup();

        assert!(s.marketplace.get_listing(&22).is_none());
    }

    #[test]
    fn test_get_all_listings_edge_offsets_and_limits() {
        let s = setup();
        s.nft.approve(&s.treasury, &s.marketplace_id, &23);
        s.marketplace.list(&s.treasury, &23, &100);

        // Zero limit, offset at the end, and offset past the end are all empty.
        assert_eq!(s.marketplace.get_all_listings(&0, &0).len(), 0);
        assert_eq!(s.marketplace.get_all_listings(&1, &10).len(), 0);
        assert_eq!(s.marketplace.get_all_listings(&99, &10).len(), 0);

        // A limit larger than the number of listings is clamped.
        assert_eq!(s.marketplace.get_all_listings(&0, &100).len(), 1);
    }

    #[test]
    fn test_get_all_listings_returns_each_seller_and_price() {
        let s = setup();
        let alice = Address::generate(&s.env);
        s.nft.transfer(&s.treasury, &alice, &24);

        s.nft.approve(&alice, &s.marketplace_id, &24);
        s.marketplace.list(&alice, &24, &777);
        s.nft.approve(&s.treasury, &s.marketplace_id, &25);
        s.marketplace.list(&s.treasury, &25, &888);

        let all = s.marketplace.get_all_listings(&0, &10);
        assert_eq!(all.len(), 2);

        let first = all.get(0).unwrap();
        assert_eq!(first.seller, alice);
        assert_eq!(first.property_id, 24);
        assert_eq!(first.price, 777);

        let second = all.get(1).unwrap();
        assert_eq!(second.seller, s.treasury);
        assert_eq!(second.property_id, 25);
        assert_eq!(second.price, 888);
    }
}
