use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    // Initialization errors
    AlreadyInitialized = 1,
    NotInitialized = 2,

    // Authorization errors
    Unauthorized = 3,
    AdminOnly = 4,
    PlatformOnly = 5,
    NotAuthorizedPlatform = 6,

    // Course NFT errors
    NFTNotFound = 7,
    NFTAlreadyExists = 8,
    NFTAlreadyIssued = 9,
    CourseNotCompleted = 10,

    // Prerequisite errors
    PrerequisiteNotMet = 11,
    InvalidPrerequisite = 12,
    PrerequisiteNotFound = 13,

    // Progress errors
    ProgressNotFound = 14,
    InvalidCompletionStatus = 15,
    ProgressAlreadyExists = 16,

    // Validation errors
    InvalidInput = 17,
    InvalidTokenId = 18,
    InvalidCourseId = 19,
    DataNotFound = 20,

    // General errors
    OperationNotAllowed = 21,
    StorageError = 22,
}
