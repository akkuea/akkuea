use soroban_sdk::{contracttype, Address, Map, String, Vec};

#[contracttype]
pub enum DataKey {
    User(u64),                      // User ID -> User data
    Credential(u64),                // Token ID -> CredentialToken data
    Reputation(u64, String),        // (User ID, Subject) -> Reputation data
    NextUserId,                     // Counter for user IDs
    NextTokenId,                    // Counter for token IDs
    Dispute(u64),                   // Dispute ID -> Dispute data
    NextDisputeId,                  // Counter for dispute IDs
    UserDisputes(u64),              // User ID -> List of dispute IDs
    RecoveryPlan(u64),              // User ID -> Recovery plan
    ProbationStatus(u64),           // User ID -> Probation status
    ReputationHistory(u64, String), // (User ID, Subject) -> Historical reputation data
    Analytics(String),              // Analytics key -> Analytics data
    // Security-related keys
    RateLimit(String),              // Rate limit key -> Rate limit data
    CircuitBreaker(String),         // Circuit breaker key -> Circuit breaker state
    Admin(Address),                 // Admin address -> Admin status
    Moderator(Address),             // Moderator address -> Moderator status
    // Integration-related keys
    ExternalCredential(String),     // External credential ID -> External credential data
    ProfessionalCert(String),       // Professional certification ID -> Certification data
    SystemBridge(String),           // System bridge ID -> Bridge configuration
    ImportExportLog(u64),           // Log ID -> Import/export operation log
    NextImportExportId,             // Counter for import/export operation IDs
    UserExternalCredentials(u64),   // User ID -> List of external credential IDs
    UserProfessionalCerts(u64),     // User ID -> List of professional certification IDs
    CredentialMapping(String),      // External credential ID -> Internal mapping
    // Verification tier system keys
    UserVerification(u64),          // User ID -> Verification data
    VerificationDelegation(Address, u64), // (Delegate Address, User ID) -> Delegation data
}

#[contracttype]
#[derive(Clone)]
pub struct User {
    pub id: u64,
    pub name: String,
    pub expertise_areas: Map<String, u32>, // Subject -> Expertise level
    pub verified: bool,                    // Verification status
}

#[contracttype]
#[derive(Clone)]
pub struct CredentialToken {
    pub user_id: u64,
    pub token_id: u64,  // Non-transferable token ID
    pub issued_at: u64, // Timestamp of issuance
}

#[contracttype]
#[derive(Clone)]
pub struct Reputation {
    pub user_id: u64,
    pub subject: String, // Subject area
    pub score: u32,      // Reputation score
}

#[contracttype]
#[derive(Clone)]
pub struct Dispute {
    pub id: u64,
    pub user_id: u64,
    pub subject: String,
    pub original_score: u32,
    pub disputed_score: u32,
    pub evidence: String,
    pub status: DisputeStatus,
    pub created_at: u64,
    pub resolved_at: Option<u64>,
    pub resolver: Option<String>,
}

#[contracttype]
#[derive(Clone)]
pub enum DisputeStatus {
    Pending,
    UnderReview,
    Approved,
    Rejected,
}

