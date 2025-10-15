use soroban_sdk::{contracttype, Address, BytesN, Env, String, Vec};

// Define the verification tiers
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum VerificationLevel {
    None = 0,
    Peer = 1,
    Expert = 2,
    Institutional = 3,
}

// Content data structure as per requirements
#[contracttype]
pub struct Content {
    pub id: u64,
    pub creator: Address,
    pub title: String,
    pub content_hash: BytesN<32>,
    pub creation_date: u64,
    pub subject_tags: Vec<String>,
    pub upvotes: u32,
    pub verification_level: VerificationLevel,
}

/// VERSIONING STORAGE
#[contracttype]
pub struct ContentVersion {
    pub version: u32,
    pub creator: Address,
    pub creation_date: u64,
    pub change_notes: String,
    pub upvotes: u32,                          // Version-specific upvotes
    pub verification_level: VerificationLevel, // Version-specific verification level
}

#[contracttype]
pub struct VersionDiff {
    pub from_version: u32,
    pub to_version: u32,
    pub title_changed: bool,
    pub content_changed: bool,
}

/// COLLABORATIVE STORAGE
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PermissionType {
    Collaborator = 0, // Can submit content for review
                      // Reviewer = 1,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReviewStatus {
    Pending = 0,
    Accepted = 1,
    Rejected = 2,
}

#[contracttype]
pub struct CollaboratorPermission {
    pub collaborator: Address,
    pub content_id: u64,
    pub permission_type: PermissionType,
    pub granted_by: Address,
    pub granted_date: u64,
}

#[contracttype]
#[derive(Clone)]
pub struct CollaboratorSubmission {
    pub content_id: u64,
    pub collaborator: Address,
    pub submission_date: u64,
    pub status: ReviewStatus,
    pub new_content_hash: BytesN<32>,
    pub new_subject_tags: Vec<String>,
    pub change_notes: String,
    pub reviewer: Option<Address>,
    pub review_date: Option<u64>,
    pub review_feedback: Option<String>,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Content(u64),
    ContentCounter,
    UserVotes(Address, u64),

    // Versioning keys
    VersionSnapshot(u64, u32),       // content_id, version -> Content
    ContentHistory(u64, u32),        // content_id, version -> ContentVersion
    VersionCount(u64),               // content_id -> total versions
    VersionVotes(Address, u64, u32), // voter, content_id, version

    // Collaborative keys
    CollaboratorPermission(Address, u64), // collaborator, content_id -> CollaboratorPermission
    CollaboratorSubmission(Address, u64), // collaborator, content_id -> CollaboratorSubmission
    UserContentContributions(Address, u64), // collaborator, content_id -> Vec<CollaboratorSubmission>

    // Analytics keys
    ContentAnalytics(u64),                  // content_id -> ContentAnalytics
    TimeBasedMetrics(u64, u64, TimePeriod), // content_id, timestamp, period -> TimeBasedMetrics
    CategoryAnalytics(String),              // category -> CategoryAnalytics
    TrendingContent(u64, TrendingPeriod),   // content_id, period -> TrendingContent
    TrendingSnapshot(TrendingPeriod, u64),  // period, timestamp -> TrendingSnapshot
    AnalyticsCounter,                       // u64
}

// --- Advanced Verification and Moderation Additions ---

#[contracttype]
pub struct VerificationRecord {
    pub verifier: Address,
    pub level: VerificationLevel,
    pub timestamp: u64,
    pub expiration: Option<u64>,
    pub delegated_by: Option<Address>,
    pub reputation_snapshot: Option<u32>,
}

#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub struct Delegation {
    pub delegator: Address,
    pub delegatee: Address,
    pub since: u64,
    pub until: Option<u64>,
}

#[contracttype]
pub struct Flag {
    pub content_id: u64,
    pub flagger: Address,
    pub reason: String,
    pub timestamp: u64,
}

#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum ModerationStatus {
    Pending,
    Approved,
    Rejected,
    Removed,
    UnderDispute,
}

#[contracttype]
pub struct ModerationAction {
    pub content_id: u64,
    pub moderator: Address,
    pub action: ModerationStatus,
    pub reason: String,
    pub timestamp: u64,
}

