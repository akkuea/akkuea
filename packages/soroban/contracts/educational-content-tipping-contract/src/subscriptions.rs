// Subscriptions module for recurring tips
// TODO: Implement recurring tip logic, scheduling, and processing

use soroban_sdk::{Address, Env, String, contracttype, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Subscription {
    pub subscriber: Address,
    pub educator: Address,
    pub amount: i128,
    pub token: Address,
    pub interval_seconds: u64,
    pub next_payment_timestamp: u64,
    pub message: Option<String>,
    pub active: bool,
}

pub fn create_subscription(
    env: &Env,
    subscriber: Address,
    educator: Address,
    amount: i128,
    token: Address,
    interval_seconds: u64,
    message: Option<String>,
) {
    // Calculate next payment timestamp
    let now = env.ledger().timestamp();
    let next_payment_timestamp = now + interval_seconds;

    // Create subscription struct
    let subscription = Subscription {
        subscriber: subscriber.clone(),
        educator: educator.clone(),
        amount,
        token,
        interval_seconds,
        next_payment_timestamp,
        message,
        active: true,
    };

    // Store subscription (overwrites any existing for this pair)
    crate::storage::set_subscription(env, &subscriber, &educator, &subscription);
}

pub fn cancel_subscription(env: &Env, subscriber: Address, educator: Address) {
    // Remove the subscription from storage
    crate::storage::remove_subscription(env, &subscriber, &educator);
}

pub fn process_due_subscriptions(env: &Env) {
    // TODO: Process all subscriptions that are due for payment
} 