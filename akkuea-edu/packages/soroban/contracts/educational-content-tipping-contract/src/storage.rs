use crate::analytics::AnalyticsRecord;
use crate::price_feeds::{ConversionRate, PriceData};
use crate::subscriptions::{ConditionalTip, Subscription, TipGoal};
use crate::token::WhitelistedToken;
use crate::types::{
    EducatorStats, FeeConfig, FraudAlert, GovernanceConfig, MultiSigOperation, Proposal,
    SecurityConfig, TimeLockedWithdrawal, Tip, TipHistory, Vote,
};
use soroban_sdk::{Address, BytesN, Env, Symbol, Vec};

// Storage keys for existing functionality
fn get_admin_key(env: &Env) -> Symbol {
    Symbol::new(env, "ADMIN")
}

fn get_educator_stats_key(env: &Env, educator: &Address) -> Symbol {
    Symbol::new(env, "EDU_STATS")
}

fn get_tip_history_key(env: &Env, educator: &Address) -> Symbol {
    Symbol::new(env, "TIP_HIST")
}

fn get_top_educators_key(env: &Env) -> Symbol {
    Symbol::new(env, "TOP_EDU")
}

// Storage keys for token management
fn get_token_whitelist_key(env: &Env, token: &Address) -> Symbol {
    Symbol::new(env, "TOKEN_WL")
}

fn get_token_list_key(env: &Env) -> Symbol {
    Symbol::new(env, "TOKEN_LST")
}

// Storage keys for price feeds
fn get_price_data_key(env: &Env, token: &Address) -> Symbol {
    Symbol::new(env, "PRICE")
}

fn get_conversion_rate_key(env: &Env, from_token: &Address, to_token: &Address) -> Symbol {
    Symbol::new(env, "CONV_RATE")
}

fn get_oracle_list_key(env: &Env) -> Symbol {
    Symbol::new(env, "ORACLES")
}

// Storage keys for subscriptions
fn get_subscription_key(env: &Env, subscription_id: &BytesN<32>) -> Symbol {
    Symbol::new(env, "SUB")
}

fn get_subscriber_subscriptions_key(env: &Env, subscriber: &Address) -> Symbol {
    Symbol::new(env, "SUB_USER")
}

fn get_educator_subscriptions_key(env: &Env, educator: &Address) -> Symbol {
    Symbol::new(env, "SUB_EDU")
}

// NEW: Storage keys for tip goals
fn get_tip_goal_key(env: &Env, goal_id: &BytesN<32>) -> Symbol {
    Symbol::new(env, "GOAL")
}

fn get_educator_goals_key(env: &Env, educator: &Address) -> Symbol {
    Symbol::new(env, "GOAL_EDU")
}

// NEW: Storage keys for conditional tips
fn get_conditional_tip_key(env: &Env, tip_id: &BytesN<32>) -> Symbol {
    Symbol::new(env, "COND_TIP")
}

fn get_educator_conditional_tips_key(env: &Env, educator: &Address) -> Symbol {
    Symbol::new(env, "COND_EDU")
}

// NEW: Storage keys for analytics
fn get_analytics_record_key(env: &Env, timestamp: &u64) -> Symbol {
    Symbol::new(env, "ANALYTICS")
}

fn get_all_tips_key(env: &Env) -> Symbol {
    Symbol::new(env, "ALL_TIPS")
}

// Admin management
pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&get_admin_key(env))
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&get_admin_key(env), admin);
}

// Educator stats management
pub fn get_educator_stats(env: &Env, educator: &Address) -> Option<EducatorStats> {
    env.storage()
        .instance()
        .get(&get_educator_stats_key(env, educator))
}

pub fn set_educator_stats(env: &Env, educator: &Address, stats: &EducatorStats) {
    env.storage()
        .instance()
        .set(&get_educator_stats_key(env, educator), stats);
}

// Tip history management
pub fn get_tip_history(env: &Env, educator: &Address) -> Option<TipHistory> {
    env.storage()
        .instance()
        .get(&get_tip_history_key(env, educator))
}

