use soroban_sdk::{contracttype, Address, String};

/// Premium tier levels based on contribution amounts
#[contracttype]
#[derive(Debug, Clone, PartialEq, PartialOrd)]
pub enum TierLevel {
    None,  // No premium tier
    Basic, // 100-499 XLM
    Pro,   // 500-1999 XLM
    Elite, // 2000+ XLM
}

/// Premium tier data structure
#[contracttype]
#[derive(Debug, Clone)]
pub struct PremiumTier {
    pub user: Address,             // Stellar address of the user
    pub tier: TierLevel,           // Tier level
    pub contribution: i128,        // Contribution amount in Stroops (1 XLM = 10,000,000 Stroops)
    pub assigned_at: u64,          // Tier assignment timestamp
    pub features: PremiumFeatures, // Available features for this tier
}

/// Features available per tier
#[contracttype]
#[derive(Debug, Clone)]
pub struct PremiumFeatures {
    pub max_greetings_per_day: u32, // Maximum greetings allowed per day
    pub custom_greeting_messages: bool, // Can create custom greeting messages
    pub priority_support: bool,     // Access to priority support
    pub analytics_access: bool,     // Access to greeting analytics
    pub api_rate_limit: u32,        // API calls per minute
}

/// Tier upgrade event data
#[contracttype]
#[derive(Debug, Clone)]
pub struct TierUpgradeEvent {
    pub user: Address,
    pub old_tier: TierLevel,
    pub new_tier: TierLevel,
    pub contribution: i128,
    pub timestamp: u64,
}

/// Tier assignment event data
#[contracttype]
#[derive(Debug, Clone)]
pub struct TierAssignmentEvent {
    pub user: Address,
    pub tier: TierLevel,
    pub contribution: i128,
    pub timestamp: u64,
}

/// Represents a single greeting.
#[contracttype]
#[derive(Clone)]
pub struct Greeting {
    pub id: u64,
    pub text: soroban_sdk::String,
    pub creator: Address,
    pub updated_at: u64,
}

/// Status of a batch operation.
#[contracttype]
#[derive(Clone)]
pub enum OperationStatus {
    Pending,
    Completed,
    Failed(soroban_sdk::String), // Reason for failure
}

/// Batch update record for auditing.
#[contracttype]
#[derive(Clone)]
pub struct BatchUpdate {
    pub batch_id: u64,
    pub greeting_ids: soroban_sdk::Vec<u64>,
    pub updates: soroban_sdk::Vec<soroban_sdk::String>,
    pub status: OperationStatus,
    pub processed_by: Address,
    pub processed_at: u64,
}

impl TierLevel {
    /// Convert tier level to soroban_sdk::String representation
    pub fn to_str(&self) -> &str {
        match self {
            TierLevel::None => "None",
            TierLevel::Basic => "Basic",
            TierLevel::Pro => "Pro",
            TierLevel::Elite => "Elite",
        }
    }

    /// Determine tier level based on contribution amount (in Stroops)
    /// 1 XLM = 10,000,000 Stroops
    pub fn from_contribution(contribution: i128) -> Self {
        const ONE_XLM: i128 = 10_000_000; // 1 XLM in Stroops

        if contribution >= 2000 * ONE_XLM {
            TierLevel::Elite
        } else if contribution >= 500 * ONE_XLM {
            TierLevel::Pro
        } else if contribution >= 100 * ONE_XLM {
            TierLevel::Basic
        } else {
            TierLevel::None
        }
    }

    /// Get features for the tier level
    pub fn get_features(&self) -> PremiumFeatures {
        match self {
            TierLevel::None => PremiumFeatures {
                max_greetings_per_day: 10,
                custom_greeting_messages: false,
                priority_support: false,
                analytics_access: false,
                api_rate_limit: 10,
            },
            TierLevel::Basic => PremiumFeatures {
                max_greetings_per_day: 50,
                custom_greeting_messages: true,
                priority_support: false,
                analytics_access: false,
                api_rate_limit: 30,
            },
            TierLevel::Pro => PremiumFeatures {
                max_greetings_per_day: 200,
                custom_greeting_messages: true,
                priority_support: true,
                analytics_access: true,
                api_rate_limit: 100,
            },
            TierLevel::Elite => PremiumFeatures {
                max_greetings_per_day: 1000,
                custom_greeting_messages: true,
                priority_support: true,
                analytics_access: true,
                api_rate_limit: 500,
            },
        }
    }
}

/// Reward record for a greeting
#[contracttype]
#[derive(Debug, Clone)]
pub struct GreetingReward {
    pub greeting_id: u64,   // Associated greeting ID
    pub creator: Address,   // Stellar address of the creator
    pub token_amount: i128, // Reward amount in tokens (Stroops)
    pub timestamp: u64,     // Reward issuance timestamp
}

/// User profile data structure
#[contracttype]
#[derive(Debug, Clone)]
pub struct UserProfile {
    pub user: Address,
    pub name: String,
    pub preferences: String,
    pub registered_at: u64,
}
