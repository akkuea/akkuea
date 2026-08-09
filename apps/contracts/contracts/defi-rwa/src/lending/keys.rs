use soroban_sdk::{contracttype, Address, String};

/// Last validated oracle observation for an asset: normalized price + feed timestamp.
///
/// Persisted after a successful guarded price fetch so price and timestamp travel
/// together in contract storage (issue #981).
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct OraclePriceSnapshot {
    /// Price normalized to 18-decimal precision
    pub price: i128,
    /// Timestamp reported by the SEP-40 oracle feed
    pub timestamp: u64,
}

/// Storage key types for the lending module
#[derive(Clone)]
#[contracttype]
pub enum LendingKey {
    /// Lending pool configuration
    /// Storage: Persistent
    Pool(String),

    /// List of all pool IDs
    /// Storage: Persistent
    PoolList,

    /// Total number of pools
    /// Storage: Instance
    PoolCount,

    /// Deposit position for user in pool
    /// Storage: Persistent
    DepositPosition(Address, String),

    /// Borrow position for user in pool
    /// Storage: Persistent
    BorrowPosition(Address, String),

    /// User's deposit positions list
    /// Storage: Persistent
    UserDeposits(Address),

    /// User's borrow positions list
    /// Storage: Persistent
    UserBorrows(Address),

    /// Pool's total deposits
    /// Storage: Persistent
    PoolTotalDeposits(String),

    /// Pool's total borrows
    /// Storage: Persistent
    PoolTotalBorrows(String),

    /// Pool's accumulated interest index
    /// Storage: Persistent
    PoolInterestIndex(String),

    /// Last accrual timestamp
    /// Storage: Persistent
    PoolLastAccrual(String),

    /// Reserve balance for pool
    /// Storage: Persistent
    PoolReserves(String),

    /// Interest rate model parameters
    /// Storage: Instance
    InterestRateModel(String),

    /// Global lending configuration
    /// Storage: Instance
    LendingConfig,

    /// Pool pause status
    /// Storage: Instance
    PoolPaused(String),

    /// Contract administrator address
    /// Storage: Instance
    Admin,

    /// Oracle Address
    /// Storage: Instance
    OracleAddress,

    /// Maximum age (in seconds) before a price is considered stale
    /// Storage: Instance
    OracleMaxAge,

    /// Minimum acceptable normalized price (floor)
    /// Storage: Instance
    OracleMinPrice,

    /// Last validated oracle price snapshot (price + timestamp) for an asset
    /// Storage: Persistent
    LastOraclePrice(Address),
}

/// TTL bump amounts for lending storage
pub mod lending_bump {
    pub const INSTANCE_BUMP: u32 = 518400; // ~60 days
    pub const PERSISTENT_BUMP: u32 = 2592000; // ~300 days
}
