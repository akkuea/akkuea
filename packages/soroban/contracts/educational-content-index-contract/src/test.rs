use soroban_sdk::{
    Env,
    String as SorobanString,
    Vec,
    Address,
    testutils::Events,
};

use crate::ContentSearchContract;

fn setup_contract(env: &Env) -> Address {
    let contract_id = env.register(ContentSearchContract, ());
    env.as_contract(&contract_id, || {
        ContentSearchContract::initialize(env.clone());
    });
    contract_id
}

#[test]
fn test_add_and_search_content() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add content
    let title = SorobanString::from_str(&env, "Blockchain Basics");
    let description = SorobanString::from_str(&env, "Introduction to blockchain technology");
    let tags = Vec::from_array(&env, [
        SorobanString::from_str(&env, "blockchain"),
        SorobanString::from_str(&env, "crypto"),
        SorobanString::from_str(&env, "technology"),
    ]);
    let url = SorobanString::from_str(&env, "https://example.com/blockchain-basics");

    let _content_id = env.as_contract(&contract_id, || {
        ContentSearchContract::add_content(
            env.clone(),
            title.clone(),
            description.clone(),
            tags.clone(),
            url.clone(),
        )
    }).unwrap();

    // Search content
    let search_term = SorobanString::from_str(&env, "blockchain");
    let results = env.as_contract(&contract_id, || {
        ContentSearchContract::search_content(env.clone(), search_term)
    }).unwrap();

    assert_eq!(results.len(), 1);
    let content = results.get_unchecked(0);
    assert_eq!(content.title, title);
    assert_eq!(content.description, description);
    assert_eq!(content.content_url, url);
}

#[test]
fn test_search_no_results() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    let search_term = SorobanString::from_str(&env, "nonexistent");
    let result = env.as_contract(&contract_id, || {
        ContentSearchContract::search_content(env.clone(), search_term)
    });
    assert!(result.is_err());
}

#[test]
fn test_add_content_validation() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Test empty title
    let result = env.as_contract(&contract_id, || {
        ContentSearchContract::add_content(
            env.clone(),
            SorobanString::from_str(&env, ""),
            SorobanString::from_str(&env, "Description"),
            Vec::from_array(&env, [SorobanString::from_str(&env, "tag")]),
            SorobanString::from_str(&env, "https://example.com"),
        )
    });
    assert!(result.is_err());

    // Test valid content
    let result = env.as_contract(&contract_id, || {
        ContentSearchContract::add_content(
            env.clone(),
            SorobanString::from_str(&env, "Blockchain Basics"),
            SorobanString::from_str(&env, "Description"),
            Vec::from_array(&env, [SorobanString::from_str(&env, "blockchain")]),
            SorobanString::from_str(&env, "https://example.com"),
        )
    });
    assert!(result.is_ok());
}

#[test]
fn test_case_insensitive_search() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add content with uppercase tag
    let _content_id = env.as_contract(&contract_id, || {
        ContentSearchContract::add_content(
            env.clone(),
            SorobanString::from_str(&env, "Blockchain Basics"),
            SorobanString::from_str(&env, "Description"),
            Vec::from_array(&env, [SorobanString::from_str(&env, "blockchain")]),
            SorobanString::from_str(&env, "https://example.com"),
        )
    }).unwrap();

    // Search with same case
    let results = env.as_contract(&contract_id, || {
        ContentSearchContract::search_content(
            env.clone(),
            SorobanString::from_str(&env, "blockchain")
        )
    }).unwrap();
    assert_eq!(results.len(), 1);
}

#[test]
fn test_content_added_event_emitted() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    let title = SorobanString::from_str(&env, "Blockchain Basics");
    let description = SorobanString::from_str(&env, "Introduction to blockchain technology");
    let tags = Vec::from_array(&env, [
        SorobanString::from_str(&env, "blockchain"),
        SorobanString::from_str(&env, "crypto"),
    ]);
    let url = SorobanString::from_str(&env, "https://example.com/blockchain-basics");

    let _content_id = env.as_contract(&contract_id, || {
        ContentSearchContract::add_content(
            env.clone(),
            title.clone(),
            description.clone(),
            tags.clone(),
            url.clone(),
        )
    }).unwrap();

    // Verify that an event was emitted
    let events = env.events().all();
    assert_eq!(events.len(), 1);
    
    // Verify the event came from our contract
    let event = events.get_unchecked(0);
    assert_eq!(event.0, contract_id);
}

