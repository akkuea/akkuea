use super::storage::{get_admin, get_auction, is_resolver, save_auction};
use crate::datatype::{AuctionStatus, DisputeStatus};
use soroban_sdk::{Address, BytesN, Env, String, Symbol};

// Open a dispute
pub fn open_dispute(env: &Env, auction_id: &BytesN<32>, buyer: &Address, reason: &String) {
    buyer.require_auth();

    let mut auction = get_auction(env, auction_id);

    // Check if caller is highest bidder
    if auction.has_highest_bid {
        if auction.highest_bidder != *buyer {
            panic!("Only the highest bidder can open a dispute");
        }
    } else {
        panic!("No bids on this auction");
    }

    // Validate auction status
    if auction.status != AuctionStatus::Ended && auction.status != AuctionStatus::Completed {
        panic!("Can only open disputes for ended or completed auctions");
    }

    if auction.dispute_status != DisputeStatus::None {
        panic!("A dispute is already open for this auction");
    }

    // Update auction
    auction.dispute_status = DisputeStatus::Open;
    auction.has_dispute_reason = true;
    auction.dispute_reason = reason.clone();
    auction.status = AuctionStatus::Disputed;
    save_auction(env, auction_id, &auction);

    // Emit event
    env.events().publish(
        (Symbol::new(env, "dispute_opened"), auction_id.clone()),
        (auction_id.clone(), reason.clone()),
    );
}

// Resolve a dispute
pub fn resolve_dispute(
    env: &Env,
    resolver: &Address,
    auction_id: &BytesN<32>,
    resolution: &DisputeStatus,
) {
    resolver.require_auth();

    // Check authorization
    let admin = get_admin(env);
    if *resolver != admin && !is_resolver(env, resolver) {
        panic!("Not authorized to resolve disputes");
    }

    if *resolution == DisputeStatus::None || *resolution == DisputeStatus::Open {
        panic!("Invalid resolution status");
    }

    let mut auction = get_auction(env, auction_id);

    if auction.dispute_status != DisputeStatus::Open {
        panic!("No open dispute for this auction");
    }

    // Update auction
    auction.dispute_status = *resolution;
    auction.status = AuctionStatus::Completed;
    save_auction(env, auction_id, &auction);

    // Emit event
    env.events().publish(
        (Symbol::new(env, "dispute_resolved"), auction_id.clone()),
        (auction_id.clone(), *resolution),
    );
}
