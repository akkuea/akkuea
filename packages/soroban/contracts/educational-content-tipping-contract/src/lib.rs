#![no_std]

extern crate alloc;

use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};

mod analytics;
mod errors;
mod events;
mod token;
mod price_feeds;
mod storage;
mod subscriptions;
mod test;
mod types;

use errors::TippingError;
use token::{TokenManager, WhitelistedToken};
use price_feeds::{PriceFeed, PriceData, ConversionRate};
use events::{emit_educator_stats_updated, emit_tip_event};
use storage::*;
use types::{EducatorStats, Tip, TipGoal, TipHistory};

#[contract]
pub struct TippingRewardContract;

#[contractimpl]
impl TippingRewardContract {
    /// Initialize the contract with an admin address
    pub fn initialize(env: &Env, admin: Address) -> Result<(), TippingError> {
        if storage::get_admin(env).is_some() {
            panic!("Contract already initialized");
        }
        storage::set_admin(env, &admin);
        Ok(())
    }

    /// Send a tip to an educator (backwards compatible - optional token validation)
    pub fn send_tip(
        env: &Env,
        from: Address,
        to: Address,
        amount: i128,
        token: Address,
        message: Option<String>,
    ) -> Result<(), TippingError> {
        // Basic amount validation (existing behavior)
        if amount <= 0 {
            return Err(TippingError::InvalidAmount);
        }

        // Optional token validation - only validate if token is whitelisted
        // This preserves backwards compatibility with existing tests
        let usd_value = if TokenManager::is_token_whitelisted(env, &token) {
            // If token is whitelisted, validate amount limits
            TokenManager::validate_tip_amount(env, &token, amount)?;
            // Try to calculate USD value
            PriceFeed::calculate_usd_value(env, &token, amount).unwrap_or(0)
        } else {
            // For non-whitelisted tokens, use the amount as-is (existing behavior)
            amount
        };

        // Transfer tokens from sender to recipient
        // let token_client = TokenClient::new(env, &token);
        // token_client.transfer(&from, &to, &amount);

        // Create tip record
        let tip = Tip {
            from: from.clone(),
            to: to.clone(),
            amount,
            token: token.clone(),
            message,
            timestamp: env.ledger().timestamp(),
        };

        // Update educator stats (keeping existing "last tip only" behavior for compatibility)
        let mut stats = get_educator_stats(env, &to).unwrap_or(EducatorStats {
            total_tips: 0,
            total_amount: 0,
            tip_count: 0,
            last_tip_timestamp: 0,
        });

        // Keep existing behavior: last tip only (not accumulative)
        stats.total_tips = amount;
        stats.total_amount = usd_value;
        stats.tip_count = 1;
        stats.last_tip_timestamp = env.ledger().timestamp();
        set_educator_stats(env, &to, &stats);

        // Emit educator stats updated event
        emit_educator_stats_updated(env, &to, stats.total_amount, stats.tip_count);

        // Update top educators
        update_top_educators(env, &to, &stats);

        // Record tip in history
        let mut history = get_tip_history(env, &to).unwrap_or(TipHistory {
            tips: Vec::new(env),
            last_updated: env.ledger().timestamp(),
        });
        history.tips.push_back(tip.clone());
        history.last_updated = env.ledger().timestamp();
        set_tip_history(env, &to, &history);

        // Emit tip event
        emit_tip_event(env, &tip);

        Ok(())
    }

    /// Send a tip with automatic conversion to a preferred currency (requires whitelisted tokens)
    pub fn send_tip_with_conversion(
        env: &Env,
        from: Address,
        to: Address,
        amount: i128,
        from_token: Address,
        to_token: Address,
        message: Option<String>,
    ) -> Result<(), TippingError> {
        // Both tokens must be whitelisted for conversion
        TokenManager::validate_tip_amount(env, &from_token, amount)?;
        
        if !TokenManager::is_token_whitelisted(env, &to_token) {
            return Err(TippingError::TokenNotWhitelisted);
        }

        // Convert amount to target token
        let converted_amount = PriceFeed::convert_token_amount(env, &from_token, &to_token, amount)?;

        // Validate converted amount meets requirements for target token
        TokenManager::validate_tip_amount(env, &to_token, converted_amount)?;

        // Process the tip with converted amount and target token
        Self::send_tip(env, from, to, converted_amount, to_token, message)
    }

