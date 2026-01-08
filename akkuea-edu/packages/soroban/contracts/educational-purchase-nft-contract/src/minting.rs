use crate::AkkueaPurchaseNFTArgs;
use crate::AkkueaPurchaseNFTClient;
use crate::{
    AkkueaPurchaseNFT, NFTDetail, NFTMetadata, PurchaseMetadata, COUNTER_KEY, TRANSACTION_MAPPING,
};
use soroban_sdk::{contractimpl, contracttype, Address, BytesN, Env, Map, String, Vec};

#[derive(Clone)]
#[contracttype]
pub struct PurchaseNFTData {
    pub buyer: Address,
    pub seller: Address,
    pub transaction_id: BytesN<32>,
    pub purchase_id: String,
    pub amount: i128,
    pub currency: String,
    pub product_info: ProductInfo,
    pub nft_metadata: NFTMetaInput,
}

#[derive(Clone)]
#[contracttype]
pub struct ProductInfo {
    pub product_id: String,
    pub product_name: String,
}

#[derive(Clone)]
#[contracttype]
pub struct NFTMetaInput {
    pub name: String,
    pub description: String,
    pub attributes: Vec<String>,
    pub additional_attributes: Map<String, String>,
}

#[contractimpl]
impl AkkueaPurchaseNFT {
    /// Mint a new NFT representing proof of purchase using a structured input
    pub fn mint_proof_of_purchase(env: Env, purchase_data: PurchaseNFTData) -> u32 {
        // Extract data from the input structure
        let buyer = purchase_data.buyer;
        let seller = purchase_data.seller;
        let transaction_id = purchase_data.transaction_id.clone(); // Clone to avoid moved value
        let purchase_id = purchase_data.purchase_id.clone(); // Clone to avoid moved value
        let amount = purchase_data.amount;
        let currency = purchase_data.currency;
        let product_id = purchase_data.product_info.product_id;
        let product_name = purchase_data.product_info.product_name;
        let name = purchase_data.nft_metadata.name;
        let description = purchase_data.nft_metadata.description;
        let attributes = purchase_data.nft_metadata.attributes;
        let additional_attributes = purchase_data.nft_metadata.additional_attributes;

        // Ensure transaction authenticity
        seller.require_auth();

        // Validate transaction hasn't been used before
        let mut txn_map: Map<BytesN<32>, u32> =
            env.storage().instance().get(&TRANSACTION_MAPPING).unwrap();
        if txn_map.contains_key(transaction_id.clone()) {
            // Clone before use
            panic!("Transaction already has an associated NFT");
        }

        // Get current timestamp from ledger
        let timestamp = env.ledger().timestamp();

        // Create purchase metadata
        let purchase_metadata = PurchaseMetadata {
            purchase_id: purchase_id.clone(), // Clone before use
            timestamp,
            amount,
            currency,
            product_id,
            product_name,
            additional_attributes,
        };

        // Create NFT metadata
        let metadata = NFTMetadata {
            name,
            description,
            purchase_data: purchase_metadata,
            attributes,
        };

        // Create NFT detail
        let nft = NFTDetail {
            owner: buyer.clone(),
            seller: seller.clone(),
            metadata,
            transaction_id: transaction_id.clone(), // Clone before use
        };

        // Increment token counter
        let mut current_id: u32 = env.storage().instance().get(&COUNTER_KEY).unwrap();
        current_id += 1;
        env.storage().instance().set(&COUNTER_KEY, &current_id);

        // Store NFT
        env.storage().persistent().set(&current_id, &nft);

        // Map transaction to NFT for future reference
        txn_map.set(transaction_id.clone(), current_id); // Clone before use
        env.storage().instance().set(&TRANSACTION_MAPPING, &txn_map);

        // Log the minting event
        env.events().publish(
            ("mint", "proof_of_purchase"),
            (buyer, seller, purchase_id, current_id),
        );

        // Return the token ID
        current_id
    }

    /// Simplified mint function with essential parameters
    pub fn simple_mint(
        env: Env,
        buyer: Address,
        seller: Address,
        transaction_id: BytesN<32>,
        purchase_id: String,
        amount: i128,
        product_name: String,
    ) -> u32 {
        // Ensure transaction authenticity
        seller.require_auth();

        // Clone values to avoid ownership issues
        let transaction_id_clone = transaction_id.clone();
        let purchase_id_clone = purchase_id.clone();
        let product_name_clone = product_name.clone();

        // Validate transaction hasn't been used before
        let mut txn_map: Map<BytesN<32>, u32> =
            env.storage().instance().get(&TRANSACTION_MAPPING).unwrap();
        if txn_map.contains_key(transaction_id_clone.clone()) {
            panic!("Transaction already has an associated NFT");
        }

        // Get current timestamp from ledger
        let timestamp = env.ledger().timestamp();

        // Create default attributes
        let additional_attributes: Map<String, String> = Map::new(&env);

        // Create purchase metadata
        let purchase_data = PurchaseMetadata {
            purchase_id: purchase_id_clone.clone(),
            timestamp,
            amount,
            currency: String::from_str(&env, "XLM"),
            product_id: String::from_str(&env, "default"),
            product_name: product_name_clone,
            additional_attributes,
        };

        // Create NFT metadata
        let metadata = NFTMetadata {
            name: String::from_str(&env, "Proof of Purchase"),
            description: String::from_str(&env, "This NFT certifies your purchase"),
            purchase_data,
            attributes: Vec::new(&env),
        };

        // Create NFT detail
        let nft = NFTDetail {
            owner: buyer.clone(),
            seller: seller.clone(),
            metadata,
            transaction_id: transaction_id_clone.clone(),
        };

        // Increment token counter
        let mut current_id: u32 = env.storage().instance().get(&COUNTER_KEY).unwrap();
        current_id += 1;
        env.storage().instance().set(&COUNTER_KEY, &current_id);

        // Store NFT
        env.storage().persistent().set(&current_id, &nft);

        // Map transaction to NFT for future reference
        txn_map.set(transaction_id_clone, current_id);
        env.storage().instance().set(&TRANSACTION_MAPPING, &txn_map);

        // Log the minting event
        env.events().publish(
            ("mint", "proof_of_purchase"),
            (buyer, seller, purchase_id, current_id),
        );

        // Return the token ID
        current_id
    }

    /// Admin function to batch mint NFTs for historical purchases (using simplified parameters)
    pub fn admin_batch_mint(
        env: Env,
        admin: Address,
        batch_data: Vec<(Address, Address, BytesN<32>, String, i128, String)>,
    ) -> Vec<u32> {
        // Check admin privileges
        Self::check_admin(&env, &admin);
        admin.require_auth();

        let mut minted_ids: Vec<u32> = Vec::new(&env);

        // Process each batch entry
        for data in batch_data.iter() {
            let (buyer, seller, txn_id, purchase_id, amount, product_name) = data.clone();

            // Clone the transaction ID before checking
            let txn_id_clone = txn_id.clone();

            // Skip if transaction already has an NFT
            let txn_map: Map<BytesN<32>, u32> =
                env.storage().instance().get(&TRANSACTION_MAPPING).unwrap();
            if txn_map.contains_key(txn_id_clone) {
                continue;
            }

            // Mint the NFT with cloned values
            let token_id = Self::simple_mint(
                env.clone(),
                buyer,
                seller,
                txn_id.clone(),
                purchase_id,
                amount,
                product_name,
            );

            minted_ids.push_back(token_id);
        }

        minted_ids
    }
}
