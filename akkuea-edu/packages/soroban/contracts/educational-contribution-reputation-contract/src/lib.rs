#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Map, String, Vec};

mod algorithms;
mod analytics;
mod credentials;
mod error;
mod expertise;
mod integration;
mod recovery;
mod reputation;
mod security;
mod storage;
mod test;
mod types;
mod verify;

pub use error::Error;
pub use types::*;

#[contract]
pub struct ContributorReputation;

#[contractimpl]
impl ContributorReputation {
    // Initialize a new user
    pub fn initialize_user(env: Env, caller: Address, name: String) -> Result<u64, Error> {
        caller.require_auth();

        let user_id = env
            .storage()
            .instance()
            .get(&DataKey::NextUserId)
            .unwrap_or(1u64);
        env.storage()
            .instance()
            .set(&DataKey::NextUserId, &(user_id + 1));

        let user = User {
            id: user_id,
            name,
            expertise_areas: Map::new(&env),
            verified: false,
        };
        env.storage().instance().set(&DataKey::User(user_id), &user);
        Ok(user_id)
    }

    pub fn get_user(env: Env, user_id: u64) -> Result<User, Error> {
        env.storage()
            .instance()
            .get(&DataKey::User(user_id))
            .ok_or(Error::UserNotFound)
    }

    // Reputation functions
    pub fn update_reputation(
        env: Env,
        caller: Address,
        user_id: u64,
        subject: String,
        score: u32,
    ) -> Result<(), Error> {
        reputation::update_reputation(env, caller, user_id, subject, score)
    }

    pub fn get_reputation(env: Env, user_id: u64, subject: String) -> Result<u32, Error> {
        reputation::get_reputation(env, user_id, subject)
    }

    /**
     * @notice Update a user's reputation in a subject/domain using advanced algorithms.
     * @param env The contract environment.
     * @param caller The admin address (must be authorized).
     * @param user_id The ID of the user whose reputation is being updated.
     * @param subject The subject/domain of the contribution.
     * @param base_score The base quality score eg(0-100).
     * @param contribution_type The type of contribution (0=Code, 1=Mentoring, 2=Review, 3=Other).
     */
    pub fn update_reputation_advanced(
        env: Env,
        caller: Address, // Admin address
        user_id: u64,
        subject: String,
        base_score: u32,
        contribution_type: u32, // 0=Code, 1=Mentoring, 2=Review, 3=Other
    ) -> Result<(), Error> {
        caller.require_auth();
        security::check_admin_access(&env, &caller)?;

        let user = storage::get_user(&env, user_id)?;
        if !user.verified {
            return Err(Error::NotVerified);
        }

        let contrib_type = match contribution_type {
            0 => algorithms::ContributionType::Code,
            1 => algorithms::ContributionType::Mentoring,
            2 => algorithms::ContributionType::Review,
            _ => algorithms::ContributionType::Other, // Default for docs, research, etc.
        };

        algorithms::update_reputation_with_algorithms(
            env,
            user_id,
            subject,
            base_score,
            contrib_type,
        )
    }

    /**
     * @notice Get the normalized reputation scores for a user across all domains.
     * @param env The contract environment.
     * @param user_id The ID of the user whose normalized reputation is being queried.
     */
    pub fn get_normalized_reputation(env: Env, user_id: u64) -> Result<Map<String, u32>, Error> {
        algorithms::normalize_reputation_across_domains(&env, user_id)
    }

    // Credential functions
    pub fn mint_credential_token(env: Env, caller: Address, user_id: u64) -> Result<u64, Error> {
        credentials::mint_credential_token(env, caller, user_id)
    }

    // Expertise functions
    pub fn update_expertise_areas(
        env: Env,
        caller: Address,
        user_id: u64,
        expertise_areas: Map<String, u32>,
    ) -> Result<(), Error> {
        expertise::update_expertise_areas(env, caller, user_id, expertise_areas)
    }

    pub fn get_expertise_areas(env: Env, user_id: u64) -> Result<Map<String, u32>, Error> {
        expertise::get_expertise_areas(env, user_id)
    }

    // Verification functions

    /**
     * @notice Verify a user with a specific tier level in the multi-level verification system.
     * @param env The contract environment.
     * @param caller The address performing the verification (must be authorized for the target tier).
     * @param user_id The ID of the user being verified.
     * @param verification_details String containing details about the verification process.
     * @param target_tier The verification tier level (1=Basic, 2=Verified, 3=Expert, 4=Authority).
     */
    pub fn verify_user_with_tier(
        env: Env,
        caller: Address,
        user_id: u64,
        verification_details: String,
        target_tier: u32,
    ) -> Result<(), Error> {
        verify::verify_user_with_tier(env, caller, user_id, verification_details, target_tier)
    }

