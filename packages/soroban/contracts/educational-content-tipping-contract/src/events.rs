use crate::types::Tip;
use soroban_sdk::{Address, BytesN, Env, Symbol};

pub fn emit_tip_event(env: &Env, tip: &Tip) {
    let topics = (Symbol::new(env, "tip"), tip.from.clone(), tip.to.clone());
    let data = (
        tip.amount,
        tip.token.clone(),
        tip.message.clone(),
        tip.timestamp,
    );
    env.events().publish(topics, data);
}

pub fn emit_educator_stats_updated(
    env: &Env,
    educator: &Address,
    total_tips: i128,
    tip_count: u32,
) {
    let topics = (Symbol::new(env, "educator_stats_updated"), educator.clone());
    let data = (total_tips, tip_count);
    env.events().publish(topics, data);
}

// Subscription events
pub fn emit_subscription_created(
    env: &Env,
    subscription_id: &BytesN<32>,
    subscriber: &Address,
    educator: &Address,
    amount: i128,
    period: u64,
) {
    let topics = (
        Symbol::new(env, "subscription_created"),
        subscriber.clone(),
        educator.clone(),
    );
    let data = (subscription_id.clone(), amount, period);
    env.events().publish(topics, data);
}

pub fn emit_subscription_executed(
    env: &Env,
    subscription_id: &BytesN<32>,
    subscriber: &Address,
    educator: &Address,
    amount: i128,
) {
    let topics = (
        Symbol::new(env, "subscription_executed"),
        subscriber.clone(),
        educator.clone(),
    );
    let data = (subscription_id.clone(), amount);
    env.events().publish(topics, data);
}

pub fn emit_subscription_cancelled(
    env: &Env,
    subscription_id: &BytesN<32>,
    subscriber: &Address,
    educator: &Address,
) {
    let topics = (
        Symbol::new(env, "subscription_cancelled"),
        subscriber.clone(),
        educator.clone(),
    );
    let data = subscription_id.clone();
    env.events().publish(topics, data);
}

// Goal events
pub fn emit_goal_created(
    env: &Env,
    goal_id: &BytesN<32>,
    educator: &Address,
    target_amount: i128,
    deadline: u64,
) {
    let topics = (Symbol::new(env, "goal_created"), educator.clone());
    let data = (goal_id.clone(), target_amount, deadline);
    env.events().publish(topics, data);
}

pub fn emit_goal_updated(
    env: &Env,
    goal_id: &BytesN<32>,
    current_amount: i128,
    target_amount: i128,
) {
    let topics = (Symbol::new(env, "goal_updated"), goal_id.clone());
    let data = (current_amount, target_amount);
    env.events().publish(topics, data);
}

pub fn emit_goal_completed(
    env: &Env,
    goal_id: &BytesN<32>,
    educator: &Address,
    final_amount: i128,
) {
    let topics = (Symbol::new(env, "goal_completed"), educator.clone());
    let data = (goal_id.clone(), final_amount);
    env.events().publish(topics, data);
}

// Conditional tip events
pub fn emit_conditional_tip_created(
    env: &Env,
    tip_id: &BytesN<32>,
    from: &Address,
    to: &Address,
    amount: i128,
    condition_type: &str,
    condition_value: i128,
) {
    let topics = (
        Symbol::new(env, "conditional_tip_created"),
        from.clone(),
        to.clone(),
    );
    let data = (tip_id.clone(), amount, condition_value);
    env.events().publish(topics, data);
}

pub fn emit_conditional_tip_executed(
    env: &Env,
    tip_id: &BytesN<32>,
    from: &Address,
    to: &Address,
    amount: i128,
    final_metric_value: i128,
) {
    let topics = (
        Symbol::new(env, "conditional_tip_executed"),
        from.clone(),
        to.clone(),
    );
    let data = (tip_id.clone(), amount, final_metric_value);
    env.events().publish(topics, data);
}

// Analytics events
pub fn emit_analytics_recorded(
    env: &Env,
    timestamp: u64,
    total_tips: i128,
    unique_tippers: u32,
    tip_count: u32,
) {
    let topics = (Symbol::new(env, "analytics_recorded"),);
    let data = (timestamp, total_tips, unique_tippers, tip_count);
    env.events().publish(topics, data);
}

pub fn emit_trend_analysis_completed(
    env: &Env,
    educator: &Address,
    trend_type: &str,
    percentage_change: i128,
    period_days: u32,
) {
    let topics = (
        Symbol::new(env, "trend_analysis_completed"),
        educator.clone(),
    );
    let data = (percentage_change, period_days);
    env.events().publish(topics, data);
}
