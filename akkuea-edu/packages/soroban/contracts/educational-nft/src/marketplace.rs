use crate::nft::get_educational_nft_safe;
use crate::utils::NFTError;
use soroban_sdk::{contracttype, symbol_short, Address, Env, String, Symbol, Vec};

pub const LISTING_EVENT: Symbol = symbol_short!("nft_list");
pub const SALE_EVENT: Symbol = symbol_short!("nft_sale");
pub const AUCTION_EVENT: Symbol = symbol_short!("nft_auct");
pub const BID_EVENT: Symbol = symbol_short!("nft_bid");
pub const ROYALTY_EVENT: Symbol = symbol_short!("nft_royal");

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Listing {
    pub token_id: u64,
    pub seller: Address,
    pub price: i128,
    pub auction_end: u64,
    pub royalty_rate: u32,
    pub is_active: bool,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Bid {
    pub token_id: u64,
    pub bidder: Address,
    pub amount: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Sale {
    pub token_id: u64,
    pub seller: Address,
    pub buyer: Address,
    pub price: i128,
    pub royalty_paid: i128,
    pub royalty_recipient: Address,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PriceHistory {
    pub token_id: u64,
    pub prices: Vec<i128>,
    pub timestamps: Vec<u64>,
    pub last_updated: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ListingEvent {
    pub token_id: u64,
    pub seller: Address,
    pub price: i128,
    pub auction_end: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SaleEvent {
    pub token_id: u64,
    pub seller: Address,
    pub buyer: Address,
    pub price: i128,
    pub royalty_paid: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BidEvent {
    pub token_id: u64,
    pub bidder: Address,
    pub amount: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RoyaltyEvent {
    pub token_id: u64,
    pub creator: Address,
    pub amount: i128,
    pub sale_price: i128,
    pub timestamp: u64,
}

const LISTINGS: Symbol = symbol_short!("listings");
const BIDS: Symbol = symbol_short!("bids");
const SALES_HISTORY: Symbol = symbol_short!("sales_h");
const PRICE_HISTORY: Symbol = symbol_short!("price_h");
const ACTIVE_LISTINGS: Symbol = symbol_short!("act_list");

pub fn store_listing(env: &Env, listing: &Listing) {
    let key = (LISTINGS, listing.token_id);
    env.storage().persistent().set(&key, listing);
}

pub fn get_listing(env: &Env, token_id: u64) -> Option<Listing> {
    let key = (LISTINGS, token_id);
    env.storage().persistent().get(&key)
}

pub fn remove_listing(env: &Env, token_id: u64) {
    let key = (LISTINGS, token_id);
    env.storage().persistent().remove(&key);
}

pub fn store_bid(env: &Env, token_id: u64, bid: &Bid) {
    let key = (BIDS, token_id);
    let mut bids: Vec<Bid> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));

    bids.push_back(bid.clone());
    env.storage().persistent().set(&key, &bids);
}

pub fn get_bids(env: &Env, token_id: u64) -> Vec<Bid> {
    let key = (BIDS, token_id);
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env))
}

pub fn get_highest_bid(env: &Env, token_id: u64) -> Option<Bid> {
    let bids = get_bids(env, token_id);
    if bids.is_empty() {
        return None;
    }

    let mut highest_bid = bids.get(0).unwrap();
    for i in 1..bids.len() {
        let bid = bids.get(i).unwrap();
        if bid.amount > highest_bid.amount {
            highest_bid = bid;
        }
    }
    Some(highest_bid)
}

pub fn store_sale(env: &Env, sale: &Sale) {
    let key = (SALES_HISTORY, sale.token_id);
    let mut sales: Vec<Sale> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));

    sales.push_back(sale.clone());
    env.storage().persistent().set(&key, &sales);
}

pub fn get_sales_history(env: &Env, token_id: u64) -> Vec<Sale> {
    let key = (SALES_HISTORY, token_id);
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env))
}