pub fn set_tip_history(env: &Env, educator: &Address, history: &TipHistory) {
    env.storage()
        .instance()
        .set(&get_tip_history_key(env, educator), history);
}

// Top educators management (existing - FIXED)
pub fn get_top_educators(env: &Env) -> Vec<(Address, EducatorStats)> {
    env.storage()
        .instance()
        .get(&get_top_educators_key(env))
        .unwrap_or(Vec::new(env))
}

pub fn set_top_educators(env: &Env, educators: &Vec<(Address, EducatorStats)>) {
    env.storage()
        .instance()
        .set(&get_top_educators_key(env), educators);
}

pub fn update_top_educators(env: &Env, educator: &Address, stats: &EducatorStats) {
    let mut top_educators = get_top_educators(env);

    // Find if educator already exists and remove it
    for i in 0..top_educators.len() {
        let (addr, _) = top_educators.get(i).unwrap();
        if addr == *educator {
            top_educators.remove(i);
            break;
        }
    }

    // Find the correct position to insert based on total_amount
    let mut insert_idx = 0;
    for i in 0..top_educators.len() {
        let (_, current_stats) = top_educators.get(i).unwrap();
        if stats.total_amount > current_stats.total_amount {
            insert_idx = i;
            break;
        }
        insert_idx = i + 1;
    }

    // Insert the educator at the correct position
    top_educators.insert(insert_idx, (educator.clone(), stats.clone()));

    set_top_educators(env, &top_educators);
}

// Token whitelist management
pub fn get_whitelisted_token(env: &Env, token: &Address) -> Option<WhitelistedToken> {
    env.storage()
        .persistent()
        .get(&get_token_whitelist_key(env, token))
}

pub fn set_whitelisted_token(env: &Env, token: &Address, whitelisted_token: &WhitelistedToken) {
    env.storage()
        .persistent()
        .set(&get_token_whitelist_key(env, token), whitelisted_token);
}

pub fn get_token_list(env: &Env) -> Vec<Address> {
    env.storage()
        .persistent()
        .get(&get_token_list_key(env))
        .unwrap_or(Vec::new(env))
}

pub fn set_token_list(env: &Env, token_list: &Vec<Address>) {
    env.storage()
        .persistent()
        .set(&get_token_list_key(env), token_list);
}

// Price data management
pub fn get_price_data(env: &Env, token: &Address) -> Option<PriceData> {
    env.storage()
        .persistent()
        .get(&get_price_data_key(env, token))
}

pub fn set_price_data(env: &Env, token: &Address, price_data: &PriceData) {
    env.storage()
        .persistent()
        .set(&get_price_data_key(env, token), price_data);
}

// Conversion rate caching
pub fn get_conversion_rate(
    env: &Env,
    from_token: &Address,
    to_token: &Address,
) -> Option<ConversionRate> {
    env.storage()
        .temporary()
        .get(&get_conversion_rate_key(env, from_token, to_token))
}

pub fn set_conversion_rate(
    env: &Env,
    from_token: &Address,
    to_token: &Address,
    rate: &ConversionRate,
) {
    env.storage()
        .temporary()
        .set(&get_conversion_rate_key(env, from_token, to_token), rate);
}

// Oracle management
pub fn get_authorized_oracles(env: &Env) -> Vec<Address> {
    env.storage()
        .persistent()
        .get(&get_oracle_list_key(env))
        .unwrap_or(Vec::new(env))
}

pub fn set_authorized_oracles(env: &Env, oracles: &Vec<Address>) {
    env.storage()
        .persistent()
        .set(&get_oracle_list_key(env), oracles);
}

pub fn is_authorized_oracle(env: &Env, oracle: &Address) -> bool {
    let oracles = get_authorized_oracles(env);
    for i in 0..oracles.len() {
        if let Some(authorized_oracle) = oracles.get(i) {
            if authorized_oracle == *oracle {
                return true;
            }
        }
    }
    false
}

pub fn add_authorized_oracle(env: &Env, oracle: &Address) {
    let mut oracles = get_authorized_oracles(env);

    // Check if oracle already exists
    if !is_authorized_oracle(env, oracle) {
        oracles.push_back(oracle.clone());
        set_authorized_oracles(env, &oracles);
    }
}

