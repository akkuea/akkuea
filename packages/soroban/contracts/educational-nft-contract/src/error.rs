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
    EducatorOnly = 5,
    NotAuthorizedEducator = 6,
    
    // Achievement errors
    AchievementNotFound = 7,
    AchievementAlreadyExists = 8,
    InvalidCompletionStatus = 9,
    NotCertified = 10,
    AlreadyCertified = 11,
    
    // Validation errors
    InvalidInput = 12,
    InvalidTokenId = 13,
    InvalidQuizScore = 14,
    DataNotFound = 15,
    
    // General errors
    OperationNotAllowed = 16,
}