use super::storage::{get_auction, save_auction};
use crate::datatype::{AuctionStatus, Bid};
use soroban_sdk::{Address, BytesN, Env, Symbol};

// Place a bid on an auction
pub fn place_bid(
    env: &Env,
    auction_id: &BytesN<32>,
    bidder: &Address,
    amount: &i128,
    quantity: &u32,
) {
    bidder.require_auth();

    let mut auction = get_auction(env, auction_id);

    // Validate auction state
    if auction.status != AuctionStatus::Active {
        panic!("Auction is not active");
    }

    // Validate auction state
    if auction.status != AuctionStatus::Active {
        panic!("Auction is not active");
    }

    // Validate auction state
    if auction.status != AuctionStatus::Active {
        panic!("Auction is not active");
    }

    let current_time = env.ledger().timestamp();
    if current_time < auction.start_time {
        panic!("Auction has not started yet");
    }
    if current_time > auction.end_time {
        panic!("Auction has already ended");
    }

    // Check inventory
    if *quantity > auction.product.inventory_count {
        panic!("Requested quantity exceeds available inventory");
    }

    // Check bid amount
    if auction.has_highest_bid {
        let highest_bid = Bid {
            bidder: auction.highest_bidder.clone(),
            amount: auction.highest_bid_amount,
            timestamp: auction.highest_bid_timestamp,
            quantity: auction.highest_bid_quantity,
        };

        if amount <= &highest_bid.amount {
            panic!("Bid amount must be higher than current highest bid");
        }
    }

    // Create new bid
    let new_bid = Bid {
        bidder: bidder.clone(),
        amount: *amount,
        timestamp: env.ledger().timestamp(),
        quantity: *quantity,
    };

    // Update auction
    auction.has_highest_bid = true;
    auction.highest_bidder = new_bid.bidder.clone();
    auction.highest_bid_amount = new_bid.amount;
    auction.highest_bid_timestamp = new_bid.timestamp;
    auction.highest_bid_quantity = new_bid.quantity;
    auction.all_bids.push_back(new_bid);
    save_auction(env, auction_id, &auction);

    // Emit event
    env.events().publish(
        (Symbol::new(env, "bid_placed"), auction_id.clone()),
        (auction_id.clone(), bidder.clone(), *amount, *quantity),
    );
}
