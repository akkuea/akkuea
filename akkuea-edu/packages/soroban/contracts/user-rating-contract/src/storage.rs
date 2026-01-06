use crate::types::{DataKey, RatingData, ReputationData};
use soroban_sdk::{Address, BytesN, Env, Vec};

pub fn save_rating(env: &Env, rating_data: &RatingData) {
    let key = DataKey::TransactionRating(rating_data.transaction_id.clone());
    env.storage().instance().set(&key, rating_data);
}

pub fn get_rating_by_transaction(env: &Env, transaction_id: &BytesN<32>) -> Option<RatingData> {
    let key = DataKey::TransactionRating(transaction_id.clone());

    if env.storage().instance().has(&key) {
        Some(env.storage().instance().get(&key).unwrap())
    } else {
        None
    }
}

pub fn save_reputation(env: &Env, user: &Address, reputation_data: &ReputationData) {
    let key = DataKey::UserReputation(user.clone());
    env.storage().instance().set(&key, reputation_data);
}

pub fn get_reputation(env: &Env, user: &Address) -> Option<ReputationData> {
    let key = DataKey::UserReputation(user.clone());

    if env.storage().instance().has(&key) {
        Some(env.storage().instance().get(&key).unwrap())
    } else {
        None
    }
}

pub fn update_rating_history(env: &Env, user: &Address, transaction_id: &BytesN<32>) {
    let key = DataKey::UserRatingHistory(user.clone());

    let mut history: Vec<BytesN<32>> = if env.storage().instance().has(&key) {
        env.storage().instance().get(&key).unwrap()
    } else {
        Vec::new(env)
    };

    history.push_back(transaction_id.clone());
    env.storage().instance().set(&key, &history);
}

pub fn get_user_rating_history(env: &Env, user: &Address) -> Vec<BytesN<32>> {
    let key = DataKey::UserRatingHistory(user.clone());

    if env.storage().instance().has(&key) {
        env.storage().instance().get(&key).unwrap()
    } else {
        Vec::new(env)
    }
}

pub fn save_last_rating_timestamp(env: &Env, user: &Address, timestamp: u64) {
    let key = DataKey::LastRatingTimestamp(user.clone());
    env.storage().instance().set(&key, &timestamp);
}

pub fn get_last_rating_timestamp(env: &Env, user: &Address) -> Option<u64> {
    let key = DataKey::LastRatingTimestamp(user.clone());

    if env.storage().instance().has(&key) {
        Some(env.storage().instance().get(&key).unwrap())
    } else {
        None
    }
}
