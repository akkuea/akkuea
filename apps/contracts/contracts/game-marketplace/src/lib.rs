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
    InvalidPrice = 8,
}

// ── Storage types ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Listing {
    pub seller: Address,
    pub property_id: u32,
    pub price: i128,
}

/// A listing together with the index slot it occupies, so removing a listing
/// can move the last slot into the freed one (swap-remove) in constant time
/// instead of scanning the whole index.
///
/// Internal only: `get_listing` / `get_all_listings` keep returning `Listing`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
struct StoredListing {
    listing: Listing,
    slot: u32,
}

#[contracttype]
enum DataKey {
    NftContract,
    LandToken,
    /// Number of active index slots. Small, scalar, kept in instance storage.
    ListingCount,
    /// Persistent: the `StoredListing` for a property id.
    Listing(u32),
    /// Persistent: the property id occupying index slot `u32`.
    IndexSlot(u32),
    Guard,
}

// ── TTL ───────────────────────────────────────────────────────────────────────
//
// Same TTL the other game contracts use (see the `bump_persistent` helper in
// `game-property-nft`). Applied to every listing/index write and to the
// instance on each state-changing call.

const STORAGE_TTL: u32 = 518_400;

fn bump_persistent(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, STORAGE_TTL, STORAGE_TTL);
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
        env.storage().instance().set(&DataKey::ListingCount, &0_u32);
        Self::extend_instance_ttl(&env);
    }

    /// List a property for sale.
    ///
    /// The seller must have already called `approve(seller, marketplace, property_id)`
    /// on the NFT contract. This function calls `transfer_from` to take custody.
    /// `price` must be strictly positive.
    ///
    /// Rent handling: the NFT contract checkpoints rent on every ownership
    /// change (reset-on-transfer design). Unclaimed rent accrued by the seller
    /// up to the escrow transfer is forfeited, so the seller should call
    /// `claim_rental` on the engine before listing. Escrow time earns no rent
    /// for anyone, and the buyer starts accruing from the purchase ledger.
    pub fn list(env: Env, seller: Address, property_id: u32, price: i128) {
        seller.require_auth();

        if price <= 0 {
            panic_with_error!(&env, MarketError::InvalidPrice);
        }

        if env
            .storage()
            .persistent()
            .has(&DataKey::Listing(property_id))
        {
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

        // Append to the index: the new listing takes the next free slot.
        let slot = Self::listing_count(&env);
        let stored = StoredListing {
            listing: Listing {
                seller,
                property_id,
                price,
            },
            slot,
        };

        let listing_key = DataKey::Listing(property_id);
        env.storage().persistent().set(&listing_key, &stored);
        bump_persistent(&env, &listing_key);

        let index_key = DataKey::IndexSlot(slot);
        env.storage().persistent().set(&index_key, &property_id);
        bump_persistent(&env, &index_key);

        env.storage()
            .instance()
            .set(&DataKey::ListingCount, &(slot + 1));
        Self::extend_instance_ttl(&env);
    }

    /// Purchase a listed property.
    ///
    /// Atomically transfers LAND tokens from buyer to seller and the NFT from
    /// escrow to buyer. Uses an ExecutionGuard to prevent re-entrancy.
    /// The NFT contract resets rent checkpointing on transfer, so the buyer
    /// cannot claim rent that accrued before the purchase.
    pub fn buy(env: Env, buyer: Address, property_id: u32) {
        buyer.require_auth();

        let _guard = ExecutionGuard::acquire(&env).unwrap_or_else(|e| panic_with_error!(&env, e));

        let stored: StoredListing = env
            .storage()
            .persistent()
            .get(&DataKey::Listing(property_id))
            .unwrap_or_else(|| panic_with_error!(&env, MarketError::NotListed));
        let listing = stored.listing.clone();

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
        Self::remove_listing(&env, property_id, stored.slot);

        // Transfer LAND from buyer to seller.
        land_client.transfer(&buyer, &listing.seller, &listing.price);

        // Transfer NFT from escrow (this contract) to buyer.
        let marketplace = env.current_contract_address();
        let nft_client = NftContractClient::new(&env, &nft);
        nft_client.transfer(&marketplace, &buyer, &property_id);

        Self::extend_instance_ttl(&env);
    }

    /// Cancel a listing and return the NFT to the seller.
    ///
    /// Escrow time does not pay rent: the NFT contract resets the checkpoint
    /// on the return transfer, so the seller earns nothing for the escrow period.
    pub fn cancel(env: Env, seller: Address, property_id: u32) {
        seller.require_auth();

        let stored: StoredListing = env
            .storage()
            .persistent()
            .get(&DataKey::Listing(property_id))
            .unwrap_or_else(|| panic_with_error!(&env, MarketError::NotListed));
        let listing = stored.listing.clone();

        if listing.seller != seller {
            panic_with_error!(&env, MarketError::NotSeller);
        }

        let nft: Address = env
            .storage()
            .instance()
            .get(&DataKey::NftContract)
            .unwrap_or_else(|| panic_with_error!(&env, MarketError::NotInitialized));

        Self::remove_listing(&env, property_id, stored.slot);

        // Return NFT from escrow to seller.
        let marketplace = env.current_contract_address();
        let nft_client = NftContractClient::new(&env, &nft);
        nft_client.transfer(&marketplace, &seller, &property_id);

        Self::extend_instance_ttl(&env);
    }

    /// Return a single listing.
    pub fn get_listing(env: Env, property_id: u32) -> Option<Listing> {
        env.storage()
            .persistent()
            .get::<DataKey, StoredListing>(&DataKey::Listing(property_id))
            .map(|stored| stored.listing)
    }

    /// Return a paginated slice of active listings.
    ///
    /// Pages are served from a compact index: `offset`/`limit` select index
    /// slots, and each slot holds one active property id. Slots are filled in
    /// listing order, but when a listing is bought or cancelled the last slot
    /// is moved into the freed slot (swap-remove), so results stay in
    /// insertion order only until a removal happens. Callers that need a
    /// stable global order should sort the page themselves.
    ///
    /// `offset`/`limit` are clamped: any pair returns a valid (possibly empty)
    /// page and never panics.
    pub fn get_all_listings(env: Env, offset: u32, limit: u32) -> Vec<Listing> {
        let count = Self::listing_count(&env);
        let start = offset.min(count);
        let end = offset.saturating_add(limit).min(count);

        let mut result: Vec<Listing> = Vec::new(&env);
        for slot in start..end {
            let Some(property_id) = env
                .storage()
                .persistent()
                .get::<DataKey, u32>(&DataKey::IndexSlot(slot))
            else {
                continue;
            };
            if let Some(stored) = env
                .storage()
                .persistent()
                .get::<DataKey, StoredListing>(&DataKey::Listing(property_id))
            {
                result.push_back(stored.listing);
            }
        }
        result
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    fn listing_count(env: &Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::ListingCount)
            .unwrap_or(0)
    }

    fn extend_instance_ttl(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(STORAGE_TTL, STORAGE_TTL);
    }

    /// Drop a listing and its index slot in constant time: the last active
    /// slot is moved into the freed slot, and the moved listing's stored slot
    /// is rewritten to match.
    fn remove_listing(env: &Env, property_id: u32, slot: u32) {
        env.storage()
            .persistent()
            .remove(&DataKey::Listing(property_id));
        env.storage().persistent().remove(&DataKey::IndexSlot(slot));

        let count = Self::listing_count(env);
        if slot >= count {
            return;
        }

        let last_slot = count - 1;
        if slot != last_slot {
            if let Some(moved_id) = env
                .storage()
                .persistent()
                .get::<DataKey, u32>(&DataKey::IndexSlot(last_slot))
            {
                env.storage()
                    .persistent()
                    .set(&DataKey::IndexSlot(slot), &moved_id);
                bump_persistent(env, &DataKey::IndexSlot(slot));

                let moved_key = DataKey::Listing(moved_id);
                if let Some(mut moved) = env
                    .storage()
                    .persistent()
                    .get::<DataKey, StoredListing>(&moved_key)
                {
                    moved.slot = slot;
                    env.storage().persistent().set(&moved_key, &moved);
                    bump_persistent(env, &moved_key);
                }
            }
        }

        env.storage().persistent().remove(&DataKey::IndexSlot(last_slot));
        env.storage()
            .instance()
            .set(&DataKey::ListingCount, &last_slot);
    }
}
