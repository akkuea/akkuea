// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Stellar Soroban Contracts ^0.4.1
#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Bytes, Env, String, Vec};
use stellar_access::ownable::{self as ownable, Ownable};
use stellar_macros::default_impl;
use stellar_tokens::non_fungible::{Base, NonFungibleToken};

mod batch;
mod governance;
mod marketplace;
mod metadata;
mod mock_educator_verification_nft;
mod nft;
mod social;
mod utils;

pub use batch::*;
pub use governance::*;
pub use marketplace::*;
pub use metadata::*;
pub use nft::*;
pub use social::*;
pub use utils::*;

pub use mock_educator_verification_nft::MockEducatorVerificationNft;

#[contract]
pub struct EducationalNFTContract;

#[contractimpl]
impl EducationalNFTContract {
    /// Constructor to initialize the contract
    pub fn __constructor(e: &Env, owner: Address, educator_contract_addr: Address) {
        let uri = soroban_sdk::String::from_str(e, "https://educational-nft.com/api/metadata/");
        let name = soroban_sdk::String::from_str(e, "Educational NFT");
        let symbol = soroban_sdk::String::from_str(e, "ENFT");

        Base::set_metadata(e, uri, name, symbol);
        ownable::set_owner(e, &owner);
        nft::store_educator_verification_address(e, &educator_contract_addr);
    }

    /// Mint a new educational NFT with educator verification
    pub fn mint_nft(
        e: &Env,
        caller: Address,
        collection_id: u64,
        fractions: u32,
        metadata_hash: Bytes,
    ) -> Result<u32, utils::NFTError> {
        caller.require_auth();

        // Get the educator verification contract address (for compatibility, but use mock directly)
        let _educator_contract_address = nft::get_educator_verification_address_safe(e)
            .map_err(|_| utils::NFTError::ContractNotInitialized)?;

        // Use mock educator verification directly instead of WASM client
        let is_verified = MockEducatorVerificationNft::verify_educator(e.clone(), caller.clone());
        if !is_verified {
            return Err(utils::NFTError::Unauthorized);
        }

        let token_id = Base::sequential_mint(e, &caller);

        // Create and store NFT data
        let nft_data = nft::EducationalNFT {
            token_id: token_id as u64,
            owner: caller.clone(),
            collection_id,
            fractions,
            metadata_hash: metadata_hash.clone(),
        };

        nft::store_educational_nft(e, token_id as u64, &nft_data);

        // Emit mint event
        utils::emit_mint_event(
            e,
            token_id as u64,
            &caller,
            collection_id,
            fractions,
            &metadata_hash,
        );

        Ok(token_id)
    }

    /// Transfer NFT ownership
    pub fn transfer_nft(e: &Env, caller: Address, token_id: u32, new_owner: Address) {
        caller.require_auth();

        // Emit transfer event before the transfer
        utils::emit_transfer_event(e, token_id, &caller, &new_owner);

        nft::EducationalNFTStorage::transfer(e, &caller, &new_owner, token_id);
    }

    /// Fractionalize an NFT into multiple ownership shares
    pub fn fractionalize_nft(
        e: &Env,
        caller: Address,
        token_id: u64,
    ) -> Result<(), utils::NFTError> {
        caller.require_auth();

        // Attempt to fractionalize the NFT
        let result = nft::fractionalize_nft(e, token_id, &caller);

        // If successful, emit the fractionalize event
        if result.is_ok() {
            if let Ok(nft_data) = nft::get_educational_nft_safe(e, token_id) {
                utils::emit_fractionalize_event(e, token_id, &caller, nft_data.fractions);
            }
        }

        result
    }

    /// Get NFT information
    pub fn get_nft_info(e: &Env, token_id: u32) -> Result<nft::EducationalNFT, utils::NFTError> {
        nft::get_educational_nft_safe(e, token_id as u64)
    }

    /// Transfer fractions between owners
    pub fn transfer_fractions(
        e: &Env,
        caller: Address,
        token_id: u32,
        to: Address,
        amount: u32,
    ) -> Result<(), utils::NFTError> {
        caller.require_auth();

        // Attempt to transfer fractions
        let result = nft::transfer_fractions(e, token_id as u64, &caller, &to, amount);

        // If successful, emit the fraction transfer event
        if result.is_ok() {
            utils::emit_fraction_transfer_event(e, token_id as u64, &caller, &to, amount);
        }

        result
    }

