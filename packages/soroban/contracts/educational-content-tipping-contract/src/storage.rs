use soroban_sdk::{Address, Env, Symbol, Vec};
use crate::types::{EducatorStats, TipHistory};
use crate::token::WhitelistedToken;
use crate::price_feeds::{PriceData, ConversionRate};

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

// Admin management (existing)
pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&get_admin_key(env))
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&get_admin_key(env), admin);
}

// Educator stats management (existing)
pub fn get_educator_stats(env: &Env, educator: &Address) -> Option<EducatorStats> {
    env.storage().instance().get(&get_educator_stats_key(env, educator))
}

pub fn set_educator_stats(env: &Env, educator: &Address, stats: &EducatorStats) {
    env.storage().instance().set(&get_educator_stats_key(env, educator), stats);
}

// Tip history management (existing)
pub fn get_tip_history(env: &Env, educator: &Address) -> Option<TipHistory> {
    env.storage().instance().get(&get_tip_history_key(env, educator))
}

pub fn set_tip_history(env: &Env, educator: &Address, history: &TipHistory) {
    env.storage().instance().set(&get_tip_history_key(env, educator), history);
}

// Top educators management (existing - FIXED)
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
        let (addr, _) = top_educators.get(i).unwrap(); // FIXED: corrected syntax error
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

// Token whitelist management (NEW)
pub fn get_whitelisted_token(env: &Env, token: &Address) -> Option<WhitelistedToken> {
    env.storage().persistent().get(&get_token_whitelist_key(env, token))
}

pub fn set_whitelisted_token(env: &Env, token: &Address, whitelisted_token: &WhitelistedToken) {
    env.storage().persistent().set(&get_token_whitelist_key(env, token), whitelisted_token);
}

pub fn get_token_list(env: &Env) -> Vec<Address> {
    env.storage().persistent().get(&get_token_list_key(env)).unwrap_or(Vec::new(env))
}

pub fn set_token_list(env: &Env, token_list: &Vec<Address>) {
    env.storage().persistent().set(&get_token_list_key(env), token_list);
}

// Price data management (NEW)
pub fn get_price_data(env: &Env, token: &Address) -> Option<PriceData> {
    env.storage().persistent().get(&get_price_data_key(env, token))
}

pub fn set_price_data(env: &Env, token: &Address, price_data: &PriceData) {
    env.storage().persistent().set(&get_price_data_key(env, token), price_data);
}

// Conversion rate caching (NEW)
pub fn get_conversion_rate(env: &Env, from_token: &Address, to_token: &Address) -> Option<ConversionRate> {
    env.storage().temporary().get(&get_conversion_rate_key(env, from_token, to_token))
}

pub fn set_conversion_rate(env: &Env, from_token: &Address, to_token: &Address, rate: &ConversionRate) {
    env.storage().temporary().set(&get_conversion_rate_key(env, from_token, to_token), rate);
}

// Oracle management (NEW)
pub fn get_authorized_oracles(env: &Env) -> Vec<Address> {
    env.storage().persistent().get(&get_oracle_list_key(env)).unwrap_or(Vec::new(env))
}

pub fn set_authorized_oracles(env: &Env, oracles: &Vec<Address>) {
    env.storage().persistent().set(&get_oracle_list_key(env), oracles);
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