pub fn update_price_history(env: &Env, token_id: u64, price: i128) {
    let key = (PRICE_HISTORY, token_id);
    let timestamp = env.ledger().timestamp();

    let mut history: PriceHistory =
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| PriceHistory {
                token_id,
                prices: Vec::new(env),
                timestamps: Vec::new(env),
                last_updated: timestamp,
            });

    history.prices.push_back(price);
    history.timestamps.push_back(timestamp);
    history.last_updated = timestamp;

    if history.prices.len() > 10 {
        history.prices.remove(0);
        history.timestamps.remove(0);
    }

    env.storage().persistent().set(&key, &history);
}

pub fn get_price_history(env: &Env, token_id: u64) -> Option<PriceHistory> {
    let key = (PRICE_HISTORY, token_id);
    env.storage().persistent().get(&key)
}

pub fn calculate_average_price(env: &Env, token_id: u64) -> Option<i128> {
    let history = get_price_history(env, token_id)?;
    if history.prices.is_empty() {
        return None;
    }

    let mut total: i128 = 0;
    for i in 0..history.prices.len() {
        total += history.prices.get(i).unwrap();
    }
    Some(total / history.prices.len() as i128)
}

pub fn list_nft(
    env: &Env,
    caller: &Address,
    token_id: u64,
    price: i128,
    auction_end: u64,
    royalty_rate: u32,
) -> Result<(), NFTError> {
    let nft_data = get_educational_nft_safe(env, token_id)?;
    if nft_data.owner != *caller {
        return Err(NFTError::NotOwner);
    }

    if price <= 0 {
        return Err(NFTError::Unauthorized);
    }

    if royalty_rate > 10000 {
        return Err(NFTError::Unauthorized);
    }

    if auction_end > 0 && auction_end <= env.ledger().timestamp() {
        return Err(NFTError::Unauthorized);
    }

    let timestamp = env.ledger().timestamp();
    let listing = Listing {
        token_id,
        seller: caller.clone(),
        price,
        auction_end,
        royalty_rate,
        is_active: true,
        created_at: timestamp,
    };

    store_listing(env, &listing);

    let listing_event = ListingEvent {
        token_id,
        seller: caller.clone(),
        price,
        auction_end,
        timestamp,
    };

    env.events().publish((LISTING_EVENT,), listing_event);

    Ok(())
}

pub fn buy_nft(
    env: &Env,
    caller: &Address,
    token_id: u64,
    payment_amount: i128,
) -> Result<(), NFTError> {
    let listing = get_listing(env, token_id).ok_or(NFTError::TokenNotFound)?;

    if !listing.is_active {
        return Err(NFTError::Unauthorized);
    }

    if listing.auction_end > 0 {
        return Err(NFTError::Unauthorized);
    }

    if payment_amount < listing.price {
        return Err(NFTError::Unauthorized);
    }

    if listing.seller == *caller {
        return Err(NFTError::Unauthorized);
    }

    let nft_data = get_educational_nft_safe(env, token_id)?;
    let royalty_amount = (listing.price * listing.royalty_rate as i128) / 10000;
    let seller_amount = listing.price - royalty_amount;

    let timestamp = env.ledger().timestamp();

    let sale = Sale {
        token_id,
        seller: listing.seller.clone(),
        buyer: caller.clone(),
        price: listing.price,
        royalty_paid: royalty_amount,
        royalty_recipient: nft_data.owner.clone(),
        timestamp,
    };

    store_sale(env, &sale);
    update_price_history(env, token_id, listing.price);
    remove_listing(env, token_id);

    let sale_event = SaleEvent {
        token_id,
        seller: listing.seller.clone(),
        buyer: caller.clone(),
        price: listing.price,
        royalty_paid: royalty_amount,
        timestamp,
    };

    env.events().publish((SALE_EVENT,), sale_event);

    if royalty_amount > 0 {
        let royalty_event = RoyaltyEvent {
            token_id,
            creator: nft_data.owner.clone(),
            amount: royalty_amount,
            sale_price: listing.price,
            timestamp,
        };

        env.events().publish((ROYALTY_EVENT,), royalty_event);
    }

    Ok(())
}

