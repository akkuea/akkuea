#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Map, String, Vec, symbol_short};

mod datatype;
mod interfaces;
mod verification;
mod nft;
#[cfg(test)]
mod test;

use datatype::{Educator, VerificationLevel, Review};
use interfaces::EducatorVerificationInterface;
use verification::VerificationSystem;

#[contract]
pub struct EducatorVerificationContract;


#[contractimpl]
impl EducatorVerificationInterface for EducatorVerificationContract {
    fn initialize(env: Env, admin: Address) {
        if VerificationSystem::has_administrator(&env) {
            panic!("already initialized");
        }
        env.storage().instance().set(&symbol_short!("admin"), &admin);
    }

    fn register_educator(
        env: Env,
        educator_address: Address,
        name: String,
        credential_hashes: Vec<String>,
        specialty_areas: Vec<String>,
    ) -> Address {
        educator_address.require_auth();

        let educator = Educator {
            address: educator_address.clone(),
            name,
            credentials: credential_hashes,
            verification_status: false,
            nft_token_id: None,
            verification_timestamp: env.ledger().timestamp(),
            specialty_areas,
            verification_level: VerificationLevel::Pending,
            reviews_count: 0,
            rating: 0,
        };

        let key = symbol_short!("EDU");
        let mut educators: Map<Address, Educator> = env.storage().persistent().get(&key).unwrap_or(Map::new(&env));
        
        if educators.contains_key(educator_address.clone()) {
            panic!("educator already registered");
        }

        educators.set(educator_address.clone(), educator);
        env.storage().persistent().set(&key, &educators);

        educator_address
    }

    fn verify_educator(
        env: Env,
        reviewer: Address,
        educator_address: Address,
        verification_level: VerificationLevel,
    ) {
        reviewer.require_auth();
        if !verification::VerificationSystem::is_reviewer(&env, &reviewer) {
            panic!("not authorized reviewer");
        }

        let key = symbol_short!("EDU");
        let mut educators: Map<Address, Educator> = env.storage().persistent().get(&key).unwrap_or(Map::new(&env));
        
        let mut educator = educators.get(educator_address.clone())
            .expect("educator not found");

        if educator.verification_status {
            panic!("educator already verified");
        }

        if !verification::VerificationSystem::verify_credentials(&env, &educator.credentials, &reviewer) {
            panic!("invalid credentials");
        }

        educator.verification_status = true;
        educator.verification_level = verification_level.clone();
        educator.verification_timestamp = env.ledger().timestamp();

        let nft_id = verification::VerificationSystem::mint_verification_nft(
            &env,
            &educator_address,
            &verification_level,
            &educator.specialty_areas
        );
        
        educator.nft_token_id = Some(nft_id);

        educators.set(educator_address.clone(), educator);
        env.storage().persistent().set(&key, &educators);
    }

    fn add_reviewer(env: Env, admin: Address, reviewer: Address) {
        admin.require_auth();
        VerificationSystem::verify_admin(&env, &admin);
        VerificationSystem::add_reviewer(&env, &reviewer);
    }

    fn remove_reviewer(env: Env, admin: Address, reviewer: Address) {
        admin.require_auth();
        VerificationSystem::verify_admin(&env, &admin);
        VerificationSystem::remove_reviewer(&env, &reviewer);
    }

    fn get_educator(env: Env, educator_address: Address) -> Option<Educator> {
        let key = symbol_short!("EDU");
        let educators: Map<Address, Educator> = env.storage().persistent().get(&key).unwrap_or(Map::new(&env));
        educators.get(educator_address)
    }

    fn get_verified_educators(env: Env) -> Vec<Address> {
        let key = symbol_short!("EDU");
        let educators: Map<Address, Educator> = env.storage().persistent().get(&key).unwrap_or(Map::new(&env));
        
        let mut verified = Vec::new(&env);
        for (address, educator) in educators.iter() {
            if educator.verification_status {
                verified.push_back(address);
            }
        }
        verified
    }

    fn update_educator_profile(env: Env, educator_address: Address, name: Option<String>, specialty_areas: Option<Vec<String>>) -> bool {
        educator_address.require_auth();
        
        let key = symbol_short!("EDU");
        let mut educators: Map<Address, Educator> = env.storage().persistent().get(&key).unwrap_or(Map::new(&env));
        
        if let Some(mut educator) = educators.get(educator_address.clone()) {
            if let Some(new_name) = name {
                educator.name = new_name;
            }
            if let Some(new_specialties) = specialty_areas {
                educator.specialty_areas = new_specialties;
            }
            educators.set(educator_address, educator);
            env.storage().persistent().set(&key, &educators);
            true
        } else {
            false
        }
    }

