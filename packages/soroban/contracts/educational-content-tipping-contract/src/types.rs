use soroban_sdk::{contracttype, Address, BytesN, String, Vec};

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

// Security Types
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SecurityConfig {
    pub multi_sig_threshold: u32,
    pub time_lock_duration: u64,
    pub fraud_alert_threshold: u64,
    pub max_daily_tip_amount: i128,
    pub suspicious_pattern_window: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MultiSigOperation {
    pub operation_id: BytesN<32>,
    pub operation_type: String,
    pub initiator: Address,
    pub approvers: Vec<Address>,
    pub required_approvals: u32,
    pub created_at: u64,
    pub expires_at: u64,
    pub executed: bool,
    pub execution_data: Option<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TimeLockedWithdrawal {
    pub withdrawal_id: BytesN<32>,
    pub educator: Address,
    pub amount: i128,
    pub token: Address,
    pub initiated_at: u64,
    pub unlock_at: u64,
    pub cancelled: bool,
    pub initiator: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FraudAlert {
    pub alert_id: BytesN<32>,
    pub target_address: Address,
    pub alert_type: String,
    pub detected_at: u64,
    pub resolved: bool,
    pub details: String,
    pub severity: u32,
}

// Governance Types
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProposalType {
    FeatureProposal,
    FeeAdjustment,
    SecurityConfigChange,
    TokenWhitelistChange,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProposalStatus {
    Pending,
    Active,
    Approved,
    Rejected,
    Executed,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum VoteType {
    For,
    Against,
    Abstain,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proposal {
    pub proposal_id: BytesN<32>,
    pub description: String,
    pub proposer: Address,
    pub proposal_type: ProposalType,
    pub vote_count_for: u32,
    pub vote_count_against: u32,
    pub total_voting_power: u32,
    pub deadline: u64,
    pub status: ProposalStatus,
    pub execution_data: Option<String>,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Vote {
    pub voter: Address,
    pub proposal_id: BytesN<32>,
    pub vote_type: VoteType,
    pub voting_power: u32,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GovernanceConfig {
    pub min_proposal_stake: i128,
    pub voting_period: u64,
    pub execution_delay: u64,
    pub min_quorum_percentage: u32,
    pub min_approval_percentage: u32,
    pub fee_adjustment_limit: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FeeConfig {
    pub base_fee_percentage: u32,
    pub premium_fee_percentage: u32,
    pub withdrawal_fee: i128,
    pub last_updated: u64,
}
