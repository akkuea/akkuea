use soroban_sdk::{contracttype, Address, Map, String, Vec};

/// Educator profile data structure
#[contracttype]
#[derive(Clone)]
pub struct Educator {
    pub address: Address,
    pub name: String,
    pub credentials: Vec<String>,
    pub verification_status: bool,
    pub nft_token_id: Option<String>,
    pub verification_timestamp: u64,
    pub specialty_areas: Vec<String>,
    pub verification_level: VerificationLevel,
    pub reviews_count: u32,
    pub ratings: Map<String, (u32, u32)>, // e.g., {"Clarity": (score, weight), "Knowledge": (score, weight)}
}

/// Verification levels for educators
#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum VerificationLevel {
    Pending,
    Basic,
    Advanced,
    Expert,
}

/// Verification request data structure
#[contracttype]
#[derive(Clone)]
pub struct VerificationRequest {
    pub educator: Address,
    pub document_hashes: Vec<String>,
    pub request_timestamp: u64,
    pub status: RequestStatus,
    pub reviewer: Option<Address>,
}

/// Status options for verification requests
#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum RequestStatus {
    Pending,
    InReview,
    Approved,
    Rejected,
}

/// Review data structure
#[contracttype]
#[derive(Clone)]
pub struct Review {
    pub review_id: u32,
    pub reviewer: Address,
    pub educator: Address,
    pub ratings: Map<String, u32>,
    pub comment_hash: String,
    pub timestamp: u64,
    pub verifiers: Vec<Address>,
    pub dispute_status: DisputeStatus,
}

/// Dispute data structure
#[contracttype]
#[derive(Clone)]
pub struct Dispute {
    pub review_id: u32,
    pub educator: Address,
    pub reason_hash: String,
    pub status: DisputeStatus,
}

/// Status options for review disputes
#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum DisputeStatus {
    None,
    Active,
    Resolved,
}

// A snapshot of analytics data at a specific point in time for trend analysis.
#[contracttype]
#[derive(Clone)]
pub struct AnalyticsSnapshot {
    pub timestamp: u64,
    pub total_verifications: u32,
    pub total_reviews: u32,
    pub total_disputes: u32,
}

// A struct to track the performance metrics of individual reviewers.
#[contracttype]
#[derive(Clone)]
pub struct ReviewerPerformance {
    pub reviews_submitted: u32,
    pub disputes_received: u32, // Number of their reviews that were disputed
}

// The main analytics struct now includes trend and performance data.
#[contracttype]
#[derive(Clone)]
pub struct AnalyticsData {
    pub current_snapshot: AnalyticsSnapshot,
    pub history: Vec<AnalyticsSnapshot>, // For trend analysis
    pub specialty_distribution: Map<String, u32>,
    pub reviewer_performance: Map<Address, ReviewerPerformance>,
}
