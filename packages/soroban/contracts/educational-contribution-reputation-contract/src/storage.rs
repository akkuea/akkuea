use crate::error::Error;
use crate::types::*;
use soroban_sdk::{Address, Env, Map, String, Vec};

/// Storage operations for the reputation contract

/// Get next available user ID
pub fn get_next_user_id(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::NextUserId)
        .unwrap_or(1u64)
}

/// Increment and return next user ID
pub fn increment_user_id(env: &Env) -> u64 {
    let next_id = get_next_user_id(env);
    env.storage()
        .instance()
        .set(&DataKey::NextUserId, &(next_id + 1));
    next_id
}

/// Get next available token ID
pub fn get_next_token_id(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::NextTokenId)
        .unwrap_or(1u64)
}

/// Increment and return next token ID
pub fn increment_token_id(env: &Env) -> u64 {
    let next_id = get_next_token_id(env);
    env.storage()
        .instance()
        .set(&DataKey::NextTokenId, &(next_id + 1));
    next_id
}

/// Get next available dispute ID
pub fn get_next_dispute_id(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::NextDisputeId)
        .unwrap_or(1u64)
}

/// Increment and return next dispute ID
pub fn increment_dispute_id(env: &Env) -> u64 {
    let next_id = get_next_dispute_id(env);
    env.storage()
        .instance()
        .set(&DataKey::NextDisputeId, &(next_id + 1));
    next_id
}

/// Store user data
pub fn store_user(env: &Env, user: &User) {
    env.storage().instance().set(&DataKey::User(user.id), user);
}

/// Get user data
pub fn get_user(env: &Env, user_id: u64) -> Result<User, Error> {
    env.storage()
        .instance()
        .get(&DataKey::User(user_id))
        .ok_or(Error::UserNotFound)
}

/// Store reputation data
pub fn store_reputation(env: &Env, reputation: &Reputation) {
    let key = DataKey::Reputation(reputation.user_id, reputation.subject.clone());
    env.storage().instance().set(&key, reputation);
}

/// Get reputation data
pub fn get_reputation(env: &Env, user_id: u64, subject: String) -> Result<Reputation, Error> {
    let key = DataKey::Reputation(user_id, subject);
    env.storage()
        .instance()
        .get(&key)
        .ok_or(Error::ReputationNotFound)
}

/// Store credential token
pub fn store_credential(env: &Env, credential: &CredentialToken) {
    env.storage()
        .instance()
        .set(&DataKey::Credential(credential.token_id), credential);
}

/// Get credential token
pub fn get_credential(env: &Env, token_id: u64) -> Result<CredentialToken, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Credential(token_id))
        .ok_or(Error::TokenNotFound)
}

/// Store dispute data
pub fn store_dispute(env: &Env, dispute: &Dispute) {
    env.storage()
        .instance()
        .set(&DataKey::Dispute(dispute.id), dispute);
}

/// Get dispute data
pub fn get_dispute(env: &Env, dispute_id: u64) -> Result<Dispute, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Dispute(dispute_id))
        .ok_or(Error::DisputeNotFound)
}

/// Store user disputes list
pub fn store_user_disputes(env: &Env, user_id: u64, disputes: &Vec<u64>) {
    env.storage()
        .instance()
        .set(&DataKey::UserDisputes(user_id), disputes);
}

/// Get user disputes list
pub fn get_user_disputes(env: &Env, user_id: u64) -> Vec<u64> {
    env.storage()
        .instance()
        .get(&DataKey::UserDisputes(user_id))
        .unwrap_or(Vec::new(env))
}

/// Store recovery plan
pub fn store_recovery_plan(env: &Env, plan: &RecoveryPlan) {
    env.storage()
        .instance()
        .set(&DataKey::RecoveryPlan(plan.user_id), plan);
}

/// Get recovery plan
pub fn get_recovery_plan(env: &Env, user_id: u64) -> Result<RecoveryPlan, Error> {
    env.storage()
        .instance()
        .get(&DataKey::RecoveryPlan(user_id))
        .ok_or(Error::RecoveryNotAllowed)
}

/// Store probation status
pub fn store_probation_status(env: &Env, status: &ProbationStatus) {
    env.storage()
        .instance()
        .set(&DataKey::ProbationStatus(status.user_id), status);
}

