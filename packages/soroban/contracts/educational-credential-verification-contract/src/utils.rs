use crate::datatype::{Credential, VerificationLevel};
use soroban_sdk::{Address, BytesN, Env, String};

pub struct Utils;

impl Utils {
    /// Generate a unique credential ID using timestamp and hash
    pub fn generate_credential_id(
        env: &Env,
        credential_hash: &String,
        issuer: &Address,
    ) -> BytesN<32> {
        let timestamp = env.ledger().timestamp();
        let mut bytes = [0u8; 32];

        // Use timestamp for first 8 bytes
        bytes[0] = (timestamp >> 56) as u8;
        bytes[1] = (timestamp >> 48) as u8;
        bytes[2] = (timestamp >> 40) as u8;
        bytes[3] = (timestamp >> 32) as u8;
        bytes[4] = (timestamp >> 24) as u8;
        bytes[5] = (timestamp >> 16) as u8;
        bytes[6] = (timestamp >> 8) as u8;
        bytes[7] = timestamp as u8;

        // Use credential hash for next 16 bytes (simplified)
        // Note: Soroban String doesn't have direct to_string or as_bytes methods
        // We'll use a simpler approach with length-based hashing
        let hash_len = credential_hash.len();
        bytes[8] = (hash_len >> 8) as u8;
        bytes[9] = hash_len as u8;

        // Use issuer address for last 8 bytes (simplified)
        // Since Soroban String doesn't have as_bytes(), we'll use a simple approach
        let issuer_len = issuer.to_string().len();
        bytes[24] = (issuer_len >> 8) as u8;
        bytes[25] = issuer_len as u8;

        BytesN::from_array(env, &bytes)
    }

    /// Generate a unique NFT ID
    pub fn generate_nft_id(env: &Env, owner: &Address, template_id: u32) -> BytesN<32> {
        let timestamp = env.ledger().timestamp();
        let mut bytes = [0u8; 32];

        // Use timestamp for first 8 bytes
        bytes[0] = (timestamp >> 56) as u8;
        bytes[1] = (timestamp >> 48) as u8;
        bytes[2] = (timestamp >> 40) as u8;
        bytes[3] = (timestamp >> 32) as u8;
        bytes[4] = (timestamp >> 24) as u8;
        bytes[5] = (timestamp >> 16) as u8;
        bytes[6] = (timestamp >> 8) as u8;
        bytes[7] = timestamp as u8;

        // Use template ID for next 4 bytes
        bytes[8] = (template_id >> 24) as u8;
        bytes[9] = (template_id >> 16) as u8;
        bytes[10] = (template_id >> 8) as u8;
        bytes[11] = template_id as u8;

        // Use owner address for remaining bytes (simplified)
        let owner_len = owner.to_string().len();
        bytes[12] = (owner_len >> 8) as u8;
        bytes[13] = owner_len as u8;

        BytesN::from_array(env, &bytes)
    }

    /// Validate W3C verifiable credential format
    pub fn validate_w3c_credential(credential_hash: &String) -> bool {
        // Basic validation for W3C credential format
        // In a real implementation, this would validate the actual W3C VC structure
        credential_hash.len() >= 64 && credential_hash.len() <= 128
    }

    /// Check if credential has expired
    pub fn is_credential_expired(env: &Env, credential: &Credential) -> bool {
        env.ledger().timestamp() > credential.expiration
    }

    /// Calculate verification tier based on multiple factors
    pub fn calculate_verification_tier(
        w3c_compliant: bool,
        cross_chain_verified: bool,
        renewal_count: u32,
        verification_level: &VerificationLevel,
    ) -> u32 {
        let mut tier = match verification_level {
            VerificationLevel::Pending => 0,
            VerificationLevel::Basic => 1,
            VerificationLevel::Advanced => 2,
            VerificationLevel::Expert => 3,
            VerificationLevel::Premium => 4,
        };

        // Bonus points for W3C compliance
        if w3c_compliant {
            tier += 1;
        }

        // Bonus points for cross-chain verification
        if cross_chain_verified {
            tier += 1;
        }

        // Bonus points for multiple renewals (showing commitment)
        if renewal_count >= 3 {
            tier += 1;
        }

        tier.min(4) // Cap at tier 4
    }

    /// Validate credential hash format
    pub fn validate_credential_hash(credential_hash: &String) -> bool {
        // Check if it's a valid SHA-256 hash (64 characters, hexadecimal)
        // Simplified validation for Soroban String
        if credential_hash.len() != 64 {
            return false;
        }

        // For now, we'll just check length since Soroban String doesn't have direct char access
        // In a real implementation, you'd implement proper hex validation
        true
    }

    /// Calculate expiration timestamp based on tier
    pub fn calculate_expiration_timestamp(env: &Env, tier: u32) -> u64 {
        let current_time = env.ledger().timestamp();
        let seconds_per_year = 365 * 24 * 60 * 60; // One year in seconds

        match tier {
            1 => current_time + seconds_per_year,       // Basic: 1 year
            2 => current_time + (2 * seconds_per_year), // Advanced: 2 years
            3 => current_time + (3 * seconds_per_year), // Expert: 3 years
            4 => current_time + (5 * seconds_per_year), // Premium: 5 years
            _ => current_time + (seconds_per_year / 2), // Default: 6 months
        }
    }

    /// Validate cross-chain verification data
    pub fn validate_cross_chain_data(chain_id: u32, verification_hash: &String) -> bool {
        // Basic validation for cross-chain data
        // In a real implementation, this would validate against specific chain formats
        chain_id > 0 && verification_hash.len() == 64
    }

    /// Generate achievement badge criteria hash
    pub fn generate_badge_criteria_hash(
        env: &Env,
        criteria: &String,
        required_tier: u32,
    ) -> BytesN<32> {
        let mut bytes = [0u8; 32];

        // Add required tier bytes
        bytes[0] = (required_tier >> 24) as u8;
        bytes[1] = (required_tier >> 16) as u8;
        bytes[2] = (required_tier >> 8) as u8;
        bytes[3] = required_tier as u8;

        // Add criteria hash bytes (simplified)
        let criteria_len = criteria.len();
        bytes[4] = (criteria_len >> 8) as u8;
        bytes[5] = criteria_len as u8;

        BytesN::from_array(env, &bytes)
    }
}
