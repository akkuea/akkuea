use soroban_sdk::{contracterror, contracttype, symbol_short, Address, Bytes, Env, String, Symbol};

/// Event symbols for Educational NFT operations
///
/// These symbols are used to identify different types of events emitted by the contract:
/// - `mint`: Emitted when a new NFT is minted
/// - `transfer`: Emitted when an NFT is transferred between addresses
/// - `fraction`: Emitted when an NFT is fractionalized
/// - `frac_xfer`: Emitted when fractions of an NFT are transferred between owners
/// - `meta_created`: Emitted when metadata is first created for an NFT
/// - `meta_updated`: Emitted when metadata is updated with a new version
pub const MINT_EVENT: Symbol = symbol_short!("mint");
pub const TRANSFER_EVENT: Symbol = symbol_short!("transfer");
pub const FRACTIONALIZE_EVENT: Symbol = symbol_short!("fraction");
pub const FRACTION_TRANSFER_EVENT: Symbol = symbol_short!("frac_xfer");
pub const METADATA_CREATED_EVENT: Symbol = symbol_short!("meta_new");
pub const METADATA_UPDATED_EVENT: Symbol = symbol_short!("meta_upd");
pub const SOCIAL_SHARE_EVENT: Symbol = symbol_short!("soc_share");
pub const SOCIAL_COLLAB_EVENT: Symbol = symbol_short!("soc_colb");
pub const SOCIAL_SHOWCASE_EVENT: Symbol = symbol_short!("soc_show");
pub const MARKETPLACE_LISTING_EVENT: Symbol = symbol_short!("mkt_list");
pub const MARKETPLACE_SALE_EVENT: Symbol = symbol_short!("mkt_sale");
pub const MARKETPLACE_BID_EVENT: Symbol = symbol_short!("mkt_bid");
pub const MARKETPLACE_ROYALTY_EVENT: Symbol = symbol_short!("mkt_royal");
pub const GOVERNANCE_PROPOSAL_EVENT: Symbol = symbol_short!("gov_prop");
pub const GOVERNANCE_VOTE_EVENT: Symbol = symbol_short!("gov_vote");
pub const GOVERNANCE_FINALIZE_EVENT: Symbol = symbol_short!("gov_final");
pub const GOVERNANCE_EXECUTE_EVENT: Symbol = symbol_short!("gov_exec");

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

/// Data emitted when metadata is created for an NFT
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MetadataCreatedEvent {
    pub token_id: u64,
    pub creator: Address,
    pub content_type: String,
    pub ipfs_hash: Bytes,
    pub version: u32,
}

