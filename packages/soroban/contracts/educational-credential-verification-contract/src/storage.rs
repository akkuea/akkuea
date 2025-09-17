use soroban_sdk::{contracttype, symbol_short, Address, Symbol, BytesN, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    ReviewCounter(Address),
    Reviews(Address),
    Credential(BytesN<32>),
    NFT(BytesN<32>),
    Template(u32),
    Badge(BytesN<32>),
    // Security related keys
    MultiSigProposal(BytesN<32>),
    TimeLockOperation(BytesN<32>),
    FraudReport(BytesN<32>),
    ReputationStake(Address),
    SuspendedAccount(Address),
    // Upgrade related keys
    VersionInfo(BytesN<32>),
    MigrationBatch(u32),
    CompatibilityAdapter(String),
}

// Existing storage keys
pub const ADMIN: Symbol = symbol_short!("admin");
pub const REVIEWERS: Symbol = symbol_short!("reviewers");
pub const EDUCATORS: Symbol = symbol_short!("EDU");
pub const DISPUTES: Symbol = symbol_short!("disputes");
pub const ANALYTICS: Symbol = symbol_short!("analytics");
pub const REVOKED: Symbol = symbol_short!("REVOKE");
pub const VERIFIED_CREDS: Symbol = symbol_short!("vcreds");
pub const SIGNATURES: Symbol = symbol_short!("sigs");
pub const AUTH_INST: Symbol = symbol_short!("AUTH_INST");

// New storage keys for enhanced features
pub const CREDENTIALS: Symbol = symbol_short!("CREDS");
pub const NFTS: Symbol = symbol_short!("NFTS");
pub const NFT_TEMPLATES: Symbol = symbol_short!("TEMPLATES");
pub const ACHIEVEMENT_BADGES: Symbol = symbol_short!("BADGES");
pub const CREDENTIAL_COUNTER: Symbol = symbol_short!("CRED_CTR");
pub const NFT_COUNTER: Symbol = symbol_short!("NFT_CTR");
pub const TEMPLATE_COUNTER: Symbol = symbol_short!("TMPL_CTR");
pub const BADGE_COUNTER: Symbol = symbol_short!("BADGE_CTR");
pub const EXPIRED_CREDENTIALS: Symbol = symbol_short!("EXPIRED");
pub const CROSS_CHAIN_REGISTRY: Symbol = symbol_short!("XCHAIN");

// Security and upgrade storage keys
pub const SECURITY_CONFIG: Symbol = symbol_short!("SEC_CFG");
pub const MULTISIG_PROPOSALS: Symbol = symbol_short!("MULTISIG");
pub const TIMELOCK_OPERATIONS: Symbol = symbol_short!("TIMELOCK");
pub const FRAUD_REPORTS: Symbol = symbol_short!("FRAUD");
pub const REPUTATION_STAKES: Symbol = symbol_short!("STAKES");
pub const CONTRACT_VERSION: Symbol = symbol_short!("VERSION");
pub const VERSION_HISTORY: Symbol = symbol_short!("VER_HIST");
pub const MIGRATION_STATE: Symbol = symbol_short!("MIGRATE");
pub const PAUSE_STATE: Symbol = symbol_short!("PAUSE");
pub const IMPLEMENTATION: Symbol = symbol_short!("IMPL");
pub const UPGRADE_LOG: Symbol = symbol_short!("UPG_LOG");
pub const SLASH_LOG: Symbol = symbol_short!("SLASH");
pub const SUSPENDED_ACCOUNTS: Symbol = symbol_short!("SUSPEND");
pub const COMPATIBILITY_ADAPTERS: Symbol = symbol_short!("COMPAT");