    /// Get fraction balance for a specific owner
    pub fn get_fraction_balance(
        e: &Env,
        token_id: u32,
        owner: Address,
    ) -> Result<u32, utils::NFTError> {
        nft::get_fraction_balance(e, token_id as u64, &owner)
    }

    /// Store rich metadata for an NFT on IPFS/Arweave
    pub fn store_metadata(
        e: &Env,
        caller: Address,
        token_id: u64,
        content_type: String,
        ipfs_hash: Bytes,
        title: String,
        description: String,
    ) -> Result<(), utils::NFTError> {
        caller.require_auth();

        // Check if NFT exists
        let nft_data = nft::get_educational_nft_safe(e, token_id)?;

        // Check authorization - only NFT owner can store metadata
        if nft_data.owner != caller {
            return Err(utils::NFTError::UnauthorizedMetadataUpdate);
        }

        // Check if metadata already exists
        if nft::get_nft_metadata_safe(e, token_id).is_ok() {
            return Err(utils::NFTError::MetadataAlreadyExists);
        }

        // Parse content type
        let parsed_content_type = if content_type == String::from_str(e, "Course") {
            metadata::ContentType::Course
        } else if content_type == String::from_str(e, "Certification") {
            metadata::ContentType::Certification
        } else if content_type == String::from_str(e, "Workshop") {
            metadata::ContentType::Workshop
        } else if content_type == String::from_str(e, "Tutorial") {
            metadata::ContentType::Tutorial
        } else if content_type == String::from_str(e, "Assignment") {
            metadata::ContentType::Assignment
        } else if content_type == String::from_str(e, "Assessment") {
            metadata::ContentType::Assessment
        } else {
            return Err(utils::NFTError::InvalidContentType);
        };

        // Create new metadata
        let new_metadata = metadata::NFTMetadata::new(
            e,
            token_id,
            parsed_content_type.clone(),
            ipfs_hash.clone(),
            caller.clone(),
            title,
            description,
        )?;

        // Store metadata
        nft::store_nft_metadata(e, token_id, &new_metadata);

        // Create and store metadata history
        let history = metadata::MetadataHistory::new(e, token_id, &new_metadata);
        nft::store_metadata_history(e, token_id, &history);

        // Update indexes
        nft::add_token_to_creator_index(e, &caller, token_id);
        nft::add_token_to_content_type_index(e, &parsed_content_type, token_id);

        // Emit event
        utils::emit_metadata_created_event(
            e,
            token_id,
            &caller,
            String::from_str(e, parsed_content_type.as_string()),
            &ipfs_hash,
            new_metadata.version,
        );

        Ok(())
    }

    /// Update metadata with a new version, preserving history
    pub fn update_metadata(
        e: &Env,
        caller: Address,
        token_id: u64,
        ipfs_hash: Bytes,
        change_notes: String,
    ) -> Result<(), utils::NFTError> {
        caller.require_auth();

        // Get existing metadata
        let current_metadata = nft::get_nft_metadata_safe(e, token_id)?;

        // Check authorization - only original creator can update
        if current_metadata.creator != caller {
            return Err(utils::NFTError::UnauthorizedMetadataUpdate);
        }

        // Create updated metadata
        let updated_metadata = current_metadata.update_version(
            e,
            ipfs_hash.clone(),
            caller.clone(),
            change_notes.clone(),
        )?;

        // Store updated metadata
        nft::store_nft_metadata(e, token_id, &updated_metadata);

        // Update history
        let mut history = nft::get_metadata_history_safe(e, token_id)?;
        history.add_version(e, &updated_metadata, change_notes);
        nft::store_metadata_history(e, token_id, &history);

        // Emit event
        utils::emit_metadata_updated_event(
            e,
            token_id,
            &caller,
            current_metadata.version,
            updated_metadata.version,
            &ipfs_hash,
        );

        Ok(())
    }

    /// Get metadata for a specific NFT and version
    pub fn get_metadata(
        e: &Env,
        token_id: u64,
        version: Option<u32>,
    ) -> Result<metadata::NFTMetadata, utils::NFTError> {
        if let Some(v) = version {
            // Get specific version from history
            let history = nft::get_metadata_history_safe(e, token_id)?;
            let version_info = history
                .get_version(v)
                .ok_or(utils::NFTError::MetadataVersionNotFound)?;

            // For now, we'll return the current metadata with the version info
            // In a more complete implementation, we'd reconstruct the full metadata for that version
            let mut metadata = nft::get_nft_metadata_safe(e, token_id)?;
            metadata.version = version_info.version;
            metadata.ipfs_hash = version_info.ipfs_hash;
            metadata.updated_at = version_info.created_at;
            Ok(metadata)
        } else {
            // Get current version
            nft::get_nft_metadata_safe(e, token_id)
        }
    }

