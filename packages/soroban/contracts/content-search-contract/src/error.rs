use soroban_sdk::{contracterror, contracttype};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NoMatchingContent = 1,
    InvalidInput = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CustomError {
    pub message: String,
}

impl From<Error> for CustomError {
    fn from(error: Error) -> Self {
        let message = match error {
            Error::NoMatchingContent => "No content found matching the search criteria",
            Error::InvalidInput => "The provided input is invalid",
        };
        CustomError {
            message: message.to_string(),
        }
    }
} 