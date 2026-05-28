use soroban_sdk::contracterror;

#[contracterror]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum EngineError {
    AlreadyInitialized = 1,
    NotOwner = 2,
    AlreadyMaxLevel = 3,
    NothingToClaim = 4,
    InsufficientBalance = 5,
}
