# C5-005: Implement GameMarketplace Soroban Contract

## Issue Metadata

| Attribute       | Value           |
| --------------- | --------------- |
| Issue ID        | C5-005          |
| Area            | CONTRACTS       |
| Difficulty      | High            |
| Labels          | contracts, high |
| Dependencies    | C5-003, C5-004  |
| Estimated Lines | 250-380         |

## Contract Architecture

### Storage

```rust
const LISTINGS_KEY: Symbol = symbol_short!("LISTINGS");
const NFT_CONTRACT_KEY: Symbol = symbol_short!("NFT");
const TOKEN_CONTRACT_KEY: Symbol = symbol_short!("TOKEN");

#[contracttype]
pub struct Listing {
    pub seller: Address,
    pub property_id: u32,
    pub price_in_land: i128,
    pub created_ledger: u64,
}
```

Store the listings as `Map<u32, Listing>` (keyed by property ID) in instance storage.

### Entry Points

```rust
#[contractimpl]
impl GameMarketplace {
    pub fn initialize(env: Env, nft_contract: Address, token_contract: Address);
    pub fn list(env: Env, seller: Address, property_id: u32, price_in_land: i128);
    pub fn buy(env: Env, buyer: Address, property_id: u32);
    pub fn cancel(env: Env, seller: Address, property_id: u32);
    pub fn get_listing(env: Env, property_id: u32) -> Option<Listing>;
    pub fn get_all_listings(env: Env, offset: u32, limit: u32) -> soroban_sdk::Vec<Listing>;
}
```

### List Flow

```rust
pub fn list(env: Env, seller: Address, property_id: u32, price_in_land: i128) {
    seller.require_auth();

    // Verify seller owns the property
    let nft = GamePropertyNftClient::new(&env, &get_nft_contract(&env));
    if nft.get_owner(&property_id) != seller {
        panic_with_error!(&env, MarketError::NotOwner);
    }

    // Transfer NFT to marketplace escrow
    nft.transfer_from(&env.current_contract_address(), &seller, &env.current_contract_address(), &property_id);

    // Record listing
    let mut listings = get_listings(&env);
    listings.set(property_id, Listing {
        seller: seller.clone(),
        property_id,
        price_in_land,
        created_ledger: env.ledger().sequence() as u64,
    });
    save_listings(&env, &listings);

    env.events().publish((symbol_short!("listed"), seller, property_id), price_in_land);
}
```

Note: the seller must call `approve(marketplace_address, property_id)` on the NFT contract before calling `list`.

### Buy Flow

```rust
pub fn buy(env: Env, buyer: Address, property_id: u32) {
    buyer.require_auth();

    let listing = get_listing_or_error(&env, property_id)?;

    // Transfer LAND from buyer to seller
    let token = GameLandTokenClient::new(&env, &get_token_contract(&env));
    token.transfer_from(
        &env.current_contract_address(),
        &buyer,
        &listing.seller,
        &listing.price_in_land,
    );

    // Transfer NFT from escrow to buyer
    let nft = GamePropertyNftClient::new(&env, &get_nft_contract(&env));
    nft.transfer(&env.current_contract_address(), &buyer, &property_id);

    // Remove listing
    let mut listings = get_listings(&env);
    listings.remove(property_id);
    save_listings(&env, &listings);

    env.events().publish((symbol_short!("sold"), buyer.clone(), property_id), listing.price_in_land);
}
```

Note: the buyer must call `approve(marketplace_address, price_in_land)` on the LandToken contract before calling `buy`.

### Cancel Flow

```rust
pub fn cancel(env: Env, seller: Address, property_id: u32) {
    seller.require_auth();

    let listing = get_listing_or_error(&env, property_id)?;
    if listing.seller != seller {
        panic_with_error!(&env, MarketError::NotSeller);
    }

    // Return NFT from escrow to seller
    let nft = GamePropertyNftClient::new(&env, &get_nft_contract(&env));
    nft.transfer(&env.current_contract_address(), &seller, &property_id);

    // Remove listing
    let mut listings = get_listings(&env);
    listings.remove(property_id);
    save_listings(&env, &listings);

    env.events().publish((symbol_short!("cancelled"), seller, property_id), ());
}
```

### Error Enum

```rust
#[contracterror]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum MarketError {
    AlreadyInitialized = 1,
    NotOwner = 2,
    NotSeller = 3,
    ListingNotFound = 4,
    InsufficientBalance = 5,
    AlreadyListed = 6,
}
```

### Required Tests

- `list_creates_escrow_and_listing`
- `buy_transfers_nft_and_land_atomically`
- `buy_fails_with_insufficient_balance`
- `cancel_returns_nft_to_seller`
- `cancel_fails_if_not_seller`
- `list_fails_if_not_owner`
- `buy_fails_if_listing_not_found`

Use the real PropertyNFT and LandToken contract clients in tests, registered in the same `Env`.

## Definition of Done

- All entry points implemented and tested.
- Buy flow is atomic (LAND + NFT transfer in same invocation).
- All required tests pass.
- `stellar contract build` succeeds.
- All CI workflows pass on the pull request.