#[contracttype]
pub struct Dispute {
    pub dispute_id: u64,
    pub content_id: u64,
    pub creator: Address,
    pub reason: String,
    pub status: ModerationStatus,
    pub created_at: u64,
    pub resolved_at: Option<u64>,
    pub resolver: Option<Address>,
}

#[derive(Clone)]
#[contracttype]
pub enum AdvDataKey {
    VerificationRecord(u64), // content_id -> Vec<VerificationRecord>
    Delegation(Address),     // delegator -> Vec<Delegation>
    Flag(u64),               // content_id -> Vec<Flag>
    Moderation(u64),         // content_id -> Vec<ModerationAction>
    Dispute(u64),            // dispute_id -> Dispute
    DisputeCounter,          // u64
}

/// ANALYTICS STORAGE STRUCTURES
#[contracttype]
pub struct ContentAnalytics {
    pub content_id: u64,
    pub total_views: u64,
    pub total_upvotes: u32,
    pub total_downvotes: u32,
    pub engagement_rate: u32, // (upvotes + downvotes) / views * 10000 (scaled to avoid decimals)
    pub average_rating: u32,  // 0-50000 (scaled to avoid decimals, 50000 = 5.0)
    pub trending_score: u32,  // Scaled trending score
    pub last_updated: u64,
}

#[contracttype]
pub struct TimeBasedMetrics {
    pub content_id: u64,
    pub timestamp: u64,
    pub views: u32,
    pub upvotes: u32,
    pub downvotes: u32,
    pub period: TimePeriod,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum TimePeriod {
    Hourly = 0,
    Daily = 1,
    Weekly = 2,
    Monthly = 3,
}

#[contracttype]
pub struct CategoryAnalytics {
    pub category: String,
    pub total_content: u32,
    pub total_views: u64,
    pub total_upvotes: u32,
    pub average_rating: u32, // 0-50000 (scaled to avoid decimals, 50000 = 5.0)
    pub trending_content_count: u32,
    pub last_updated: u64,
}

/// TRENDING STORAGE STRUCTURES
#[contracttype]
pub struct TrendingContent {
    pub content_id: u64,
    pub trending_score: u32,      // Scaled trending score
    pub velocity_score: u32,      // Scaled velocity score
    pub time_weighted_score: u32, // Scaled time-weighted score
    pub period: TrendingPeriod,
    pub calculated_at: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[contracttype]
pub enum TrendingPeriod {
    Daily = 0,
    Weekly = 1,
    Monthly = 2,
}

#[contracttype]
pub struct TrendingSnapshot {
    pub period: TrendingPeriod,
    pub timestamp: u64,
    pub trending_content_ids: Vec<u64>,
    pub scores: Vec<u32>, // Scaled scores
}

// Get the next content ID and increment the counter
pub fn get_next_content_id(env: &Env) -> u64 {
    let key = DataKey::ContentCounter;
    let id = env.storage().instance().get(&key).unwrap_or(0u64);
    env.storage().instance().set(&key, &(id + 1));
    id
}

// Store content in contract storage
pub fn save_content(env: &Env, content: &Content) {
    let key = DataKey::Content(content.id);
    env.storage().instance().set(&key, content);
}

// Retrieve content from contract storage
pub fn get_content(env: &Env, content_id: u64) -> Content {
    let key = DataKey::Content(content_id);
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| panic!("content with ID {} not found", content_id))
}

// Record a user's vote for a specific content
pub fn record_user_vote(env: &Env, voter: Address, content_id: u64) {
    let key = DataKey::UserVotes(voter, content_id);
    env.storage().instance().set(&key, &true);
}

// Check if a user has already voted for a specific content
pub fn has_user_voted(env: &Env, voter: &Address, content_id: u64) -> bool {
    let key = DataKey::UserVotes(voter.clone(), content_id);
    env.storage().instance().has(&key)
}

// Get the current content counter (total number of content items created)
pub fn get_content_counter(env: &Env) -> u64 {
    let key = DataKey::ContentCounter;
    env.storage().instance().get(&key).unwrap_or(0u64)
}

// Check if content exists by ID
pub fn content_exists(env: &Env, content_id: u64) -> bool {
    let key = DataKey::Content(content_id);
    env.storage().instance().has(&key)
}

// Get all existing content IDs (for filtering operations)
pub fn get_all_content_ids(env: &Env) -> Vec<u64> {
    let mut content_ids = Vec::new(env);
    let total_content = get_content_counter(env);

    for id in 0..total_content {
        if content_exists(env, id) {
            content_ids.push_back(id);
        }
    }

    content_ids
}

// Get multiple content items by their IDs
#[allow(dead_code)]
pub fn get_multiple_content(env: &Env, content_ids: &Vec<u64>) -> Vec<Content> {
    let mut contents = Vec::new(env);

    for i in 0..content_ids.len() {
        let content_id = content_ids.get(i).unwrap();
        if content_exists(env, content_id) {
            let content = get_content(env, content_id);
            contents.push_back(content);
        }
    }

    contents
}

///
/// VERSION STORAGE FUNCTIONS
///
// Save content snapshot for a version history
pub fn save_version_snapshot(env: &Env, content_id: u64, version: u32, content: &Content) {
    let key = DataKey::VersionSnapshot(content_id, version);
    env.storage().instance().set(&key, content);
}

// Get content snapshot for a version
pub fn get_version_snapshot(env: &Env, content_id: u64, version: u32) -> Content {
    let key = DataKey::VersionSnapshot(content_id, version);
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| panic!("version snapshot not found"))
}

