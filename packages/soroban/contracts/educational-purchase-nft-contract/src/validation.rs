use crate::AkkueaPurchaseNFTArgs;
use crate::AkkueaPurchaseNFTClient;
use crate::{AkkueaPurchaseNFT, TRANSACTION_MAPPING};
use soroban_sdk::{contractimpl, Address, BytesN, Env, Map, String};

#[contractimpl]
impl AkkueaPurchaseNFT {
    /// Validate and verify an NFT's authenticity
    pub fn verify_nft(env: Env, token_id: u32) -> bool {
        // Check if NFT exists
        if !env.storage().persistent().has(&token_id) {
            return false;
        }

        let nft: crate::NFTDetail = env
            .storage()
            .persistent()
            .get(&token_id)
            .expect("NFT does not exist");

        // Check transaction mapping consistency
        let txn_map: Map<BytesN<32>, u32> =
            env.storage().instance().get(&TRANSACTION_MAPPING).unwrap();

        // Clone the transaction_id before moving it
        let txn_id = nft.transaction_id.clone();

        if !txn_map.contains_key(txn_id.clone()) {
            return false;
        }

        let mapped_token_id = txn_map.get(txn_id).unwrap();
        if mapped_token_id != token_id {
            return false;
        }

        // NFT has passed all validation checks
        true
    }

    /// Verify an NFT belongs to a specific purchase transaction
    pub fn verify_purchase(env: Env, token_id: u32, purchase_id: String) -> bool {
        // Check if NFT exists
        if !env.storage().persistent().has(&token_id) {
            return false;
        }

        let nft: crate::NFTDetail = env
            .storage()
            .persistent()
            .get(&token_id)
            .expect("NFT does not exist");

        // Check if the purchase ID matches
        nft.metadata.purchase_data.purchase_id == purchase_id
    }

    /// Verify NFT ownership
    pub fn verify_ownership(env: Env, token_id: u32, address: Address) -> bool {
        // Check if NFT exists
        if !env.storage().persistent().has(&token_id) {
            return false;
        }

        let nft: crate::NFTDetail = env
            .storage()
            .persistent()
            .get(&token_id)
            .expect("NFT does not exist");

        // Check if the address is the owner
        nft.owner == address
    }

    /// Get a comprehensive validation report
    pub fn validation_report(env: Env, token_id: u32) -> Map<String, bool> {
        let mut result: Map<String, bool> = Map::new(&env); // Make the map mutable

        // Check if NFT exists
        if !env.storage().persistent().has(&token_id) {
            return result;
        }

        let nft: crate::NFTDetail = env
            .storage()
            .persistent()
            .get(&token_id)
            .expect("NFT does not exist");

        // Run validation checks
        let exists = true;

        // Check transaction mapping
        let txn_map: Map<BytesN<32>, u32> =
            env.storage().instance().get(&TRANSACTION_MAPPING).unwrap();

        // Clone the transaction_id before moving it
        let txn_id = nft.transaction_id.clone();

        let txn_consistency =
            txn_map.contains_key(txn_id.clone()) && txn_map.get(txn_id).unwrap() == token_id;

        // Build the report
        result.set(String::from_str(&env, "exists"), exists);
        result.set(
            String::from_str(&env, "transaction_consistency"),
            txn_consistency,
        );

        result
    }
}
