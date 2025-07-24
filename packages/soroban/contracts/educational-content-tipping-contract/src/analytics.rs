// Analytics module for tipping trends and reporting
// Implements analytics data collection, time-based reporting, and trend analysis

use soroban_sdk::{Address, Env, contracttype, Vec, Map};
use crate::storage;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TipAnalytics {
    pub educator: Address,
    pub total_tips: i128,
    pub total_amount: i128,
    pub unique_tippers: u32,
    pub tips_per_period: Vec<(u64, i128)>, // (timestamp, amount)
}

// Helper: maintain a list of unique tippers per educator in storage
fn get_unique_tippers_key(educator: &Address) -> (Address, &'static str) {
    (educator.clone(), "unique_tippers")
}

pub fn record_tip(env: &Env, educator: &Address, tipper: &Address, amount: i128, timestamp: u64) {
    // Get or create analytics
    let mut analytics = storage::get_tip_analytics(env, educator).unwrap_or(TipAnalytics {
        educator: educator.clone(),
        total_tips: 0,
        total_amount: 0,
        unique_tippers: 0,
        tips_per_period: Vec::new(env),
    });
    // Update totals
    analytics.total_tips += 1;
    analytics.total_amount += amount;
    analytics.tips_per_period.push_back((timestamp, amount));
    // Update unique tippers
    let key = get_unique_tippers_key(educator);
    let mut tippers: Vec<Address> = env.storage().instance().get(&key).unwrap_or(Vec::new(env));
    if !tippers.iter().any(|a| a == tipper.clone()) {
        tippers.push_back(tipper.clone());
        analytics.unique_tippers = tippers.len() as u32;
        env.storage().instance().set(&key, &tippers);
    } else {
        analytics.unique_tippers = tippers.len() as u32;
    }
    // Save analytics
    storage::set_tip_analytics(env, educator, &analytics);
}

pub fn get_analytics(env: &Env, educator: &Address) -> Option<TipAnalytics> {
    storage::get_tip_analytics(env, educator)
}

pub fn get_trend_report(env: &Env, educator: &Address, period_seconds: u64) -> Vec<(u64, i128)> {
    // Aggregate tips by period
    let analytics = match storage::get_tip_analytics(env, educator) {
        Some(a) => a,
        None => return Vec::new(env),
    };
    let mut period_map: Map<u64, i128> = Map::new(env);
    for (timestamp, amount) in analytics.tips_per_period.iter() {
        let period = timestamp / period_seconds;
        let prev = period_map.get(period).unwrap_or(0);
        period_map.set(period, prev + amount);
    }
    // Convert to Vec<(period_start_timestamp, total_amount)>
    let mut result = Vec::new(env);
    for (period, total) in period_map.iter() {
        result.push_back((period * period_seconds, total));
    }
    result
} 