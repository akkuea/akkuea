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

    // Review errors
    ReviewNotFound = 4,
    NoReviewsFound = 5,

    // Input validation errors
    InvalidInput = 6,
    TextTooShort = 7,
    TextTooLong = 8,
    EmptyText = 9,

    // General errors
    DataNotFound = 10,
}
