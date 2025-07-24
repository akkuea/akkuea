use soroban_sdk::{Address, Env, Symbol};

use crate::types::Tip;

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

pub fn emit_educator_stats_updated(env: &Env, educator: &Address, total_tips: i128, tip_count: u32) {
    let topics = (Symbol::new(env, "educator_stats_updated"), educator.clone());
    let data = (total_tips, tip_count);
    env.events().publish(topics, data);
}

pub fn emit_tip_goal_set(env: &Env, educator: &Address, goal_amount: i128) {
    let topics = (Symbol::new(env, "tip_goal_set"), educator.clone());
    env.events().publish(topics, goal_amount);
}

pub fn emit_tip_goal_achieved(env: &Env, educator: &Address, goal_amount: i128) {
    let topics = (Symbol::new(env, "tip_goal_achieved"), educator.clone());
    env.events().publish(topics, goal_amount);
} 