    /**
     * @notice Renew an existing user verification before it expires.
     * @param env The contract environment.
     * @param caller The address performing the renewal (must be authorized).
     * @param user_id The ID of the user whose verification is being renewed.
     */
    pub fn renew_verification(env: Env, caller: Address, user_id: u64) -> Result<(), Error> {
        verify::renew_verification(env, caller, user_id)
    }

    /**
     * @notice Delegate verification authority to another address for a specific user.
     * @param env The contract environment.
     * @param caller The admin address delegating authority (must be admin).
     * @param delegate_address The address receiving the verification authority.
     * @param user_id The specific user ID that the delegate can verify.
     * @param max_tier The maximum verification tier the delegate can assign (1-4).
     * @param duration_days How long the delegation remains valid in days.
     */
    pub fn add_verification_delegation(
        env: Env,
        caller: Address,
        delegate_address: Address,
        user_id: u64,
        max_tier: u32,
        duration_days: u32,
    ) -> Result<(), Error> {
        verify::add_verification_delegation(
            env,
            caller,
            delegate_address,
            user_id,
            max_tier,
            duration_days,
        )
    }

    /**
     * @notice Get the verification details for a specific user.
     * @param env The contract environment.
     * @param user_id The ID of the user whose verification details are being queried.
     * @return UserVerification structure containing tier, verified_by, timestamps, and details.
     */
    pub fn get_user_verification(env: Env, user_id: u64) -> Result<UserVerification, Error> {
        storage::get_user_verification(&env, user_id).ok_or(Error::NotVerified)
    }

    pub fn verify_user(
        env: Env,
        caller: Address,
        user_id: u64,
        verification_details: String,
    ) -> Result<(), Error> {
        verify::verify_user(env, caller, user_id, verification_details)
    }

    pub fn verify_content(
        env: Env,
        caller: Address,
        content_id: u64,
        subject: String,
    ) -> Result<(), Error> {
        verify::verify_content(env, caller, content_id, subject)
    }

    // Recovery functions
    pub fn submit_dispute(
        env: Env,
        caller: Address,
        user_id: u64,
        subject: String,
        disputed_score: u32,
        evidence: String,
    ) -> Result<u64, Error> {
        recovery::submit_dispute(env, caller, user_id, subject, disputed_score, evidence)
    }

    pub fn resolve_dispute(
        env: Env,
        caller: Address,
        dispute_id: u64,
        approved: bool,
        resolver_name: String,
    ) -> Result<(), Error> {
        recovery::resolve_dispute(env, caller, dispute_id, approved, resolver_name)
    }

    pub fn create_recovery_plan(
        env: Env,
        caller: Address,
        user_id: u64,
        target_score: u32,
        milestones: Map<String, u32>,
        duration_days: u32,
    ) -> Result<(), Error> {
        recovery::create_recovery_plan(
            env,
            caller,
            user_id,
            target_score,
            milestones,
            duration_days,
        )
    }

    pub fn update_recovery_progress(
        env: Env,
        caller: Address,
        user_id: u64,
        subject: String,
        new_score: u32,
    ) -> Result<(), Error> {
        recovery::update_recovery_progress(env, caller, user_id, subject, new_score)
    }

    pub fn set_probation(
        env: Env,
        caller: Address,
        user_id: u64,
        duration_days: u32,
        reason: String,
        restrictions: Map<String, bool>,
    ) -> Result<(), Error> {
        recovery::set_probation(env, caller, user_id, duration_days, reason, restrictions)
    }

    pub fn is_on_probation(env: Env, user_id: u64) -> Result<bool, Error> {
        recovery::is_on_probation(env, user_id)
    }

    pub fn get_recovery_plan(env: Env, user_id: u64) -> Result<RecoveryPlan, Error> {
        recovery::get_recovery_plan(env, user_id)
    }

    pub fn get_dispute(env: Env, dispute_id: u64) -> Result<Dispute, Error> {
        recovery::get_dispute(env, dispute_id)
    }

    pub fn get_user_disputes(env: Env, user_id: u64) -> Result<Vec<u64>, Error> {
        recovery::get_user_disputes(env, user_id)
    }

    // Analytics functions
    pub fn generate_user_analytics(
        env: Env,
        user_id: u64,
        time_range_days: u32,
    ) -> Result<Analytics, Error> {
        analytics::generate_user_analytics(env, user_id, time_range_days)
    }

    pub fn generate_domain_expertise(env: Env, domain: String) -> Result<DomainExpertise, Error> {
        analytics::generate_domain_expertise(env, domain)
    }

    pub fn generate_peer_benchmark(
        env: Env,
        user_id: u64,
        subject: String,
    ) -> Result<PeerBenchmark, Error> {
        analytics::generate_peer_benchmark(env, user_id, subject)
    }

    pub fn predict_reputation_development(
        env: Env,
        user_id: u64,
        subject: String,
        prediction_days: u32,
    ) -> Result<u32, Error> {
        analytics::predict_reputation_development(env, user_id, subject, prediction_days)
    }

