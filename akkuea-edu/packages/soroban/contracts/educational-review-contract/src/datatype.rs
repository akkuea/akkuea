use soroban_sdk::{contracterror, contracttype, Address, String, Vec};

/// Categories specific to educational content for segmented ratings
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Category {
    ContentQuality,    // Quality of educational material
    InstructorSupport, // Instructor responsiveness and help
}

/// Star rating system (1-5 stars)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Rating {
    OneStar = 1,
    TwoStars = 2,
    ThreeStars = 3,
    FourStars = 4,
    FiveStars = 5,
}

/// Status of a review
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ReviewStatus {
    Unverified, // Not yet confirmed
    Verified,   // Purchase confirmed
    Disputed,   // Under dispute
}

/// Multimedia attachment with metadata
#[contracttype]
#[derive(Clone, Debug)]
pub struct MediaAttachment {
    pub file_url: String, // IPFS link or URL
}

/// Storage keys for ledger data
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    PaymentContract,
    Purchase(Address, u64),   // (user, product_id) -> Purchase
    Review(u64, u32),         // (product_id, review_id) -> Review
    ReviewCount(u64),         // product_id -> Next review_id
    ReviewSummary(u64),       // product_id -> Rating summary
    HelpfulVoteSet(u64, u32), // (product_id, review_id) -> Voters
    ProductOwner(u64),        // product_id -> Owner
    Dispute(u32),             // dispute_id -> Dispute
}

/// Errors for review operations
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ReviewError {
    Unauthorized = 1,
    PurchaseNotFound = 2,
    ReviewAlreadyExists = 3,
    NoRatingsProvided = 4,
    ReviewWindowExpired = 5,
    MultimediaLimitExceeded = 6,
    TextTooLong = 7,
    AlreadyVoted = 8,
    ProductNotFound = 9,
    ReviewNotFound = 10,
    DisputeNotFound = 11,
    InvalidCategory = 12,
    InvalidAttachment = 13,
    PurchaseAlreadyExists = 14,
    InvalidRating = 15,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum PurchaseError {
    PurchaseAlreadyExists = 1,
}

#[contracttype]
#[derive(Clone)]
pub struct Purchase {
    pub user: Address,
    pub product_id: u64,
    pub purchase_time: u64,
    pub review_id: Option<u32>,        // Links to Review
    pub purchase_link: Option<String>, // Proof of purchase (e.g., tx ID)
}

/// Review with category ratings and multimedia
#[contracttype]
#[derive(Clone)]
pub struct Review {
    pub reviewer: Address,
    pub category_ratings: Vec<CategoryRating>, // Segmented ratings
    pub text: Option<String>,
    pub multimedia: Vec<MediaAttachment>,
    pub timestamp: u64,
    pub responses: Vec<Response>,
    pub status: ReviewStatus,
    pub dispute_id: Option<u32>,
    pub helpful_votes: u32,
    pub not_helpful_votes: u32,
}

/// Response to a review
#[contracttype]
#[derive(Clone)]
pub struct Response {
    pub author: Address,
    pub text: String,
    pub timestamp: u64,
}

/// Rating for a specific category
#[contracttype]
#[derive(Clone)]
pub struct CategoryRating {
    pub category: Category,
    pub rating: Rating,
    pub timestamp: u64,
}

/// Summary of ratings for a product
#[contracttype]
#[derive(Clone)]
pub struct ReviewSummary {
    pub total_ratings: u64,
    pub sum_ratings: u64, // Sum of all rating values (for average)
}

/// Dispute record
#[contracttype]
#[derive(Clone)]
pub struct Dispute {
    pub review_id: u32,
    pub product_id: u64,
    pub complainant: Address,
    pub evidence: String, // Off-chain reference or description
    pub resolved: bool,
    pub timestamp: u64,
}