pub fn place_bid(
    env: &Env,
    caller: &Address,
    token_id: u64,
    bid_amount: i128,
) -> Result<(), NFTError> {
    let listing = get_listing(env, token_id).ok_or(NFTError::TokenNotFound)?;

    if !listing.is_active {
        return Err(NFTError::Unauthorized);
    }

    if listing.auction_end == 0 {
        return Err(NFTError::Unauthorized);
    }

    if env.ledger().timestamp() >= listing.auction_end {
        return Err(NFTError::Unauthorized);
    }

    if bid_amount <= 0 {
        return Err(NFTError::Unauthorized);
    }

    if listing.seller == *caller {
        return Err(NFTError::Unauthorized);
    }

    if let Some(highest_bid) = get_highest_bid(env, token_id) {
        if bid_amount <= highest_bid.amount {
            return Err(NFTError::Unauthorized);
        }
    } else if bid_amount < listing.price {
        return Err(NFTError::Unauthorized);
    }

    let timestamp = env.ledger().timestamp();
    let bid = Bid {
        token_id,
        bidder: caller.clone(),
        amount: bid_amount,
        timestamp,
    };

    store_bid(env, token_id, &bid);

    let bid_event = BidEvent {
        token_id,
        bidder: caller.clone(),
        amount: bid_amount,
        timestamp,
    };

    env.events().publish((BID_EVENT,), bid_event);

    Ok(())
}

pub fn settle_auction(env: &Env, caller: &Address, token_id: u64) -> Result<(), NFTError> {
    let mut listing = get_listing(env, token_id).ok_or(NFTError::TokenNotFound)?;

    if !listing.is_active {
        return Err(NFTError::Unauthorized);
    }

    if listing.auction_end == 0 {
        return Err(NFTError::Unauthorized);
    }

    if env.ledger().timestamp() < listing.auction_end {
        return Err(NFTError::Unauthorized);
    }

    let highest_bid = get_highest_bid(env, token_id);
    if highest_bid.is_none() {
        listing.is_active = false;
        store_listing(env, &listing);
        return Ok(());
    }

    let winning_bid = highest_bid.unwrap();
    let nft_data = get_educational_nft_safe(env, token_id)?;
    let royalty_amount = (winning_bid.amount * listing.royalty_rate as i128) / 10000;
    let seller_amount = winning_bid.amount - royalty_amount;

    let timestamp = env.ledger().timestamp();

    let sale = Sale {
        token_id,
        seller: listing.seller.clone(),
        buyer: winning_bid.bidder.clone(),
        price: winning_bid.amount,
        royalty_paid: royalty_amount,
        royalty_recipient: nft_data.owner.clone(),
        timestamp,
    };

    store_sale(env, &sale);
    update_price_history(env, token_id, winning_bid.amount);
    remove_listing(env, token_id);

    let sale_event = SaleEvent {
        token_id,
        seller: listing.seller.clone(),
        buyer: winning_bid.bidder.clone(),
        price: winning_bid.amount,
        royalty_paid: royalty_amount,
        timestamp,
    };

    env.events().publish((SALE_EVENT,), sale_event);

    if royalty_amount > 0 {
        let royalty_event = RoyaltyEvent {
            token_id,
            creator: nft_data.owner.clone(),
            amount: royalty_amount,
            sale_price: winning_bid.amount,
            timestamp,
        };

        env.events().publish((ROYALTY_EVENT,), royalty_event);
    }

    Ok(())
}

pub fn cancel_listing(env: &Env, caller: &Address, token_id: u64) -> Result<(), NFTError> {
    let listing = get_listing(env, token_id).ok_or(NFTError::TokenNotFound)?;

    if listing.seller != *caller {
        return Err(NFTError::Unauthorized);
    }

    if !listing.is_active {
        return Err(NFTError::Unauthorized);
    }

    if listing.auction_end > 0 && get_highest_bid(env, token_id).is_some() {
        return Err(NFTError::Unauthorized);
    }

    remove_listing(env, token_id);

    Ok(())
}

pub fn get_active_listings(env: &Env) -> Vec<Listing> {
    Vec::new(env)
}

pub fn get_listings_by_seller(env: &Env, _seller: &Address) -> Vec<Listing> {
    Vec::new(env)
}
