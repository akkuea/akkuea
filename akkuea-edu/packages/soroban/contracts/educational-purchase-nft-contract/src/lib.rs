#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Map, String, Symbol,
    Vec,
};

mod distribution;
mod metadata;
mod minting;
mod validation;

// Contract storage keys
const ADMIN_KEY: Symbol = symbol_short!("ADMIN");
const COUNTER_KEY: Symbol = symbol_short!("COUNTER");
const TRANSACTION_MAPPING: Symbol = symbol_short!("TXMAP");

// Enhanced NFT metadata for proof of purchase
#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct PurchaseMetadata {
    pub purchase_id: String,                        // Unique purchase identifier
    pub timestamp: u64,                             // Transaction timestamp
    pub amount: i128,                               // Transaction amount
    pub currency: String,                           // Currency used for transaction
    pub product_id: String,                         // ID of the purchased product
    pub product_name: String,                       // Name of the purchased product
    pub additional_attributes: Map<String, String>, // Additional flexible metadata
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct NFTMetadata {
    pub name: String,
    pub description: String,
    pub purchase_data: PurchaseMetadata,
    pub attributes: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct NFTDetail {
    pub owner: Address,  // Current owner (buyer)
    pub seller: Address, // Seller information
    pub metadata: NFTMetadata,
    pub transaction_id: BytesN<32>, // Reference to the actual blockchain transaction
}

#[contract]
pub struct AkkueaPurchaseNFT;

#[contractimpl]
impl AkkueaPurchaseNFT {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN_KEY) {
            panic!("Already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&ADMIN_KEY, &admin);
        env.storage().instance().set(&COUNTER_KEY, &0u32);

        // Initialize empty transaction mapping
        let txn_map: Map<BytesN<32>, u32> = Map::new(&env);
        env.storage().instance().set(&TRANSACTION_MAPPING, &txn_map);
    }

    fn check_admin(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&ADMIN_KEY).unwrap();
        if caller != &admin {
            panic!("Unauthorized: only admin can perform this action");
        }
    }

    // Get NFT information
    pub fn get_nft_info(env: Env, token_id: u32) -> NFTDetail {
        env.storage()
            .persistent()
            .get(&token_id)
            .expect("NFT does not exist")
    }

    // Check if transaction already has an NFT
    pub fn has_transaction_nft(env: Env, transaction_id: BytesN<32>) -> bool {
        let txn_map: Map<BytesN<32>, u32> =
            env.storage().instance().get(&TRANSACTION_MAPPING).unwrap();
        txn_map.contains_key(transaction_id)
    }

    // Get NFT token ID from transaction ID
    pub fn get_nft_by_transaction(env: Env, transaction_id: BytesN<32>) -> Option<u32> {
        let txn_map: Map<BytesN<32>, u32> =
            env.storage().instance().get(&TRANSACTION_MAPPING).unwrap();

        // Clone the transaction_id before using it to avoid ownership issues
        let txn_id = transaction_id.clone();

        if txn_map.contains_key(txn_id.clone()) {
            Some(txn_map.get(txn_id).unwrap())
        } else {
            None
        }
    }

    // Get current NFT count
    pub fn get_total_nfts(env: Env) -> u32 {
        env.storage().instance().get(&COUNTER_KEY).unwrap_or(0u32)
    }
}

#[cfg(test)]
mod test;