    /// Get metadata history for an NFT
    pub fn get_metadata_history(
        e: &Env,
        token_id: u64,
    ) -> Result<metadata::MetadataHistory, utils::NFTError> {
        nft::get_metadata_history_safe(e, token_id)
    }

    /// Get tokens by creator
    pub fn get_tokens_by_creator(e: &Env, creator: Address) -> Vec<u64> {
        nft::get_tokens_by_creator(e, &creator)
    }

    /// Get tokens by content type
    pub fn get_tokens_by_content_type(
        e: &Env,
        content_type: String,
    ) -> Result<Vec<u64>, utils::NFTError> {
        let parsed_content_type = if content_type == String::from_str(e, "Course") {
            metadata::ContentType::Course
        } else if content_type == String::from_str(e, "Certification") {
            metadata::ContentType::Certification
        } else if content_type == String::from_str(e, "Workshop") {
            metadata::ContentType::Workshop
        } else if content_type == String::from_str(e, "Tutorial") {
            metadata::ContentType::Tutorial
        } else if content_type == String::from_str(e, "Assignment") {
            metadata::ContentType::Assignment
        } else if content_type == String::from_str(e, "Assessment") {
            metadata::ContentType::Assessment
        } else {
            return Err(utils::NFTError::InvalidContentType);
        };

        Ok(nft::get_tokens_by_content_type(e, &parsed_content_type))
    }

    // ========================================
    // SOCIAL FEATURES
    // ========================================

    /// Share an NFT publicly or within a group
    pub fn share_nft(
        e: &Env,
        caller: Address,
        token_id: u64,
        visibility: String,
        group_id: Option<u64>,
        description: String,
    ) -> Result<(), utils::NFTError> {
        caller.require_auth();
        social::share_nft(e, &caller, token_id, visibility, group_id, description)
    }

    /// Join or create a collaborative learning group with an NFT
    pub fn join_collaborative_group(
        e: &Env,
        caller: Address,
        token_id: u64,
        group_id: Option<u64>,
        group_name: Option<String>,
    ) -> Result<u64, utils::NFTError> {
        caller.require_auth();
        social::join_collaborative_group(e, &caller, token_id, group_id, group_name)
    }

    /// Showcase a user's educational journey through their NFT collection
    pub fn showcase_collection(
        e: &Env,
        caller: Address,
        collection_id: u64,
        title: String,
        description: String,
        visibility: String,
    ) -> Result<(), utils::NFTError> {
        caller.require_auth();
        social::showcase_collection(e, &caller, collection_id, title, description, visibility)
    }

    /// Add an NFT to an existing educational journey showcase
    pub fn add_nft_to_showcase(
        e: &Env,
        caller: Address,
        collection_id: u64,
        token_id: u64,
    ) -> Result<(), utils::NFTError> {
        caller.require_auth();
        social::add_nft_to_showcase(e, &caller, collection_id, token_id)
    }

    /// Get social actions for a user and token
    pub fn get_social_actions(e: &Env, user: Address, token_id: u64) -> Vec<social::SocialAction> {
        social::get_social_actions(e, &user, token_id)
    }

    /// Get NFT sharing configuration
    pub fn get_nft_share_info(e: &Env, token_id: u64) -> Option<social::NFTShare> {
        social::get_nft_share(e, token_id)
    }

    /// Get collaborative group information
    pub fn get_collaborative_group_info(
        e: &Env,
        group_id: u64,
    ) -> Option<social::CollaborativeGroup> {
        social::get_collaborative_group(e, group_id)
    }

    /// Get educational journey showcase
    pub fn get_educational_journey(
        e: &Env,
        user: Address,
        collection_id: u64,
    ) -> Option<social::EducationalJourney> {
        social::get_educational_journey(e, &user, collection_id)
    }

    /// Get user's reputation boost information
    pub fn get_reputation_boost(e: &Env, user: Address) -> Option<social::ReputationBoost> {
        social::get_reputation_boost(e, &user)
    }

