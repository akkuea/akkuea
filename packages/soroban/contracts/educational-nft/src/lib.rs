// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Stellar Soroban Contracts ^0.4.1
#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Bytes, Env};
use stellar_access::ownable::{self as ownable, Ownable};
use stellar_macros::default_impl;
use stellar_tokens::non_fungible::{Base, NonFungibleToken};

mod mock_educator_verification_nft;
mod nft;
mod utils;

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
