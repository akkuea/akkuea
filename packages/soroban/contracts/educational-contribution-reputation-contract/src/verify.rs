use soroban_sdk::{contracttype, Address, Env, String};

use crate::error::Error;
use crate::storage;
use crate::types::*;
use crate::security;

const SECONDS_PER_DAY: u64 = 24 * 3600;
const DAYS_PER_YEAR: u64 = 365;
const RENEWAL_WINDOW_DAYS: u64 = 30;

const BASIC_VALIDITY_YEARS: u64 = 1;
const VERIFIED_VALIDITY_YEARS: u64 = 2;
const EXPERT_VALIDITY_YEARS: u64 = 3;
const AUTHORITY_VALIDITY_YEARS: u64 = 5;

#[contracttype]
#[derive(Clone, Copy, PartialEq)]
pub enum VerificationTier {
    Basic = 1,
    Verified = 2,
    Expert = 3,
    Authority = 4,
}

impl VerificationTier {
    pub fn from_u32(value: u32) -> Result<Self, Error> {
        match value {
            1 => Ok(VerificationTier::Basic),
            2 => Ok(VerificationTier::Verified),
            3 => Ok(VerificationTier::Expert),
            4 => Ok(VerificationTier::Authority),
            _ => Err(Error::InvalidInput),
        }
    }

    pub fn as_u32(&self) -> u32 {
        *self as u32
    }

    pub fn validity_period(&self) -> u64 {
        let years = match self {
            VerificationTier::Basic => BASIC_VALIDITY_YEARS,
            VerificationTier::Verified => VERIFIED_VALIDITY_YEARS,
            VerificationTier::Expert => EXPERT_VALIDITY_YEARS,
            VerificationTier::Authority => AUTHORITY_VALIDITY_YEARS,
        };
        years * DAYS_PER_YEAR * SECONDS_PER_DAY
    }

    pub fn can_verify_tier(&self, target_tier: VerificationTier) -> bool {
        match self {
            VerificationTier::Authority => true,
            VerificationTier::Expert => target_tier.as_u32() <= VerificationTier::Verified.as_u32(),
            VerificationTier::Verified => target_tier == VerificationTier::Basic,
            VerificationTier::Basic => false,
        }
    }

    pub fn get_validation_rules(&self, env: &Env) -> TierValidationRules {
        match self {
            VerificationTier::Basic => TierValidationRules {
                tier: 1,
                requires_previous_verification: false,
                min_expertise_areas: 0,
                requires_verified_status: false,
                validity_years: BASIC_VALIDITY_YEARS,
                description: String::from_str(env, "Basic verification - Entry level"),
            },
            VerificationTier::Verified => TierValidationRules {
                tier: 2,
                requires_previous_verification: false,
                min_expertise_areas: 0,
                requires_verified_status: false,
                validity_years: VERIFIED_VALIDITY_YEARS,
                description: String::from_str(env, "Verified by moderator - Trusted user"),
            },
            VerificationTier::Expert => TierValidationRules {
                tier: 3,
                requires_previous_verification: true,
                min_expertise_areas: 1,
                requires_verified_status: true,
                validity_years: EXPERT_VALIDITY_YEARS,
                description: String::from_str(env, "Expert level - Has credentials and expertise"),
            },
            VerificationTier::Authority => TierValidationRules {
                tier: 4,
                requires_previous_verification: true,
                min_expertise_areas: 2,
                requires_verified_status: true,
                validity_years: AUTHORITY_VALIDITY_YEARS,
                description: String::from_str(env, "Institutional authority - Can verify others"),
            },
        }
    }
}

/// Verify user with specific tier
pub fn verify_user_with_tier(
    env: Env,
    caller: Address,
    user_id: u64,
    verification_details: String,
    target_tier: u32,
) -> Result<(), Error> {
    caller.require_auth();

    let tier = VerificationTier::from_u32(target_tier)?;

    let mut user = storage::get_user(&env, user_id)?;

    // Check if user already has higher or equal tier
    if let Some(current_verification) = storage::get_user_verification(&env, user_id) {
        if current_verification.tier >= tier.as_u32()
            && !is_verification_expired(&env, &current_verification) {
            return Err(Error::AlreadyVerified);
        }
    }

    if verification_details.is_empty() {
        return Err(Error::InvalidInput);
    }

    if !can_caller_verify_tier(&env, &caller, user_id, tier)? {
        return Err(Error::NotAuthorized);
    }

    validate_tier_requirements(&env, user_id, target_tier)?;

    let verification = UserVerification {
        user_id,
        tier: tier.as_u32(),
        verified_by: caller.clone(),
        verified_at: env.ledger().timestamp(),
        expires_at: env.ledger().timestamp() + tier.validity_period(),
        verification_details,
    };

    storage::store_user_verification(&env, &verification);

    // Update user verified status for backward compatibility
    user.verified = true;
    storage::store_user(&env, &user);

    Ok(())
}

