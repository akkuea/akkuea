#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Map, String, Vec};

mod datatype;
mod interfaces;
mod verification;
mod nft;
mod review;
mod analytics;
mod storage;
#[cfg(test)]
mod test;

use datatype::{AnalyticsData, Educator, VerificationLevel, Review, Dispute, ReviewerPerformance};
use interfaces::EducatorVerificationInterface;
use verification::VerificationSystem;
use review::ReviewSystem;
use analytics::AnalyticsSystem;
use storage::{EDUCATORS, ADMIN, REVOKED, DISPUTES, DataKey};


#[contract]
pub struct EducatorVerificationContract;


#[contractimpl]
impl EducatorVerificationInterface for EducatorVerificationContract {
    fn initialize(env: Env, admin: Address) {
        if VerificationSystem::has_administrator(&env) {
            panic!("already initialized");
        }
        env.storage().instance().set(&ADMIN, &admin);
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
            ratings: Map::new(&env),
        };

        let mut educators: Map<Address, Educator> = env.storage().persistent().get(&EDUCATORS).unwrap_or(Map::new(&env));
        
        if educators.contains_key(educator_address.clone()) {
            panic!("educator already registered");
        }

        educators.set(educator_address.clone(), educator);
        env.storage().persistent().set(&EDUCATORS, &educators);

        educator_address
    }

    fn verify_educator(
        env: Env,
        reviewer: Address,
        educator_address: Address,
        verification_level: VerificationLevel,
    ) {
        reviewer.require_auth();
        if !VerificationSystem::is_reviewer(&env, &reviewer) {
            panic!("not authorized reviewer");
        }

        let mut educators: Map<Address, Educator> = env.storage().persistent().get(&EDUCATORS).unwrap();
        let mut educator = educators.get(educator_address.clone()).expect("educator not found");

        if educator.verification_status {
            panic!("educator already verified");
        }

        if !VerificationSystem::verify_credentials(&env, &educator.credentials, &reviewer) {
            panic!("invalid credentials");
        }

        educator.verification_status = true;
        educator.verification_level = verification_level.clone();
        educator.verification_timestamp = env.ledger().timestamp();

        let nft_id = VerificationSystem::mint_verification_nft(
            &env, &educator_address, &verification_level, &educator.specialty_areas
        );
        educator.nft_token_id = Some(nft_id);

        educators.set(educator_address.clone(), educator);
        env.storage().persistent().set(&EDUCATORS, &educators);
        
        AnalyticsSystem::recalculate_all_analytics(&env);
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
        let educators: Map<Address, Educator> = env.storage().persistent().get(&EDUCATORS).unwrap_or(Map::new(&env));
        educators.get(educator_address)
    }

    fn get_verified_educators(env: Env) -> Vec<Address> {
        let educators: Map<Address, Educator> = env.storage().persistent().get(&EDUCATORS).unwrap_or(Map::new(&env));
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
        let mut educators: Map<Address, Educator> = env.storage().persistent().get(&EDUCATORS).unwrap();
        if let Some(mut educator) = educators.get(educator_address.clone()) {
            if let Some(new_name) = name { educator.name = new_name; }
            if let Some(new_specialties) = specialty_areas { educator.specialty_areas = new_specialties; }
            educators.set(educator_address, educator);
            env.storage().persistent().set(&EDUCATORS, &educators);
            true
        } else { false }
    }

    fn add_credentials(env: Env, educator_address: Address, new_credentials: Vec<String>) -> bool {
        educator_address.require_auth();
        let mut educators: Map<Address, Educator> = env.storage().persistent().get(&EDUCATORS).unwrap();
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
                env.storage().persistent().set(&EDUCATORS, &educators);
            }
            updated
        } else { false }
    }

    fn revoke_verification(env: Env, admin: Address, educator_address: Address, reason: String) {
        admin.require_auth();
        VerificationSystem::verify_admin(&env, &admin);
        let mut educators: Map<Address, Educator> = env.storage().persistent().get(&EDUCATORS).unwrap();
        if let Some(mut educator) = educators.get(educator_address.clone()) {
            if educator.verification_status {
                educator.verification_status = false;
                educator.verification_level = VerificationLevel::Pending;
                
                let mut revocations: Map<Address, String> = env.storage().persistent().get(&REVOKED).unwrap_or(Map::new(&env));
                revocations.set(educator_address.clone(), reason);
                env.storage().persistent().set(&REVOKED, &revocations);
                
                if let Some(nft_id) = educator.nft_token_id.clone() {
                    nft::NFTImplementation::burn_nft(env.clone(), nft_id);
                    educator.nft_token_id = None;
                }
                
                educators.set(educator_address, educator);
                env.storage().persistent().set(&EDUCATORS, &educators);
            } else { panic!("educator not verified"); }
        } else { panic!("educator not found"); }
    }

    fn get_educators_by_specialty(env: Env, specialty: String) -> Vec<Address> {
        let educators: Map<Address, Educator> = env.storage().persistent().get(&EDUCATORS).unwrap_or(Map::new(&env));
        let mut filtered_educators = Vec::new(&env);
        for (address, educator) in educators.iter() {
            if educator.specialty_areas.contains(&specialty) {
                filtered_educators.push_back(address);
            }
        }
        filtered_educators
    }

    fn get_educator_reviews(env: Env, educator_address: Address) -> Vec<Review> {
        let reviews_key = DataKey::Reviews(educator_address);
        env.storage().persistent().get(&reviews_key).unwrap_or_else(|| Vec::new(&env))
    }

    fn add_verified_credential(env: Env, reviewer: Address, credential: String) {
        reviewer.require_auth();
        if !VerificationSystem::is_reviewer(&env, &reviewer) {
            panic!("not authorized reviewer");
        }
        VerificationSystem::add_verified_credential(&env, credential, &reviewer);
    }
    
    fn add_authorized_institution(env: Env, admin: Address, institution_id: String) {
        admin.require_auth();
        VerificationSystem::verify_admin(&env, &admin);
        VerificationSystem::add_authorized_institution(&env, &admin, institution_id);
    }

    fn submit_review(
        env: Env,
        reviewer: Address,
        educator_address: Address,
        ratings: Map<String, u32>,
        comment_hash: String,
    ) {
        ReviewSystem::submit_review(&env, reviewer, educator_address, ratings, comment_hash);
    }

    fn verify_review(env: Env, verifier: Address, educator_address: Address, review_id: u32) {
        ReviewSystem::verify_review(&env, verifier, educator_address, review_id);
    }

    fn dispute_review(env: Env, educator: Address, review_id: u32, reason_hash: String) {
        ReviewSystem::dispute_review(&env, educator, review_id, reason_hash);
    }

    fn resolve_dispute(env: Env, admin: Address, educator_address: Address, review_id: u32) {
        ReviewSystem::resolve_dispute(&env, admin, educator_address, review_id);
    }

    fn get_disputes(env: Env) -> Vec<Dispute> {
        env.storage().persistent().get(&DISPUTES).unwrap_or(Vec::new(&env))
    }
    
    fn get_analytics(env: Env) -> AnalyticsData {
        AnalyticsSystem::get_analytics(&env)
    }

    fn recalculate_analytics(env: Env, admin: Address) {
        admin.require_auth();
        VerificationSystem::verify_admin(&env, &admin);
        AnalyticsSystem::recalculate_all_analytics(&env);
    }

    fn get_reviewer_performance(env: Env, reviewer: Address) -> Option<ReviewerPerformance> {
        let analytics = AnalyticsSystem::get_analytics(&env);
        analytics.reviewer_performance.get(reviewer)
    }
}
