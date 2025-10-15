#![no_std]

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, String, Vec};

mod analytics;
mod errors;
mod events;
mod governance;
mod price_feeds;
mod security;
mod storage;
mod subscriptions;
mod test;
mod token;
mod types;
mod utils;

use analytics::{
    AnalyticsManager, AnalyticsRecord, EducatorAnalytics, TimeBasedReport, TippingTrend,
};
use errors::TippingError;
use events::{emit_educator_stats_updated, emit_tip_event};
use governance::GovernanceManager;
use price_feeds::{ConversionRate, PriceData, PriceFeed};
use security::SecurityManager;
use storage::{
    add_tip_to_all_tips, get_educator_stats, get_tip_history, set_educator_stats, set_tip_history,
    update_top_educators,
};
use subscriptions::{ConditionalTip, Subscription, SubscriptionManager, TipGoal};
use token::{TokenManager, WhitelistedToken};
use types::{
    EducatorStats, FeeConfig, FraudAlert, GovernanceConfig, MultiSigOperation, Proposal,
    ProposalType, SecurityConfig, TimeLockedWithdrawal, Tip, TipHistory, Vote, VoteType,
};

#[contract]
pub struct TippingRewardContract;

#[contractimpl]
impl TippingRewardContract {
    /// Initialize the contract with an admin address
    pub fn initialize(env: &Env, admin: Address) {
        if storage::get_admin(env).is_some() {
            panic!("Contract already initialized");
        }
        storage::set_admin(env, &admin);
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
        let usd_value = if TokenManager::is_token_whitelisted(env, &token) {
            // If token is whitelisted, validate amount limits
            TokenManager::validate_tip_amount(env, &token, amount)?;
            // Try to calculate USD value
            PriceFeed::calculate_usd_value(env, &token, amount).unwrap_or(0)
        } else {
            // For non-whitelisted tokens, use the amount as-is (existing behavior)
            amount
        };

        // Create tip record
        let tip = Tip {
            from,
            to: to.clone(),
            amount,
            token: token.clone(),
            message,
            timestamp: env.ledger().timestamp(),
        };

        // Add tip to analytics storage
        add_tip_to_all_tips(env, &tip);

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
        let converted_amount =
            PriceFeed::convert_token_amount(env, &from_token, &to_token, amount)?;

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

        // Add tip to analytics storage
        add_tip_to_all_tips(env, &tip);

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

    // QUERY FUNCTIONS

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

        let mut educators_vec = Vec::new(env);
        for (address, stats) in top_educators.iter() {
            educators_vec.push_back((address, stats));
        }

        let actual_limit = if limit < educators_vec.len() as u32 {
            limit
        } else {
            educators_vec.len() as u32
        };

        for i in 0..actual_limit {
            if let Some((address, stats)) = educators_vec.get(i) {
                result.push_back((address.clone(), stats.clone()));
            }
        }

        result
    }

    // SUBSCRIPTION FUNCTIONS

    /// Create a recurring tip subscription
    pub fn create_subscription(
        env: &Env,
        subscriber: Address,
        educator: Address,
        amount: i128,
        token: Address,
        period: u64,
    ) -> Result<BytesN<32>, TippingError> {
        SubscriptionManager::create_subscription(env, subscriber, educator, amount, token, period)
    }

    /// Execute a subscription payment
    pub fn execute_subscription_payment(
        env: &Env,
        subscription_id: BytesN<32>,
    ) -> Result<(), TippingError> {
        SubscriptionManager::execute_subscription_payment(env, subscription_id)
    }

    /// Cancel a subscription
    pub fn cancel_subscription(
        env: &Env,
        subscriber: Address,
        subscription_id: BytesN<32>,
    ) -> Result<(), TippingError> {
        SubscriptionManager::cancel_subscription(env, subscriber, subscription_id)
    }

    /// Get subscription information
    pub fn get_subscription_info(env: &Env, subscription_id: BytesN<32>) -> Option<Subscription> {
        SubscriptionManager::get_subscription_info(env, subscription_id)
    }

    /// Get all subscriptions for a subscriber
    pub fn get_subscriber_subscriptions(env: &Env, subscriber: Address) -> Vec<Subscription> {
        SubscriptionManager::get_subscriber_subscriptions(env, subscriber)
    }

