use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum WhitelistError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
}
