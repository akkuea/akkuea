use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum NftError {
    AlreadyInitialized = 1,
    NotOwner = 2,
    NotApproved = 3,
    InvalidProperty = 4,
    ContractPaused = 5,
    Unauthorized = 6,
}
