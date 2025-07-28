use soroban_sdk::{contracttype, Address, String, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Tip {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
    pub token: Address,
    pub message: Option<String>,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EducatorStats {
    pub total_tips: i128,
    pub total_amount: i128,
    pub tip_count: u32,
    pub last_tip_timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TipHistory {
    pub tips: Vec<Tip>,
    pub last_updated: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TipGoal {
    pub educator: Address,
    pub goal_amount: i128,
    pub achieved: bool,
}