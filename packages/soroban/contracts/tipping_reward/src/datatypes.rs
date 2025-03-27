use soroban_sdk::{Address, contracttype, Symbol, contracterror, symbol_short};


/// Constant key used to store the tips history in contract storage
/// Uses a short symbol for gas efficiency
pub const TIPS_HISTORY: Symbol = symbol_short!("TIPS");




/// Error codes that can be returned by the contract functions
/// Each error has a unique u32 code that will be returned to the client
#[contracterror]
#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    /// Returned when the tip amount is zero or negative
    InvalidAmount = 1,
    
    /// Returned when the specified educator address doesn't exist in the educator contract
    InvalidEducator = 2,
    
    /// Returned when an operation is attempted without proper authorization
    NotAuthorized = 3,
    
    /// Returned when trying to tip an educator who hasn't been verified
    EducatorNotVerified = 4,
    
    /// Returned when a rating is outside the valid range (typically 1-5)
    InvalidRating = 5,
    
    /// Returned when a review operation fails for any reason
    ReviewFailed = 6,
}



/// Structure representing a single tip transaction
/// This is stored in the contract's storage as part of the tip history
#[derive(Clone)]
#[contracttype]
pub struct TipRecord {
    /// Address of the user who sent the tip
    pub from: Address,
    
    /// Address of the educator who received the tip
    pub to: Address,
    
    /// Amount of tokens that were tipped
    pub amount: i128,
    
    /// Ledger timestamp when the tip was recorded
    /// Used for chronological ordering and time-based analytics
    pub timestamp: u64,
}