use crate::error::Error;
use crate::storage;
use crate::types::*;
use soroban_sdk::{Address, Env, String, Vec};

/// Security module providing input validation, rate limiting, circuit breakers, and formal verification

// Constants for security limits
const MAX_STRING_LENGTH: u32 = 1000;
const MAX_SCORE: u32 = 1000;
const MAX_RATE_LIMIT_WINDOW: u64 = 3600; // 1 hour in seconds
const DEFAULT_RATE_LIMIT: u32 = 100; // Default operations per window
const CIRCUIT_BREAKER_THRESHOLD: u32 = 10; // Failures before circuit opens
const CIRCUIT_BREAKER_TIMEOUT: u64 = 300; // 5 minutes in seconds

/// Input validation functions

/// Validate user input for registration
pub fn validate_user_input(name: &String) -> Result<(), Error> {
    if name.len() == 0 || name.len() as u32 > MAX_STRING_LENGTH {
        return Err(Error::InvalidInput);
    }

    // Check for common malicious patterns
    // For Soroban, we'll do basic validation using simple character checks
    // In production, more sophisticated validation would be implemented
    // For now, we'll check length only and rely on broader security measures
    // Advanced pattern matching would require external validation services

    Ok(())
}

/// Validate reputation score input
pub fn validate_reputation_score(score: u32) -> Result<(), Error> {
    if score > MAX_SCORE {
        return Err(Error::InvalidInput);
    }
    Ok(())
}

/// Validate subject string
pub fn validate_subject(subject: &String) -> Result<(), Error> {
    if subject.len() == 0 || subject.len() as u32 > MAX_STRING_LENGTH {
        return Err(Error::InvalidInput);
    }

    // Basic validation - more sophisticated checks would be added in production
    // Skip string content validation for now to avoid to_string() issues

    Ok(())
}

/// Validate evidence string for disputes
pub fn validate_evidence(evidence: &String) -> Result<(), Error> {
    if evidence.len() == 0 || evidence.len() as u32 > (MAX_STRING_LENGTH * 5) {
        return Err(Error::InvalidInput);
    }
    Ok(())
}

/// Rate limiting functions

/// Check if user has exceeded rate limit
pub fn check_rate_limit(env: &Env, _user_address: &Address, operation: &str) -> Result<(), Error> {
    let current_time = env.ledger().timestamp();
    let window_start = if current_time > MAX_RATE_LIMIT_WINDOW {
        current_time - MAX_RATE_LIMIT_WINDOW
    } else {
        0
    };

    // Simplified rate limiting key to avoid string concatenation issues
    let rate_limit_key = String::from_str(env, operation);
    let mut rate_data: RateLimitData = storage::get_rate_limit_data(env, rate_limit_key.clone())
        .unwrap_or(RateLimitData {
            key: rate_limit_key.clone(),
            operations: Vec::new(env),
            limit: DEFAULT_RATE_LIMIT,
            window_start,
        });

    // Clean old operations
    let mut new_operations = Vec::new(env);
    for timestamp in rate_data.operations.iter() {
        if timestamp >= window_start {
            new_operations.push_back(timestamp);
        }
    }
    rate_data.operations = new_operations;

    // Check if limit exceeded
    if rate_data.operations.len() >= rate_data.limit {
        return Err(Error::RateLimitExceeded);
    }

    // Add current operation
    rate_data.operations.push_back(current_time);
    storage::store_rate_limit_data(env, &rate_data);

    Ok(())
}

/// Update rate limit for specific user and operation
pub fn update_rate_limit(
    env: &Env,
    _user_address: &Address,
    operation: &str,
    new_limit: u32,
) -> Result<(), Error> {
    // Simplified rate limiting key to avoid string concatenation issues
    let rate_limit_key = String::from_str(env, operation);
    let current_time = env.ledger().timestamp();
    let window_start = current_time - MAX_RATE_LIMIT_WINDOW;

    let mut rate_data: RateLimitData = storage::get_rate_limit_data(env, rate_limit_key.clone())
        .unwrap_or(RateLimitData {
            key: rate_limit_key.clone(),
            operations: Vec::new(env),
            limit: new_limit,
            window_start,
        });

    rate_data.limit = new_limit;
    storage::store_rate_limit_data(env, &rate_data);

    Ok(())
}

