use soroban_sdk::{contracterror, contracttype, Env, String};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    NoMatchingContent = 1,
    InvalidInput = 2,
    NotInitialized = 3,
    ContentNotFound = 4,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CustomError {
    pub message: String,
}

impl From<Error> for CustomError {
    fn from(error: Error) -> Self {
        let env = Env::default();
        let message = match error {
            Error::NoMatchingContent => "No content found matching the search criteria",
            Error::InvalidInput => "The provided input is invalid",
            Error::NotInitialized => "Contract has not been initialized",
            Error::ContentNotFound => "Content not found",
        };
        CustomError {
            message: String::from_str(&env, message),
        }
    }
}
