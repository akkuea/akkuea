use soroban_sdk::{Address, Env, Vec, Map, String};
use crate::datatype::{Educator, VerificationLevel,};
use crate::nft::NFTImplementation;
use crate::storage::{ADMIN, REVIEWERS, VERIFIED_CREDS, SIGNATURES, AUTH_INST,};

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
        let reviewers: Vec<Address> = env.storage().persistent().get(&REVIEWERS).unwrap_or_else(|| Vec::new(env));
        reviewers.contains(reviewer)
    }

    pub fn add_reviewer(env: &Env, reviewer: &Address) {
        let mut reviewers: Vec<Address> = env.storage().persistent().get(&REVIEWERS).unwrap_or_else(|| Vec::new(env));
        if !reviewers.contains(reviewer) {
            reviewers.push_back(reviewer.clone());
            env.storage().persistent().set(&REVIEWERS, &reviewers);
        }
    }

    pub fn remove_reviewer(env: &Env, reviewer: &Address) {
        let reviewers: Vec<Address> = env.storage().persistent().get(&REVIEWERS).unwrap_or_else(|| Vec::new(env));
        
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

        let verified_credentials: Map<String, bool> = env.storage().persistent().get(&VERIFIED_CREDS).unwrap_or_else(|| Map::new(env));

        for credential in credentials.iter() {
            if let Some(is_verified) = verified_credentials.get(credential.clone()) {
                if !is_verified { return false; }
                continue;
            }
            if !Self::is_valid_hash_format(env, &credential) { return false; }
            if !Self::verify_digital_signature(env, &credential, reviewer) { return false; }
            if !Self::verify_institution(env, &credential) { return false; }
        }
        true
    }

    fn is_valid_hash_format(_env: &Env, hash: &String) -> bool {
        hash.len() == 64
    }

    fn verify_digital_signature(env: &Env, credential: &String, reviewer: &Address) -> bool {
        let signatures: Map<String, Vec<Address>> = env.storage().persistent().get(&SIGNATURES).unwrap_or_else(|| Map::new(env));
        signatures.get(credential.clone()).map_or(false, |s| s.contains(reviewer))
    }

    fn verify_institution(env: &Env, credential: &String) -> bool {
        let authorized_institutions: Vec<String> = env.storage().persistent().get(&AUTH_INST).unwrap_or_else(|| Vec::new(env));
        authorized_institutions.contains(credential)
    }

    pub fn add_verified_credential(env: &Env, credential: String, reviewer: &Address) {
        if !Self::is_reviewer(env, reviewer) {
            panic!("not authorized reviewer");
        }

        let mut verified_credentials: Map<String, bool> = env.storage().persistent().get(&VERIFIED_CREDS).unwrap_or_else(|| Map::new(env));
        verified_credentials.set(credential.clone(), true);
        env.storage().persistent().set(&VERIFIED_CREDS, &verified_credentials);

        let mut signatures: Map<String, Vec<Address>> = env.storage().persistent().get(&SIGNATURES).unwrap_or_else(|| Map::new(env));
        let mut signers = signatures.get(credential.clone()).unwrap_or_else(|| Vec::new(env));
        
        if !signers.contains(reviewer) {
            signers.push_back(reviewer.clone());
            signatures.set(credential, signers);
            env.storage().persistent().set(&SIGNATURES, &signatures);
        }
    }

    pub fn add_authorized_institution(env: &Env, admin: &Address, institution_id: String) {
        Self::verify_admin(env, admin);
        let mut authorized_institutions: Vec<String> = env.storage().persistent().get(&AUTH_INST).unwrap_or_else(|| Vec::new(env));
        if !authorized_institutions.contains(&institution_id) {
            authorized_institutions.push_back(institution_id);
            env.storage().persistent().set(&AUTH_INST, &authorized_institutions);
        }
    }

    pub fn mint_verification_nft(
        env: &Env, 
        recipient: &Address, 
        level: &VerificationLevel,
        specialties: &Vec<String>
    ) -> String {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        NFTImplementation::mint_nft(env.clone(), admin, recipient.clone(), level.clone(), specialties.clone())
    }

    pub fn calculate_verification_level(_env: &Env, educators: &Map<Address, Educator>, educator_address: &Address) -> VerificationLevel {
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
        
        match final_avg_rating {
            0..=3 => VerificationLevel::Basic,
            4..=7 => VerificationLevel::Advanced,
            _ => VerificationLevel::Expert,
        }
    }
}
