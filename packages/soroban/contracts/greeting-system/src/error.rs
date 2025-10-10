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

    /// User not found
    UserNotFound = 18,

    /// User already registered
    UserAlreadyRegistered = 19,

    /// Batch size exceeds the maximum allowed limit
    BatchTooLarge = 9,

    /// Mismatch between number of greeting IDs and updates
    InvalidUpdateLength = 10,

    /// Greeting not found or user not authorized to update it
    UnauthorizedGreeting = 11,

    /// Batch ID already exists
    BatchIdExists = 12,

    /// Duplicate greeting IDs in batch
    DuplicateGreetingIds = 13,

    /// Empty update text in batch
    EmptyUpdate = 14,

    /// Batch not found
    BatchNotFound = 15,

    /// Invalid user preferences
    InvalidPreferences = 16,

    /// Invalid name provided
    InvalidName = 17, // Add this

    // Role-related errors
    InvalidRole = 200,
    UnauthorizedRole = 201,
    CannotRevokeOwnerRole = 202,
    ContractAlreadyInitialized = 203,
    ContractNotInitialized = 204,

    /// Greeting not found
    GreetingNotFound = 20,

    /// User already liked this greeting
    AlreadyLiked = 21,

    /// Comment text is empty
    EmptyComment = 22,

    /// Comment text too long
    CommentTooLong = 23,
}

// Add Display impl for to_string() to work (required for String::from_str(&e.to_string()))
use core::fmt;

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            Error::InvalidContribution => {
                f.write_str("Invalid contribution amount (must be positive)")
            }
            Error::TierNotFound => f.write_str("Tier not found for the user"),
            Error::Unauthorized => {
                f.write_str("Unauthorized access (only verified Stellar accounts)")
            }
            Error::DowngradeNotAllowed => f.write_str("Tier downgrade not allowed"),
            Error::StorageError => f.write_str("Storage error"),
            Error::InvalidTierLevel => f.write_str("Invalid tier level"),
            Error::ZeroContribution => f.write_str("Zero contribution not allowed"),
            Error::TierAlreadyExists => f.write_str("User already has a tier assigned"),
            Error::UserNotFound => f.write_str("User profile not found"),
            Error::UserAlreadyRegistered => f.write_str("User is already registered"),
            Error::BatchTooLarge => f.write_str("Batch size exceeds the maximum allowed limit"),
            Error::InvalidUpdateLength => {
                f.write_str("Mismatch between number of greeting IDs and updates")
            }
            Error::UnauthorizedGreeting => {
                f.write_str("Greeting not found or user not authorized to update it")
            }
            Error::BatchIdExists => f.write_str("Batch ID already exists"),
            Error::DuplicateGreetingIds => f.write_str("Duplicate greeting IDs in batch"),
            Error::EmptyUpdate => f.write_str("Empty update text in batch"),
            Error::BatchNotFound => f.write_str("Batch not found"),
            Error::InvalidPreferences => f.write_str("Invalid user preferences"), // Add this line
            Error::InvalidName => f.write_str("Invalid name provided"),           // And this line
            Error::InvalidRole => f.write_str("Invalid role specified"),
            Error::UnauthorizedRole => f.write_str("Unauthorized role operation"),
            Error::CannotRevokeOwnerRole => f.write_str("Cannot revoke the owner role"),
            Error::ContractAlreadyInitialized => f.write_str("Contract already initialized"),
            Error::ContractNotInitialized => f.write_str("Contract not initialized"),
            Error::GreetingNotFound => f.write_str("Greeting not found"),
            Error::AlreadyLiked => f.write_str("User already liked this greeting"),
            Error::EmptyComment => f.write_str("Comment text is empty"),
            Error::CommentTooLong => f.write_str("Comment text too long"),
        }
    }
}
