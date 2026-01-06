use crate::datatype::{Credential, Educator, VerificationLevel};
use crate::nft::NFTImplementation;
use crate::storage::{
    ADMIN, AUTH_INST, CREDENTIALS, CREDENTIAL_COUNTER, CROSS_CHAIN_REGISTRY, EXPIRED_CREDENTIALS,
    REVIEWERS, SIGNATURES, VERIFIED_CREDS,
};
use crate::utils::Utils;
use soroban_sdk::{Address, BytesN, Env, Map, String, Vec};

pub struct VerificationSystem;

impl VerificationSystem {
    pub fn has_administrator(env: &Env) -> bool {
        env.storage().instance().has(&ADMIN)
    }

    pub fn verify_admin(env: &Env, admin: &Address) {
        let stored_admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        if admin != &stored_admin {
            panic!("not authorized");
        }
    }

    pub fn is_reviewer(env: &Env, reviewer: &Address) -> bool {
        let reviewers: Vec<Address> = env
            .storage()
            .persistent()
            .get(&REVIEWERS)
            .unwrap_or_else(|| Vec::new(env));
        reviewers.contains(reviewer)
    }

    pub fn add_reviewer(env: &Env, reviewer: &Address) {
        let mut reviewers: Vec<Address> = env
            .storage()
            .persistent()
            .get(&REVIEWERS)
            .unwrap_or_else(|| Vec::new(env));
        if !reviewers.contains(reviewer) {
            reviewers.push_back(reviewer.clone());
            env.storage().persistent().set(&REVIEWERS, &reviewers);
        }
    }

    pub fn remove_reviewer(env: &Env, reviewer: &Address) {
        let reviewers: Vec<Address> = env
            .storage()
            .persistent()
            .get(&REVIEWERS)
            .unwrap_or_else(|| Vec::new(env));

        let mut new_reviewers = Vec::new(env);
        for r in reviewers.iter() {
            if &r != reviewer {
                new_reviewers.push_back(r.clone());
            }
        }

        env.storage().persistent().set(&REVIEWERS, &new_reviewers);
    }

    pub fn verify_credentials(env: &Env, credentials: &Vec<String>, reviewer: &Address) -> bool {
        if !Self::is_reviewer(env, reviewer) {
            return false;
        }

        let verified_credentials: Map<String, bool> = env
            .storage()
            .persistent()
            .get(&VERIFIED_CREDS)
            .unwrap_or_else(|| Map::new(env));

        for credential in credentials.iter() {
            if let Some(is_verified) = verified_credentials.get(credential.clone()) {
                if !is_verified {
                    return false;
                }
                continue;
            }
            if !Self::is_valid_hash_format(env, &credential) {
                return false;
            }
            if !Self::verify_digital_signature(env, &credential, reviewer) {
                return false;
            }
            if !Self::verify_institution(env, &credential) {
                return false;
            }
        }
        true
    }

    fn is_valid_hash_format(_env: &Env, hash: &String) -> bool {
        hash.len() == 64
    }

    fn verify_digital_signature(env: &Env, credential: &String, reviewer: &Address) -> bool {
        let signatures: Map<String, Vec<Address>> = env
            .storage()
            .persistent()
            .get(&SIGNATURES)
            .unwrap_or_else(|| Map::new(env));
        signatures
            .get(credential.clone())
            .map_or(false, |s| s.contains(reviewer))
    }

    fn verify_institution(env: &Env, credential: &String) -> bool {
        let authorized_institutions: Vec<String> = env
            .storage()
            .persistent()
            .get(&AUTH_INST)
            .unwrap_or_else(|| Vec::new(env));
        authorized_institutions.contains(credential)
    }

    pub fn add_verified_credential(env: &Env, credential: String, reviewer: &Address) {
        if !Self::is_reviewer(env, reviewer) {
            panic!("not authorized reviewer");
        }

        let mut verified_credentials: Map<String, bool> = env
            .storage()
            .persistent()
            .get(&VERIFIED_CREDS)
            .unwrap_or_else(|| Map::new(env));
        verified_credentials.set(credential.clone(), true);
        env.storage()
            .persistent()
            .set(&VERIFIED_CREDS, &verified_credentials);

        let mut signatures: Map<String, Vec<Address>> = env
            .storage()
            .persistent()
            .get(&SIGNATURES)
            .unwrap_or_else(|| Map::new(env));
        let mut signers = signatures
            .get(credential.clone())
            .unwrap_or_else(|| Vec::new(env));

        if !signers.contains(reviewer) {
            signers.push_back(reviewer.clone());
            signatures.set(credential, signers);
            env.storage().persistent().set(&SIGNATURES, &signatures);
        }
    }