    // TIP GOAL FUNCTIONS

    /// Create a new tip goal
    pub fn create_tip_goal(
        env: &Env,
        educator: Address,
        title: String,
        description: String,
        target_amount: i128,
        deadline: u64,
    ) -> Result<BytesN<32>, TippingError> {
        SubscriptionManager::create_tip_goal(
            env,
            educator,
            title,
            description,
            target_amount,
            deadline,
        )
    }

    /// Contribute to a tip goal
    pub fn contribute_to_goal(
        env: &Env,
        contributor: Address,
        goal_id: BytesN<32>,
        amount: i128,
        token: Address,
    ) -> Result<(), TippingError> {
        SubscriptionManager::contribute_to_goal(env, contributor, goal_id, amount, token)
    }

    /// Get tip goal status
    pub fn get_goal_status(env: &Env, goal_id: BytesN<32>) -> Option<TipGoal> {
        SubscriptionManager::get_goal_status(env, goal_id)
    }

    // CONDITIONAL TIPPING FUNCTIONS

    /// Create a conditional tip based on metrics
    pub fn create_conditional_tip(
        env: &Env,
        from: Address,
        to: Address,
        amount: i128,
        token: Address,
        condition_type: String,
        condition_value: i128,
    ) -> Result<BytesN<32>, TippingError> {
        SubscriptionManager::create_conditional_tip(
            env,
            from,
            to,
            amount,
            token,
            condition_type,
            condition_value,
        )
    }

    /// Execute conditional tip based on current metrics
    pub fn execute_conditional_tip(
        env: &Env,
        tip_id: BytesN<32>,
        current_metric_value: i128,
    ) -> Result<(), TippingError> {
        SubscriptionManager::execute_conditional_tip(env, tip_id, current_metric_value)
    }

    /// Get conditional tip information
    pub fn get_conditional_tip_info(env: &Env, tip_id: BytesN<32>) -> Option<ConditionalTip> {
        SubscriptionManager::get_conditional_tip_info(env, tip_id)
    }

    // ANALYTICS FUNCTIONS

    /// Record analytics data for a specific period
    pub fn record_analytics(
        env: &Env,
        period_start: u64,
        period_end: u64,
    ) -> Result<(), TippingError> {
        AnalyticsManager::record_analytics(env, period_start, period_end)
    }

    /// Generate time-based tipping report
    pub fn generate_time_report(
        env: &Env,
        period_type: String,
        start_time: u64,
        end_time: u64,
    ) -> Result<TimeBasedReport, TippingError> {
        AnalyticsManager::generate_time_report(env, period_type, start_time, end_time)
    }

    /// Analyze tipping trends for an educator
    pub fn analyze_trends(
        env: &Env,
        educator: Address,
        period_days: u32,
    ) -> Result<TippingTrend, TippingError> {
        AnalyticsManager::analyze_trends(env, educator, period_days)
    }

    /// Get comprehensive educator analytics
    pub fn get_educator_analytics(
        env: &Env,
        educator: Address,
    ) -> Result<EducatorAnalytics, TippingError> {
        AnalyticsManager::get_educator_analytics(env, educator)
    }

    /// Get analytics record for a specific timestamp
    pub fn get_analytics_record(env: &Env, timestamp: u64) -> Option<AnalyticsRecord> {
        AnalyticsManager::get_analytics_record(env, timestamp)
    }

