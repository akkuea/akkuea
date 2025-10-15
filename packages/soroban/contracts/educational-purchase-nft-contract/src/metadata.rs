use crate::AkkueaPurchaseNFTArgs;
use crate::AkkueaPurchaseNFTClient;
use soroban_sdk::{contractimpl, Address, Env, Map, String, Vec};

#[contractimpl]
impl super::AkkueaPurchaseNFT {
    /// Update NFT metadata (admin only)
    pub fn update_metadata(
        env: Env,
        admin: Address,
        token_id: u32,
        name: String,
        description: String,
        attributes: Vec<String>,
    ) {
        Self::check_admin(&env, &admin);
        admin.require_auth();

        let mut nft: crate::NFTDetail = env
            .storage()
            .persistent()
            .get(&token_id)
            .expect("NFT does not exist");

        // Update base metadata fields without changing purchase data
        let mut updated_metadata = nft.metadata.clone();
        updated_metadata.name = name;
        updated_metadata.description = description;
        updated_metadata.attributes = attributes;

        // Update NFT with new metadata
        nft.metadata = updated_metadata;
        env.storage().persistent().set(&token_id, &nft);

        // Log the metadata update event
        env.events()
            .publish(("update", "metadata"), (admin, token_id));
    }

    /// Update purchase metadata details (admin only)
    pub fn update_purchase_metadata(
        env: Env,
        admin: Address,
        token_id: u32,
        purchase_id: String,
        amount: i128,
        currency: String,
        product_id: String,
        product_name: String,
        additional_attributes: Map<String, String>,
    ) {
        Self::check_admin(&env, &admin);
        admin.require_auth();

        let mut nft: crate::NFTDetail = env
            .storage()
            .persistent()
            .get(&token_id)
            .expect("NFT does not exist");

        // Preserve original timestamp from the blockchain
        let original_timestamp = nft.metadata.purchase_data.timestamp;

        // Update purchase data
        let updated_purchase_data = crate::PurchaseMetadata {
            purchase_id,
            timestamp: original_timestamp, // Keep original timestamp
            amount,
            currency,
            product_id,
            product_name,
            additional_attributes,
        };

        // Update NFT with new purchase data
        let mut updated_metadata = nft.metadata.clone();
        updated_metadata.purchase_data = updated_purchase_data;
        nft.metadata = updated_metadata;

        env.storage().persistent().set(&token_id, &nft);

        // Log the purchase metadata update event
        env.events()
            .publish(("update", "purchase_metadata"), (admin, token_id));
    }

    /// Get NFT metadata
    pub fn get_metadata(env: Env, token_id: u32) -> crate::NFTMetadata {
        let nft: crate::NFTDetail = env
            .storage()
            .persistent()
            .get(&token_id)
            .expect("NFT does not exist");
        nft.metadata
    }

    /// Get purchase data specifically
    pub fn get_purchase_data(env: Env, token_id: u32) -> crate::PurchaseMetadata {
        let nft: crate::NFTDetail = env
            .storage()
            .persistent()
            .get(&token_id)
            .expect("NFT does not exist");
        nft.metadata.purchase_data
    }

    /// Add or update attribute in additional_attributes
    pub fn add_attribute(env: Env, admin: Address, token_id: u32, key: String, value: String) {
        Self::check_admin(&env, &admin);
        admin.require_auth();

        let mut nft: crate::NFTDetail = env
            .storage()
            .persistent()
            .get(&token_id)
            .expect("NFT does not exist");

        // Add/update the attribute
        let mut updated_metadata = nft.metadata.clone();
        let mut updated_purchase_data = updated_metadata.purchase_data.clone();
        let mut attributes = updated_purchase_data.additional_attributes.clone();

        attributes.set(key.clone(), value.clone());
        updated_purchase_data.additional_attributes = attributes;
        updated_metadata.purchase_data = updated_purchase_data;
        nft.metadata = updated_metadata;

        env.storage().persistent().set(&token_id, &nft);

        // Log the attribute update event
        env.events()
            .publish(("update", "attribute"), (admin, token_id, key, value));
    }
}
