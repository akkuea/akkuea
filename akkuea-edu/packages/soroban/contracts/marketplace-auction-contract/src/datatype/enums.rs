use soroban_sdk::contracttype;

/// Product condition rating
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[contracttype]
pub enum ProductCondition {
    New,
    LikeNew,
    Good,
    Fair,
    Poor,
}

/// Auction status
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[contracttype]
pub enum AuctionStatus {
    Pending,   // Created but not yet started
    Active,    // Auction is live and accepting bids
    Ended,     // Auction time has expired
    Cancelled, // Auction was cancelled
    Completed, // Product has been delivered and verified
    Disputed,  // There is an active dispute on this auction
}

/// Dispute status
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[contracttype]
pub enum DisputeStatus {
    None,
    Open,
    ResolvedForBuyer,
    ResolvedForSeller,
}

/// Shipping status
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[contracttype]
pub enum ShippingStatus {
    NotShipped,
    Shipped,
    InTransit,
    Delivered,
}

/// Storage keys for better organization
#[contracttype]
#[derive(Clone)]
pub enum StorageKey {
    Admin,
    Auctions,
    AuctionCounter,
    UserSelling(soroban_sdk::Address),
    UserBidding(soroban_sdk::Address),
    Verifiers,
    Resolvers,
}
