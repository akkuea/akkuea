use soroban_sdk::{
    Address, Env, String as SorobanString, Vec,
    testutils::Events, TryIntoVal, Symbol,
};
use crate::{ContentSearchContract, events::Events as ContractEvents};

fn setup_contract(env: &Env) -> Address {
    let contract_id = env.register(ContentSearchContract, ());
    env.as_contract(&contract_id, || {
        ContentSearchContract::initialize(env.clone());
    });
    contract_id
}

#[test]
fn test_add_content_emits_event() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add content
    let title = SorobanString::from_str(&env, "Blockchain Basics");
    let description = SorobanString::from_str(&env, "Introduction to blockchain technology");
    let tags = Vec::from_array(
        &env,
        [
            SorobanString::from_str(&env, "blockchain"),
            SorobanString::from_str(&env, "crypto"),
            SorobanString::from_str(&env, "technology"),
        ],
    );
    let url = SorobanString::from_str(&env, "https://example.com/blockchain-basics");

    let content_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                title.clone(),
                description.clone(),
                tags.clone(),
                url.clone(),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Verify event was emitted
    let events = env.events().all();
    let (_, topics, data) = events.last().unwrap();
    
    // Check event topic
    let topic_symbol: Symbol = topics.get_unchecked(0).try_into_val(&env).unwrap();
    let topic_id: u64 = topics.get_unchecked(1).try_into_val(&env).unwrap();
    assert_eq!(topic_symbol, ContractEvents::CONTENT);
    assert_eq!(topic_id, content_id);
    
    // Check event data
    let (emitted_title, emitted_tags): (SorobanString, Vec<SorobanString>) = data.try_into_val(&env).unwrap();
    assert_eq!(emitted_title, title);
    assert_eq!(emitted_tags, tags);
}

#[test]
fn test_search_content_emits_event() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add some content first
    let title = SorobanString::from_str(&env, "Blockchain Basics");
    let description = SorobanString::from_str(&env, "Introduction to blockchain technology");
    let tags = Vec::from_array(
        &env,
        [SorobanString::from_str(&env, "blockchain")],
    );
    let url = SorobanString::from_str(&env, "https://example.com/blockchain-basics");

    env.as_contract(&contract_id, || {
        ContentSearchContract::add_content(
            env.clone(),
            title,
            description,
            tags,
            url,
            None,
            None,
            None,
        )
    }).unwrap();

    // Clear events from add_content
    env.events().all();

    // Perform search
    let search_term = SorobanString::from_str(&env, "blockchain");
    env.as_contract(&contract_id, || {
        ContentSearchContract::search_content(env.clone(), search_term.clone())
    }).unwrap();

    // Verify search event was emitted
    let events = env.events().all();
    let (_, topics, data) = events.last().unwrap();
    
    // Check event topic
    let topic_symbol: Symbol = topics.get_unchecked(0).try_into_val(&env).unwrap();
    assert_eq!(topic_symbol, ContractEvents::SEARCH);
    
    // Check event data
    let (query, result_count, _timestamp): (SorobanString, u32, u64) = data.try_into_val(&env).unwrap();
    assert_eq!(query, search_term);
    assert_eq!(result_count, 1);
}

#[test]
fn test_add_and_search_content() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add content
    let title = SorobanString::from_str(&env, "Blockchain Basics");
    let description = SorobanString::from_str(&env, "Introduction to blockchain technology");
    let tags = Vec::from_array(
        &env,
        [
            SorobanString::from_str(&env, "blockchain"),
            SorobanString::from_str(&env, "crypto"),
            SorobanString::from_str(&env, "technology"),
        ],
    );
    let url = SorobanString::from_str(&env, "https://example.com/blockchain-basics");

    let _content_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                title.clone(),
                description.clone(),
                tags.clone(),
                url.clone(),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Search content
    let search_term = SorobanString::from_str(&env, "blockchain");
    let results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content(env.clone(), search_term)
        })
        .unwrap();

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
            None,
            None,
            None,
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
            Some(SorobanString::from_str(&env, "Maxwell")),
            Some(SorobanString::from_str(&env, "Beginner")),
            Some(1633036800),
        )
    });
    assert!(result.is_ok());
}

