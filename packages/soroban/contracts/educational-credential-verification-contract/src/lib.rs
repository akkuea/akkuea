#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Map, String, Vec, BytesN};

mod datatype;
mod interfaces;
mod verification;
mod nft;
mod review;
mod analytics;
mod storage;
mod utils;
mod security;
mod upgrade;
#[cfg(test)]
mod test;
#[cfg(test)]
mod test_security;
#[cfg(test)]
mod test_upgrade;

use datatype::{
    AnalyticsData, Educator, VerificationLevel, Review, Dispute, ReviewerPerformance, 
    Credential, NFT, NFTTemplate, AchievementBadge, SecurityConfig, MultiSigProposal, 
    TimeLockOperation, FraudReport, ReputationStake, ContractVersion, MigrationState
};
use interfaces::EducatorVerificationInterface;
use verification::VerificationSystem;
use review::ReviewSystem;
use analytics::AnalyticsSystem;
use nft::NFTImplementation;
use security::SecuritySystem;
use upgrade::UpgradeSystem;
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
            credentials: Vec::new(&env), // Initialize as empty, credentials will be added later
            verification_status: false,
            nft_token_id: None,
            verification_timestamp: env.ledger().timestamp(),
            specialty_areas,
            verification_level: VerificationLevel::Pending,
            reviews_count: 0,
            ratings: Map::new(&env),
            owned_nfts: Vec::new(&env),
            achievement_badges: Vec::new(&env),
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

        // For now, we'll use the legacy credential verification
        // In a full implementation, this would verify the new Credential structs
        let credential_hashes: Vec<String> = Vec::new(&env); // Placeholder for now
        if !VerificationSystem::verify_credentials(&env, &credential_hashes, &reviewer) {
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
            // For now, we'll skip adding credentials to the new structure
            // In a full implementation, this would create Credential structs
            // and add them to educator.credentials
            // This is a placeholder to maintain compatibility
            let updated = true; // Assume credentials were processed
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

    // --- Enhanced Credential Functions ---
    
    fn create_credential(
        env: Env,
        issuer: Address,
        subject: Address,
        credential_hash: String,
        tier: u32,
        w3c_compliant: bool,
    ) -> BytesN<32> {
        VerificationSystem::create_credential(&env, &issuer, &subject, credential_hash, tier, w3c_compliant)
    }

    fn renew_credential(env: Env, issuer: Address, credential_id: BytesN<32>) -> bool {
        VerificationSystem::renew_credential(&env, &issuer, credential_id)
    }

    fn verify_cross_chain(
        env: Env,
        verifier: Address,
        credential_id: BytesN<32>,
        chain_id: u32,
        verification_hash: String,
    ) -> bool {
        VerificationSystem::verify_cross_chain(&env, &verifier, credential_id, chain_id, verification_hash)
    }

    fn get_credential_info(env: Env, credential_id: BytesN<32>) -> Option<Credential> {
        VerificationSystem::get_credential_info(&env, credential_id)
    }

    fn get_credentials_by_subject(env: Env, subject: Address) -> Vec<Credential> {
        VerificationSystem::get_credentials_by_subject(&env, &subject)
    }

    // --- Dynamic NFT Functions ---
    
    fn create_dynamic_nft(
        env: Env,
        admin: Address,
        owner: Address,
        template_id: u32,
        is_badge: bool,
        initial_metadata: Map<String, String>,
    ) -> BytesN<32> {
        NFTImplementation::create_nft_internal(env, admin, owner, template_id, is_badge, initial_metadata)
    }

    fn update_nft_metadata(
        env: Env,
        owner: Address,
        nft_id: BytesN<32>,
        new_metadata: Map<String, String>,
    ) -> bool {
        NFTImplementation::update_nft_metadata(env, owner, nft_id, new_metadata)
    }

    fn upgrade_nft(
        env: Env,
        owner: Address,
        nft_id: BytesN<32>,
        additional_metadata: Map<String, String>,
    ) -> bool {
        NFTImplementation::upgrade_nft(env, owner, nft_id, additional_metadata)
    }

    fn list_nfts(env: Env, owner: Address) -> Vec<NFT> {
        NFTImplementation::list_nfts(env, owner)
    }

    fn get_nft_info(env: Env, nft_id: BytesN<32>) -> Option<NFT> {
        NFTImplementation::get_nft_info(env, nft_id)
    }

    // --- NFT Template Functions ---
    
    fn create_nft_template(
        env: Env,
        admin: Address,
        name: String,
        description: String,
        image_url: String,
        attributes: Map<String, String>,
        is_badge_template: bool,
    ) -> u32 {
        NFTImplementation::create_nft_template(env, admin, name, description, image_url, attributes, is_badge_template)
    }

    fn get_nft_template(env: Env, template_id: u32) -> Option<NFTTemplate> {
        NFTImplementation::get_nft_template(env, template_id)
    }

    // --- Achievement Badge Functions ---
    
    fn issue_badge(
        env: Env,
        admin: Address,
        educator: Address,
        badge_name: String,
        badge_description: String,
        criteria: String,
        required_tier: u32,
        template_id: u32,
    ) -> BytesN<32> {
        NFTImplementation::issue_badge(env, admin, educator, badge_name, badge_description, criteria, required_tier, template_id)
    }

    fn get_achievement_badge(env: Env, badge_id: BytesN<32>) -> Option<AchievementBadge> {
        NFTImplementation::get_achievement_badge(env, badge_id)
    }

    // --- Security Functions ---
    
    fn configure_security(env: Env, admin: Address, config: SecurityConfig) {
        SecuritySystem::configure_security(&env, &admin, config);
    }

    fn get_security_config(env: Env) -> SecurityConfig {
        SecuritySystem::get_security_config(&env)
    }

    // Multi-signature functions
    fn create_multisig_proposal(
        env: Env,
        proposer: Address,
        operation: String,
        target: Address,
        data: Vec<String>,
    ) -> BytesN<32> {
        // Check if contract is paused
        if UpgradeSystem::is_contract_paused(&env) {
            panic!("contract is paused");
        }
        SecuritySystem::create_multisig_proposal(&env, &proposer, operation, target, data)
    }

    fn approve_proposal(env: Env, approver: Address, proposal_id: BytesN<32>) -> bool {
        if UpgradeSystem::is_contract_paused(&env) {
            panic!("contract is paused");
        }
        SecuritySystem::approve_proposal(&env, &approver, proposal_id)
    }

    fn execute_multisig_operation(env: Env, executor: Address, proposal_id: BytesN<32>) -> bool {
        if UpgradeSystem::is_contract_paused(&env) {
            panic!("contract is paused");
        }
        SecuritySystem::execute_multisig_operation(&env, &executor, proposal_id)
    }

    // Time-lock functions
    fn schedule_time_locked_operation(
        env: Env,
        proposer: Address,
        operation: String,
        target: Address,
        data: Vec<String>,
    ) -> BytesN<32> {
        if UpgradeSystem::is_contract_paused(&env) {
            panic!("contract is paused");
        }
        SecuritySystem::schedule_time_locked_operation(&env, &proposer, operation, target, data)
    }

    fn execute_time_locked_operation(env: Env, executor: Address, operation_id: BytesN<32>) -> bool {
        if UpgradeSystem::is_contract_paused(&env) {
            panic!("contract is paused");
        }
        SecuritySystem::execute_time_locked_operation(&env, &executor, operation_id)
    }

    fn cancel_time_locked_operation(env: Env, admin: Address, operation_id: BytesN<32>) -> bool {
        SecuritySystem::cancel_time_locked_operation(&env, &admin, operation_id)
    }

    // Fraud detection functions
    fn flag_fraudulent_activity(
        env: Env,
        reporter: Address,
        target: Address,
        fraud_type: String,
        evidence_hash: String,
    ) -> BytesN<32> {
        SecuritySystem::flag_fraudulent_activity(&env, &reporter, &target, fraud_type, evidence_hash)
    }

    // Reputation staking functions
    fn stake_reputation(env: Env, staker: Address, amount: u64, lock_duration: u64) -> bool {
        if UpgradeSystem::is_contract_paused(&env) {
            panic!("contract is paused");
        }
        SecuritySystem::stake_reputation(&env, &staker, amount, lock_duration)
    }

    fn slash_stake(env: Env, admin: Address, staker: Address, slash_amount: u64) -> bool {
        SecuritySystem::slash_stake(&env, &admin, &staker, slash_amount)
    }

    fn withdraw_stake(env: Env, staker: Address) -> u64 {
        if UpgradeSystem::is_contract_paused(&env) {
            panic!("contract is paused");
        }
        SecuritySystem::withdraw_stake(&env, &staker)
    }

    fn get_active_stake(env: Env, staker: Address) -> Option<ReputationStake> {
        SecuritySystem::get_active_stake(&env, &staker)
    }

    // Account security functions
    fn is_account_suspended(env: Env, account: Address) -> bool {
        SecuritySystem::is_account_suspended(&env, &account)
    }

    // --- Upgrade Functions ---

    fn get_version_info(env: Env) -> Option<ContractVersion> {
        UpgradeSystem::get_version_info(&env)
    }

    fn upgrade_contract(env: Env, admin: Address, new_implementation: Address, new_version: String) -> bool {
        UpgradeSystem::upgrade_contract(&env, &admin, new_implementation, new_version)
    }

    fn set_implementation(env: Env, admin: Address, implementation: Address) -> bool {
        UpgradeSystem::set_implementation(&env, &admin, implementation)
    }

    fn get_implementation(env: Env) -> Option<Address> {
        UpgradeSystem::get_implementation(&env)
    }

    // Contract pause functions
    fn pause_contract(env: Env, admin: Address, reason: String) -> bool {
        UpgradeSystem::pause_contract(&env, &admin, reason)
    }

    fn unpause_contract(env: Env, admin: Address) -> bool {
        UpgradeSystem::unpause_contract(&env, &admin)
    }

    fn is_contract_paused(env: Env) -> bool {
        UpgradeSystem::is_contract_paused(&env)
    }

    fn emergency_stop(env: Env, admin: Address, reason: String) -> bool {
        UpgradeSystem::emergency_stop(&env, &admin, reason)
    }

    // Data migration functions
    fn initialize_migration(env: Env, admin: Address, to_version: String) -> BytesN<32> {
        UpgradeSystem::initialize_migration(&env, &admin, to_version)
    }

    fn migrate_educators(env: Env, admin: Address, batch_size: u32) -> u32 {
        UpgradeSystem::migrate_educators(&env, &admin, batch_size)
    }

    fn migrate_credentials(env: Env, admin: Address, batch_size: u32) -> u32 {
        UpgradeSystem::migrate_credentials(&env, &admin, batch_size)
    }

    fn migrate_nfts(env: Env, admin: Address, batch_size: u32) -> u32 {
        UpgradeSystem::migrate_nfts(&env, &admin, batch_size)
    }

    fn complete_migration(env: Env, admin: Address, migration_id: BytesN<32>) -> bool {
        UpgradeSystem::complete_migration(&env, &admin, migration_id)
    }

    fn validate_migration_integrity(env: Env, admin: Address, data_type: String) -> bool {
        UpgradeSystem::validate_migration_integrity(&env, &admin, data_type)
    }

    // Backward compatibility functions
    fn create_compatibility_adapter(
        env: Env, 
        old_function: String, 
        new_function: String, 
    ) -> bool {
        UpgradeSystem::create_compatibility_adapter(&env, old_function, new_function)
    }

    fn is_function_deprecated(env: Env, function_name: String) -> bool {
        UpgradeSystem::is_function_deprecated(&env, function_name)
    }

    fn get_deprecation_warning(env: Env, function_name: String) -> Option<String> {
        UpgradeSystem::get_deprecation_warning(&env, function_name)
    }

    // Rollback functions
    fn rollback_to_previous_version(env: Env, admin: Address) -> bool {
        UpgradeSystem::rollback_to_previous_version(&env, &admin)
    }
}
