use crate::datatype::{AchievementBadge, NFTTemplate, VerificationLevel, NFT};
use crate::storage::{
    ACHIEVEMENT_BADGES, BADGE_COUNTER, NFTS, NFT_COUNTER, NFT_TEMPLATES, TEMPLATE_COUNTER,
};
use crate::utils::Utils;
use soroban_sdk::{symbol_short, Address, BytesN, Env, Map, String, Vec};

/// NFT implementation for educator verification credentials
pub struct NFTImplementation;

impl NFTImplementation {
    /// Initialize the NFT contract and return its address
    pub fn initialize_nft(env: Env, _admin: Address) -> Address {
        // Check that it's not already initialized
        if env.storage().instance().has(&symbol_short!("token")) {
            panic!("already initialized");
        }

        let contract_address = env.current_contract_address();
        // We don't use token here, but save it for future use

        // Store the token_id
        env.storage()
            .instance()
            .set(&symbol_short!("token"), &contract_address);
        contract_address
    }

    /// Mint a new NFT for an educator with a specific verification level
    pub fn mint_nft(
        env: Env,
        admin: Address,
        _recipient: Address,
        level: VerificationLevel,
        specialties: Vec<String>,
    ) -> String {
        admin.require_auth();

        let _token_id = env
            .storage()
            .instance()
            .get(&symbol_short!("token"))
            .unwrap_or_else(|| NFTImplementation::initialize_nft(env.clone(), admin.clone()));

        // Create a unique ID using a counter
        let counter: u32 = env
            .storage()
            .instance()
            .get(&symbol_short!("counter"))
            .unwrap_or(0);
        let nft_id = String::from_str(&env, "NFT");
        env.storage()
            .instance()
            .set(&symbol_short!("counter"), &(counter + 1));

        #[cfg(not(test))]
        {
            let token_client = soroban_sdk::token::Client::new(&env, &_token_id);
            token_client.transfer(&admin, &_recipient, &1);
        }

        // Store the metadata
        let metadata = (level, specialties);
        env.storage().persistent().set(&nft_id, &metadata);

        nft_id
    }

    /// Burn an NFT by its ID, removing it from circulation
    pub fn burn_nft(env: Env, nft_id: String) {
        let _token_id: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("token"))
            .unwrap_or_else(|| panic!("Token not initialized"));

        #[cfg(not(test))]
        {
            let token_client = soroban_sdk::token::Client::new(&env, &_token_id);
            let burn_address = env.current_contract_address();

            burn_address.require_auth();

            // Transfer to the burn address
            token_client.transfer(&burn_address, &burn_address, &1);
        }