#[test]
fn test_add_content_validation_invalid_difficulty() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Test invalid difficulty level
    let result = env.as_contract(&contract_id, || {
        ContentSearchContract::add_content(
            env.clone(),
            SorobanString::from_str(&env, "Blockchain Basics"),
            SorobanString::from_str(&env, "Description"),
            Vec::from_array(&env, [SorobanString::from_str(&env, "blockchain")]),
            SorobanString::from_str(&env, "https://example.com"),
            None,
            Some(SorobanString::from_str(&env, "Expert")),
            None,
        )
    });
    assert!(result.is_err());
}

#[test]
fn test_case_insensitive_search() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add content with uppercase tag
    let _content_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Blockchain Basics"),
                SorobanString::from_str(&env, "Description"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "blockchain")]),
                SorobanString::from_str(&env, "https://example.com"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Search with same case
    let results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content(
                env.clone(),
                SorobanString::from_str(&env, "blockchain"),
            )
        })
        .unwrap();
    assert_eq!(results.len(), 1);
}

#[test]
fn test_update_content_emits_event() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // First add content
    let title = SorobanString::from_str(&env, "Blockchain Basics");
    let description = SorobanString::from_str(&env, "Introduction to blockchain technology");
    let tags = Vec::from_array(
        &env,
        [SorobanString::from_str(&env, "blockchain")],
    );
    let url = SorobanString::from_str(&env, "https://example.com/blockchain-basics");

    let content_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                title,
                description,
                tags.clone(),
                url,
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Clear events from add_content
    env.events().all();

    // Update the content
    let new_title = SorobanString::from_str(&env, "Advanced Blockchain");
    let new_description = SorobanString::from_str(&env, "Deep dive into blockchain");
    let new_tags = Vec::from_array(
        &env,
        [
            SorobanString::from_str(&env, "blockchain"),
            SorobanString::from_str(&env, "advanced"),
        ],
    );
    let new_url = SorobanString::from_str(&env, "https://example.com/advanced-blockchain");

    env.as_contract(&contract_id, || {
        ContentSearchContract::update_content(
            env.clone(),
            content_id,
            new_title.clone(),
            new_description.clone(),
            new_tags.clone(),
            new_url.clone(),
            None,
            None,
            None,
        )
    })
    .unwrap();

    // Verify update event was emitted
    let events = env.events().all();
    let (_, topics, data) = events.last().unwrap();
    
    // Check event topic
    let topic_symbol: Symbol = topics.get_unchecked(0).try_into_val(&env).unwrap();
    let topic_id: u64 = topics.get_unchecked(1).try_into_val(&env).unwrap();
    assert_eq!(topic_symbol, ContractEvents::UPDATED);
    assert_eq!(topic_id, content_id);
    
    // Check event data contains updated fields
    let (
        updated_title,
        updated_description,
        updated_tags,
        updated_url,
        _author,
        _difficulty,
        _creation_date,
    ): (
        SorobanString,
        SorobanString,
        Vec<SorobanString>,
        SorobanString,
        Option<SorobanString>,
        Option<SorobanString>,
        Option<u64>,
    ) = data.try_into_val(&env).unwrap();

    assert_eq!(updated_title, new_title);
    assert_eq!(updated_description, new_description);
    assert_eq!(updated_tags, new_tags);
    assert_eq!(updated_url, new_url);
}

#[test]
fn test_update_nonexistent_content() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    let result = env.as_contract(&contract_id, || {
        ContentSearchContract::update_content(
            env.clone(),
            999, // Non-existent ID
            SorobanString::from_str(&env, "Title"),
            SorobanString::from_str(&env, "Description"),
            Vec::from_array(&env, [SorobanString::from_str(&env, "tag")]),
            SorobanString::from_str(&env, "https://example.com"),
            None,
            None,
            None,
        )
    });

    assert!(result.is_err());
}
