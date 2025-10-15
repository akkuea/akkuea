use crate::error::ContractError;
use soroban_sdk::String;

const MIN_REVIEW_LENGTH: u32 = 5;
const MAX_REVIEW_LENGTH: u32 = 1000;

/// Validate review text
pub fn validate_review_text(text: &String) -> Result<(), ContractError> {
    let length = text.len();

    if length == 0 {
        return Err(ContractError::EmptyText);
    }

    if length < MIN_REVIEW_LENGTH {
        return Err(ContractError::TextTooShort);
    }

    if length > MAX_REVIEW_LENGTH {
        return Err(ContractError::TextTooLong);
    }

    Ok(())
}

/// Get sentiment category as a descriptive label
pub fn _get_sentiment_category(score: i32) -> &'static str {
    if score >= 30 {
        "positive"
    } else if score <= -30 {
        "negative"
    } else {
        "neutral"
    }
}