pub fn remove_authorized_oracle(env: &Env, oracle: &Address) {
    let mut oracles = get_authorized_oracles(env);

    for i in 0..oracles.len() {
        if let Some(authorized_oracle) = oracles.get(i) {
            if authorized_oracle == *oracle {
                oracles.remove(i);
                break;
            }
        }
    }

    set_authorized_oracles(env, &oracles);
}

// Subscription management
pub fn get_subscription(env: &Env, subscription_id: &BytesN<32>) -> Option<Subscription> {
    env.storage()
        .persistent()
        .get(&get_subscription_key(env, subscription_id))
}

pub fn set_subscription(env: &Env, subscription_id: &BytesN<32>, subscription: &Subscription) {
    env.storage()
        .persistent()
        .set(&get_subscription_key(env, subscription_id), subscription);
}

pub fn get_subscriber_subscriptions(env: &Env, subscriber: &Address) -> Vec<BytesN<32>> {
    env.storage()
        .persistent()
        .get(&get_subscriber_subscriptions_key(env, subscriber))
        .unwrap_or(Vec::new(env))
}

pub fn set_subscriber_subscriptions(
    env: &Env,
    subscriber: &Address,
    subscriptions: &Vec<BytesN<32>>,
) {
    env.storage().persistent().set(
        &get_subscriber_subscriptions_key(env, subscriber),
        subscriptions,
    );
}

pub fn get_educator_subscriptions(env: &Env, educator: &Address) -> Vec<BytesN<32>> {
    env.storage()
        .persistent()
        .get(&get_educator_subscriptions_key(env, educator))
        .unwrap_or(Vec::new(env))
}

pub fn set_educator_subscriptions(env: &Env, educator: &Address, subscriptions: &Vec<BytesN<32>>) {
    env.storage().persistent().set(
        &get_educator_subscriptions_key(env, educator),
        subscriptions,
    );
}

// Tip goal management
pub fn get_tip_goal(env: &Env, goal_id: &BytesN<32>) -> Option<TipGoal> {
    env.storage()
        .persistent()
        .get(&get_tip_goal_key(env, goal_id))
}

pub fn set_tip_goal(env: &Env, goal_id: &BytesN<32>, goal: &TipGoal) {
    env.storage()
        .persistent()
        .set(&get_tip_goal_key(env, goal_id), goal);
}

pub fn get_educator_goals(env: &Env, educator: &Address) -> Vec<BytesN<32>> {
    env.storage()
        .persistent()
        .get(&get_educator_goals_key(env, educator))
        .unwrap_or(Vec::new(env))
}

pub fn set_educator_goals(env: &Env, educator: &Address, goals: &Vec<BytesN<32>>) {
    env.storage()
        .persistent()
        .set(&get_educator_goals_key(env, educator), goals);
}

// Conditional tip management
pub fn get_conditional_tip(env: &Env, tip_id: &BytesN<32>) -> Option<ConditionalTip> {
    env.storage()
        .persistent()
        .get(&get_conditional_tip_key(env, tip_id))
}

pub fn set_conditional_tip(env: &Env, tip_id: &BytesN<32>, conditional_tip: &ConditionalTip) {
    env.storage()
        .persistent()
        .set(&get_conditional_tip_key(env, tip_id), conditional_tip);
}

pub fn get_educator_conditional_tips(env: &Env, educator: &Address) -> Vec<BytesN<32>> {
    env.storage()
        .persistent()
        .get(&get_educator_conditional_tips_key(env, educator))
        .unwrap_or(Vec::new(env))
}

pub fn set_educator_conditional_tips(env: &Env, educator: &Address, tips: &Vec<BytesN<32>>) {
    env.storage()
        .persistent()
        .set(&get_educator_conditional_tips_key(env, educator), tips);
}

// Analytics management
pub fn get_analytics_record(env: &Env, timestamp: &u64) -> Option<AnalyticsRecord> {
    env.storage()
        .persistent()
        .get(&get_analytics_record_key(env, timestamp))
}

