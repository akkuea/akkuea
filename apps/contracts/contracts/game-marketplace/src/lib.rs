#![no_std]

use cougr_core::ops::ExecutionGuard;
use soroban_sdk::{
    contract,
    contractclient,
    contracterror,
    contractimpl,
    contracttype,
    panic_with_error,
    symbol_short,
    Address,
    Env,
    Map,
    Symbol,
    Vec,
};

const LISTINGS_KEY: Symbol = symbol_short!("LISTINGS");
const NFT_CONTRACT_KEY: Symbol = symbol_short!("NFT");
const TOKEN_CONTRACT_KEY: Symbol = symbol_short!("TOKEN");
const BUY_GUARD_KEY: Symbol = symbol_short!("BUY");

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct Listing {
    pub seller: Address,
    pub property_id: u32,
    pub price_in_land: i128,
    pub created_ledger: u64,
}

#[contracterror]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MarketError {
    AlreadyInitialized = 1,
    NotOwner = 2,
    NotSeller = 3,
    ListingNotFound = 4,
    InsufficientBalance = 5,
    AlreadyListed = 6,
}

#[contractclient(name = "GamePropertyNftClient")]
pub trait GamePropertyNft {
    fn transfer_from(env: Env, spender: Address, from: Address, to: Address, property_id: u32);
    fn transfer(env: Env, from: Address, to: Address, property_id: u32);
    fn get_owner(env: Env, property_id: u32) -> Address;
}

#[contractclient(name = "GameLandTokenClient")]
pub trait GameLandToken {
    fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128);
}

#[contract]
pub struct GameMarketplace;

#[contractimpl]
impl GameMarketplace {
    pub fn initialize(env: Env, nft_contract: Address, token_contract: Address) {
        if env.storage().instance().has(&NFT_CONTRACT_KEY) {
            panic_with_error!(&env, MarketError::AlreadyInitialized);
        }

        env.storage().instance().set(&NFT_CONTRACT_KEY, &nft_contract);
        env.storage().instance().set(&TOKEN_CONTRACT_KEY, &token_contract);
    }

    pub fn list(env: Env, seller: Address, property_id: u32, price_in_land: i128) {
        seller.require_auth();
        if price_in_land <= 0 {
            panic!("price_in_land must be greater than zero");
        }

        let nft = GamePropertyNftClient::new(&env, &get_nft_contract(&env));
        if nft.get_owner(&property_id) != seller {
            panic_with_error!(&env, MarketError::NotOwner);
        }

        if get_listings(&env).get(property_id).is_some() {
            panic_with_error!(&env, MarketError::AlreadyListed);
        }

        nft.transfer_from(
            &env.current_contract_address(),
            &seller,
            &env.current_contract_address(),
            &property_id,
        );

        let mut listings = get_listings(&env);
        listings.set(
            property_id,
            Listing {
                seller: seller.clone(),
                property_id,
                price_in_land,
                created_ledger: env.ledger().sequence() as u64,
            },
        );
        save_listings(&env, &listings);

        env.events().publish((symbol_short!("listed"), seller, property_id), price_in_land);
    }

    pub fn buy(env: Env, buyer: Address, property_id: u32) {
        buyer.require_auth();
        let _guard = ExecutionGuard::new(BUY_GUARD_KEY);

        let listing = get_listing_or_error(&env, property_id).unwrap();

        let token = GameLandTokenClient::new(&env, &get_token_contract(&env));
        token.transfer_from(
            &env.current_contract_address(),
            &buyer,
            &listing.seller,
            &listing.price_in_land,
        );

        let nft = GamePropertyNftClient::new(&env, &get_nft_contract(&env));
        nft.transfer(&env.current_contract_address(), &buyer, &property_id);

        let mut listings = get_listings(&env);
        listings.remove(property_id);
        save_listings(&env, &listings);

        env.events().publish((symbol_short!("sold"), buyer.clone(), property_id), listing.price_in_land);
    }

    pub fn cancel(env: Env, seller: Address, property_id: u32) {
        seller.require_auth();

        let listing = get_listing_or_error(&env, property_id).unwrap();
        if listing.seller != seller {
            panic_with_error!(&env, MarketError::NotSeller);
        }

        let nft = GamePropertyNftClient::new(&env, &get_nft_contract(&env));
        nft.transfer(&env.current_contract_address(), &seller, &property_id);

        let mut listings = get_listings(&env);
        listings.remove(property_id);
        save_listings(&env, &listings);

        env.events().publish((symbol_short!("cancelled"), seller, property_id), ());
    }

    pub fn get_listing(env: Env, property_id: u32) -> Option<Listing> {
        get_listing_helper(&env, property_id)
    }

    pub fn get_all_listings(env: Env, offset: u32, limit: u32) -> Vec<Listing> {
        let listings = get_listings(&env);
        let keys = listings.keys();
        let mut result = Vec::new(&env);
        let mut idx = offset;
        let count = keys.len();

        while idx < count && result.len() < limit {
            if let Some(key) = keys.get(idx) {
                if let Some(listing) = listings.get(key) {
                    result.push_back(listing);
                }
            }
            idx += 1;
        }

        result
    }
}

fn get_nft_contract(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&NFT_CONTRACT_KEY)
        .expect("NFT contract not initialized")
}

fn get_token_contract(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&TOKEN_CONTRACT_KEY)
        .expect("token contract not initialized")
}

fn get_listings(env: &Env) -> Map<u32, Listing> {
    env.storage()
        .instance()
        .get(&LISTINGS_KEY)
        .unwrap_or_else(|| Map::<u32, Listing>::new(env))
}

fn save_listings(env: &Env, listings: &Map<u32, Listing>) {
    env.storage().instance().set(&LISTINGS_KEY, listings);
}

fn get_listing_or_error(env: &Env, property_id: u32) -> Result<Listing, MarketError> {
    get_listing_helper(env, property_id).ok_or(MarketError::ListingNotFound)
}

fn get_listing_helper(env: &Env, property_id: u32) -> Option<Listing> {
    get_listings(env).get(property_id)
}

#[cfg(test)]
mod test;
