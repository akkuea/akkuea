use soroban_sdk::{
    contracttype,
    xdr::{ScErrorCode, ScErrorType},
    Error,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TippingError {
    AlreadyInitialized,
    InvalidAmount,
    InsufficientBalance,
    Unauthorized,
    InvalidToken,
    InvalidRecipient,
    ContractNotInitialized,
    StorageError,
}

impl From<TippingError> for Error {
    fn from(_e: TippingError) -> Self {
        Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput)
    }
}

impl From<&TippingError> for Error {
    fn from(_e: &TippingError) -> Self {
        Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput)
    }
}

impl From<Error> for TippingError {
    fn from(_e: Error) -> Self {
        TippingError::StorageError
    }
}
