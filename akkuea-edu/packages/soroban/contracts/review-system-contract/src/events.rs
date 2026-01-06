use soroban_sdk::{contracttype, Address, Env};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SentimentAnalyzedEvent {
    pub review_id: u64,
    pub content_id: u64,
    pub reviewer: Address,
    pub sentiment_score: i32,
}

pub struct Events;

impl Events {
    pub fn sentiment_analyzed(
        env: &Env,
        review_id: u64,
        content_id: u64,
        reviewer: &Address,
        sentiment_score: i32,
    ) {
        let event = SentimentAnalyzedEvent {
            review_id,
            content_id,
            reviewer: reviewer.clone(),
            sentiment_score,
        };
        env.events().publish(("sentiment_analyzed",), event);
    }
}
