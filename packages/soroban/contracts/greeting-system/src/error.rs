use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Invalid contribution amount (must be positive)
    InvalidContribution = 1,

    /// Tier not found for the user
    TierNotFound = 2,

    /// Unauthorized access (only verified Stellar accounts)
    Unauthorized = 3,

    /// Tier downgrade not allowed
    DowngradeNotAllowed = 4,

    /// Storage error
    StorageError = 5,

    /// Invalid tier level
    InvalidTierLevel = 6,

    /// Zero contribution not allowed
    ZeroContribution = 7,

    /// User already has a tier assigned
    TierAlreadyExists = 8,

    /// User is already registered
    UserAlreadyRegistered = 9,

    /// User profile not found
    UserNotFound = 10,

    /// Invalid user name
    InvalidName = 11,

    /// Invalid user preferences
    InvalidPreferences = 12,

    /// Greeting not eligible for rewards
    NotEligible = 13,

    /// Reward already claimed for greeting
    RewardAlreadyClaimed = 14,

    /// Greeting not found
    GreetingNotFound = 15,

    /// Cross-contract call failed
    ExternalCallFailed = 16,

    /// Flag not found for the greeting
    FlagNotFound = 17,

    /// Greeting is already flagged
    AlreadyFlagged = 18,

    /// Unauthorized moderator
    UnauthorizedModerator = 19,

    /// Invalid flag status
    InvalidFlagStatus = 20,
}