    pub fn add_authorized_institution(env: &Env, admin: &Address, institution_id: String) {
        Self::verify_admin(env, admin);
        let mut authorized_institutions: Vec<String> = env
            .storage()
            .persistent()
            .get(&AUTH_INST)
            .unwrap_or_else(|| Vec::new(env));
        if !authorized_institutions.contains(&institution_id) {
            authorized_institutions.push_back(institution_id);
            env.storage()
                .persistent()
                .set(&AUTH_INST, &authorized_institutions);
        }
    }

    pub fn mint_verification_nft(
        env: &Env,
        recipient: &Address,
        level: &VerificationLevel,
        specialties: &Vec<String>,
    ) -> String {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        NFTImplementation::mint_nft(
            env.clone(),
            admin,
            recipient.clone(),
            level.clone(),
            specialties.clone(),
        )
    }

    pub fn calculate_verification_level(
        _env: &Env,
        educators: &Map<Address, Educator>,
        educator_address: &Address,
    ) -> VerificationLevel {
        let educator = educators.get(educator_address.clone()).unwrap();

        if educator.reviews_count == 0 {
            return VerificationLevel::Basic;
        }

        let mut total_average_sum = 0;
        let mut rated_categories_count = 0;

        // Iterate through each category's weighted score and total weight.
        for (_, (total_score, total_weight)) in educator.ratings.iter() {
            if total_weight > 0 {
                // Calculate the average for this category.
                total_average_sum += total_score / total_weight;
                rated_categories_count += 1;
            }
        }

        if rated_categories_count == 0 {
            return VerificationLevel::Basic;
        }

        // Calculate the final average across all rated categories.
        let final_avg_rating = total_average_sum / rated_categories_count;

        // Enhanced tiered verification with Premium level
        match final_avg_rating {
            0..=3 => VerificationLevel::Basic,
            4..=6 => VerificationLevel::Advanced,
            7..=8 => VerificationLevel::Expert,
            _ => VerificationLevel::Premium,
        }
    }

    /// Create a new credential with tiered verification and W3C compliance
    pub fn create_credential(
        env: &Env,
        issuer: &Address,
        subject: &Address,
        credential_hash: String,
        tier: u32,
        w3c_compliant: bool,
    ) -> BytesN<32> {
        issuer.require_auth();

        if !Self::is_reviewer(env, issuer) {
            panic!("not authorized issuer");
        }

        if !Utils::validate_credential_hash(&credential_hash) {
            panic!("invalid credential hash format");
        }

        if w3c_compliant && !Utils::validate_w3c_credential(&credential_hash) {
            panic!("invalid W3C credential format");
        }

        let credential_id = Utils::generate_credential_id(env, &credential_hash, issuer);
        let expiration = Utils::calculate_expiration_timestamp(env, tier);

        let credential = Credential {
            id: credential_id.clone(),
            tier,
            expiration,
            w3c_compliant,
            issuer: issuer.clone(),
            subject: subject.clone(),
            credential_hash,
            cross_chain_verified: false,
            renewal_count: 0,
        };

        // Store the credential
        env.storage().persistent().set(&credential_id, &credential);

        // Update credentials map
        let mut credentials: Map<BytesN<32>, Credential> = env
            .storage()
            .persistent()
            .get(&CREDENTIALS)
            .unwrap_or_else(|| Map::new(env));
        credentials.set(credential_id.clone(), credential);
        env.storage().persistent().set(&CREDENTIALS, &credentials);

        // Increment credential counter
        let counter: u32 = env
            .storage()
            .persistent()
            .get(&CREDENTIAL_COUNTER)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&CREDENTIAL_COUNTER, &(counter + 1));