    fn add_credentials(env: Env, educator_address: Address, new_credentials: Vec<String>) -> bool {
        educator_address.require_auth();
        
        let key = symbol_short!("EDU");
        let mut educators: Map<Address, Educator> = env.storage().persistent().get(&key).unwrap_or(Map::new(&env));
        
        if let Some(mut educator) = educators.get(educator_address.clone()) {
            let mut updated = false;
            for cred in new_credentials.iter() {
                if !educator.credentials.contains(&cred) {
                    educator.credentials.push_back(cred.clone());
                    updated = true;
                }
            }
            
            if updated {
                educators.set(educator_address, educator);
                env.storage().persistent().set(&key, &educators);
                true
            } else {
                false
            }
        } else {
            false
        }
    }

    fn revoke_verification(env: Env, admin: Address, educator_address: Address, reason: String) {
        admin.require_auth();
        verification::VerificationSystem::verify_admin(&env, &admin);
        
        let key = symbol_short!("EDU");
        let mut educators: Map<Address, Educator> = env.storage().persistent().get(&key).unwrap_or(Map::new(&env));
        
        if let Some(mut educator) = educators.get(educator_address.clone()) {
            if educator.verification_status {
                educator.verification_status = false;
                educator.verification_level = VerificationLevel::Pending;
                
                let revoke_key = symbol_short!("REVOKE");
                let mut revocations: Map<Address, String> = env.storage().persistent().get(&revoke_key).unwrap_or(Map::new(&env));
                revocations.set(educator_address.clone(), reason);
                env.storage().persistent().set(&revoke_key, &revocations);
                
                if let Some(nft_id) = educator.nft_token_id.clone() {
                    nft::NFTImplementation::burn_nft(env.clone(), nft_id);
                    educator.nft_token_id = None;
                }
                
                educators.set(educator_address, educator);
                env.storage().persistent().set(&key, &educators);
            } else {
                panic!("educator not verified");
            }
        } else {
            panic!("educator not found");
        }
    }

    fn get_educators_by_specialty(env: Env, specialty: String) -> Vec<Address> {
        let key = symbol_short!("EDU");
        let educators: Map<Address, Educator> = env.storage().persistent().get(&key).unwrap_or(Map::new(&env));
        
        let mut filtered_educators = Vec::new(&env);
        
        for (address, educator) in educators.iter() {
            if educator.specialty_areas.contains(&specialty) {
                filtered_educators.push_back(address);
            }
        }
        
        filtered_educators
    }

    fn get_educator_reviews(env: Env, educator_address: Address) -> Vec<Review> {
        let reviews_key = symbol_short!("revs");
        let reviews_map: Map<Address, Vec<Review>> = env.storage().persistent()
            .get(&reviews_key)
            .unwrap_or_else(|| Map::new(&env));
            
        if let Some(reviews) = reviews_map.get(educator_address) {
            reviews
        } else {
            Vec::new(&env)
        }
    }

    fn submit_review(env: Env, reviewer: Address, educator_address: Address, rating: u32) {
        reviewer.require_auth();
        
        if !verification::VerificationSystem::is_reviewer(&env, &reviewer) {
            panic!("not authorized reviewer");
        }
        
        let edu_key = symbol_short!("EDU");
        let educators: Map<Address, Educator> = env.storage().persistent()
            .get(&edu_key)
            .unwrap_or_else(|| Map::new(&env));
            
        if !educators.contains_key(educator_address.clone()) {
            panic!("educator not found");
        }
        
        if rating < 1 || rating > 10 {
            panic!("rating must be between 1 and 10");
        }
        
        let review = Review {
            reviewer: reviewer.clone(),
            educator: educator_address.clone(),
            rating,
            timestamp: env.ledger().timestamp(),
        };
        
        verification::VerificationSystem::store_review(&env, review);
        
        let mut educators_map = educators;
        if let Some(mut educator) = educators_map.get(educator_address.clone()) {
            educator.reviews_count += 1;
            
            let all_reviews = Self::get_educator_reviews(env.clone(), educator_address.clone());
            let total_rating: u32 = all_reviews.iter().map(|r| r.rating).sum();
            educator.rating = total_rating / educator.reviews_count;
            
            educator.verification_level = verification::VerificationSystem::calculate_verification_level(
                &env, 
                &educator_address
            );
            
            educators_map.set(educator_address, educator);
            env.storage().persistent().set(&edu_key, &educators_map);
        }
    }

    fn add_verified_credential(env: Env, reviewer: Address, credential: String) {
        reviewer.require_auth();
        
        if !verification::VerificationSystem::is_reviewer(&env, &reviewer) {
            panic!("not authorized reviewer");
        }
        
        verification::VerificationSystem::add_verified_credential(&env, credential, &reviewer);
    }
    
    fn add_authorized_institution(env: Env, admin: Address, institution_id: String) {
        admin.require_auth();
        
        verification::VerificationSystem::verify_admin(&env, &admin);
        verification::VerificationSystem::add_authorized_institution(&env, &admin, institution_id);
    }
} 