/// Data emitted when metadata is updated for an NFT
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MetadataUpdatedEvent {
    pub token_id: u64,
    pub updater: Address,
    pub old_version: u32,
    pub new_version: u32,
    pub new_ipfs_hash: Bytes,
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

pub fn emit_metadata_created_event(
    env: &Env,
    token_id: u64,
    creator: &Address,
    content_type: String,
    ipfs_hash: &Bytes,
    version: u32,
) {
    let event_data = MetadataCreatedEvent {
        token_id,
        creator: creator.clone(),
        content_type,
        ipfs_hash: ipfs_hash.clone(),
        version,
    };
    env.events().publish((METADATA_CREATED_EVENT,), event_data);
}

pub fn emit_metadata_updated_event(
    env: &Env,
    token_id: u64,
    updater: &Address,
    old_version: u32,
    new_version: u32,
    new_ipfs_hash: &Bytes,
) {
    let event_data = MetadataUpdatedEvent {
        token_id,
        updater: updater.clone(),
        old_version,
        new_version,
        new_ipfs_hash: new_ipfs_hash.clone(),
    };
    env.events().publish((METADATA_UPDATED_EVENT,), event_data);
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SocialShareEvent {
    pub token_id: u64,
    pub user: Address,
    pub visibility: String,
    pub group_id: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SocialCollaborateEvent {
    pub token_id: u64,
    pub user: Address,
    pub group_id: u64,
    pub action: String,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SocialShowcaseEvent {
    pub user: Address,
    pub collection_id: u64,
    pub nft_count: u32,
    pub visibility: String,
    pub timestamp: u64,
}

pub fn emit_social_share_event(
    env: &Env,
    token_id: u64,
    user: &Address,
    visibility: String,
    group_id: u64,
) {
    let event_data = SocialShareEvent {
        token_id,
        user: user.clone(),
        visibility,
        group_id,
        timestamp: env.ledger().timestamp(),
    };
    env.events().publish((SOCIAL_SHARE_EVENT,), event_data);
}

pub fn emit_social_collaborate_event(
    env: &Env,
    token_id: u64,
    user: &Address,
    group_id: u64,
    action: String,
) {
    let event_data = SocialCollaborateEvent {
        token_id,
        user: user.clone(),
        group_id,
        action,
        timestamp: env.ledger().timestamp(),
    };
    env.events().publish((SOCIAL_COLLAB_EVENT,), event_data);
}

pub fn emit_social_showcase_event(
    env: &Env,
    user: &Address,
    collection_id: u64,
    nft_count: u32,
    visibility: String,
) {
    let event_data = SocialShowcaseEvent {
        user: user.clone(),
        collection_id,
        nft_count,
        visibility,
        timestamp: env.ledger().timestamp(),
    };
    env.events().publish((SOCIAL_SHOWCASE_EVENT,), event_data);
}

pub fn is_verified_stellar_account(_env: &Env, _address: &Address) -> bool {
    true
}

pub fn check_privacy_permissions(
    env: &Env,
    owner: &Address,
    viewer: &Address,
    visibility: &String,
    group_id: u64,
) -> bool {
    if owner == viewer {
        return true;
    }

    if *visibility == String::from_str(env, "Public") {
        true
    } else if *visibility == String::from_str(env, "Private") {
        false
    } else if *visibility == String::from_str(env, "GroupOnly") {
        true
    } else {
        false
    }
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
    /// Invalid IPFS hash format
    InvalidIPFSHash = 14,
    /// Invalid Arweave hash format
    InvalidArweaveHash = 15,
    /// Unsupported hash type
    UnsupportedHashType = 16,
    /// Metadata not found
    MetadataNotFound = 17,
    /// Metadata version not found
    MetadataVersionNotFound = 18,
    /// Unauthorized metadata update
    UnauthorizedMetadataUpdate = 19,
    /// Invalid content type
    InvalidContentType = 20,
    /// Metadata already exists
    MetadataAlreadyExists = 21,
    /// Invalid social action
    InvalidSocialAction = 22,
    /// Group not found
    GroupNotFound = 23,
    /// User not a member of the group
    NotGroupMember = 24,
    /// Invalid visibility level
    InvalidVisibility = 25,
    /// Showcase not found
    ShowcaseNotFound = 26,
    /// Listing not found
    ListingNotFound = 27,
    /// Invalid price
    InvalidPrice = 28,
    /// Auction not active
    AuctionNotActive = 29,
    /// Bid too low
    BidTooLow = 30,
    /// Auction ended
    AuctionEnded = 31,
    /// Not auction
    NotAuction = 32,
    /// Auction still active
    AuctionStillActive = 33,
    /// Invalid royalty rate
    InvalidRoyaltyRate = 34,
    /// Insufficient payment
    InsufficientPayment = 35,
    /// Proposal not found
    ProposalNotFound = 36,
    /// Voting period ended
    VotingPeriodEnded = 37,
    /// Already voted
    AlreadyVoted = 38,
    /// Insufficient reputation to propose
    InsufficientReputation = 39,
    /// Invalid proposal duration
    InvalidProposalDuration = 40,
    /// Proposal not ready for finalization
    ProposalNotReady = 41,
    /// Insufficient quorum
    InsufficientQuorum = 42,
    /// Proposal execution failed
    ProposalExecutionFailed = 43,
    /// Invalid voting power
    InvalidVotingPower = 44,
    /// Proposal already finalized
    ProposalAlreadyFinalized = 45,
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
            NFTError::InvalidIPFSHash => "InvalidIPFSHash",
            NFTError::InvalidArweaveHash => "InvalidArweaveHash",
            NFTError::UnsupportedHashType => "UnsupportedHashType",
            NFTError::MetadataNotFound => "MetadataNotFound",
            NFTError::MetadataVersionNotFound => "MetadataVersionNotFound",
            NFTError::UnauthorizedMetadataUpdate => "UnauthorizedMetadataUpdate",
            NFTError::InvalidContentType => "InvalidContentType",
            NFTError::MetadataAlreadyExists => "MetadataAlreadyExists",
            NFTError::InvalidSocialAction => "InvalidSocialAction",
            NFTError::GroupNotFound => "GroupNotFound",
            NFTError::NotGroupMember => "NotGroupMember",
            NFTError::InvalidVisibility => "InvalidVisibility",
            NFTError::ShowcaseNotFound => "ShowcaseNotFound",
            NFTError::ListingNotFound => "ListingNotFound",
            NFTError::InvalidPrice => "InvalidPrice",
            NFTError::AuctionNotActive => "AuctionNotActive",
            NFTError::BidTooLow => "BidTooLow",
            NFTError::AuctionEnded => "AuctionEnded",
            NFTError::NotAuction => "NotAuction",
            NFTError::AuctionStillActive => "AuctionStillActive",
            NFTError::InvalidRoyaltyRate => "InvalidRoyaltyRate",
            NFTError::InsufficientPayment => "InsufficientPayment",
            NFTError::ProposalNotFound => "ProposalNotFound",
            NFTError::VotingPeriodEnded => "VotingPeriodEnded",
            NFTError::AlreadyVoted => "AlreadyVoted",
            NFTError::InsufficientReputation => "InsufficientReputation",
            NFTError::InvalidProposalDuration => "InvalidProposalDuration",
            NFTError::ProposalNotReady => "ProposalNotReady",
            NFTError::InsufficientQuorum => "InsufficientQuorum",
            NFTError::ProposalExecutionFailed => "ProposalExecutionFailed",
            NFTError::InvalidVotingPower => "InvalidVotingPower",
            NFTError::ProposalAlreadyFinalized => "ProposalAlreadyFinalized",
        }
    }
}