    pub fn get_reputation_trends(
        env: Env,
        user_id: u64,
        subject: String,
        days: u32,
    ) -> Result<Map<u64, u32>, Error> {
        analytics::get_reputation_trends(env, user_id, subject, days)
    }

    pub fn calculate_platform_analytics(env: Env) -> Result<Analytics, Error> {
        analytics::calculate_platform_analytics(env)
    }

    // Security functions

    /// Perform a security audit of the platform
    pub fn perform_security_audit(env: Env, caller: Address) -> Result<SecurityAuditReport, Error> {
        caller.require_auth();
        security::check_admin_access(&env, &caller)?;
        security::perform_security_audit(&env)
    }

    /// Update rate limit for a specific user and operation
    pub fn update_rate_limit(
        env: Env,
        caller: Address,
        user_address: Address,
        _operation: String,
        new_limit: u32,
    ) -> Result<(), Error> {
        caller.require_auth();
        security::check_admin_access(&env, &caller)?;
        security::update_rate_limit(&env, &user_address, "operation", new_limit)
    }

    /// Check circuit breaker status for a service
    pub fn check_circuit_breaker_status(
        env: Env,
        service: String,
    ) -> Result<CircuitBreakerState, Error> {
        storage::get_circuit_breaker_state(&env, service).ok_or(Error::ServiceUnavailable)
    }

    /// Verify reputation invariants for a user
    pub fn verify_reputation_invariants(
        env: Env,
        user_id: u64,
        subject: String,
    ) -> Result<(), Error> {
        security::verify_reputation_invariants(&env, user_id, subject)
    }

    // Integration functions

    /// Register an external credential
    pub fn register_external_credential(
        env: Env,
        caller: Address,
        user_id: u64,
        credential_data: ExternalCredential,
    ) -> Result<String, Error> {
        integration::register_external_credential(&env, &caller, user_id, credential_data)
    }

    /// Verify an external credential
    pub fn verify_external_credential(
        env: Env,
        caller: Address,
        credential_id: String,
        verification_data: String,
    ) -> Result<(), Error> {
        integration::verify_external_credential(&env, &caller, credential_id, verification_data)
    }

    /// Get user's external credentials
    pub fn get_user_external_credentials(
        env: Env,
        user_id: u64,
    ) -> Result<Vec<ExternalCredential>, Error> {
        integration::get_user_external_credentials(&env, user_id)
    }

    /// Register a professional certification
    pub fn register_professional_cert(
        env: Env,
        caller: Address,
        user_id: u64,
        certification: ProfessionalCertification,
    ) -> Result<String, Error> {
        integration::register_professional_certification(&env, &caller, user_id, certification)
    }

    /// Verify a professional certification
    pub fn verify_professional_cert(
        env: Env,
        caller: Address,
        certification_id: String,
    ) -> Result<(), Error> {
        integration::verify_professional_certification(&env, &caller, certification_id)
    }

    /// Configure a system bridge
    pub fn configure_system_bridge(
        env: Env,
        caller: Address,
        bridge_config: SystemBridge,
    ) -> Result<String, Error> {
        integration::configure_system_bridge(&env, &caller, bridge_config)
    }

    /// Sync data with external system
    pub fn sync_with_external_system(
        env: Env,
        caller: Address,
        bridge_id: String,
        sync_type: ImportExportType,
    ) -> Result<u64, Error> {
        integration::sync_with_external_system(&env, &caller, bridge_id, sync_type)
    }

    /// Import user data from external system
    pub fn import_user_data(
        env: Env,
        caller: Address,
        user_id: u64,
        source_system: String,
        data_format: String,
        data_content: String,
    ) -> Result<u64, Error> {
        integration::import_user_data(
            &env,
            &caller,
            user_id,
            source_system,
            data_format,
            data_content,
        )
    }

    /// Export user data to external format
    pub fn export_user_data(
        env: Env,
        caller: Address,
        user_id: u64,
        export_format: String,
        include_sensitive: bool,
    ) -> Result<String, Error> {
        integration::export_user_data(&env, &caller, user_id, export_format, include_sensitive)
    }

    /// Get import/export operation details
    pub fn get_import_export_operation(
        env: Env,
        operation_id: u64,
    ) -> Result<ImportExportOperation, Error> {
        storage::get_import_export_operation(&env, operation_id).ok_or(Error::ImportExportFailed)
    }

    /// Get user's import/export history
    pub fn get_user_import_export_history(env: Env, user_id: u64) -> Result<Vec<u64>, Error> {
        Ok(storage::get_user_import_export_operations(&env, user_id))
    }

    /// Clean up expired credentials and probations
    pub fn cleanup_expired_data(env: Env, caller: Address) -> Result<(), Error> {
        caller.require_auth();
        security::check_admin_access(&env, &caller)?;

        storage::cleanup_expired_probations(&env);
        storage::cleanup_expired_credentials(&env);

        Ok(())
    }
}
