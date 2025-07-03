use soroban_sdk::{contracttype, Env, String, Vec, Symbol, symbol_short};

// Event type symbols (max 9 characters)
const CONTENT_ADD: Symbol = symbol_short!("cont_add");
const CONTENT_UPD: Symbol = symbol_short!("cont_upd");
const SEARCH_PERF: Symbol = symbol_short!("search");

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContentAddedEvent {
    pub content_id: u64,
    pub title: String,
    pub subject_tags: Vec<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContentUpdatedEvent {
    pub content_id: u64,
    pub updated_fields: Vec<String>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SearchPerformedEvent {
    pub query: String,
    pub result_count: u32,
    pub timestamp: u64,
}

/// Emit a ContentAdded event
pub fn emit_content_added(env: &Env, content_id: u64, title: String, subject_tags: Vec<String>) {
    let event = ContentAddedEvent {
        content_id,
        title,
        subject_tags,
    };
    
    // Emit the event - using env.events().publish() with topic and data
    env.events().publish((CONTENT_ADD,), event);
}

/// Emit a ContentUpdated event
pub fn emit_content_updated(env: &Env, content_id: u64, updated_fields: Vec<String>) {
    let event = ContentUpdatedEvent {
        content_id,
        updated_fields,
    };
    
    env.events().publish((CONTENT_UPD,), event);
}

/// Emit a SearchPerformed event
pub fn emit_search_performed(env: &Env, query: String, result_count: u32) {
    let timestamp = env.ledger().timestamp();
    
    let event = SearchPerformedEvent {
        query,
        result_count,
        timestamp,
    };
    
    env.events().publish((SEARCH_PERF,), event);
} 