#[contracttype]
#[derive(Clone)]
pub struct RecoveryPlan {
    pub user_id: u64,
    pub target_score: u32,
    pub milestones: Map<String, u32>, // Subject -> Target score
    pub created_at: u64,
    pub deadline: u64,
    pub progress: Map<String, u32>, // Subject -> Current progress
    pub completed: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct ProbationStatus {
    pub user_id: u64,
    pub active: bool,
    pub start_date: u64,
    pub end_date: u64,
    pub reason: String,
    pub restrictions: Map<String, bool>, // Restriction type -> Active
}

#[contracttype]
#[derive(Clone)]
pub struct ReputationHistory {
    pub user_id: u64,
    pub subject: String,
    pub scores: Map<u64, u32>,     // Timestamp -> Score
    pub changes: Map<u64, String>, // Timestamp -> Change reason
}

#[contracttype]
#[derive(Clone)]
pub struct Analytics {
    pub key: String,
    pub data: Map<String, u32>, // Metric name -> Value
    pub trends: Map<u64, u32>,  // Timestamp -> Trend value
    pub last_updated: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct DomainExpertise {
    pub domain: String,
    pub experts: Map<u64, u32>, // User ID -> Expertise score
    pub average_score: u32,
    pub total_contributors: u32,
}

#[contracttype]
#[derive(Clone)]
pub struct PeerBenchmark {
    pub user_id: u64,
    pub subject: String,
    pub user_score: u32,
    pub peer_average: u32,
    pub percentile: u32,
    pub rank: u32,
    pub total_peers: u32,
}

// Security-related types

#[contracttype]
#[derive(Clone)]
pub struct RateLimitData {
    pub key: String,
    pub operations: Vec<u64>,  // Timestamps of operations
    pub limit: u32,            // Max operations per window
    pub window_start: u64,     // Start of current window
}

#[contracttype]
#[derive(Clone)]
pub struct CircuitBreakerState {
    pub key: String,
    pub state: CircuitState,
    pub failure_count: u32,
    pub last_failure_time: u64,
    pub last_success_time: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum CircuitState {
    Closed,    // Normal operation
    Open,      // Failing, reject requests
    HalfOpen,  // Testing if service recovered
}

#[contracttype]
#[derive(Clone)]
pub struct SecurityAuditReport {
    pub timestamp: u64,
    pub total_users: u32,
    pub verified_users: u32,
    pub active_disputes: u32,
    pub probation_users: u32,
    pub security_violations: u32,
    pub rate_limit_violations: u32,
    pub circuit_breaker_trips: u32,
    pub recommendations: Vec<String>,
}

// Integration-related types

#[contracttype]
#[derive(Clone)]
pub struct ExternalCredential {
    pub id: String,
    pub user_id: u64,
    pub provider: String,          // Academic institution, certification body, etc.
    pub credential_type: String,   // Degree, certificate, etc.
    pub subject_area: String,      // Field of study/expertise
    pub issued_date: u64,
    pub expiry_date: Option<u64>,
    pub verification_status: VerificationStatus,
    pub verification_data: String, // Hash or reference to verification proof
    pub metadata: Map<String, String>, // Additional credential metadata
}

#[contracttype]
#[derive(Clone)]
pub struct ProfessionalCertification {
    pub id: String,
    pub user_id: u64,
    pub certification_body: String,
    pub certification_name: String,
    pub competency_areas: Vec<String>,
    pub skill_level: u32,          // 1-1000 scale
    pub issued_date: u64,
    pub expiry_date: Option<u64>,
    pub renewal_required: bool,
    pub verification_status: VerificationStatus,
    pub continuing_education_credits: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum VerificationStatus {
    Pending,
    Verified,
    Rejected,
    Expired,
    Revoked,
}

#[contracttype]
#[derive(Clone)]
pub struct SystemBridge {
    pub id: String,
    pub name: String,
    pub bridge_type: BridgeType,
    pub endpoint_url: String,
    pub authentication_method: String,
    pub supported_operations: Vec<String>,
    pub rate_limit: u32,
    pub active: bool,
    pub last_sync: u64,
    pub sync_interval: u64,
}

#[contracttype]
#[derive(Clone)]
pub enum BridgeType {
    AcademicSystem,      // University/school systems
    CertificationBody,   // Professional certification providers
    LearningPlatform,    // Online learning platforms
    CredentialWallet,    // Digital credential wallets
    BlockchainNetwork,   // Other blockchain networks
}

#[contracttype]
#[derive(Clone)]
pub struct ImportExportOperation {
    pub id: u64,
    pub operation_type: ImportExportType,
    pub user_id: u64,
    pub source_system: String,
    pub target_system: String,
    pub data_type: String,
    pub status: OperationStatus,
    pub initiated_at: u64,
    pub completed_at: Option<u64>,
    pub records_processed: u32,
    pub errors: Vec<String>,
    pub metadata: Map<String, String>,
}

#[contracttype]
#[derive(Clone)]
pub enum ImportExportType {
    Import,
    Export,
    Sync,
}

#[contracttype]
#[derive(Clone)]
pub enum OperationStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    PartiallyCompleted,
}

#[contracttype]
#[derive(Clone)]
pub struct CredentialMapping {
    pub external_id: String,
    pub internal_id: u64,
    pub mapping_type: String,
    pub confidence_score: u32,  // How confident we are in this mapping (0-100)
    pub created_at: u64,
    pub verified_by: Option<Address>,
}

// Verification tier system types

#[contracttype]
#[derive(Clone)]
pub struct UserVerification {
    pub user_id: u64,
    pub tier: u32,                      // Verification tier (1-4)
    pub verified_by: Address,           // Who verified this user
    pub verified_at: u64,               // When verification occurred
    pub expires_at: u64,                // When verification expires
    pub verification_details: String,   // Details about verification
}

#[contracttype]
#[derive(Clone)]
pub struct VerificationDelegation {
    pub delegator: Address,             // Who delegated the authority
    pub delegate: Address,              // Address who received authority
    pub user_id: u64,                   // Specific user they can verify
    pub max_tier: u32,                  // Maximum tier they can verify for this user
    pub expires_at: u64,                // When delegation expires
}

#[contracttype]
#[derive(Clone)]
pub struct TierValidationRules {
    pub tier: u32,
    pub requires_previous_verification: bool,
    pub min_expertise_areas: u32,
    pub requires_verified_status: bool,
    pub validity_years: u64,
    pub description: String,
}
