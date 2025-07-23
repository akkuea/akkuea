use soroban_sdk::{Address, Env, Symbol, Vec};

use crate::types::{EducatorStats, TipHistory};

// Storage keys
fn get_admin_key(env: &Env) -> Symbol {
    Symbol::new(env, "ADMIN")
}

fn get_educator_stats_key(env: &Env, _educator: &Address) -> Symbol {
    Symbol::new(env, "EDU_STATS")
}

fn get_tip_history_key(env: &Env, _educator: &Address) -> Symbol {
    Symbol::new(env, "TIP_HIST")
}

fn get_top_educators_key(env: &Env) -> Symbol {
    Symbol::new(env, "TOP_EDU")
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
    env.storage().instance().get(&get_educator_stats_key(env, educator))
}

pub fn set_educator_stats(env: &Env, educator: &Address, stats: &EducatorStats) {
    env.storage().instance().set(&get_educator_stats_key(env, educator), stats);
}

// Tip history management
pub fn get_tip_history(env: &Env, educator: &Address) -> Option<TipHistory> {
    env.storage().instance().get(&get_tip_history_key(env, educator))
}

pub fn set_tip_history(env: &Env, educator: &Address, history: &TipHistory) {
    env.storage().instance().set(&get_tip_history_key(env, educator), history);
}

// Top educators management
pub fn get_top_educators(env: &Env) -> Vec<(Address, EducatorStats)> {
    env.storage().instance().get(&get_top_educators_key(env)).unwrap_or(Vec::new(env))
}

pub fn set_top_educators(env: &Env, educators: &Vec<(Address, EducatorStats)>) {
    env.storage().instance().set(&get_top_educators_key(env), educators);
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

// Subscriptions storage
pub fn get_subscriptions(env: &Env, subscriber: &Address) -> Vec<(Address, crate::subscriptions::Subscription)> {
    // TODO: Retrieve all subscriptions for a subscriber
    Vec::new(env)
}

pub fn set_subscription(env: &Env, subscriber: &Address, educator: &Address, subscription: &crate::subscriptions::Subscription) {
    // TODO: Store a subscription for a subscriber-educator pair
}

pub fn remove_subscription(env: &Env, subscriber: &Address, educator: &Address) {
    // TODO: Remove a subscription
}

// Analytics storage
pub fn get_tip_analytics(env: &Env, educator: &Address) -> Option<crate::analytics::TipAnalytics> {
    // TODO: Retrieve analytics data for an educator
    None
}

pub fn set_tip_analytics(env: &Env, educator: &Address, analytics: &crate::analytics::TipAnalytics) {
    // TODO: Store analytics data for an educator
}