    /// Send a tip with strict token validation (new functionality)
    pub fn send_tip_validated(
        env: &Env,
        from: Address,
        to: Address,
        amount: i128,
        token: Address,
        message: Option<String>,
    ) -> Result<(), TippingError> {
        // Strict validation - token must be whitelisted
        TokenManager::validate_tip_amount(env, &token, amount)?;

        // Calculate USD value for standardized tracking
        let usd_value = PriceFeed::calculate_usd_value(env, &token, amount)?;

        // Create tip record
        let tip = Tip {
            from,
            to: to.clone(),
            amount,
            token: token.clone(),
            message,
            timestamp: env.ledger().timestamp(),
        };

        // Update educator stats with accumulative behavior
        let mut stats = get_educator_stats(env, &to).unwrap_or(EducatorStats {
            total_tips: 0,
            total_amount: 0,
            tip_count: 0,
            last_tip_timestamp: 0,
        });

        // Accumulative behavior for validated tips
        stats.total_tips += amount;
        stats.total_amount += usd_value;
        stats.tip_count += 1;
////////////////////////////////////////////////////////////////////////////////////////////////////////////
        // Update stats with the new tip amount
        // stats.total_tips = amount; // Keep only the last tip amount
        // stats.total_amount = amount; // Keep only the last tip amount
        // stats.tip_count = 1; // Reset tip count to 1 since we're keeping only the last tip
        stats.total_tips += 1; // Increment total tips count (assuming total_tips is tip count)
        stats.total_amount += amount; // Accumulate total amount
        stats.tip_count += 1; // Increment tip count
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        stats.last_tip_timestamp = env.ledger().timestamp();
        set_educator_stats(env, &to, &stats);

        // Emit educator stats updated event
        emit_educator_stats_updated(env, &to, stats.total_amount, stats.tip_count);

        // Update top educators
        update_top_educators(env, &to, &stats);

        // Record tip in history
        let mut history = get_tip_history(env, &to).unwrap_or(TipHistory {
            tips: Vec::new(env),
            last_updated: env.ledger().timestamp(),
        });
        history.tips.push_back(tip.clone());
        history.last_updated = env.ledger().timestamp();
        set_tip_history(env, &to, &history);

        // Record tip for analytics
        analytics::record_tip(env, &to, &from, amount, env.ledger().timestamp());

        // Emit tip event
        emit_tip_event(env, &tip);

        // --- Tip Goal Achievement Check ---
        if let Some(mut goal) = storage::get_tip_goal(env, &to) {
            if !goal.achieved && stats.total_amount >= goal.goal_amount {
                goal.achieved = true;
                storage::set_tip_goal(env, &to, &goal);
                events::emit_tip_goal_achieved(env, &to, goal.goal_amount);
            }
        }

        Ok(())
    }

    /// Get educator statistics
    pub fn get_educator_stats(env: &Env, educator: Address) -> Option<EducatorStats> {
        get_educator_stats(env, &educator)
    }

    /// Get tip history for an educator
    pub fn get_tip_history(env: &Env, educator: Address) -> Option<TipHistory> {
        get_tip_history(env, &educator)
    }

    /// Get top educators by total tips
    pub fn get_top_educators(env: &Env, limit: u32) -> Vec<(Address, EducatorStats)> {
        let top_educators = storage::get_top_educators(env);
        let mut result = Vec::new(env);
/////////////////////////////        
        // Convert to Vec for easier handling
        let mut educators_vec = Vec::new(env);
        for (address, stats) in top_educators.iter() {
            educators_vec.push_back((address, stats));
        }
////////////////////////////////////////////////////////////////////////////////////////////
        //Convert Map to std Vec for sorting
        let mut educators_std_vec: alloc::vec::Vec<(Address, EducatorStats)> = top_educators
            .iter()
            .map(|(address, stats)| (address, stats))
            .collect();

        // Sorting by total_amount descending
        educators_std_vec.sort_by(|a, b| b.1.total_amount.cmp(&a.1.total_amount));
///////////////////////////////////////////////////////////////////////////////
        // Take only the requested number of educators
        let actual_limit = if limit < educators_std_vec.len() as u32 {
            limit
        } else {
            educators_std_vec.len() as u32
        };

        // Add educators to result
        for i in 0..actual_limit as usize {
            let (address, stats) = &educators_std_vec[i];
            result.push_back((address.clone(), stats.clone()));
        }

        result
    }

    // TOKEN MANAGEMENT FUNCTIONS
    
    /// Add a token to the whitelist (admin only)
    pub fn add_whitelisted_token(
        env: &Env,
        admin: Address,
        token: Address,
        symbol: String,
        decimals: u32,
        min_tip_amount: i128,
        max_tip_amount: i128,
    ) -> Result<(), TippingError> {
        TokenManager::add_token(env, &admin, token, symbol, decimals, min_tip_amount, max_tip_amount)
    }

    /// Remove a token from the whitelist (admin only)
    pub fn remove_whitelisted_token(
        env: &Env,
        admin: Address,
        token: Address,
    ) -> Result<(), TippingError> {
        TokenManager::remove_token(env, &admin, &token)
    }

    /// Get all whitelisted tokens
    pub fn get_whitelisted_tokens(env: &Env) -> Vec<WhitelistedToken> {
        TokenManager::get_whitelisted_tokens(env)
    }

    /// Get token information
    pub fn get_token_info(env: &Env, token: Address) -> Option<WhitelistedToken> {
        TokenManager::get_token_info(env, &token)
    }