        credential_id
    }

    /// Renew an expired credential with updated expiration
    pub fn renew_credential(env: &Env, issuer: &Address, credential_id: BytesN<32>) -> bool {
        issuer.require_auth();

        if !Self::is_reviewer(env, issuer) {
            panic!("not authorized issuer");
        }

        let mut credentials: Map<BytesN<32>, Credential> = env
            .storage()
            .persistent()
            .get(&CREDENTIALS)
            .unwrap_or_else(|| Map::new(env));

        if let Some(mut credential) = credentials.get(credential_id.clone()) {
            // Update expiration and renewal count
            credential.expiration = Utils::calculate_expiration_timestamp(env, credential.tier);
            credential.renewal_count += 1;

            // Store updated credential
            credentials.set(credential_id.clone(), credential.clone());
            env.storage().persistent().set(&CREDENTIALS, &credentials);
            env.storage().persistent().set(&credential_id, &credential);

            // Remove from expired credentials if it was there
            let mut expired: Vec<BytesN<32>> = env
                .storage()
                .persistent()
                .get(&EXPIRED_CREDENTIALS)
                .unwrap_or_else(|| Vec::new(env));
            let mut new_expired = Vec::new(env);
            for exp_id in expired.iter() {
                if exp_id != credential_id {
                    new_expired.push_back(exp_id);
                }
            }
            env.storage()
                .persistent()
                .set(&EXPIRED_CREDENTIALS, &new_expired);

            true
        } else {
            false
        }
    }

    /// Verify credentials across compatible blockchains
    pub fn verify_cross_chain(
        env: &Env,
        verifier: &Address,
        credential_id: BytesN<32>,
        chain_id: u32,
        verification_hash: String,
    ) -> bool {
        verifier.require_auth();

        if !Self::is_reviewer(env, verifier) {
            panic!("not authorized verifier");
        }

        if !Utils::validate_cross_chain_data(chain_id, &verification_hash) {
            panic!("invalid cross-chain verification data");
        }

        let mut credentials: Map<BytesN<32>, Credential> = env
            .storage()
            .persistent()
            .get(&CREDENTIALS)
            .unwrap_or_else(|| Map::new(env));

        if let Some(mut credential) = credentials.get(credential_id.clone()) {
            credential.cross_chain_verified = true;

            // Store updated credential
            credentials.set(credential_id.clone(), credential.clone());
            env.storage().persistent().set(&CREDENTIALS, &credentials);
            env.storage().persistent().set(&credential_id, &credential);

            // Store cross-chain verification record
            let mut cross_chain_registry: Map<BytesN<32>, (u32, String)> = env
                .storage()
                .persistent()
                .get(&CROSS_CHAIN_REGISTRY)
                .unwrap_or_else(|| Map::new(env));
            cross_chain_registry.set(credential_id, (chain_id, verification_hash));
            env.storage()
                .persistent()
                .set(&CROSS_CHAIN_REGISTRY, &cross_chain_registry);

            true
        } else {
            false
        }
    }

    /// Get credential information including tier and expiration
    pub fn get_credential_info(env: &Env, credential_id: BytesN<32>) -> Option<Credential> {
        env.storage().persistent().get(&credential_id)
    }

    /// Check and mark expired credentials
    pub fn check_expired_credentials(env: &Env) {
        let credentials: Map<BytesN<32>, Credential> = env
            .storage()
            .persistent()
            .get(&CREDENTIALS)
            .unwrap_or_else(|| Map::new(env));

        let mut expired: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&EXPIRED_CREDENTIALS)
            .unwrap_or_else(|| Vec::new(env));

        for (id, credential) in credentials.iter() {
            if Utils::is_credential_expired(env, &credential) && !expired.contains(&id) {
                expired.push_back(id);
            }
        }

        env.storage()
            .persistent()
            .set(&EXPIRED_CREDENTIALS, &expired);
    }

    /// Get all credentials for a subject
    pub fn get_credentials_by_subject(env: &Env, subject: &Address) -> Vec<Credential> {
        let credentials: Map<BytesN<32>, Credential> = env
            .storage()
            .persistent()
            .get(&CREDENTIALS)
            .unwrap_or_else(|| Map::new(env));

        let mut subject_credentials = Vec::new(env);
        for (_, credential) in credentials.iter() {
            if credential.subject == *subject {
                subject_credentials.push_back(credential);
            }
        }

        subject_credentials
    }
}
