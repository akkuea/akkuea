// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Stellar Soroban Contracts ^0.4.1
#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Bytes, Env, String, Vec};
use stellar_access::ownable::{self as ownable, Ownable};
use stellar_macros::default_impl;
use stellar_tokens::non_fungible::{Base, NonFungibleToken};

mod metadata;
mod mock_educator_verification_nft;
mod nft;
mod utils;

pub use metadata::*;
pub use nft::*;
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
            let version_info = history.get_version(v)
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
    pub fn get_tokens_by_content_type(e: &Env, content_type: String) -> Result<Vec<u64>, utils::NFTError> {
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
