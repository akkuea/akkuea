use soroban_sdk::{Address, Env, Vec, String, contracttype};
use crate::storage;
use crate::errors::TippingError;

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct WhitelistedToken {
    pub address: Address,
    pub symbol: String,
    pub decimals: u32,
    pub is_active: bool,
    pub min_tip_amount: i128,
    pub max_tip_amount: i128,
}

pub struct TokenManager;

impl TokenManager {
    /// Add a token to the whitelist (admin only)
    pub fn add_token(
        env: &Env,
        admin: &Address,
        token: Address,
        symbol: String,
        decimals: u32,
        min_tip_amount: i128,
        max_tip_amount: i128,
    ) -> Result<(), TippingError> {
        // Verify admin permissions
        Self::verify_admin(env, admin)?;

        let whitelisted_token = WhitelistedToken {
            address: token.clone(),
            symbol,
            decimals,
            is_active: true,
            min_tip_amount,
            max_tip_amount,
        };

        storage::set_whitelisted_token(env, &token, &whitelisted_token);
        
        // Add to the list of all tokens if not already present
        let mut token_list = storage::get_token_list(env);
        if !Self::token_exists_in_list(&token_list, &token) {
            token_list.push_back(token);
            storage::set_token_list(env, &token_list);
        }

        Ok(())
    }

    /// Remove a token from the whitelist (admin only)
    pub fn remove_token(
        env: &Env,
        admin: &Address,
        token: &Address,
    ) -> Result<(), TippingError> {
        Self::verify_admin(env, admin)?;

        // Deactivate the token instead of removing to maintain history
        if let Some(mut whitelisted_token) = storage::get_whitelisted_token(env, token) {
            whitelisted_token.is_active = false;
            storage::set_whitelisted_token(env, token, &whitelisted_token);
        }

        Ok(())
    }

    /// Check if a token is whitelisted and active
    pub fn is_token_whitelisted(env: &Env, token: &Address) -> bool {
        if let Some(whitelisted_token) = storage::get_whitelisted_token(env, token) {
            whitelisted_token.is_active
        } else {
            false
        }
    }

    /// Validate a tip amount for a specific token
    pub fn validate_tip_amount(
        env: &Env,
        token: &Address,
        amount: i128,
    ) -> Result<(), TippingError> {
        if amount <= 0 {
            return Err(TippingError::InvalidAmount);
        }

        if let Some(whitelisted_token) = storage::get_whitelisted_token(env, token) {
            if !whitelisted_token.is_active {
                return Err(TippingError::TokenNotWhitelisted);
            }

            if amount < whitelisted_token.min_tip_amount {
                return Err(TippingError::AmountTooSmall);
            }

            if amount > whitelisted_token.max_tip_amount {
                return Err(TippingError::AmountTooLarge);
            }

            Ok(())
        } else {
            Err(TippingError::TokenNotWhitelisted)
        }
    }

    /// Get all whitelisted tokens
    pub fn get_whitelisted_tokens(env: &Env) -> Vec<WhitelistedToken> {
        let token_list = storage::get_token_list(env);
        let mut result = Vec::new(env);

        for i in 0..token_list.len() {
            if let Some(token_address) = token_list.get(i) {
                if let Some(whitelisted_token) = storage::get_whitelisted_token(env, &token_address) {
                    if whitelisted_token.is_active {
                        result.push_back(whitelisted_token);
                    }
                }
            }
        }

        result
    }

    /// Get token information
    pub fn get_token_info(env: &Env, token: &Address) -> Option<WhitelistedToken> {
        storage::get_whitelisted_token(env, token)
    }

    /// Update token limits (admin only)
    pub fn update_token_limits(
        env: &Env,
        admin: &Address,
        token: &Address,
        min_tip_amount: i128,
        max_tip_amount: i128,
    ) -> Result<(), TippingError> {
        Self::verify_admin(env, admin)?;

        if let Some(mut whitelisted_token) = storage::get_whitelisted_token(env, token) {
            whitelisted_token.min_tip_amount = min_tip_amount;
            whitelisted_token.max_tip_amount = max_tip_amount;
            storage::set_whitelisted_token(env, token, &whitelisted_token);
            Ok(())
        } else {
            Err(TippingError::TokenNotWhitelisted)
        }
    }

    /// Helper function to verify admin permissions
    fn verify_admin(env: &Env, admin: &Address) -> Result<(), TippingError> {
        if let Some(contract_admin) = storage::get_admin(env) {
            if *admin == contract_admin {
                Ok(())
            } else {
                Err(TippingError::Unauthorized)
            }
        } else {
            Err(TippingError::Unauthorized)
        }
    }

    /// Helper function to check if token exists in list
    fn token_exists_in_list(token_list: &Vec<Address>, token: &Address) -> bool {
        for i in 0..token_list.len() {
            if let Some(existing_token) = token_list.get(i) {
                if existing_token == *token {
                    return true;
                }
            }
        }
        false
    }

    /// Convert token amount to standardized decimals (18 decimals as base)
    pub fn normalize_amount(amount: i128, token_decimals: u32) -> i128 {
        const BASE_DECIMALS: u32 = 18;
        
        if token_decimals == BASE_DECIMALS {
            amount
        } else if token_decimals < BASE_DECIMALS {
            let multiplier = 10_i128.pow(BASE_DECIMALS - token_decimals);
            amount * multiplier
        } else {
            let divisor = 10_i128.pow(token_decimals - BASE_DECIMALS);
            amount / divisor
        }
    }

    /// Convert normalized amount back to token-specific decimals
    pub fn denormalize_amount(normalized_amount: i128, token_decimals: u32) -> i128 {
        const BASE_DECIMALS: u32 = 18;
        
        if token_decimals == BASE_DECIMALS {
            normalized_amount
        } else if token_decimals < BASE_DECIMALS {
            let divisor = 10_i128.pow(BASE_DECIMALS - token_decimals);
            normalized_amount / divisor
        } else {
            let multiplier = 10_i128.pow(token_decimals - BASE_DECIMALS);
            normalized_amount * multiplier
        }
    }
}