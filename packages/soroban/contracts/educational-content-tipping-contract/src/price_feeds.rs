use soroban_sdk::{Address, Env, Vec, String, contracttype};
use crate::storage;
use crate::errors::TippingError;
use crate::token::TokenManager;

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PriceData {
    pub token: Address,
    pub price_in_usd: i128,  // Price with 8 decimal places (like Chainlink)
    pub last_updated: u64,
    pub confidence: u32,     // Confidence level (0-100)
    pub oracle_source: String,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct ConversionRate {
    pub from_token: Address,
    pub to_token: Address,
    pub rate: i128,          // Exchange rate with 18 decimal places
    pub last_updated: u64,
}

pub struct PriceFeed;

impl PriceFeed {
    /// Update price data for a token (oracle or admin only)
    pub fn update_price(
        env: &Env,
        oracle: &Address,
        token: &Address,
        price_in_usd: i128,
        confidence: u32,
        oracle_source: String,
    ) -> Result<(), TippingError> {
        // Verify oracle permissions
        Self::verify_oracle_permissions(env, oracle)?;

        if confidence > 100 {
            return Err(TippingError::InvalidInput);
        }

        let price_data = PriceData {
            token: token.clone(),
            price_in_usd,
            last_updated: env.ledger().timestamp(),
            confidence,
            oracle_source,
        };

        storage::set_price_data(env, token, &price_data);
        Ok(())
    }

    /// Get price data for a token
    pub fn get_price_data(env: &Env, token: &Address) -> Option<PriceData> {
        storage::get_price_data(env, token)
    }

    /// Check if price data is fresh (within acceptable time window)
    pub fn is_price_fresh(env: &Env, token: &Address, max_age_seconds: u64) -> bool {
        if let Some(price_data) = Self::get_price_data(env, token) {
            let current_time = env.ledger().timestamp();
            current_time - price_data.last_updated <= max_age_seconds
        } else {
            false
        }
    }

    /// Calculate USD value of a token amount
    pub fn calculate_usd_value(
        env: &Env,
        token: &Address,
        amount: i128,
    ) -> Result<i128, TippingError> {
        let price_data = Self::get_price_data(env, token)
            .ok_or(TippingError::PriceDataNotFound)?;

        // Check price freshness (24 hours max)
        if !Self::is_price_fresh(env, token, 86400) {
            return Err(TippingError::PriceDataStale);
        }

        // Check confidence level (minimum 80%)
        if price_data.confidence < 80 {
            return Err(TippingError::LowPriceConfidence);
        }

        // Get token info for decimal normalization
        let token_info = TokenManager::get_token_info(env, token)
            .ok_or(TippingError::TokenNotWhitelisted)?;

        // Normalize amount to 18 decimals
        let normalized_amount = TokenManager::normalize_amount(amount, token_info.decimals);

        // Calculate USD value: (normalized_amount * price_in_usd) / 10^18
        // Price is in 8 decimals, so result will be in 8 decimals
        let usd_value = (normalized_amount * price_data.price_in_usd) / 1_000_000_000_000_000_000_i128;

        Ok(usd_value)
    }

    /// Convert amount from one token to another using USD as bridge
    pub fn convert_token_amount(
        env: &Env,
        from_token: &Address,
        to_token: &Address,
        amount: i128,
    ) -> Result<i128, TippingError> {
        // Handle same token conversion
        if from_token == to_token {
            return Ok(amount);
        }

        // Get USD value of the from_token amount
        let usd_value = Self::calculate_usd_value(env, from_token, amount)?;

        // Get price data for to_token
        let to_price_data = Self::get_price_data(env, to_token)
            .ok_or(TippingError::PriceDataNotFound)?;

        // Check to_token price freshness
        if !Self::is_price_fresh(env, to_token, 86400) {
            return Err(TippingError::PriceDataStale);
        }

        // Check to_token confidence level
        if to_price_data.confidence < 80 {
            return Err(TippingError::LowPriceConfidence);
        }

        // Get to_token info for decimal handling
        let to_token_info = TokenManager::get_token_info(env, to_token)
            .ok_or(TippingError::TokenNotWhitelisted)?;

        // Calculate to_token amount: (usd_value * 10^18) / to_price_in_usd
        let normalized_to_amount = (usd_value * 1_000_000_000_000_000_000_i128) / to_price_data.price_in_usd;

        // Denormalize to target token decimals
        let to_amount = TokenManager::denormalize_amount(normalized_to_amount, to_token_info.decimals);

        Ok(to_amount)
    }

    /// Get conversion rate between two tokens
    pub fn get_conversion_rate(
        env: &Env,
        from_token: &Address,
        to_token: &Address,
    ) -> Result<ConversionRate, TippingError> {
        if from_token == to_token {
            return Ok(ConversionRate {
                from_token: from_token.clone(),
                to_token: to_token.clone(),
                rate: 1_000_000_000_000_000_000_i128, // 1.0 with 18 decimals
                last_updated: env.ledger().timestamp(),
            });
        }

        // Check if we have cached conversion rate
        if let Some(cached_rate) = storage::get_conversion_rate(env, from_token, to_token) {
            // Use cached rate if it's fresh (1 hour)
            if Self::is_conversion_rate_fresh(env, &cached_rate, 3600) {
                return Ok(cached_rate);
            }
        }

        // Calculate new conversion rate
        let from_price = Self::get_price_data(env, from_token)
            .ok_or(TippingError::PriceDataNotFound)?;
        let to_price = Self::get_price_data(env, to_token)
            .ok_or(TippingError::PriceDataNotFound)?;

        // Check freshness and confidence
        if !Self::is_price_fresh(env, from_token, 86400) || !Self::is_price_fresh(env, to_token, 86400) {
            return Err(TippingError::PriceDataStale);
        }

        if from_price.confidence < 80 || to_price.confidence < 80 {
            return Err(TippingError::LowPriceConfidence);
        }

        // Calculate rate: from_price / to_price (with 18 decimal places)
        let rate = (from_price.price_in_usd * 1_000_000_000_000_000_000_i128) / to_price.price_in_usd;

        let conversion_rate = ConversionRate {
            from_token: from_token.clone(),
            to_token: to_token.clone(),
            rate,
            last_updated: env.ledger().timestamp(),
        };

        // Cache the conversion rate
        storage::set_conversion_rate(env, from_token, to_token, &conversion_rate);

        Ok(conversion_rate)
    }

    /// Get all supported tokens with their current prices
    pub fn get_all_prices(env: &Env) -> Vec<PriceData> {
        let token_list = storage::get_token_list(env);
        let mut result = Vec::new(env);

        for i in 0..token_list.len() {
            if let Some(token_address) = token_list.get(i) {
                if let Some(price_data) = Self::get_price_data(env, &token_address) {
                    result.push_back(price_data);
                }
            }
        }

        result
    }

    /// Batch update multiple token prices (admin only)
    pub fn batch_update_prices(
        env: &Env,
        oracle: &Address,
        price_updates: Vec<(Address, i128, u32, String)>, // (token, price, confidence, source)
    ) -> Result<(), TippingError> {
        Self::verify_oracle_permissions(env, oracle)?;

        for i in 0..price_updates.len() {
            if let Some((token, price, confidence, source)) = price_updates.get(i) {
                Self::update_price(env, oracle, &token, price, confidence, source)?;
            }
        }

        Ok(())
    }

    /// Helper function to verify oracle permissions
    fn verify_oracle_permissions(env: &Env, oracle: &Address) -> Result<(), TippingError> {
        // Check if oracle is admin
        if let Some(admin) = storage::get_admin(env) {
            if *oracle == admin {
                return Ok(());
            }
        }

        // Check if oracle is in authorized oracles list
        if storage::is_authorized_oracle(env, oracle) {
            Ok(())
        } else {
            Err(TippingError::Unauthorized)
        }
    }

    /// Check if conversion rate is fresh
    fn is_conversion_rate_fresh(env: &Env, rate: &ConversionRate, max_age_seconds: u64) -> bool {
        let current_time = env.ledger().timestamp();
        current_time - rate.last_updated <= max_age_seconds
    }

    /// Add authorized oracle (admin only)
    pub fn add_oracle(
        env: &Env,
        admin: &Address,
        oracle: &Address,
    ) -> Result<(), TippingError> {
        if let Some(contract_admin) = storage::get_admin(env) {
            if *admin != contract_admin {
                return Err(TippingError::Unauthorized);
            }
        } else {
            return Err(TippingError::Unauthorized);
        }

        storage::add_authorized_oracle(env, oracle);
        Ok(())
    }

    /// Remove authorized oracle (admin only)
    pub fn remove_oracle(
        env: &Env,
        admin: &Address,
        oracle: &Address,
    ) -> Result<(), TippingError> {
        if let Some(contract_admin) = storage::get_admin(env) {
            if *admin != contract_admin {
                return Err(TippingError::Unauthorized);
            }
        } else {
            return Err(TippingError::Unauthorized);
        }

        storage::remove_authorized_oracle(env, oracle);
        Ok(())
    }
}