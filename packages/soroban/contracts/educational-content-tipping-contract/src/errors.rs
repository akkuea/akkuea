use soroban_sdk::{contracttype, Error, xdr::{ScErrorType, ScErrorCode}};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TippingError {
    // Existing errors
    InvalidAmount,
    InsufficientBalance,
    Unauthorized,
    InvalidToken,
    InvalidRecipient,
    ContractNotInitialized,
    StorageError,
    
    // New multi-token errors
    TokenNotWhitelisted,
    AmountTooSmall,
    AmountTooLarge,
    TokenAlreadyExists,
    
    // Price feed errors
    PriceDataNotFound,
    PriceDataStale,
    LowPriceConfidence,
    OracleNotAuthorized,
    ConversionFailed,
    
    // Additional errors
    InvalidInput,
    TransferFailed,
    DataNotFound,
}

impl From<TippingError> for Error {
    fn from(_e: TippingError) -> Self {
        Error::from_type_and_code(
            ScErrorType::Contract,
            ScErrorCode::InvalidInput
        )
    }
}

impl From<&TippingError> for Error {
    fn from(_e: &TippingError) -> Self {
        Error::from_type_and_code(
            ScErrorType::Contract,
            ScErrorCode::InvalidInput
        )
    }
}

impl From<Error> for TippingError {
    fn from(_e: Error) -> Self {
        TippingError::StorageError
    }
}