/// Get probation status
pub fn get_probation_status(env: &Env, user_id: u64) -> ProbationStatus {
    env.storage()
        .instance()
        .get(&DataKey::ProbationStatus(user_id))
        .unwrap_or(ProbationStatus {
            user_id,
            active: false,
            start_date: 0,
            end_date: 0,
            reason: String::from_str(env, ""),
            restrictions: Map::new(env),
        })
}

/// Store reputation history
pub fn store_reputation_history(env: &Env, history: &ReputationHistory) {
    let key = DataKey::ReputationHistory(history.user_id, history.subject.clone());
    env.storage().instance().set(&key, history);
}

/// Get reputation history
pub fn get_reputation_history(env: &Env, user_id: u64, subject: String) -> ReputationHistory {
    let key = DataKey::ReputationHistory(user_id, subject.clone());
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or(ReputationHistory {
            user_id,
            subject,
            scores: Map::new(env),
            changes: Map::new(env),
        })
}

/// Store analytics data
pub fn store_analytics(env: &Env, analytics: &Analytics) {
    env.storage()
        .instance()
        .set(&DataKey::Analytics(analytics.key.clone()), analytics);
}

/// Get analytics data
pub fn get_analytics(env: &Env, key: String) -> Option<Analytics> {
    env.storage().instance().get(&DataKey::Analytics(key))
}

/// Check if user exists
pub fn user_exists(env: &Env, user_id: u64) -> bool {
    env.storage().instance().has(&DataKey::User(user_id))
}

/// Check if reputation exists
pub fn reputation_exists(env: &Env, user_id: u64, subject: String) -> bool {
    env.storage()
        .instance()
        .has(&DataKey::Reputation(user_id, subject))
}

/// Check if dispute exists
pub fn dispute_exists(env: &Env, dispute_id: u64) -> bool {
    env.storage().instance().has(&DataKey::Dispute(dispute_id))
}

/// Get all users (for analytics purposes)
pub fn get_all_user_ids(env: &Env) -> Vec<u64> {
    let mut user_ids = Vec::new(env);
    let max_user_id = get_next_user_id(env);

    for user_id in 1..max_user_id {
        if user_exists(env, user_id) {
            user_ids.push_back(user_id);
        }
    }

    user_ids
}

/// Get all disputes (for analytics purposes)
pub fn get_all_dispute_ids(env: &Env) -> Vec<u64> {
    let mut dispute_ids = Vec::new(env);
    let max_dispute_id = get_next_dispute_id(env);

    for dispute_id in 1..max_dispute_id {
        if dispute_exists(env, dispute_id) {
            dispute_ids.push_back(dispute_id);
        }
    }

    dispute_ids
}

/// Clean up expired probations
pub fn cleanup_expired_probations(env: &Env) {
    let current_time = env.ledger().timestamp();
    let user_ids = get_all_user_ids(env);

    for user_id in user_ids.iter() {
        let mut probation = get_probation_status(env, user_id);
        if probation.active && current_time > probation.end_date {
            probation.active = false;
            store_probation_status(env, &probation);
        }
    }
}

// Security-related storage functions

/// Get next available import/export operation ID
pub fn get_next_import_export_id(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::NextImportExportId)
        .unwrap_or(1u64)
}

/// Increment and return next import/export operation ID
pub fn increment_import_export_id(env: &Env) -> u64 {
    let next_id = get_next_import_export_id(env);
    env.storage()
        .instance()
        .set(&DataKey::NextImportExportId, &(next_id + 1));
    next_id
}

/// Store rate limit data
pub fn store_rate_limit_data(env: &Env, rate_data: &RateLimitData) {
    env.storage()
        .instance()
        .set(&DataKey::RateLimit(rate_data.key.clone()), rate_data);
}

/// Get rate limit data
pub fn get_rate_limit_data(env: &Env, key: String) -> Option<RateLimitData> {
    env.storage()
        .instance()
        .get(&DataKey::RateLimit(key))
}

/// Store circuit breaker state
pub fn store_circuit_breaker_state(env: &Env, state: &CircuitBreakerState) {
    env.storage()
        .instance()
        .set(&DataKey::CircuitBreaker(state.key.clone()), state);
}