        // Remove the metadata
        env.storage().persistent().remove(&nft_id);
    }

    /// Create a new dynamic NFT with metadata and template (internal function)
    pub fn create_nft_internal(
        env: Env,
        admin: Address,
        owner: Address,
        template_id: u32,
        is_badge: bool,
        initial_metadata: Map<String, String>,
    ) -> BytesN<32> {
        admin.require_auth();

        let nft_id = Utils::generate_nft_id(&env, &owner, template_id);
        let current_time = env.ledger().timestamp();

        let nft = NFT {
            id: nft_id.clone(),
            metadata: initial_metadata,
            template_id,
            is_badge,
            owner: owner.clone(),
            creation_timestamp: current_time,
            last_update: current_time,
            upgrade_level: 1,
        };

        // Store the NFT
        env.storage().persistent().set(&nft_id, &nft);

        // Update NFTs map
        let mut nfts: Map<BytesN<32>, NFT> = env
            .storage()
            .persistent()
            .get(&NFTS)
            .unwrap_or_else(|| Map::new(&env));
        nfts.set(nft_id.clone(), nft);
        env.storage().persistent().set(&NFTS, &nfts);

        // Increment NFT counter
        let counter: u32 = env.storage().persistent().get(&NFT_COUNTER).unwrap_or(0);
        env.storage().persistent().set(&NFT_COUNTER, &(counter + 1));

        nft_id
    }

    /// Update NFT metadata dynamically
    pub fn update_nft_metadata(
        env: Env,
        owner: Address,
        nft_id: BytesN<32>,
        new_metadata: Map<String, String>,
    ) -> bool {
        owner.require_auth();

        let mut nfts: Map<BytesN<32>, NFT> = env
            .storage()
            .persistent()
            .get(&NFTS)
            .unwrap_or_else(|| Map::new(&env));

        if let Some(mut nft) = nfts.get(nft_id.clone()) {
            if nft.owner != owner {
                panic!("not authorized owner");
            }

            nft.metadata = new_metadata;
            nft.last_update = env.ledger().timestamp();

            // Store updated NFT
            nfts.set(nft_id.clone(), nft.clone());
            env.storage().persistent().set(&NFTS, &nfts);
            env.storage().persistent().set(&nft_id, &nft);

            true
        } else {
            false
        }
    }

    /// Upgrade an existing NFT with new attributes
    pub fn upgrade_nft(
        env: Env,
        owner: Address,
        nft_id: BytesN<32>,
        additional_metadata: Map<String, String>,
    ) -> bool {
        owner.require_auth();

        let mut nfts: Map<BytesN<32>, NFT> = env
            .storage()
            .persistent()
            .get(&NFTS)
            .unwrap_or_else(|| Map::new(&env));

        if let Some(mut nft) = nfts.get(nft_id.clone()) {
            if nft.owner != owner {
                panic!("not authorized owner");
            }

            // Merge additional metadata with existing metadata
            for (key, value) in additional_metadata.iter() {
                nft.metadata.set(key, value);
            }

            nft.upgrade_level += 1;
            nft.last_update = env.ledger().timestamp();

            // Store updated NFT
            nfts.set(nft_id.clone(), nft.clone());
            env.storage().persistent().set(&NFTS, &nfts);
            env.storage().persistent().set(&nft_id, &nft);

            true
        } else {
            false
        }
    }

    /// Create a new NFT template for visual rendering
    pub fn create_nft_template(
        env: Env,
        admin: Address,
        name: String,
        description: String,
        image_url: String,
        attributes: Map<String, String>,
        is_badge_template: bool,
    ) -> u32 {
        admin.require_auth();

        let template_id = env
            .storage()
            .persistent()
            .get(&TEMPLATE_COUNTER)
            .unwrap_or(1);

        let template = NFTTemplate {
            template_id,
            name,
            description,
            image_url,
            attributes,
            is_badge_template,
        };

        // Store the template
        env.storage().persistent().set(&template_id, &template);

        // Update templates map
        let mut templates: Map<u32, NFTTemplate> = env
            .storage()
            .persistent()
            .get(&NFT_TEMPLATES)
            .unwrap_or_else(|| Map::new(&env));
        templates.set(template_id, template);
        env.storage().persistent().set(&NFT_TEMPLATES, &templates);

        // Increment template counter
        env.storage()
            .persistent()
            .set(&TEMPLATE_COUNTER, &(template_id + 1));

        template_id
    }

    /// Issue an achievement badge NFT for educators
    pub fn issue_badge(
        env: Env,
        admin: Address,
        educator: Address,
        badge_name: String,
        badge_description: String,
        criteria: String,
        required_tier: u32,
        template_id: u32,
    ) -> BytesN<32> {
        admin.require_auth();

        let badge_id = Utils::generate_badge_criteria_hash(&env, &criteria, required_tier);

        let achievement_badge = AchievementBadge {
            badge_id: badge_id.clone(),
            name: badge_name.clone(),
            description: badge_description.clone(),
            criteria,
            template_id,
            required_tier,
            is_active: true,
        };

        // Store the badge configuration
        env.storage()
            .persistent()
            .set(&badge_id, &achievement_badge);

        // Update badges map
        let mut badges: Map<BytesN<32>, AchievementBadge> = env
            .storage()
            .persistent()
            .get(&ACHIEVEMENT_BADGES)
            .unwrap_or_else(|| Map::new(&env));
        badges.set(badge_id.clone(), achievement_badge);
        env.storage().persistent().set(&ACHIEVEMENT_BADGES, &badges);

        // Create badge metadata
        let mut badge_metadata = Map::new(&env);
        badge_metadata.set(String::from_str(&env, "name"), badge_name);
        badge_metadata.set(String::from_str(&env, "description"), badge_description);
        badge_metadata.set(
            String::from_str(&env, "type"),
            String::from_str(&env, "achievement_badge"),
        );
        // Convert required_tier to string representation for metadata
        let tier_str = match required_tier {
            1 => "1",
            2 => "2",
            3 => "3",
            4 => "4",
            _ => "0",
        };
        badge_metadata.set(
            String::from_str(&env, "required_tier"),
            String::from_str(&env, tier_str),
        );

        // Create the badge NFT
        let nft_id = Self::create_nft_internal(
            env.clone(),
            admin,
            educator,
            template_id,
            true, // is_badge = true
            badge_metadata,
        );

        // Increment badge counter
        let counter: u32 = env.storage().persistent().get(&BADGE_COUNTER).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&BADGE_COUNTER, &(counter + 1));

        nft_id
    }

    /// Get NFT information
    pub fn get_nft_info(env: Env, nft_id: BytesN<32>) -> Option<NFT> {
        env.storage().persistent().get(&nft_id)
    }

    /// List all NFTs associated with a user, including badges
    pub fn list_nfts(env: Env, owner: Address) -> Vec<NFT> {
        let nfts: Map<BytesN<32>, NFT> = env
            .storage()
            .persistent()
            .get(&NFTS)
            .unwrap_or_else(|| Map::new(&env));

        let mut owner_nfts = Vec::new(&env);
        for (_, nft) in nfts.iter() {
            if nft.owner == owner {
                owner_nfts.push_back(nft);
            }
        }

        owner_nfts
    }

    /// Get NFT template information
    pub fn get_nft_template(env: Env, template_id: u32) -> Option<NFTTemplate> {
        env.storage().persistent().get(&template_id)
    }

    /// Get achievement badge information
    pub fn get_achievement_badge(env: Env, badge_id: BytesN<32>) -> Option<AchievementBadge> {
        env.storage().persistent().get(&badge_id)
    }
}