pub fn set_analytics_record(env: &Env, timestamp: &u64, record: &AnalyticsRecord) {
    env.storage()
        .persistent()
        .set(&get_analytics_record_key(env, timestamp), record);
}

// All tips storage for analytics
pub fn get_all_tips(env: &Env) -> Vec<Tip> {
    env.storage()
        .persistent()
        .get(&get_all_tips_key(env))
        .unwrap_or(Vec::new(env))
}

pub fn set_all_tips(env: &Env, tips: &Vec<Tip>) {
    env.storage().persistent().set(&get_all_tips_key(env), tips);
}

pub fn add_tip_to_all_tips(env: &Env, tip: &Tip) {
    let mut all_tips = get_all_tips(env);
    all_tips.push_back(tip.clone());
    set_all_tips(env, &all_tips);
}

// Get tips in a specific time period
pub fn get_all_tips_in_period(env: &Env, start_time: u64, end_time: u64) -> Vec<Tip> {
    let all_tips = get_all_tips(env);
    let mut result = Vec::new(env);

    for i in 0..all_tips.len() {
        if let Some(tip) = all_tips.get(i) {
            if tip.timestamp >= start_time && tip.timestamp <= end_time {
                result.push_back(tip);
            }
        }
    }

    result
}

// Get tips for a specific educator in a time period
pub fn get_educator_tips_in_period(
    env: &Env,
    educator: &Address,
    start_time: u64,
    end_time: u64,
) -> Vec<Tip> {
    let all_tips = get_all_tips(env);
    let mut result = Vec::new(env);

    for i in 0..all_tips.len() {
        if let Some(tip) = all_tips.get(i) {
            if tip.to == *educator && tip.timestamp >= start_time && tip.timestamp <= end_time {
                result.push_back(tip);
            }
        }
    }

    result
}

// ==== SECURITY STORAGE KEYS AND FUNCTIONS ====

// Security storage keys
fn get_security_config_key(env: &Env) -> Symbol {
    Symbol::new(env, "SEC_CONFIG")
}

fn get_multi_sig_operation_key(env: &Env, operation_id: &BytesN<32>) -> Symbol {
    Symbol::new(env, "MULTISIG_OP")
}

fn get_time_locked_withdrawal_key(env: &Env, withdrawal_id: &BytesN<32>) -> Symbol {
    Symbol::new(env, "TIME_LOCK")
}

fn get_fraud_alert_key(env: &Env, alert_id: &BytesN<32>) -> Symbol {
    Symbol::new(env, "FRAUD_ALERT")
}

// Security configuration management
pub fn get_security_config(env: &Env) -> Option<SecurityConfig> {
    env.storage()
        .persistent()
        .get(&get_security_config_key(env))
}

pub fn set_security_config(env: &Env, config: &SecurityConfig) {
    env.storage()
        .persistent()
        .set(&get_security_config_key(env), config);
}

// Multi-signature operation management
pub fn get_multi_sig_operation(env: &Env, operation_id: &BytesN<32>) -> Option<MultiSigOperation> {
    env.storage()
        .persistent()
        .get(&get_multi_sig_operation_key(env, operation_id))
}

pub fn set_multi_sig_operation(
    env: &Env,
    operation_id: &BytesN<32>,
    operation: &MultiSigOperation,
) {
    env.storage()
        .persistent()
        .set(&get_multi_sig_operation_key(env, operation_id), operation);
}

// Time-locked withdrawal management
pub fn get_time_locked_withdrawal(
    env: &Env,
    withdrawal_id: &BytesN<32>,
) -> Option<TimeLockedWithdrawal> {
    env.storage()
        .persistent()
        .get(&get_time_locked_withdrawal_key(env, withdrawal_id))
}

pub fn set_time_locked_withdrawal(
    env: &Env,
    withdrawal_id: &BytesN<32>,
    withdrawal: &TimeLockedWithdrawal,
) {
    env.storage().persistent().set(
        &get_time_locked_withdrawal_key(env, withdrawal_id),
        withdrawal,
    );
}

pub fn remove_time_locked_withdrawal(env: &Env, withdrawal_id: &BytesN<32>) {
    env.storage()
        .persistent()
        .remove(&get_time_locked_withdrawal_key(env, withdrawal_id));
}