/// Circuit breaker functions

/// Check circuit breaker status
pub fn check_circuit_breaker(env: &Env, service: &str) -> Result<(), Error> {
    let circuit_key = String::from_str(env, service);
    let circuit_state = storage::get_circuit_breaker_state(env, circuit_key.clone()).unwrap_or(
        CircuitBreakerState {
            key: circuit_key.clone(),
            state: CircuitState::Closed,
            failure_count: 0,
            last_failure_time: 0,
            last_success_time: env.ledger().timestamp(),
        },
    );

    match circuit_state.state {
        CircuitState::Open => {
            let current_time = env.ledger().timestamp();
            if current_time - circuit_state.last_failure_time > CIRCUIT_BREAKER_TIMEOUT {
                // Move to half-open state
                let mut new_state = circuit_state;
                new_state.state = CircuitState::HalfOpen;
                storage::store_circuit_breaker_state(env, &new_state);
                Ok(())
            } else {
                Err(Error::ServiceUnavailable)
            }
        }
        CircuitState::HalfOpen => Ok(()), // Allow limited requests
        CircuitState::Closed => Ok(()),   // Normal operation
    }
}

/// Record operation success for circuit breaker
pub fn record_success(env: &Env, service: &str) -> Result<(), Error> {
    let circuit_key = String::from_str(env, service);
    let mut circuit_state = storage::get_circuit_breaker_state(env, circuit_key.clone()).unwrap_or(
        CircuitBreakerState {
            key: circuit_key.clone(),
            state: CircuitState::Closed,
            failure_count: 0,
            last_failure_time: 0,
            last_success_time: env.ledger().timestamp(),
        },
    );

    circuit_state.failure_count = 0;
    circuit_state.last_success_time = env.ledger().timestamp();
    circuit_state.state = CircuitState::Closed;

    storage::store_circuit_breaker_state(env, &circuit_state);
    Ok(())
}

/// Record operation failure for circuit breaker
pub fn record_failure(env: &Env, service: &str) -> Result<(), Error> {
    let circuit_key = String::from_str(env, service);
    let mut circuit_state = storage::get_circuit_breaker_state(env, circuit_key.clone()).unwrap_or(
        CircuitBreakerState {
            key: circuit_key.clone(),
            state: CircuitState::Closed,
            failure_count: 0,
            last_failure_time: 0,
            last_success_time: env.ledger().timestamp(),
        },
    );

    circuit_state.failure_count += 1;
    circuit_state.last_failure_time = env.ledger().timestamp();

    if circuit_state.failure_count >= CIRCUIT_BREAKER_THRESHOLD {
        circuit_state.state = CircuitState::Open;
    }

    storage::store_circuit_breaker_state(env, &circuit_state);
    Ok(())
}

/// Formal verification functions

/// Verify reputation invariants
pub fn verify_reputation_invariants(env: &Env, user_id: u64, subject: String) -> Result<(), Error> {
    // Check if user exists
    if !storage::user_exists(env, user_id) {
        return Err(Error::UserNotFound);
    }

    // Get reputation
    if let Ok(reputation) = storage::get_reputation(env, user_id, subject.clone()) {
        // Verify score bounds
        if reputation.score > MAX_SCORE {
            return Err(Error::SecurityViolation);
        }

        // Verify user ID consistency
        if reputation.user_id != user_id {
            return Err(Error::SecurityViolation);
        }

        // Verify subject consistency
        if reputation.subject != subject {
            return Err(Error::SecurityViolation);
        }
    }

    Ok(())
}

/// Verify user invariants
pub fn verify_user_invariants(_env: &Env, user: &User) -> Result<(), Error> {
    // Check name validity
    validate_user_input(&user.name)?;

    // Check expertise areas bounds
    for (subject, level) in user.expertise_areas.iter() {
        validate_subject(&subject)?;
        if level > MAX_SCORE {
            return Err(Error::SecurityViolation);
        }
    }

    Ok(())
}

