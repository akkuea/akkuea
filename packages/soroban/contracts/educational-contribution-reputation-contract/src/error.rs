use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    NotAuthorized = 1,           // Caller is not authorized
    UserNotFound = 2,            // User does not exist
    AlreadyVerified = 3,         // User is already verified
    NotVerified = 4,             // User is not verified
    InvalidInput = 5,            // Invalid input provided
    TokenNotFound = 6,           // Credential token not found
    ReputationNotFound = 7,      // Reputation data not found
    DisputeNotFound = 8,         // Dispute not found
    DisputeAlreadyExists = 9,    // Dispute already exists for this reputation
    DisputeAlreadyResolved = 10, // Dispute has already been resolved
    InsufficientEvidence = 11,   // Insufficient evidence for dispute
    RecoveryNotAllowed = 12,     // Recovery not allowed for this user
    ProbationActive = 13,        // User is currently on probation
    InvalidTimeRange = 14,       // Invalid time range for analytics
    InsufficientData = 15,       // Insufficient data for analytics
    // Security-related errors
    SecurityViolation = 16,      // Security policy violation detected
    RateLimitExceeded = 17,      // Rate limit exceeded for operation
    ServiceUnavailable = 18,     // Service unavailable due to circuit breaker
    AccessDenied = 19,           // Access denied for operation
    InvalidPermission = 20,      // Invalid permission level
    // Integration-related errors
    ExternalSystemError = 21,    // Error communicating with external system
    CredentialNotFound = 22,     // External credential not found
    VerificationFailed = 23,     // Credential verification failed
    BridgeNotConfigured = 24,    // System bridge not properly configured
    ImportExportFailed = 25,     // Import/export operation failed
    MappingNotFound = 26,        // Credential mapping not found
    InvalidCredential = 27,      // Invalid credential format or data
    ExpirationDatePassed = 28,   // Credential has expired
    SyncError = 29,              // Synchronization error with external system
    UnsupportedOperation = 30,   // Operation not supported by bridge

    // Verification tier errors
    RenewalNotDue = 32,          // Verification renewal not yet due
    InsufficientExpertise = 35,  // User doesn't have sufficient expertise areas
}
