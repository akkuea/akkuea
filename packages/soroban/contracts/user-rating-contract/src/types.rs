use soroban_sdk::{contracttype, Address, BytesN, String};

#[derive(Clone, Debug)]
#[contracttype]
pub enum DataKey {
    UserReputation(Address),       // Maps user to their reputation data
    TransactionRating(BytesN<32>), // Maps transaction ID to rating data
    UserRatingHistory(Address),    // Maps user to their rating history
    LastRatingTimestamp(Address),  // Tracks the last time a user submitted a rating
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct ReputationData {
    pub total_score: u32,                // Cumulative weighted score
    pub rating_count: u32,               // Total number of ratings received
    pub reputation_score: u32,           // Normalized score (0-100)
    pub reputation_tier: ReputationTier, // Categorized reputation level
}

#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub enum ReputationTier {
    New,    // New users with few ratings
    Low,    // Low reputation
    Medium, // Medium reputation
    High,   // High reputation
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct RatingData {
    pub transaction_id: BytesN<32>, // Unique transaction identifier
    pub rater: Address,             // User who submitted the rating
    pub rated_user: Address,        // User being rated
    pub delivery_score: u32,        // Score for delivery (1-5)
    pub communication_score: u32,   // Score for communication (1-5)
    pub accuracy_score: u32,        // Score for accuracy (1-5)
    pub value_score: u32,           // Score for value (1-5)
    pub timestamp: u64,             // Timestamp when rating was submitted
    pub comment: String,            // Optional comment
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct RatingSubmissionResult {
    pub success: bool,
    pub new_reputation_score: u32,
    pub new_reputation_tier: ReputationTier,
    pub message: String,
}
