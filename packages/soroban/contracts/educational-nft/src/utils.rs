use soroban_sdk::{contracterror, contracttype, symbol_short, Address, Bytes, Env, Symbol};

/// Event symbols for Educational NFT operations
///
/// These symbols are used to identify different types of events emitted by the contract:
/// - `mint`: Emitted when a new NFT is minted
/// - `transfer`: Emitted when an NFT is transferred between addresses
/// - `fraction`: Emitted when an NFT is fractionalized
/// - `frac_xfer`: Emitted when fractions of an NFT are transferred between owners
pub const MINT_EVENT: Symbol = symbol_short!("mint");
pub const TRANSFER_EVENT: Symbol = symbol_short!("transfer");
pub const FRACTIONALIZE_EVENT: Symbol = symbol_short!("fraction");
pub const FRACTION_TRANSFER_EVENT: Symbol = symbol_short!("frac_xfer");

/// Event data structures for Educational NFT operations
///
/// These structures define the data that gets emitted with each event type:
/// Data emitted when a new NFT is minted
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MintEvent {
    pub token_id: u64,
    pub owner: Address,
    pub collection_id: u64,
    pub fractions: u32,
    pub metadata_hash: Bytes,
}

/// Data emitted when an NFT is transferred
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransferEvent {
    pub token_id: u32,
    pub from: Address,
    pub to: Address,
}

/// Data emitted when an NFT is fractionalized
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FractionalizeEvent {
    pub token_id: u64,
    pub owner: Address,
    pub total_fractions: u32,
}

/// Data emitted when fractions of an NFT are transferred
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FractionTransferEvent {
    pub token_id: u64,
    pub from: Address,
    pub to: Address,
    pub amount: u32,
}

/// Helper functions to emit events
pub fn emit_mint_event(
    env: &Env,
    token_id: u64,
    owner: &Address,
    collection_id: u64,
    fractions: u32,
    metadata_hash: &Bytes,
) {
    let event_data = MintEvent {
        token_id,
        owner: owner.clone(),
        collection_id,
        fractions,
        metadata_hash: metadata_hash.clone(),
    };
    env.events().publish((MINT_EVENT,), event_data);
}

pub fn emit_transfer_event(env: &Env, token_id: u32, from: &Address, to: &Address) {
    let event_data = TransferEvent {
        token_id,
        from: from.clone(),
        to: to.clone(),
    };
    env.events().publish((TRANSFER_EVENT,), event_data);
}

pub fn emit_fractionalize_event(env: &Env, token_id: u64, owner: &Address, total_fractions: u32) {
    let event_data = FractionalizeEvent {
        token_id,
        owner: owner.clone(),
        total_fractions,
    };
    env.events().publish((FRACTIONALIZE_EVENT,), event_data);
}

pub fn emit_fraction_transfer_event(
    env: &Env,
    token_id: u64,
    from: &Address,
    to: &Address,
    amount: u32,
) {
    let event_data = FractionTransferEvent {
        token_id,
        from: from.clone(),
        to: to.clone(),
        amount,
    };
    env.events().publish((FRACTION_TRANSFER_EVENT,), event_data);
}

/// Error codes for Educational NFT operations
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum NFTError {
    /// Token does not exist
    TokenNotFound = 1,
    /// Caller is not the owner of the token
    NotOwner = 2,
    /// Invalid fractionalization parameters
    InvalidFractions = 3,
    /// Token is already fractionalized
    AlreadyFractionalized = 4,
    /// Token is not fractionalized
    NotFractionalized = 5,
    /// Insufficient fraction balance
    InsufficientFractions = 6,
    /// Invalid fraction transfer amount
    InvalidFractionAmount = 7,
    /// Fraction owner not found
    FractionOwnerNotFound = 8,
    /// Unauthorized operation
    Unauthorized = 9,
    /// Invalid collection ID
    InvalidCollection = 10,
    /// Insufficient fractions for transfer decision
    InsufficientFractionsForTransfer = 11,
    /// Insufficient fractions for approve decision
    InsufficientFractionsForApprove = 12,
    /// Contract not properly initialized
    ContractNotInitialized = 13,
}

impl NFTError {
    /// Get the string representation of the error that matches test expectations
    pub fn as_str(&self) -> &'static str {
        match self {
            NFTError::TokenNotFound => "TokenNotFound",
            NFTError::NotOwner => "NotOwner",
            NFTError::InvalidFractions => "InvalidFractions",
            NFTError::AlreadyFractionalized => "AlreadyFractionalized",
            NFTError::NotFractionalized => "NotFractionalized",
            NFTError::InsufficientFractions => "InsufficientFractions",
            NFTError::InvalidFractionAmount => "InvalidFractionAmount",
            NFTError::FractionOwnerNotFound => "FractionOwnerNotFound",
            NFTError::Unauthorized => "Unauthorized",
            NFTError::InvalidCollection => "InvalidCollection",
            NFTError::InsufficientFractionsForTransfer => "InsufficientFractionsForTransfer",
            NFTError::InsufficientFractionsForApprove => "InsufficientFractionsForApprove",
            NFTError::ContractNotInitialized => "ContractNotInitialized",
        }
    }
}
