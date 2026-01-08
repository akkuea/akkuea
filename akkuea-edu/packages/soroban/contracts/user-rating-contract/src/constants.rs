// Rating criteria weights
pub const DELIVERY_WEIGHT: u32 = 3;
pub const COMMUNICATION_WEIGHT: u32 = 2;
pub const ACCURACY_WEIGHT: u32 = 3;
pub const VALUE_WEIGHT: u32 = 2;

// Reputation thresholds
pub const HIGH_REPUTATION_THRESHOLD: u32 = 85;
pub const MEDIUM_REPUTATION_THRESHOLD: u32 = 65;

// Time restrictions (in ledger timestamps)
pub const MIN_RATING_INTERVAL: u64 = 86400; // 1 day in seconds
