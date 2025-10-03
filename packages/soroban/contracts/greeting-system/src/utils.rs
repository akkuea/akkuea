use soroban_sdk::{Address, Env, String};

use crate::Error;

/// Validate contribution amount
/// Ensures the contribution is positive and non-zero
pub fn validate_contribution(contribution: i128) -> Result<(), Error> {
    if contribution <= 0 {
        return Err(Error::InvalidContribution);
    }

    if contribution == 0 {
        return Err(Error::ZeroContribution);
    }

    Ok(())
}

/// Verify that the user is authorized (must be a valid Stellar account)
/// In production, this should verify against account flags or additional criteria
pub fn verify_user_authorization(_env: &Env, user: &Address) -> Result<(), Error> {
    // Require authentication from the user
    user.require_auth();

    // Additional verification could be added here:
    // - Check if account is on a whitelist
    // - Verify account age
    // - Check account trustlines
    // - Validate account flags

    Ok(())
}

/// Get current timestamp from the Soroban ledger
pub fn get_current_timestamp(env: &Env) -> u64 {
    env.ledger().timestamp()
}

/// Convert XLM to Stroops (1 XLM = 10,000,000 Stroops)
pub fn xlm_to_stroops(xlm: i128) -> i128 {
    xlm * 10_000_000
}

/// Convert Stroops to XLM (1 XLM = 10,000,000 Stroops)
pub fn stroops_to_xlm(stroops: i128) -> i128 {
    stroops / 10_000_000
}

/// Basic engagement-based eligibility check: at least MIN_LIKES likes
pub fn is_greeting_eligible(env: &Env, greeting_id: u64) -> bool {
    let like_count_key = (soroban_sdk::symbol_short!("LIKE_CNT"), greeting_id);
    let likes: u64 = env.storage().persistent().get(&like_count_key).unwrap_or(0);
    const MIN_LIKES: u64 = 5;
    likes >= MIN_LIKES
}

/// Validate non-zero positive token amount in Stroops
pub fn validate_token_amount(token_amount: i128) -> Result<(), Error> {
    if token_amount <= 0 {
        return Err(Error::InvalidContribution);
    }
    Ok(())
}
pub fn validate_name(name: &String) -> Result<(), Error> {
    let len = name.len() as u32;
    if len == 0 || len > 64 {
        return Err(Error::InvalidName);
    }
    Ok(())
}

/// Validate user preferences input
pub fn validate_preferences(preferences: &String) -> Result<(), Error> {
    let len = preferences.len() as u32;
    if len > 256 {
        return Err(Error::InvalidPreferences);
    }
    Ok(())
}

/// Check if a greeting text contains inappropriate content
/// Uses simple keyword-based filtering for gas efficiency
/// Note: Case-sensitive for simplicity; in production, use more advanced filtering
pub fn is_inappropriate_content(text: &String) -> bool {
    // For simplicity, check for common inappropriate words
    // In real implementation, this could be more sophisticated
    let inappropriate_words = [
        "inappropriate", "offensive", "hate", "spam", "abuse",
        "INAPPROPRIATE", "OFFENSIVE", "HATE", "SPAM", "ABUSE"
    ];

    for word in inappropriate_words.iter() {
        if text.contains(word) {
            return true;
        }
    }
    false
}

/// Validate flag reason
pub fn validate_flag_reason(reason: &String) -> Result<(), Error> {
    let len = reason.len() as u32;
    if len == 0 || len > 256 {
        return Err(Error::InvalidPreferences); // Reuse error, or add new
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_contribution_positive() {
        assert!(validate_contribution(100).is_ok());
        assert!(validate_contribution(1000000).is_ok());
    }

    #[test]
    fn test_validate_contribution_zero() {
        assert_eq!(validate_contribution(0), Err(Error::InvalidContribution));
    }

    #[test]
    fn test_validate_contribution_negative() {
        assert_eq!(validate_contribution(-100), Err(Error::InvalidContribution));
    }

    #[test]
    fn test_xlm_stroops_conversion() {
        assert_eq!(xlm_to_stroops(1), 10_000_000);
        assert_eq!(xlm_to_stroops(100), 1_000_000_000);
        assert_eq!(stroops_to_xlm(10_000_000), 1);
        assert_eq!(stroops_to_xlm(1_000_000_000), 100);
    }
}
