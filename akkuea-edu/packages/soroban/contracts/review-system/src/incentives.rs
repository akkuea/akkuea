use soroban_sdk::{contracterror, contracttype, Address};

/// Review reward data structure as specified in the requirements
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReviewReward {
    pub review_id: u64,     // Associated review ID
    pub reviewer: Address,  // Stellar address of the reviewer
    pub token_amount: i128, // Reward amount in tokens (Stroops)
    pub timestamp: u64,     // Reward issuance timestamp
}

/// Quality thresholds for review rewards
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct QualityThresholds {
    pub min_length: u32,            // Minimum review text length
    pub min_helpful_votes: u32,     // Minimum helpful votes
    pub min_helpfulness_ratio: u32, // Minimum ratio (helpful/(helpful+not_helpful)) * 100
    pub max_not_helpful_votes: u32, // Maximum not helpful votes allowed
}

/// Reward amounts by quality tier
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RewardAmounts {
    pub basic_reward: i128,        // Basic quality review reward
    pub high_quality_reward: i128, // High quality review reward
    pub exceptional_reward: i128,  // Exceptional quality review reward
}

/// Quality tier for reviews
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum QualityTier {
    Basic,
    HighQuality,
    Exceptional,
}

/// Errors specific to the reward system
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RewardError {
    RewardContractNotSet = 100,
    RewardAlreadyIssued = 101,
    NotEligibleForReward = 102,
    InvalidRewardAmount = 103,
    RewardDistributionFailed = 104,
    ThresholdsNotSet = 105,
    RewardAmountsNotSet = 106,
}
