use crate::metadata::Content;
use soroban_sdk::{symbol_short, Env, IntoVal, String, Symbol, Val, Vec};

pub struct Events;

impl Events {
    // Event topics/names (max 9 chars)
    pub const CONTENT: Symbol = symbol_short!("content");
    pub const UPDATED: Symbol = symbol_short!("updated");
    pub const SEARCH: Symbol = symbol_short!("search");

    // Event emission helpers
    pub fn content_added(env: &Env, content: &Content) {
        let topics: Vec<Val> = (Events::CONTENT, content.id).into_val(env);
        let data: Val = (content.title.clone(), content.subject_tags.clone()).into_val(env);
        env.events().publish(topics, data);
    }

    pub fn content_updated(env: &Env, _old_content: &Content, new_content: &Content) {
        let topics: Vec<Val> = (Events::UPDATED, new_content.id).into_val(env);
        let data: Val = (
            // Fields that were updated
            new_content.title.clone(),
            new_content.description.clone(),
            new_content.subject_tags.clone(),
            new_content.content_url.clone(),
            new_content.author.clone(),
            new_content.difficulty_level.clone(),
            new_content.creation_date,
        )
            .into_val(env);
        env.events().publish(topics, data);
    }

    pub fn search_performed(env: &Env, query: &String, result_count: u32) {
        let topics: Vec<Val> = (Events::SEARCH,).into_val(env);
        let data: Val = (query.clone(), result_count, env.ledger().timestamp()).into_val(env);
        env.events().publish(topics, data);
    }
}