/// Get circuit breaker state
pub fn get_circuit_breaker_state(env: &Env, key: String) -> Option<CircuitBreakerState> {
    env.storage()
        .instance()
        .get(&DataKey::CircuitBreaker(key))
}

// Integration-related storage functions

/// Store external credential
pub fn store_external_credential(env: &Env, credential: &ExternalCredential) {
    env.storage()
        .instance()
        .set(&DataKey::ExternalCredential(credential.id.clone()), credential);
}

/// Get external credential
pub fn get_external_credential(env: &Env, credential_id: String) -> Option<ExternalCredential> {
    env.storage()
        .instance()
        .get(&DataKey::ExternalCredential(credential_id))
}

/// Store user's external credentials list
pub fn store_user_external_credentials(env: &Env, user_id: u64, credentials: &Vec<String>) {
    let key = DataKey::UserExternalCredentials(user_id);
    env.storage().instance().set(&key, credentials);
}

/// Get user's external credentials list
pub fn get_user_external_credentials(env: &Env, user_id: u64) -> Option<Vec<String>> {
    let key = DataKey::UserExternalCredentials(user_id);
    env.storage().instance().get(&key)
}

/// Store professional certification
pub fn store_professional_certification(env: &Env, certification: &ProfessionalCertification) {
    env.storage()
        .instance()
        .set(&DataKey::ProfessionalCert(certification.id.clone()), certification);
}

/// Get professional certification
pub fn get_professional_certification(env: &Env, certification_id: String) -> Option<ProfessionalCertification> {
    env.storage()
        .instance()
        .get(&DataKey::ProfessionalCert(certification_id))
}

/// Store user's professional certifications list
pub fn store_user_professional_certifications(env: &Env, user_id: u64, certifications: &Vec<String>) {
    let key = DataKey::UserProfessionalCerts(user_id);
    env.storage().instance().set(&key, certifications);
}

/// Get user's professional certifications list
pub fn get_user_professional_certifications(env: &Env, user_id: u64) -> Option<Vec<String>> {
    let key = DataKey::UserProfessionalCerts(user_id);
    env.storage().instance().get(&key)
}

/// Store system bridge configuration
pub fn store_system_bridge(env: &Env, bridge: &SystemBridge) {
    env.storage()
        .instance()
        .set(&DataKey::SystemBridge(bridge.id.clone()), bridge);
}

/// Get system bridge configuration
pub fn get_system_bridge(env: &Env, bridge_id: String) -> Option<SystemBridge> {
    env.storage()
        .instance()
        .get(&DataKey::SystemBridge(bridge_id))
}

/// Store import/export operation
pub fn store_import_export_operation(env: &Env, operation: &ImportExportOperation) {
    env.storage()
        .instance()
        .set(&DataKey::ImportExportLog(operation.id), operation);
}

/// Get import/export operation
pub fn get_import_export_operation(env: &Env, operation_id: u64) -> Option<ImportExportOperation> {
    env.storage()
        .instance()
        .get(&DataKey::ImportExportLog(operation_id))
}

/// Store credential mapping
pub fn store_credential_mapping(env: &Env, mapping: &CredentialMapping) {
    let key = DataKey::CredentialMapping(mapping.external_id.clone());
    env.storage().instance().set(&key, mapping);
}

/// Get credential mapping
pub fn get_credential_mapping(env: &Env, external_id: String) -> Option<CredentialMapping> {
    let key = DataKey::CredentialMapping(external_id);
    env.storage().instance().get(&key)
}

/// Check if external credential exists
pub fn external_credential_exists(env: &Env, credential_id: String) -> bool {
    env.storage()
        .instance()
        .has(&DataKey::ExternalCredential(credential_id))
}

/// Check if professional certification exists
pub fn professional_certification_exists(env: &Env, certification_id: String) -> bool {
    env.storage()
        .instance()
        .has(&DataKey::ProfessionalCert(certification_id))
}

/// Check if system bridge exists
pub fn system_bridge_exists(env: &Env, bridge_id: String) -> bool {
    env.storage()
        .instance()
        .has(&DataKey::SystemBridge(bridge_id))
}