    /// Update user reputation boost (restricted to authorized contracts)
    pub fn update_reputation_boost(
        e: &Env,
        caller: Address,
        user: Address,
        reputation_score: u32,
        boost_level: u32,
    ) -> Result<(), utils::NFTError> {
        caller.require_auth();
        // TODO: Add authorization check to ensure only reputation contract can call this
        social::update_reputation_boost(e, &user, reputation_score, boost_level)
    }

    /// Verify if user has sufficient reputation for boosted visibility
    pub fn verify_reputation_boost(e: &Env, user: Address, min_reputation: u32) -> bool {
        social::verify_reputation_boost(e, &user, min_reputation)
    }

    /// Get public NFT shares for discovery
    pub fn get_public_shares(e: &Env) -> Vec<social::NFTShare> {
        social::get_public_nft_shares(e)
    }

    /// Get user's collaborative groups
    pub fn get_user_groups(e: &Env, user: Address) -> Vec<social::CollaborativeGroup> {
        social::get_user_groups(e, &user)
    }

    // ========================================
    // BATCH FEATURES
    // ========================================

    pub fn batch_mint_nfts(
        e: &Env,
        caller: Address,
        owners: Vec<Address>,
        collection_id: u64,
        fractions: u32,
        metadata_hashes: Vec<Bytes>,
    ) -> Result<Vec<u32>, NFTError> {
        batch::batch_mint_nfts(e, caller, owners, collection_id, fractions, metadata_hashes)
    }

    pub fn batch_transfer_nfts(
        e: &Env,
        caller: Address,
        token_ids: Vec<u64>,
        recipients: Vec<Address>,
    ) -> Result<(), NFTError> {
        caller.require_auth();
        batch::batch_transfer_nfts(e, &caller, token_ids, recipients)
    }

    pub fn batch_query_ownership(
        e: &Env,
        token_ids: Vec<u64>,
    ) -> Result<Vec<(u64, EducationalNFT)>, NFTError> {
        batch::batch_query_ownership(e, token_ids)
    }

    // ========================================
    // MARKETPLACE FEATURES
    // ========================================

    /// List an NFT for sale or auction
    pub fn list_nft(
        e: &Env,
        caller: Address,
        token_id: u64,
        price: i128,
        auction_end: u64,
        royalty_rate: u32,
    ) -> Result<(), utils::NFTError> {
        caller.require_auth();
        marketplace::list_nft(e, &caller, token_id, price, auction_end, royalty_rate)
    }

    /// Buy an NFT from the marketplace
    pub fn buy_nft(
        e: &Env,
        caller: Address,
        token_id: u64,
        payment_amount: i128,
    ) -> Result<(), utils::NFTError> {
        caller.require_auth();
        marketplace::buy_nft(e, &caller, token_id, payment_amount)
    }

    /// Place a bid on an auction
    pub fn place_bid(
        e: &Env,
        caller: Address,
        token_id: u64,
        bid_amount: i128,
    ) -> Result<(), utils::NFTError> {
        caller.require_auth();
        marketplace::place_bid(e, &caller, token_id, bid_amount)
    }

    /// Settle an auction and transfer NFT to highest bidder
    pub fn settle_auction(e: &Env, caller: Address, token_id: u64) -> Result<(), utils::NFTError> {
        caller.require_auth();
        marketplace::settle_auction(e, &caller, token_id)
    }

    /// Cancel a listing
    pub fn cancel_listing(e: &Env, caller: Address, token_id: u64) -> Result<(), utils::NFTError> {
        caller.require_auth();
        marketplace::cancel_listing(e, &caller, token_id)
    }

    /// Get listing details for a specific NFT
    pub fn get_listing(e: &Env, token_id: u64) -> Option<marketplace::Listing> {
        marketplace::get_listing(e, token_id)
    }

    /// Get all bids for a specific NFT
    pub fn get_bids(e: &Env, token_id: u64) -> Vec<marketplace::Bid> {
        marketplace::get_bids(e, token_id)
    }

    /// Get highest bid for a specific NFT
    pub fn get_highest_bid(e: &Env, token_id: u64) -> Option<marketplace::Bid> {
        marketplace::get_highest_bid(e, token_id)
    }

    /// Get sales history for a specific NFT
    pub fn get_sales_history(e: &Env, token_id: u64) -> Vec<marketplace::Sale> {
        marketplace::get_sales_history(e, token_id)
    }

