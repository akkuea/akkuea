use soroban_sdk::{contracttype, symbol_short, Address, Env, String, Symbol};

use crate::{Error, RewardEvent};

#[contracttype]
pub struct RewardIssuedEvent {
    pub recipient: Address,
    pub reward_type: String,
    pub amount: i128,
    pub timestamp: u64,
}
pub const REWARD_ISSUED: Symbol = symbol_short!("RD_ISSUED");

pub fn emit_reward_issued(env: &Env, event: &RewardEvent) -> Result<(), Error> {
    let reward_type_str = match event.reward_type {
        crate::RewardType::ContentCreation => "ContentCreation",
        crate::RewardType::ContentCuration => "ContentCuration",
        crate::RewardType::ExpertReview => "ExpertReview",
        crate::RewardType::Collaboration => "Collaboration",
    };

    let event_data = RewardIssuedEvent {
        recipient: event.recipient.clone(),
        reward_type: String::from_str(env, reward_type_str),
        amount: event.amount,
        timestamp: event.timestamp,
    };

    env.events()
        .publish((REWARD_ISSUED, symbol_short!("rd_issued")), event_data);
    Ok(())
}
