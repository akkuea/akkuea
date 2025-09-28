use soroban_sdk::{contracttype, Address};

#[contracttype]
#[derive(Debug, Clone)]
pub enum RewardType {
    ContentCreation,
    ContentCuration,
    ExpertReview,
    Collaboration,
}

#[contracttype]
pub struct RewardEvent {
    pub recipient: Address,
    pub reward_type: RewardType,
    pub amount: i128,
    pub timestamp: u64,
}

#[contracttype]
pub struct UserBalance {
    pub address: Address,
    pub balance: i128,
}