    /// Get analytics history for trend analysis
    pub fn get_analytics_history(
        env: &Env,
        start_time: u64,
        end_time: u64,
        interval_seconds: u64,
    ) -> Vec<AnalyticsRecord> {
        AnalyticsManager::get_analytics_history(env, start_time, end_time, interval_seconds)
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
        TokenManager::add_token(
            env,
            &admin,
            token,
            symbol,
            decimals,
            min_tip_amount,
            max_tip_amount,
        )
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
        PriceFeed::update_price(
            env,
            &oracle,
            &token,
            price_in_usd,
            confidence,
            oracle_source,
        )
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
    pub fn add_oracle(env: &Env, admin: Address, oracle: Address) -> Result<(), TippingError> {
        PriceFeed::add_oracle(env, &admin, &oracle)
    }

    /// Remove authorized oracle (admin only)
    pub fn remove_oracle(env: &Env, admin: Address, oracle: Address) -> Result<(), TippingError> {
        PriceFeed::remove_oracle(env, &admin, &oracle)
    }

    /// Check if price data is fresh for a token
    pub fn is_price_fresh(env: &Env, token: Address, max_age_seconds: u64) -> bool {
        PriceFeed::is_price_fresh(env, &token, max_age_seconds)
    }

    // ==== SECURITY FUNCTIONS ====

    /// Configure security parameters (admin only)
    pub fn configure_security(
        env: &Env,
        admin: Address,
        multi_sig_threshold: u32,
        time_lock_duration: u64,
        fraud_alert_threshold: u64,
        max_daily_tip_amount: i128,
        suspicious_pattern_window: u64,
    ) -> Result<(), TippingError> {
        SecurityManager::configure_security(
            env,
            admin,
            multi_sig_threshold,
            time_lock_duration,
            fraud_alert_threshold,
            max_daily_tip_amount,
            suspicious_pattern_window,
        )
    }

    /// Get current security configuration
    pub fn get_security_config(env: &Env) -> Option<SecurityConfig> {
        SecurityManager::get_security_config(env)
    }

    /// Initiate a multi-signature operation
    pub fn initiate_multi_sig_operation(
        env: &Env,
        initiator: Address,
        operation_type: String,
        execution_data: Option<String>,
    ) -> Result<BytesN<32>, TippingError> {
        SecurityManager::initiate_multi_sig_operation(
            env,
            initiator,
            operation_type,
            execution_data,
        )
    }

    /// Approve a multi-signature operation
    pub fn approve_multi_sig_operation(
        env: &Env,
        approver: Address,
        operation_id: BytesN<32>,
    ) -> Result<(), TippingError> {
        SecurityManager::approve_multi_sig_operation(env, approver, operation_id)
    }

    /// Execute a multi-signature operation
    pub fn execute_multi_sig_operation(
        env: &Env,
        executor: Address,
        operation_id: BytesN<32>,
    ) -> Result<(), TippingError> {
        SecurityManager::execute_multi_sig_operation(env, executor, operation_id)
    }

    /// Initiate a time-locked withdrawal
    pub fn initiate_time_locked_withdrawal(
        env: &Env,
        initiator: Address,
        educator: Address,
        amount: i128,
        token: Address,
    ) -> Result<BytesN<32>, TippingError> {
        SecurityManager::initiate_time_locked_withdrawal(env, initiator, educator, amount, token)
    }

    /// Execute a time-locked withdrawal
    pub fn execute_time_locked_withdrawal(
        env: &Env,
        executor: Address,
        withdrawal_id: BytesN<32>,
    ) -> Result<(), TippingError> {
        SecurityManager::execute_time_locked_withdrawal(env, executor, withdrawal_id)
    }

    /// Cancel a time-locked withdrawal
    pub fn cancel_time_locked_withdrawal(
        env: &Env,
        canceller: Address,
        withdrawal_id: BytesN<32>,
        reason: String,
    ) -> Result<(), TippingError> {
        SecurityManager::cancel_time_locked_withdrawal(env, canceller, withdrawal_id, reason)
    }

    /// Flag suspicious activity
    pub fn flag_suspicious_activity(
        env: &Env,
        reporter: Address,
        target_address: Address,
        alert_type: String,
        details: String,
        severity: u32,
    ) -> Result<BytesN<32>, TippingError> {
        SecurityManager::flag_suspicious_activity(
            env,
            reporter,
            target_address,
            alert_type,
            details,
            severity,
        )
    }

    /// Resolve a fraud alert
    pub fn resolve_fraud_alert(
        env: &Env,
        resolver: Address,
        alert_id: BytesN<32>,
    ) -> Result<(), TippingError> {
        SecurityManager::resolve_fraud_alert(env, resolver, alert_id)
    }

    /// Detect suspicious patterns for an address
    pub fn detect_suspicious_patterns(
        env: &Env,
        address: Address,
    ) -> Result<Vec<String>, TippingError> {
        SecurityManager::detect_suspicious_patterns(env, address)
    }

    /// Get all active fraud alerts
    pub fn get_active_alerts(env: &Env) -> Vec<FraudAlert> {
        SecurityManager::get_active_alerts(env)
    }

    /// Get multi-sig operation details
    pub fn get_multi_sig_operation(
        env: &Env,
        operation_id: BytesN<32>,
    ) -> Option<MultiSigOperation> {
        SecurityManager::get_multi_sig_operation(env, operation_id)
    }

    /// Get time-locked withdrawal details
    pub fn get_time_locked_withdrawal(
        env: &Env,
        withdrawal_id: BytesN<32>,
    ) -> Option<TimeLockedWithdrawal> {
        SecurityManager::get_time_locked_withdrawal(env, withdrawal_id)
    }

    // ==== GOVERNANCE FUNCTIONS ====

    /// Initialize governance configuration (admin only)
    pub fn initialize_governance(
        env: &Env,
        admin: Address,
        min_proposal_stake: i128,
        voting_period: u64,
        execution_delay: u64,
        min_quorum_percentage: u32,
        min_approval_percentage: u32,
        fee_adjustment_limit: u32,
    ) -> Result<(), TippingError> {
        GovernanceManager::initialize_governance(
            env,
            admin,
            min_proposal_stake,
            voting_period,
            execution_delay,
            min_quorum_percentage,
            min_approval_percentage,
            fee_adjustment_limit,
        )
    }

    /// Get current governance configuration
    pub fn get_governance_config(env: &Env) -> Option<GovernanceConfig> {
        GovernanceManager::get_governance_config(env)
    }

    /// Get current fee configuration
    pub fn get_fee_config(env: &Env) -> Option<FeeConfig> {
        GovernanceManager::get_fee_config(env)
    }

    /// Calculate voting power for an address
    pub fn calculate_voting_power(env: &Env, voter: Address) -> u32 {
        GovernanceManager::calculate_voting_power(env, &voter)
    }

    /// Create a new governance proposal
    pub fn create_proposal(
        env: &Env,
        proposer: Address,
        description: String,
        proposal_type: ProposalType,
        execution_data: Option<String>,
    ) -> Result<BytesN<32>, TippingError> {
        GovernanceManager::create_proposal(
            env,
            proposer,
            description,
            proposal_type,
            execution_data,
        )
    }

    /// Vote on a proposal
    pub fn vote_on_proposal(
        env: &Env,
        voter: Address,
        proposal_id: BytesN<32>,
        vote_type: VoteType,
    ) -> Result<(), TippingError> {
        GovernanceManager::vote_on_proposal(env, voter, proposal_id, vote_type)
    }

    /// Finalize a proposal after voting period ends
    pub fn finalize_proposal(
        env: &Env,
        finalizer: Address,
        proposal_id: BytesN<32>,
    ) -> Result<(), TippingError> {
        GovernanceManager::finalize_proposal(env, finalizer, proposal_id)
    }

    /// Execute an approved proposal
    pub fn execute_proposal(
        env: &Env,
        executor: Address,
        proposal_id: BytesN<32>,
    ) -> Result<(), TippingError> {
        GovernanceManager::execute_proposal(env, executor, proposal_id)
    }

    /// Get proposal information
    pub fn get_proposal_info(env: &Env, proposal_id: BytesN<32>) -> Option<Proposal> {
        GovernanceManager::get_proposal_info(env, proposal_id)
    }

    /// Get all active proposals
    pub fn get_active_proposals(env: &Env) -> Vec<Proposal> {
        GovernanceManager::get_active_proposals(env)
    }

    /// Get voting history for a voter
    pub fn get_voter_history(env: &Env, voter: Address) -> Vec<Vote> {
        GovernanceManager::get_voter_history(env, voter)
    }

    /// Adjust fees through governance
    pub fn adjust_fees(
        env: &Env,
        proposer: Address,
        base_fee_percentage: u32,
        premium_fee_percentage: u32,
        withdrawal_fee: i128,
    ) -> Result<BytesN<32>, TippingError> {
        GovernanceManager::adjust_fees(
            env,
            proposer,
            base_fee_percentage,
            premium_fee_percentage,
            withdrawal_fee,
        )
    }
}