/// Get all external credentials for analytics
pub fn get_all_external_credential_ids(env: &Env) -> Vec<String> {
    // This is a simplified implementation - in practice, you might want to maintain
    // a separate index for performance
    let credential_ids = Vec::new(env);
    
    // In a real implementation, you would iterate through stored keys
    // For now, return empty vector as placeholder
    credential_ids
}

/// Get all professional certifications for analytics
pub fn get_all_professional_certification_ids(env: &Env) -> Vec<String> {
    // This is a simplified implementation - in practice, you might want to maintain
    // a separate index for performance
    let certification_ids = Vec::new(env);
    
    // In a real implementation, you would iterate through stored keys
    // For now, return empty vector as placeholder
    certification_ids
}

/// Get all import/export operations for a user (optimized for gas)
pub fn get_user_import_export_operations(env: &Env, user_id: u64) -> Vec<u64> {
    // In a production environment, this would use an index for better performance
    // For now, we'll limit the search to avoid excessive gas usage
    let mut operation_ids = Vec::new(env);
    let max_operation_id = get_next_import_export_id(env);
    let search_limit = if max_operation_id > 100 { max_operation_id - 100 } else { 1 };
    
    // Search only recent operations to save gas
    for operation_id in search_limit..max_operation_id {
        if let Some(operation) = get_import_export_operation(env, operation_id) {
            if operation.user_id == user_id {
                operation_ids.push_back(operation_id);
            }
        }
    }
    
    operation_ids
}

/// Clean up expired credentials (gas-optimized batch processing)
pub fn cleanup_expired_credentials(env: &Env) {
    cleanup_expired_credentials_batch(env, 10); // Process max 10 users per call to save gas
}

/// Clean up expired credentials for a limited batch of users
pub fn cleanup_expired_credentials_batch(env: &Env, max_users: u32) {
    let current_time = env.ledger().timestamp();
    
    // Get all user IDs but limit processing to save gas
    let user_ids = get_all_user_ids(env);
    let process_count = if user_ids.len() > max_users { max_users } else { user_ids.len() };
    
    for i in 0..process_count {
        let user_id = user_ids.get(i).unwrap();
        
        // Process external credentials
        if let Some(credential_ids) = get_user_external_credentials(env, user_id) {
            for credential_id in credential_ids.iter() {
                if let Some(mut credential) = get_external_credential(env, credential_id) {
                    if let Some(expiry) = credential.expiry_date {
                        if current_time > expiry && 
                           !matches!(credential.verification_status, VerificationStatus::Expired) {
                            credential.verification_status = VerificationStatus::Expired;
                            store_external_credential(env, &credential);
                        }
                    }
                }
            }
        }
        
        // Process professional certifications
        if let Some(cert_ids) = get_user_professional_certifications(env, user_id) {
            for cert_id in cert_ids.iter() {
                if let Some(mut certification) = get_professional_certification(env, cert_id) {
                    if let Some(expiry) = certification.expiry_date {
                        if current_time > expiry && 
                           !matches!(certification.verification_status, VerificationStatus::Expired) {
                            certification.verification_status = VerificationStatus::Expired;
                            store_professional_certification(env, &certification);
                        }
                    }
                }
            }
        }
    }
}

// Verification tier system storage functions

/// Store user verification data
pub fn store_user_verification(env: &Env, verification: &UserVerification) {
    env.storage()
        .instance()
        .set(&DataKey::UserVerification(verification.user_id), verification);
}

/// Get user verification data
pub fn get_user_verification(env: &Env, user_id: u64) -> Option<UserVerification> {
    env.storage()
        .instance()
        .get(&DataKey::UserVerification(user_id))
}

/// Store verification delegation
pub fn store_verification_delegation(env: &Env, delegation: &VerificationDelegation) {
    env.storage()
        .instance()
        .set(&DataKey::VerificationDelegation(delegation.delegate.clone(), delegation.user_id), delegation);
}

/// Get verification delegation for specific delegate and user
pub fn get_verification_delegation(env: &Env, delegate: &Address, user_id: u64) -> Option<VerificationDelegation> {
    env.storage()
        .instance()
        .get(&DataKey::VerificationDelegation(delegate.clone(), user_id))
}