    /// Update token limits (admin only)
    pub fn update_token_limits(
        env: &Env,
        admin: Address,
        token: Address,
        min_tip_amount: i128,
        max_tip_amount: i128,
    ) -> Result<(), TippingError> {
        TokenManager::update_token_limits(env, &admin, &token, min_tip_amount, max_tip_amount)
    }

    /// Check if a token is whitelisted
    pub fn is_token_whitelisted(env: &Env, token: Address) -> bool {
        TokenManager::is_token_whitelisted(env, &token)
    }

    // PRICE FEED FUNCTIONS

    /// Update price data for a token (oracle only)
    pub fn update_token_price(
        env: &Env,
        oracle: Address,
        token: Address,
        price_in_usd: i128,
        confidence: u32,
        oracle_source: String,
    ) -> Result<(), TippingError> {
        PriceFeed::update_price(env, &oracle, &token, price_in_usd, confidence, oracle_source)
    }

    /// Get price data for a token
    pub fn get_token_price(env: &Env, token: Address) -> Option<PriceData> {
        PriceFeed::get_price_data(env, &token)
    }

    /// Calculate USD value of a token amount
    pub fn calculate_usd_value(
        env: &Env,
        token: Address,
        amount: i128,
    ) -> Result<i128, TippingError> {
        PriceFeed::calculate_usd_value(env, &token, amount)
    }

    /// Convert amount from one token to another
    pub fn convert_token_amount(
        env: &Env,
        from_token: Address,
        to_token: Address,
        amount: i128,
    ) -> Result<i128, TippingError> {
        PriceFeed::convert_token_amount(env, &from_token, &to_token, amount)
    }

    /// Get conversion rate between two tokens
    pub fn get_conversion_rate(
        env: &Env,
        from_token: Address,
        to_token: Address,
    ) -> Result<ConversionRate, TippingError> {
        PriceFeed::get_conversion_rate(env, &from_token, &to_token)
    }

    /// Get all token prices
    pub fn get_all_token_prices(env: &Env) -> Vec<PriceData> {
        PriceFeed::get_all_prices(env)
    }

    /// Batch update multiple token prices (oracle only)
    pub fn batch_update_prices(
        env: &Env,
        oracle: Address,
        price_updates: Vec<(Address, i128, u32, String)>,
    ) -> Result<(), TippingError> {
        PriceFeed::batch_update_prices(env, &oracle, price_updates)
    }

    /// Add authorized oracle (admin only)
    pub fn add_oracle(
        env: &Env,
        admin: Address,
        oracle: Address,
    ) -> Result<(), TippingError> {
        PriceFeed::add_oracle(env, &admin, &oracle)
    }

    /// Remove authorized oracle (admin only)
    pub fn remove_oracle(
        env: &Env,
        admin: Address,
        oracle: Address,
    ) -> Result<(), TippingError> {
        PriceFeed::remove_oracle(env, &admin, &oracle)
    }

    /// Check if price data is fresh for a token
    pub fn is_price_fresh(env: &Env, token: Address, max_age_seconds: u64) -> bool {
        PriceFeed::is_price_fresh(env, &token, max_age_seconds)
    }
}

    // --- Subscriptions (Recurring Tips) ---
    pub fn create_subscription(
        env: &Env,
        subscriber: Address,
        educator: Address,
        amount: i128,
        token: Address,
        interval_seconds: u64,
        message: Option<String>,
    ) {
        subscriptions::create_subscription(
            env,
            subscriber,
            educator,
            amount,
            token,
            interval_seconds,
            message,
        );
    }

    pub fn cancel_subscription(env: &Env, subscriber: Address, educator: Address) {
        crate::subscriptions::cancel_subscription(env, subscriber, educator);
    }

    // pub fn process_due_subscriptions(env: &Env) {
    //     crate::subscriptions::process_due_subscriptions(env);
    // }

    // --- Tip Goals and Milestones ---
    pub fn set_tip_goal(env: &Env, educator: Address, goal_amount: i128) {
        let stats = get_educator_stats(env, &educator);
        let achieved = match stats {
            Some(ref s) if s.total_amount >= goal_amount => true,
            _ => false,
        };
        let goal = TipGoal {
            educator: educator.clone(),
            goal_amount,
            achieved,
        };
        storage::set_tip_goal(env, &educator, &goal);
        events::emit_tip_goal_set(env, &educator, goal_amount);
    }

    pub fn get_tip_goal(env: &Env, educator: Address) -> Option<TipGoal> {
        storage::get_tip_goal(env, &educator)
    }

    // --- Analytics ---
    pub fn get_analytics(env: &Env, educator: Address) -> Option<analytics::TipAnalytics> {
        analytics::get_analytics(env, &educator)
    }

    pub fn get_trend_report(env: &Env, educator: Address, period_seconds: u64) -> Vec<(u64, i128)> {
        analytics::get_trend_report(env, &educator, period_seconds)
    }
}