// Save version info/metadata
pub fn save_version_info(env: &Env, content_id: u64, version: u32, version_info: &ContentVersion) {
    let key = DataKey::ContentHistory(content_id, version);
    env.storage().instance().set(&key, version_info);
}

// Get version info/metadata
pub fn get_version_info(env: &Env, content_id: u64, version: u32) -> ContentVersion {
    let key = DataKey::ContentHistory(content_id, version);
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| panic!("version info not found"))
}

// Get version count for content
pub fn get_version_count(env: &Env, content_id: u64) -> u32 {
    let key = DataKey::VersionCount(content_id);
    env.storage().instance().get(&key).unwrap_or(0u32)
}

// Save version count for content
pub fn save_version_count(env: &Env, content_id: u64, count: u32) {
    let key = DataKey::VersionCount(content_id);
    env.storage().instance().set(&key, &count);
}

// Check if user voted on specific version
pub fn has_user_voted_on_version(
    env: &Env,
    voter: &Address,
    content_id: u64,
    version: u32,
) -> bool {
    let key = DataKey::VersionVotes(voter.clone(), content_id, version);
    env.storage().instance().has(&key)
}

// Record user vote on specific version
pub fn record_version_vote(env: &Env, voter: Address, content_id: u64, version: u32) {
    let key = DataKey::VersionVotes(voter, content_id, version);
    env.storage().instance().set(&key, &true);
}

///
/// COLLABORATIVE STORAGE FUNCTIONS
///
/// Save user permission for content
pub fn save_collaborative_permission(
    env: &Env,
    user: Address,
    content_id: u64,
    permission: &CollaboratorPermission,
) {
    let key = DataKey::CollaboratorPermission(user, content_id);
    env.storage().instance().set(&key, permission);
}

/// Get user permission for content
pub fn get_collaborative_permission(
    env: &Env,
    user: &Address,
    content_id: u64,
) -> CollaboratorPermission {
    let key = DataKey::CollaboratorPermission(user.clone(), content_id);
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| panic!("permission not found for user and content_id"))
}

/// Save collaborator submission
pub fn save_collaborative_submission(
    env: &Env,
    submitter: Address,
    content_id: u64,
    submission: &CollaboratorSubmission,
) {
    let key = DataKey::CollaboratorSubmission(submitter, content_id);
    env.storage().instance().set(&key, submission);
}

/// Get collaborator submission
pub fn get_collaborative_submission(
    env: &Env,
    submitter: &Address,
    content_id: u64,
) -> CollaboratorSubmission {
    let key = DataKey::CollaboratorSubmission(submitter.clone(), content_id);
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| panic!("submission not found for submitter and content_id"))
}