    /// Get price history for a specific NFT
    pub fn get_price_history(e: &Env, token_id: u64) -> Option<marketplace::PriceHistory> {
        marketplace::get_price_history(e, token_id)
    }

    /// Calculate average price for a specific NFT
    pub fn get_average_price(e: &Env, token_id: u64) -> Option<i128> {
        marketplace::calculate_average_price(e, token_id)
    }

    /// Get all active listings (placeholder for production indexing)
    pub fn get_active_listings(e: &Env) -> Vec<marketplace::Listing> {
        marketplace::get_active_listings(e)
    }

    /// Get listings by seller (placeholder for production indexing)
    pub fn get_listings_by_seller(e: &Env, seller: Address) -> Vec<marketplace::Listing> {
        marketplace::get_listings_by_seller(e, &seller)
    }

    // ========================================
    // GOVERNANCE FEATURES
    // ========================================

    /// Initialize governance system (only callable by owner)
    pub fn initialize_governance(e: &Env, caller: Address) -> Result<(), utils::NFTError> {
        caller.require_auth();
        // TODO: Check if caller is owner
        governance::initialize_governance(e);
        Ok(())
    }

    /// Create a new governance proposal
    pub fn create_proposal(
        e: &Env,
        caller: Address,
        proposal_type: governance::ProposalType,
        title: String,
        description: String,
        vote_end: u64,
    ) -> Result<u64, utils::NFTError> {
        caller.require_auth();
        governance::create_proposal(e, &caller, proposal_type, title, description, vote_end)
    }

    /// Vote on a governance proposal
    pub fn vote_on_proposal(
        e: &Env,
        caller: Address,
        proposal_id: u64,
        vote: bool,
    ) -> Result<(), utils::NFTError> {
        caller.require_auth();
        governance::vote_on_proposal(e, &caller, proposal_id, vote)
    }

    /// Finalize a proposal after voting period ends
    pub fn finalize_proposal(
        e: &Env,
        caller: Address,
        proposal_id: u64,
    ) -> Result<(), utils::NFTError> {
        caller.require_auth();
        governance::finalize_proposal(e, &caller, proposal_id)
    }

    /// Get proposal details
    pub fn get_proposal(e: &Env, proposal_id: u64) -> Option<governance::Proposal> {
        governance::get_proposal(e, proposal_id)
    }

    /// Get vote details for a specific voter and proposal
    pub fn get_vote(e: &Env, proposal_id: u64, voter: Address) -> Option<governance::Vote> {
        governance::get_vote(e, proposal_id, &voter)
    }

    /// Get voter eligibility information
    pub fn get_voter_eligibility(e: &Env, voter: Address) -> governance::VoterEligibility {
        governance::get_voter_eligibility(e, &voter)
    }

    /// Get current governance configuration
    pub fn get_governance_config(e: &Env) -> governance::GovernanceConfig {
        governance::get_governance_config(e)
    }

    /// Update governance configuration (restricted access)
    pub fn update_governance_config(
        e: &Env,
        caller: Address,
        config: governance::GovernanceConfig,
    ) -> Result<(), utils::NFTError> {
        caller.require_auth();
        // TODO: Check if caller has permission to update config
        governance::update_governance_config(e, &caller, config)
    }

    /// Get active proposals (placeholder for production indexing)
    pub fn get_active_proposals(e: &Env) -> Vec<governance::Proposal> {
        governance::get_active_proposals(e)
    }

    /// Get proposals by creator (placeholder for production indexing)
    pub fn get_proposals_by_creator(e: &Env, creator: Address) -> Vec<governance::Proposal> {
        governance::get_proposals_by_creator(e, &creator)
    }

    /// Get all votes for a proposal (placeholder for production indexing)
    pub fn get_proposal_votes(e: &Env, proposal_id: u64) -> Vec<governance::Vote> {
        governance::get_proposal_votes(e, proposal_id)
    }
}

#[default_impl]
#[contractimpl]
impl NonFungibleToken for EducationalNFTContract {
    type ContractType = nft::EducationalNFTStorage;
}

#[default_impl]
#[contractimpl]
impl Ownable for EducationalNFTContract {}

#[cfg(test)]
mod tests;

#[cfg(test)]
mod social_tests;

#[cfg(test)]
mod marketplace_tests;

#[cfg(test)]
mod governance_tests;
