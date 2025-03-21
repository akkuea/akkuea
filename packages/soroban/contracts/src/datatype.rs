use soroban_sdk::{contracterror, contracttype, Address, String, Vec};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Admin,
    PaymentContract,
    Purchase(Address, u64), // (user, product_id) -> Purchase
    Review(u64, u32),       // (product_id, review_id) -> Review
    ReviewCount(u64),       // product_id -> Next review_id
    ReviewSummary(u64),
    HelpfulVotes(u64, u32), // (product_id, review_id) -> Voters
    ProductOwner(u64),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ReviewError {
    Unauthorized = 1,
    PurchaseNotFound = 2,
    ReviewAlreadyExists = 3,
    InvalidRating = 4,
    ReviewWindowExpired = 5,
    MultimediaLimitExceeded = 6,
    TextTooLong = 7,
    AlreadyVoted = 8,
    ProductNotFound = 9,
    ReviewNotFound = 10,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Rating {
    One = 1,
    Two = 2,
    Three = 3,
    Four = 4,
    Five = 5,
}

#[contracttype]
#[derive(Clone)]
pub struct Purchase {
    pub user: Address,
    pub product_id: u64,
    pub purchase_time: u64,
    pub review_id: Option<u32>, // Links to Review
}

#[contracttype]
#[derive(Clone)]
pub struct Review {
    pub rating: Rating,
    pub text: Option<String>,
    pub multimedia: Vec<String>,
    pub timestamp: u64,
    pub responses: Vec<Response>,
    pub is_disputed: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct Response {
    pub author: Address,
    pub text: String,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct ReviewSummary {
    pub total_ratings: u64,
    pub sum_ratings: u64,
}
