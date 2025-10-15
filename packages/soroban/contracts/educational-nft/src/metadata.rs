use soroban_sdk::{contracttype, Address, Bytes, Env, Map, String};

use crate::utils::NFTError;

/// Educational content types for metadata schemas
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ContentType {
    Course,
    Certification,
    Workshop,
    Tutorial,
    Assignment,
    Assessment,
}

impl ContentType {
    pub fn as_string(&self) -> &'static str {
        match self {
            ContentType::Course => "Course",
            ContentType::Certification => "Certification",
            ContentType::Workshop => "Workshop",
            ContentType::Tutorial => "Tutorial",
            ContentType::Assignment => "Assignment",
            ContentType::Assessment => "Assessment",
        }
    }
}

/// Rich metadata structure for educational NFTs
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NFTMetadata {
    pub token_id: u64,
    pub version: u32,
    pub content_type: ContentType,
    pub ipfs_hash: Bytes,
    pub creator: Address,
    pub title: String,
    pub description: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub tags: Map<String, String>,
    pub is_active: bool,
}

/// Metadata version tracking for history
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MetadataVersion {
    pub version: u32,
    pub ipfs_hash: Bytes,
    pub creator: Address,
    pub created_at: u64,
    pub change_notes: String,
}

/// Metadata history structure
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MetadataHistory {
    pub token_id: u64,
    pub current_version: u32,
    pub versions: Map<u32, MetadataVersion>,
    pub total_versions: u32,
}

impl MetadataHistory {
    pub fn new(env: &Env, token_id: u64, initial_metadata: &NFTMetadata) -> Self {
        let mut versions = Map::new(env);
        let initial_version = MetadataVersion {
            version: 1,
            ipfs_hash: initial_metadata.ipfs_hash.clone(),
            creator: initial_metadata.creator.clone(),
            created_at: initial_metadata.created_at,
            change_notes: String::from_str(env, "Initial metadata creation"),
        };
        versions.set(1, initial_version);

        Self {
            token_id,
            current_version: 1,
            versions,
            total_versions: 1,
        }
    }

    pub fn add_version(&mut self, _env: &Env, new_metadata: &NFTMetadata, change_notes: String) {
        let new_version = self.current_version + 1;
        let version_entry = MetadataVersion {
            version: new_version,
            ipfs_hash: new_metadata.ipfs_hash.clone(),
            creator: new_metadata.creator.clone(),
            created_at: new_metadata.updated_at,
            change_notes,
        };

        self.versions.set(new_version, version_entry);
        self.current_version = new_version;
        self.total_versions += 1;
    }

    pub fn get_version(&self, version: u32) -> Option<MetadataVersion> {
        self.versions.get(version)
    }
}

/// IPFS/Arweave hash validation utilities
pub mod validation {
    use soroban_sdk::Bytes;

    use crate::utils::NFTError;

    /// Validates IPFS hash format (simplified validation)
    pub fn validate_ipfs_hash(ipfs_hash: &Bytes) -> Result<(), NFTError> {
        // IPFS hash should be at least 34 bytes for CIDv0 (Qm...) or 32+ for CIDv1
        if ipfs_hash.len() < 32 {
            return Err(NFTError::InvalidIPFSHash);
        }

        // Additional validation could be added here for specific hash formats
        Ok(())
    }

    /// Validates Arweave transaction ID format
    pub fn validate_arweave_hash(ar_hash: &Bytes) -> Result<(), NFTError> {
        // Arweave transaction IDs are typically 43 characters (base64url encoded)
        if ar_hash.len() != 43 {
            return Err(NFTError::InvalidArweaveHash);
        }

        Ok(())
    }

    /// Generic hash validation that supports both IPFS and Arweave
    pub fn validate_storage_hash(hash: &Bytes, hash_type: &str) -> Result<(), NFTError> {
        match hash_type {
            "ipfs" => validate_ipfs_hash(hash),
            "arweave" => validate_arweave_hash(hash),
            _ => Err(NFTError::UnsupportedHashType),
        }
    }
}

/// Storage keys for metadata management
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MetadataKey {
    Metadata(u64),                 // token_id -> NFTMetadata
    MetadataHistory(u64),          // token_id -> MetadataHistory
    CreatorMetadata(Address),      // creator -> Vec<u64> (token_ids)
    ContentTypeIndex(ContentType), // content_type -> Vec<u64> (token_ids)
    NextMetadataVersion(u64),      // token_id -> u32 (next version number)
}

/// Core metadata management functions
impl NFTMetadata {
    pub fn new(
        env: &Env,
        token_id: u64,
        content_type: ContentType,
        ipfs_hash: Bytes,
        creator: Address,
        title: String,
        description: String,
    ) -> Result<Self, NFTError> {
        // Validate IPFS hash
        validation::validate_ipfs_hash(&ipfs_hash)?;

        let current_time = env.ledger().timestamp();
        let tags = Map::new(env);

        Ok(Self {
            token_id,
            version: 1,
            content_type,
            ipfs_hash,
            creator,
            title,
            description,
            created_at: current_time,
            updated_at: current_time,
            tags,
            is_active: true,
        })
    }

    pub fn update_version(
        &self,
        env: &Env,
        new_ipfs_hash: Bytes,
        creator: Address,
        _change_notes: String,
    ) -> Result<Self, NFTError> {
        // Validate new IPFS hash
        validation::validate_ipfs_hash(&new_ipfs_hash)?;

        let current_time = env.ledger().timestamp();

        Ok(Self {
            token_id: self.token_id,
            version: self.version + 1,
            content_type: self.content_type.clone(),
            ipfs_hash: new_ipfs_hash,
            creator,
            title: self.title.clone(),
            description: self.description.clone(),
            created_at: self.created_at,
            updated_at: current_time,
            tags: self.tags.clone(),
            is_active: self.is_active,
        })
    }

    pub fn add_tag(&mut self, key: String, value: String) {
        self.tags.set(key, value);
    }

    pub fn remove_tag(&mut self, key: String) {
        self.tags.remove(key);
    }

    pub fn get_tag(&self, key: String) -> Option<String> {
        self.tags.get(key)
    }

    pub fn deactivate(&mut self, env: &Env) {
        self.is_active = false;
        self.updated_at = env.ledger().timestamp();
    }
}