/// Renew verification for a user - Expiration and renewal processes
pub fn renew_verification(
    env: Env,
    caller: Address,
    user_id: u64,
) -> Result<(), Error> {
    caller.require_auth();

    let verification = storage::get_user_verification(&env, user_id)
        .ok_or(Error::NotVerified)?;
    
    let current_time = env.ledger().timestamp();
    let renewal_window = RENEWAL_WINDOW_DAYS * SECONDS_PER_DAY;
    
    if verification.expires_at > current_time + renewal_window {
        return Err(Error::RenewalNotDue);
    }

    let tier = VerificationTier::from_u32(verification.tier)?;

    // Check caller authority for renewal
    if !can_caller_verify_tier(&env, &caller, user_id, tier)? {
        return Err(Error::NotAuthorized);
    }

    // Update verification
    let updated_verification = UserVerification {
        user_id,
        tier: verification.tier,
        verified_by: caller,
        verified_at: current_time,
        expires_at: current_time + tier.validity_period(),
        verification_details: verification.verification_details,
    };

    storage::store_user_verification(&env, &updated_verification);

    Ok(())
}

/// Add verification delegation - allows delegating verification authority for specific user
pub fn add_verification_delegation(
    env: Env,
    caller: Address,
    delegate_address: Address,
    user_id: u64,
    max_tier: u32,
    duration_days: u32,
) -> Result<(), Error> {
    caller.require_auth();

    if security::check_admin_access(&env, &caller).is_err() {
        return Err(Error::NotAuthorized);
    }

    let _tier = VerificationTier::from_u32(max_tier)?;

    let _user = storage::get_user(&env, user_id)?;

    // Create delegation
    let delegation = VerificationDelegation {
        delegator: caller,
        delegate: delegate_address,
        user_id,
        max_tier,
        expires_at: env.ledger().timestamp() + (duration_days as u64 * SECONDS_PER_DAY),
    };

    storage::store_verification_delegation(&env, &delegation);

    Ok(())
}

/// Check tier requirements - comprehensive validation with proper struct
fn validate_tier_requirements(
    env: &Env,
    user_id: u64,
    target_tier: u32,
) -> Result<(), Error> {
    let tier = VerificationTier::from_u32(target_tier)?;
    let rules = tier.get_validation_rules(env);
    
    // Basic validation - check if user exists and is in good standing
    let user = storage::get_user(env, user_id)?;
    
    // Check if user needs previous verification
    if rules.requires_previous_verification {
        if let Some(current_verification) = storage::get_user_verification(env, user_id) {
            // Check if current verification is expired
            if is_verification_expired(env, &current_verification) {
                return Err(Error::NotVerified);
            }
        } else {
            // No verification found but required
            return Err(Error::NotVerified);
        }
    }
    
    // Check if user needs verified status
    if rules.requires_verified_status && !user.verified {
        return Err(Error::NotVerified);
    }
    
    // Check minimum expertise areas requirement
    if user.expertise_areas.len() < rules.min_expertise_areas {
        return Err(Error::InsufficientExpertise);
    }
    
    Ok(())
}


// Helper functions
fn is_verification_expired(env: &Env, verification: &UserVerification) -> bool {
    verification.expires_at <= env.ledger().timestamp()
}

fn can_caller_verify_tier(env: &Env, caller: &Address, user_id: u64, target_tier: VerificationTier) -> Result<bool, Error> {
    if security::check_admin_access(env, caller).is_ok() {
        return Ok(true);
    }
    
    // Check if caller has active delegation for this specific user and tier
    if let Some(delegation) = storage::get_verification_delegation(env, caller, user_id) {
        // Check if delegation is valid and not expired
        if delegation.expires_at > env.ledger().timestamp() {
            // Check if delegation tier allows verifying target tier
            let delegation_tier = VerificationTier::from_u32(delegation.max_tier)?;
            if delegation_tier.can_verify_tier(target_tier) {
                return Ok(true);
            }
        }
    }
    
    Ok(false)
}

// Legacy function - kept for backward compatibility
pub fn verify_user(
    env: Env,
    caller: Address,
    user_id: u64,
    verification_details: String,
) -> Result<(), Error> {
    caller.require_auth();

    // Verify user exists and is not already verified
    let mut user: User = env
        .storage()
        .instance()
        .get(&DataKey::User(user_id)) // This should be caller's user_id; adjust logic as needed
        .ok_or(Error::UserNotFound)?;

    if user.verified {
        return Err(Error::AlreadyVerified);
    }

    // Basic validation of verification details (e.g., non-empty)
    if verification_details.is_empty() {
        return Err(Error::InvalidInput);
    }

    // Mark user as verified
    user.verified = true;
    env.storage().instance().set(&DataKey::User(user_id), &user);

    Ok(())
}

pub fn verify_content(
    env: Env,
    caller: Address,
    content_id: u64,
    subject: String,
) -> Result<(), Error> {
    caller.require_auth();

    // Only verified users can verify content
    let user: User = env
        .storage()
        .instance()
        .get(&DataKey::User(content_id)) // Adjust to use caller's user_id if needed
        .ok_or(Error::UserNotFound)?;
    if !user.verified {
        return Err(Error::NotVerified);
    }

    // Check if user has expertise in the subject
    let expertise_level = user.expertise_areas.get(subject).unwrap_or(0);
    if expertise_level == 0 {
        return Err(Error::NotAuthorized);
    }

    // Content verification logic (placeholder: could emit an event or update a content status)
    Ok(())
}
