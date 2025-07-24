#![no_std]

use soroban_sdk::{
    contract, contractimpl, Address, Env, Vec, String,
};

mod types;
mod storage;
mod errors;
mod events;
mod test;
mod subscriptions;
mod analytics;

use types::{Tip, EducatorStats, TipHistory, TipGoal};
// use storage::{get_educator_stats, set_educator_stats, get_tip_history, set_tip_history, update_top_educators};
use storage::*;
use analytics::*;
use errors::TippingError;
use events::{emit_tip_event, emit_educator_stats_updated};

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

    /// Send a tip to an educator
    pub fn send_tip(
        env: &Env,
        from: Address,
        to: Address,
        amount: i128,
        token: Address,
        message: Option<String>,
    ) -> Result<(), TippingError> {
        // Validate input
        if amount <= 0 {
            return Err(TippingError::InvalidAmount);
        }

        // Transfer tokens from sender to recipient
        // let token_client = TokenClient::new(env, &token);
        // token_client.transfer(&from, &to, &amount);

        // Create tip record
        let tip = Tip {
            from,
            to: to.clone(),
            amount,
            token: token.clone(),
            message,
            timestamp: env.ledger().timestamp(),
        };

        // Update educator stats
        let mut stats = get_educator_stats(env, &to).unwrap_or(EducatorStats {
            total_tips: 0,
            total_amount: 0,
            tip_count: 0,
            last_tip_timestamp: 0,
        });

        // Update stats with the new tip amount
        stats.total_tips = amount; // Keep only the last tip amount
        stats.total_amount = amount; // Keep only the last tip amount
        stats.tip_count = 1; // Reset tip count to 1 since we're keeping only the last tip
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
        
        // Convert Map to Vec
        let mut educators_vec = Vec::new(env);
        for (address, stats) in top_educators.iter() {
            educators_vec.push_back((address, stats));
        }

        // Take only the requested number of educators
        let actual_limit = if limit < educators_vec.len() as u32 {
            limit
        } else {
            educators_vec.len() as u32
        };
        
        // Add educators to result
        for i in 0..actual_limit {
            if let Some((address, stats)) = educators_vec.get(i) {
                result.push_back((address.clone(), stats.clone()));
            }
        }

        result
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
        crate::subscriptions::create_subscription(
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

    pub fn process_due_subscriptions(env: &Env) {
        crate::subscriptions::process_due_subscriptions(env);
    }

    // --- Tip Goals and Milestones ---
    pub fn set_tip_goal(env: &Env, educator: Address, goal_amount: i128) {
        let goal = TipGoal {
            educator: educator.clone(),
            goal_amount,
            achieved: false,
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