/// Save contribution to user history
pub fn save_contribution_to_history(
    env: &Env,
    user: &Address,
    content_id: u64,
    submission: &CollaboratorSubmission,
) {
    let key = DataKey::UserContentContributions(user.clone(), content_id);
    let mut history: Vec<CollaboratorSubmission> = env
        .storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env));
    history.push_back(submission.clone());
    env.storage().instance().set(&key, &history);
}

/// Get all contribution history for a user on specific content
pub fn get_user_content_contribution_history(
    env: &Env,
    user: &Address,
    content_id: u64,
) -> Vec<CollaboratorSubmission> {
    let key = DataKey::UserContentContributions(user.clone(), content_id);
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| Vec::new(env))
}

///
/// ANALYTICS STORAGE FUNCTIONS
///

/// Save content analytics
pub fn save_content_analytics(env: &Env, analytics: &ContentAnalytics) {
    let key = DataKey::ContentAnalytics(analytics.content_id);
    env.storage().instance().set(&key, analytics);
}

/// Get content analytics
pub fn get_content_analytics(env: &Env, content_id: u64) -> Option<ContentAnalytics> {
    let key = DataKey::ContentAnalytics(content_id);
    env.storage().instance().get(&key)
}

/// Save time-based metrics
pub fn save_time_based_metrics(env: &Env, metrics: &TimeBasedMetrics) {
    let key = DataKey::TimeBasedMetrics(metrics.content_id, metrics.timestamp, metrics.period);
    env.storage().instance().set(&key, metrics);
}

/// Get time-based metrics for a content item
pub fn get_time_based_metrics(
    env: &Env,
    content_id: u64,
    timestamp: u64,
    period: TimePeriod,
) -> Option<TimeBasedMetrics> {
    let key = DataKey::TimeBasedMetrics(content_id, timestamp, period);
    env.storage().instance().get(&key)
}

/// Save category analytics
pub fn save_category_analytics(env: &Env, analytics: &CategoryAnalytics) {
    let key = DataKey::CategoryAnalytics(analytics.category.clone());
    env.storage().instance().set(&key, analytics);
}

/// Get category analytics
pub fn get_category_analytics(env: &Env, category: &String) -> Option<CategoryAnalytics> {
    let key = DataKey::CategoryAnalytics(category.clone());
    env.storage().instance().get(&key)
}

/// Save trending content data
pub fn save_trending_content(env: &Env, trending: &TrendingContent) {
    let key = DataKey::TrendingContent(trending.content_id, trending.period);
    env.storage().instance().set(&key, trending);
}

/// Get trending content data
pub fn get_trending_content(
    env: &Env,
    content_id: u64,
    period: TrendingPeriod,
) -> Option<TrendingContent> {
    let key = DataKey::TrendingContent(content_id, period);
    env.storage().instance().get(&key)
}

/// Save trending snapshot
pub fn save_trending_snapshot(env: &Env, snapshot: &TrendingSnapshot) {
    let key = DataKey::TrendingSnapshot(snapshot.period, snapshot.timestamp);
    env.storage().instance().set(&key, snapshot);
}

/// Get trending snapshot
pub fn get_trending_snapshot(
    env: &Env,
    period: TrendingPeriod,
    timestamp: u64,
) -> Option<TrendingSnapshot> {
    let key = DataKey::TrendingSnapshot(period, timestamp);
    env.storage().instance().get(&key)
}

/// Get analytics counter
#[allow(dead_code)]
pub fn get_analytics_counter(env: &Env) -> u64 {
    let key = DataKey::AnalyticsCounter;
    env.storage().instance().get(&key).unwrap_or(0u64)
}

/// Increment analytics counter
#[allow(dead_code)]
pub fn increment_analytics_counter(env: &Env) -> u64 {
    let key = DataKey::AnalyticsCounter;
    let counter = get_analytics_counter(env);
    let new_counter = counter + 1;
    env.storage().instance().set(&key, &new_counter);
    new_counter
}