// Fraud alert management
pub fn get_fraud_alert(env: &Env, alert_id: &BytesN<32>) -> Option<FraudAlert> {
    env.storage()
        .persistent()
        .get(&get_fraud_alert_key(env, alert_id))
}

pub fn set_fraud_alert(env: &Env, alert_id: &BytesN<32>, alert: &FraudAlert) {
    env.storage()
        .persistent()
        .set(&get_fraud_alert_key(env, alert_id), alert);
}

pub fn get_all_fraud_alerts(env: &Env) -> Vec<FraudAlert> {
    // This is a simplified implementation - in production, you'd maintain an index
    Vec::new(env)
}

// ==== GOVERNANCE STORAGE KEYS AND FUNCTIONS ====

// Governance storage keys
fn get_governance_config_key(env: &Env) -> Symbol {
    Symbol::new(env, "GOV_CONFIG")
}

fn get_fee_config_key(env: &Env) -> Symbol {
    Symbol::new(env, "FEE_CONFIG")
}

fn get_proposal_key(env: &Env, proposal_id: &BytesN<32>) -> Symbol {
    Symbol::new(env, "PROPOSAL")
}

fn get_vote_key(env: &Env, proposal_id: &BytesN<32>, voter: &Address) -> Symbol {
    Symbol::new(env, "VOTE")
}

fn get_voter_history_key(env: &Env, voter: &Address) -> Symbol {
    Symbol::new(env, "VOTE_HIST")
}

fn get_active_proposals_key(env: &Env) -> Symbol {
    Symbol::new(env, "ACTIVE_PROP")
}

// Governance configuration management
pub fn get_governance_config(env: &Env) -> Option<GovernanceConfig> {
    env.storage()
        .persistent()
        .get(&get_governance_config_key(env))
}

pub fn set_governance_config(env: &Env, config: &GovernanceConfig) {
    env.storage()
        .persistent()
        .set(&get_governance_config_key(env), config);
}

// Fee configuration management
pub fn get_fee_config(env: &Env) -> Option<FeeConfig> {
    env.storage().persistent().get(&get_fee_config_key(env))
}

pub fn set_fee_config(env: &Env, config: &FeeConfig) {
    env.storage()
        .persistent()
        .set(&get_fee_config_key(env), config);
}

// Proposal management
pub fn get_proposal(env: &Env, proposal_id: &BytesN<32>) -> Option<Proposal> {
    env.storage()
        .persistent()
        .get(&get_proposal_key(env, proposal_id))
}

pub fn set_proposal(env: &Env, proposal_id: &BytesN<32>, proposal: &Proposal) {
    env.storage()
        .persistent()
        .set(&get_proposal_key(env, proposal_id), proposal);
}

// Vote management
pub fn get_vote(env: &Env, proposal_id: &BytesN<32>, voter: &Address) -> Option<Vote> {
    env.storage()
        .persistent()
        .get(&get_vote_key(env, proposal_id, voter))
}

pub fn set_vote(env: &Env, proposal_id: &BytesN<32>, voter: &Address, vote: &Vote) {
    env.storage()
        .persistent()
        .set(&get_vote_key(env, proposal_id, voter), vote);

    // Add to voter history
    let mut history = get_voter_history(env, voter);
    history.push_back(vote.clone());
    set_voter_history(env, voter, &history);
}

// Voter history management
pub fn get_voter_history(env: &Env, voter: &Address) -> Vec<Vote> {
    env.storage()
        .persistent()
        .get(&get_voter_history_key(env, voter))
        .unwrap_or(Vec::new(env))
}

pub fn set_voter_history(env: &Env, voter: &Address, history: &Vec<Vote>) {
    env.storage()
        .persistent()
        .set(&get_voter_history_key(env, voter), history);
}

// Active proposals management (simplified - in production would use more efficient indexing)
pub fn get_all_active_proposals(env: &Env) -> Vec<Proposal> {
    env.storage()
        .persistent()
        .get(&get_active_proposals_key(env))
        .unwrap_or(Vec::new(env))
}