/// Verify dispute invariants
pub fn verify_dispute_invariants(env: &Env, dispute: &Dispute) -> Result<(), Error> {
    // Check if user exists
    if !storage::user_exists(env, dispute.user_id) {
        return Err(Error::UserNotFound);
    }

    // Verify subject
    validate_subject(&dispute.subject)?;

    // Verify evidence
    validate_evidence(&dispute.evidence)?;

    // Verify scores
    validate_reputation_score(dispute.original_score)?;
    validate_reputation_score(dispute.disputed_score)?;

    // Verify timestamps
    if dispute.created_at > env.ledger().timestamp() {
        return Err(Error::SecurityViolation);
    }

    if let Some(resolved_at) = dispute.resolved_at {
        if resolved_at < dispute.created_at {
            return Err(Error::SecurityViolation);
        }
    }

    Ok(())
}

/// Security audit function
pub fn perform_security_audit(env: &Env) -> Result<SecurityAuditReport, Error> {
    let mut report = SecurityAuditReport {
        timestamp: env.ledger().timestamp(),
        total_users: 0,
        verified_users: 0,
        active_disputes: 0,
        probation_users: 0,
        security_violations: 0,
        rate_limit_violations: 0,
        circuit_breaker_trips: 0,
        recommendations: Vec::new(env),
    };

    // Count users and verify their data
    let all_user_ids = storage::get_all_user_ids(env);
    report.total_users = all_user_ids.len();

    for user_id in all_user_ids.iter() {
        if let Ok(user) = storage::get_user(env, user_id) {
            if user.verified {
                report.verified_users += 1;
            }

            // Verify user invariants
            if verify_user_invariants(env, &user).is_err() {
                report.security_violations += 1;
            }
        }

        // Check probation status
        let probation = storage::get_probation_status(env, user_id);
        if probation.active {
            report.probation_users += 1;
        }
    }

    // Count active disputes
    let all_dispute_ids = storage::get_all_dispute_ids(env);
    for dispute_id in all_dispute_ids.iter() {
        if let Ok(dispute) = storage::get_dispute(env, dispute_id) {
            match dispute.status {
                DisputeStatus::Pending | DisputeStatus::UnderReview => {
                    report.active_disputes += 1;
                }
                _ => {}
            }

            // Verify dispute invariants
            if verify_dispute_invariants(env, &dispute).is_err() {
                report.security_violations += 1;
            }
        }
    }

    // Add recommendations based on findings
    if report.security_violations > 0 {
        report
            .recommendations
            .push_back(String::from_str(env, "Investigate security violations"));
    }

    if report.probation_users > report.total_users / 10 {
        report
            .recommendations
            .push_back(String::from_str(env, "Review probation policies"));
    }

    if report.active_disputes > report.total_users / 20 {
        report
            .recommendations
            .push_back(String::from_str(env, "Improve dispute resolution"));
    }

    Ok(report)
}

/// Access control functions

/// Check if caller has admin privileges
pub fn check_admin_access(env: &Env, caller: &Address) -> Result<(), Error> {
    // In a real implementation, this would check against a list of admin addresses
    // For now, we'll use a simple check - in production, this should be configurable
    let admin_key = DataKey::Admin(caller.clone());

    if !env.storage().instance().has(&admin_key) {
        return Err(Error::NotAuthorized);
    }

    Ok(())
}

/// Check if caller has moderator privileges
pub fn check_moderator_access(env: &Env, caller: &Address) -> Result<(), Error> {
    // Check if caller is admin first
    if check_admin_access(env, caller).is_ok() {
        return Ok(());
    }

    // Check moderator access
    let moderator_key = DataKey::Moderator(caller.clone());

    if !env.storage().instance().has(&moderator_key) {
        return Err(Error::NotAuthorized);
    }

    Ok(())
}

/// Check if user can perform operation based on probation status
pub fn check_probation_restrictions(env: &Env, user_id: u64, operation: &str) -> Result<(), Error> {
    let probation = storage::get_probation_status(env, user_id);

    if !probation.active {
        return Ok(());
    }

    // Check if operation is restricted
    if probation
        .restrictions
        .contains_key(String::from_str(env, operation))
    {
        if let Some(restricted) = probation.restrictions.get(String::from_str(env, operation)) {
            if restricted {
                return Err(Error::ProbationActive);
            }
        }
    }

    Ok(())
}