#[test]
fn test_search_performed_event_emitted() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add some content first
    let _content_id = env.as_contract(&contract_id, || {
        ContentSearchContract::add_content(
            env.clone(),
            SorobanString::from_str(&env, "Blockchain Basics"),
            SorobanString::from_str(&env, "Description"),
            Vec::from_array(&env, [SorobanString::from_str(&env, "blockchain")]),
            SorobanString::from_str(&env, "https://example.com"),
        )
    }).unwrap();

    // Clear events from content addition
    env.events().all(); // This consumes the events

    // Perform search
    let search_term = SorobanString::from_str(&env, "blockchain");
    let _results = env.as_contract(&contract_id, || {
        ContentSearchContract::search_content(env.clone(), search_term.clone())
    }).unwrap();

    // Verify that a search event was emitted
    let events = env.events().all();
    assert_eq!(events.len(), 1);
    
    // Verify the event came from our contract
    let event = events.get_unchecked(0);
    assert_eq!(event.0, contract_id);
}

#[test]
fn test_search_performed_event_emitted_no_results() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Perform search with no matching content
    let search_term = SorobanString::from_str(&env, "nonexistent");
    let _result = env.as_contract(&contract_id, || {
        ContentSearchContract::search_content(env.clone(), search_term.clone())
    });

    // Verify that a search event was emitted even when no results found
    let events = env.events().all();
    assert_eq!(events.len(), 1);
    
    // Verify the event came from our contract
    let event = events.get_unchecked(0);
    assert_eq!(event.0, contract_id);
}

#[test]
fn test_content_updated_event_emitted() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add content first
    let content_id = env.as_contract(&contract_id, || {
        ContentSearchContract::add_content(
            env.clone(),
            SorobanString::from_str(&env, "Original Title"),
            SorobanString::from_str(&env, "Original Description"),
            Vec::from_array(&env, [SorobanString::from_str(&env, "original")]),
            SorobanString::from_str(&env, "https://example.com/original"),
        )
    }).unwrap();

    // Clear events from content addition
    env.events().all(); // This consumes the events

    // Update the content
    let new_title = Some(SorobanString::from_str(&env, "Updated Title"));
    let new_description = Some(SorobanString::from_str(&env, "Updated Description"));
    
    let _result = env.as_contract(&contract_id, || {
        ContentSearchContract::update_content(
            env.clone(),
            content_id,
            new_title.clone(),
            new_description.clone(),
            None,
            None,
        )
    }).unwrap();

    // Verify that an update event was emitted
    let events = env.events().all();
    assert_eq!(events.len(), 1);
    
    // Verify the event came from our contract
    let event = events.get_unchecked(0);
    assert_eq!(event.0, contract_id);
}

#[test]
fn test_update_nonexistent_content() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Try to update content that doesn't exist
    let result = env.as_contract(&contract_id, || {
        ContentSearchContract::update_content(
            env.clone(),
            999, // Non-existent ID
            Some(SorobanString::from_str(&env, "New Title")),
            None,
            None,
            None,
        )
    });
    
    assert!(result.is_err());
    
    // Verify no events were emitted
    let events = env.events().all();
    assert_eq!(events.len(), 0);
}

#[test]
fn test_all_operations_emit_events() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add content - should emit event
    let content_id = env.as_contract(&contract_id, || {
        ContentSearchContract::add_content(
            env.clone(),
            SorobanString::from_str(&env, "Test Content"),
            SorobanString::from_str(&env, "Test Description"),
            Vec::from_array(&env, [SorobanString::from_str(&env, "test")]),
            SorobanString::from_str(&env, "https://example.com/test"),
        )
    }).unwrap();

    // Verify add operation emitted an event
    let add_events = env.events().all();
    assert_eq!(add_events.len(), 1);
    assert_eq!(add_events.get_unchecked(0).0, contract_id);

    // Update content - should emit event
    let _update_result = env.as_contract(&contract_id, || {
        ContentSearchContract::update_content(
            env.clone(),
            content_id,
            Some(SorobanString::from_str(&env, "Updated Test Content")),
            None,
            None,
            None,
        )
    }).unwrap();

    // Verify update operation emitted an event
    let update_events = env.events().all();
    assert_eq!(update_events.len(), 1);
    assert_eq!(update_events.get_unchecked(0).0, contract_id);

    // Search content - should emit event
    let _search_result = env.as_contract(&contract_id, || {
        ContentSearchContract::search_content(
            env.clone(),
            SorobanString::from_str(&env, "test")
        )
    }).unwrap();

    // Verify search operation emitted an event
    let search_events = env.events().all();
    assert_eq!(search_events.len(), 1);
    assert_eq!(search_events.get_unchecked(0).0, contract_id);
} 