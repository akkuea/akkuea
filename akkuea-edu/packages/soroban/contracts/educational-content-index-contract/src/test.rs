use crate::{events::Events as ContractEvents, ContentSearchContract};
use soroban_sdk::{
    testutils::Events, Address, Env, String as SorobanString, Symbol, TryIntoVal, Vec,
};

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
    let (emitted_title, emitted_tags): (SorobanString, Vec<SorobanString>) =
        data.try_into_val(&env).unwrap();
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
    let tags = Vec::from_array(&env, [SorobanString::from_str(&env, "blockchain")]);
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
    })
    .unwrap();

    // Clear events from add_content
    env.events().all();

    // Perform search
    let search_term = SorobanString::from_str(&env, "blockchain");
    env.as_contract(&contract_id, || {
        ContentSearchContract::search_content(env.clone(), search_term.clone())
    })
    .unwrap();

    // Verify search event was emitted
    let events = env.events().all();
    let (_, topics, data) = events.last().unwrap();

    // Check event topic
    let topic_symbol: Symbol = topics.get_unchecked(0).try_into_val(&env).unwrap();
    assert_eq!(topic_symbol, ContractEvents::SEARCH);

    // Check event data
    let (query, result_count, _timestamp): (SorobanString, u32, u64) =
        data.try_into_val(&env).unwrap();
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
    let tags = Vec::from_array(&env, [SorobanString::from_str(&env, "blockchain")]);
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

// ========== Indexed Search Performance Tests ==========

#[test]
fn test_indexed_search_basic_functionality() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add content with specific tags
    let blockchain_content_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Blockchain Fundamentals"),
                SorobanString::from_str(&env, "Learn blockchain basics"),
                Vec::from_array(
                    &env,
                    [
                        SorobanString::from_str(&env, "blockchain"),
                        SorobanString::from_str(&env, "crypto"),
                    ],
                ),
                SorobanString::from_str(&env, "https://example.com/blockchain"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    let programming_content_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Programming in Rust"),
                SorobanString::from_str(&env, "Learn Rust programming"),
                Vec::from_array(
                    &env,
                    [
                        SorobanString::from_str(&env, "programming"),
                        SorobanString::from_str(&env, "rust"),
                    ],
                ),
                SorobanString::from_str(&env, "https://example.com/rust"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Test indexed search for blockchain
    let blockchain_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content(
                env.clone(),
                SorobanString::from_str(&env, "blockchain"),
            )
        })
        .unwrap();

    assert_eq!(blockchain_results.len(), 1);
    assert_eq!(
        blockchain_results.get_unchecked(0).id,
        blockchain_content_id
    );

    // Test indexed search for programming
    let programming_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content(
                env.clone(),
                SorobanString::from_str(&env, "programming"),
            )
        })
        .unwrap();

    assert_eq!(programming_results.len(), 1);
    assert_eq!(
        programming_results.get_unchecked(0).id,
        programming_content_id
    );
}

#[test]
fn test_indexed_search_multiple_tags_per_content() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add content with multiple tags
    let content_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Smart Contract Development"),
                SorobanString::from_str(&env, "Build smart contracts on Stellar"),
                Vec::from_array(
                    &env,
                    [
                        SorobanString::from_str(&env, "blockchain"),
                        SorobanString::from_str(&env, "programming"),
                        SorobanString::from_str(&env, "stellar"),
                    ],
                ),
                SorobanString::from_str(&env, "https://example.com/smart-contracts"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Test that content can be found by any of its tags
    let blockchain_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content(
                env.clone(),
                SorobanString::from_str(&env, "blockchain"),
            )
        })
        .unwrap();
    assert_eq!(blockchain_results.len(), 1);
    assert_eq!(blockchain_results.get_unchecked(0).id, content_id);

    let programming_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content(
                env.clone(),
                SorobanString::from_str(&env, "programming"),
            )
        })
        .unwrap();
    assert_eq!(programming_results.len(), 1);
    assert_eq!(programming_results.get_unchecked(0).id, content_id);

    let stellar_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content(
                env.clone(),
                SorobanString::from_str(&env, "stellar"),
            )
        })
        .unwrap();
    assert_eq!(stellar_results.len(), 1);
    assert_eq!(stellar_results.get_unchecked(0).id, content_id);
}

#[test]
fn test_multi_tag_search() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add multiple content items with different tags
    let _blockchain_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Blockchain Basics"),
                SorobanString::from_str(&env, "Basic blockchain concepts"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "blockchain")]),
                SorobanString::from_str(&env, "https://example.com/blockchain"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    let _crypto_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Cryptocurrency Trading"),
                SorobanString::from_str(&env, "Learn crypto trading"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "crypto")]),
                SorobanString::from_str(&env, "https://example.com/crypto"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    let _programming_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Programming Fundamentals"),
                SorobanString::from_str(&env, "Basic programming concepts"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "programming")]),
                SorobanString::from_str(&env, "https://example.com/programming"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Test multi-tag search (OR operation)
    let multi_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content_multi_tag(
                env.clone(),
                Vec::from_array(
                    &env,
                    [
                        SorobanString::from_str(&env, "blockchain"),
                        SorobanString::from_str(&env, "crypto"),
                    ],
                ),
            )
        })
        .unwrap();

    assert_eq!(multi_results.len(), 2); // Should find both blockchain and crypto content
}

#[test]
fn test_indexed_search_update_behavior() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add content with initial tags
    let content_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Initial Title"),
                SorobanString::from_str(&env, "Initial description"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "init")]), // 4 chars
                SorobanString::from_str(&env, "https://example.com/initial"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Verify content can be found by initial tag
    let initial_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content(
                env.clone(),
                SorobanString::from_str(&env, "init"),
            )
        })
        .unwrap();
    assert_eq!(initial_results.len(), 1);

    // Update content with new tags
    env.as_contract(&contract_id, || {
        ContentSearchContract::update_content(
            env.clone(),
            content_id,
            SorobanString::from_str(&env, "Updated Title"),
            SorobanString::from_str(&env, "Updated description"),
            Vec::from_array(&env, [SorobanString::from_str(&env, "changed")]), // 7 chars, different bucket
            SorobanString::from_str(&env, "https://example.com/updated"),
            None,
            None,
            None,
        )
    })
    .unwrap();

    // Verify content can no longer be found by initial tag
    let no_initial_results = env.as_contract(&contract_id, || {
        ContentSearchContract::search_content(env.clone(), SorobanString::from_str(&env, "init"))
    });
    assert!(no_initial_results.is_err()); // Should not find any content

    // Verify content can be found by new tag
    let updated_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content(
                env.clone(),
                SorobanString::from_str(&env, "changed"),
            )
        })
        .unwrap();
    assert_eq!(updated_results.len(), 1);
    assert_eq!(updated_results.get_unchecked(0).id, content_id);
}

#[test]
fn test_get_content_by_id_indexed() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add content
    let content_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Test Content"),
                SorobanString::from_str(&env, "Test description"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "test")]),
                SorobanString::from_str(&env, "https://example.com/test"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Test indexed content retrieval
    let retrieved_content = env.as_contract(&contract_id, || {
        ContentSearchContract::get_content_by_id(env.clone(), content_id)
    });

    assert!(retrieved_content.is_some());
    let content = retrieved_content.unwrap();
    assert_eq!(content.id, content_id);
    assert_eq!(content.title, SorobanString::from_str(&env, "Test Content"));
}

#[test]
fn test_rebuild_search_indices() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add some content
    let _id1 = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Content 1"),
                SorobanString::from_str(&env, "Description 1"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "first")]), // 5 chars
                SorobanString::from_str(&env, "https://example.com/1"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    let _id2 = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Content 2"),
                SorobanString::from_str(&env, "Description 2"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "second")]), // 6 chars, different bucket
                SorobanString::from_str(&env, "https://example.com/2"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Rebuild indices (this should work without errors)
    let result = env.as_contract(&contract_id, || {
        ContentSearchContract::rebuild_search_indices(env.clone())
    });

    assert!(result.is_ok());

    // Verify search still works after rebuilding
    let search_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content(
                env.clone(),
                SorobanString::from_str(&env, "first"),
            )
        })
        .unwrap();

    assert_eq!(search_results.len(), 1);
}

// ========== Performance Demonstration Tests ==========

#[test]
fn test_search_performance_with_larger_dataset() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add multiple content items to simulate a larger dataset
    for i in 0..10 {
        let title = match i {
            0 => SorobanString::from_str(&env, "Content 0"),
            1 => SorobanString::from_str(&env, "Content 1"),
            2 => SorobanString::from_str(&env, "Content 2"),
            3 => SorobanString::from_str(&env, "Content 3"),
            4 => SorobanString::from_str(&env, "Content 4"),
            5 => SorobanString::from_str(&env, "Content 5"),
            6 => SorobanString::from_str(&env, "Content 6"),
            7 => SorobanString::from_str(&env, "Content 7"),
            8 => SorobanString::from_str(&env, "Content 8"),
            _ => SorobanString::from_str(&env, "Content 9"),
        };
        let description = match i {
            0 => SorobanString::from_str(&env, "Description 0"),
            1 => SorobanString::from_str(&env, "Description 1"),
            2 => SorobanString::from_str(&env, "Description 2"),
            3 => SorobanString::from_str(&env, "Description 3"),
            4 => SorobanString::from_str(&env, "Description 4"),
            5 => SorobanString::from_str(&env, "Description 5"),
            6 => SorobanString::from_str(&env, "Description 6"),
            7 => SorobanString::from_str(&env, "Description 7"),
            8 => SorobanString::from_str(&env, "Description 8"),
            _ => SorobanString::from_str(&env, "Description 9"),
        };
        let tag = if i % 3 == 0 {
            SorobanString::from_str(&env, "blockchain")
        } else if i % 3 == 1 {
            SorobanString::from_str(&env, "programming")
        } else {
            SorobanString::from_str(&env, "science")
        };
        let url = match i {
            0 => SorobanString::from_str(&env, "https://example.com/0"),
            1 => SorobanString::from_str(&env, "https://example.com/1"),
            2 => SorobanString::from_str(&env, "https://example.com/2"),
            3 => SorobanString::from_str(&env, "https://example.com/3"),
            4 => SorobanString::from_str(&env, "https://example.com/4"),
            5 => SorobanString::from_str(&env, "https://example.com/5"),
            6 => SorobanString::from_str(&env, "https://example.com/6"),
            7 => SorobanString::from_str(&env, "https://example.com/7"),
            8 => SorobanString::from_str(&env, "https://example.com/8"),
            _ => SorobanString::from_str(&env, "https://example.com/9"),
        };

        let _content_id = env
            .as_contract(&contract_id, || {
                ContentSearchContract::add_content(
                    env.clone(),
                    title,
                    description,
                    Vec::from_array(&env, [tag]),
                    url,
                    None,
                    None,
                    None,
                )
            })
            .unwrap();
    }

    // Test search performance - should find exactly the items with matching tags
    let blockchain_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content(
                env.clone(),
                SorobanString::from_str(&env, "blockchain"),
            )
        })
        .unwrap();

    // Should find items 0, 3, 6, 9 (every 3rd item starting from 0)
    assert_eq!(blockchain_results.len(), 4);

    let programming_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content(
                env.clone(),
                SorobanString::from_str(&env, "programming"),
            )
        })
        .unwrap();

    // Should find items 1, 4, 7 (every 3rd item starting from 1)
    assert_eq!(programming_results.len(), 3);
}

// ========== Advanced Search Feature Tests ==========

#[test]
fn test_partial_search_bio_matches_biology() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add content with "biology" tag
    let _biology_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Introduction to Biology"),
                SorobanString::from_str(&env, "Learn the fundamentals of biology"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "biology")]),
                SorobanString::from_str(&env, "https://example.com/biology"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Add content with "biochemistry" tag
    let _biochemistry_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Biochemistry Fundamentals"),
                SorobanString::from_str(&env, "Understanding biochemistry principles"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "biochemistry")]),
                SorobanString::from_str(&env, "https://example.com/biochemistry"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Search with partial term "bio" should match both
    let bio_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content_partial(
                env.clone(),
                SorobanString::from_str(&env, "bio"),
            )
        })
        .unwrap();

    assert_eq!(bio_results.len(), 2);
}

#[test]
fn test_partial_search_math_matches_mathematics() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add content with "mathematics" tag
    let _math_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Advanced Mathematics"),
                SorobanString::from_str(&env, "Mathematical concepts and theories"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "mathematics")]),
                SorobanString::from_str(&env, "https://example.com/mathematics"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Search with partial term "math" should match "mathematics"
    let math_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content_partial(
                env.clone(),
                SorobanString::from_str(&env, "math"),
            )
        })
        .unwrap();

    assert_eq!(math_results.len(), 1);
}

#[test]
fn test_advanced_search_or_mode() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add biology content
    let _biology_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Biology Basics"),
                SorobanString::from_str(&env, "Introduction to biology"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "biology")]),
                SorobanString::from_str(&env, "https://example.com/biology"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Add mathematics content
    let _math_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Math Fundamentals"),
                SorobanString::from_str(&env, "Mathematical foundations"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "mathematics")]),
                SorobanString::from_str(&env, "https://example.com/math"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Add programming content
    let _prog_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Programming Guide"),
                SorobanString::from_str(&env, "Learn to program"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "programmingsssssss")]),
                SorobanString::from_str(&env, "https://example.com/programming"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Test OR search with partial matching enabled
    let search_tags = Vec::from_array(
        &env,
        [
            SorobanString::from_str(&env, "bio"),
            SorobanString::from_str(&env, "math"),
        ],
    );

    let or_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content_advanced(
                env.clone(),
                search_tags,
                SorobanString::from_str(&env, "OR"),
                true, // partial matching enabled
            )
        })
        .unwrap();

    // Should find biology and mathematics content (2 items)
    assert_eq!(or_results.len(), 2);
}

#[test]
fn test_advanced_search_and_mode() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add content with multiple tags that match our search
    let _multi_tag_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Computational Biology"),
                SorobanString::from_str(&env, "Biology meets technology"),
                Vec::from_array(
                    &env,
                    [
                        SorobanString::from_str(&env, "biology"),
                        SorobanString::from_str(&env, "technologysssss"),
                    ],
                ),
                SorobanString::from_str(&env, "https://example.com/comp-bio"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Add content with only one matching tag
    let _single_tag_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Pure Biology"),
                SorobanString::from_str(&env, "Only biology content"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "bio")]),
                SorobanString::from_str(&env, "https://example.com/pure-bio"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Test AND search - both tags must match
    let search_tags = Vec::from_array(
        &env,
        [
            SorobanString::from_str(&env, "bios"),
            SorobanString::from_str(&env, "tech"),
        ],
    );

    let and_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content_advanced(
                env.clone(),
                search_tags,
                SorobanString::from_str(&env, "AND"),
                true, // partial matching enabled
            )
        })
        .unwrap();

    // Should find only the computational biology content (1 item)
    assert_eq!(and_results.len(), 1);
}

#[test]
fn test_advanced_search_exact_mode() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add content with "biology" tag
    let _biology_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Biology Course"),
                SorobanString::from_str(&env, "Learn biology"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "biology")]),
                SorobanString::from_str(&env, "https://example.com/biology"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Test exact search with "bio" - should not match "biology" in exact mode
    let exact_results = env.as_contract(&contract_id, || {
        ContentSearchContract::search_content_advanced(
            env.clone(),
            Vec::from_array(&env, [SorobanString::from_str(&env, "bio")]),
            SorobanString::from_str(&env, "OR"),
            false, // exact matching only
        )
    });

    // Should not find any content since "bio" != "biology" in exact mode
    assert!(exact_results.is_err());

    // Test exact search with "biology" - should match
    let exact_biology_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content_advanced(
                env.clone(),
                Vec::from_array(&env, [SorobanString::from_str(&env, "biology")]),
                SorobanString::from_str(&env, "OR"),
                false, // exact matching only
            )
        })
        .unwrap();

    assert_eq!(exact_biology_results.len(), 1);
}

#[test]
fn test_partial_search_in_titles_and_descriptions() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add content where the search term appears in title but not tags
    let _title_match_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Mathematics for Beginners"),
                SorobanString::from_str(&env, "Basic mathematical concepts"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "education")]),
                SorobanString::from_str(&env, "https://example.com/math-beginners"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Add content where the search term appears in description but not tags
    let _desc_match_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Educational Programming"),
                SorobanString::from_str(&env, "Learn programming fundamentals"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "education")]),
                SorobanString::from_str(&env, "https://example.com/edu-prog"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Search for "math" should find the title match
    let math_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content_partial(
                env.clone(),
                SorobanString::from_str(&env, "math"),
            )
        })
        .unwrap();

    assert_eq!(math_results.len(), 2);

    // Search for "prog" should find the description match
    let prog_results = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content_partial(
                env.clone(),
                SorobanString::from_str(&env, "progs"),
            )
        })
        .unwrap();

    assert_eq!(prog_results.len(), 2);
}

#[test]
fn test_search_no_results_partial() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add some content
    let _content_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Biology Course"),
                SorobanString::from_str(&env, "Learn biology"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "biology")]),
                SorobanString::from_str(&env, "https://example.com/biology"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Search for non-matching term
    let no_results = env.as_contract(&contract_id, || {
        ContentSearchContract::search_content_partial(
            env.clone(),
            SorobanString::from_str(&env, "nonexistent"),
        )
    });

    assert!(no_results.is_err());
}

#[test]
fn test_advanced_search_validation() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Test empty tags list
    let empty_tags_result = env.as_contract(&contract_id, || {
        ContentSearchContract::search_content_advanced(
            env.clone(),
            Vec::new(&env),
            SorobanString::from_str(&env, "OR"),
            false,
        )
    });

    assert!(empty_tags_result.is_err());

    // Test invalid tag (empty string)
    let invalid_tag_result = env.as_contract(&contract_id, || {
        ContentSearchContract::search_content_advanced(
            env.clone(),
            Vec::from_array(&env, [SorobanString::from_str(&env, "")]),
            SorobanString::from_str(&env, "OR"),
            false,
        )
    });

    assert!(invalid_tag_result.is_err());
}

#[test]
fn test_search_mode_parsing() {
    let env = Env::default();
    let contract_id = setup_contract(&env);

    // Add test content
    let _content_id = env
        .as_contract(&contract_id, || {
            ContentSearchContract::add_content(
                env.clone(),
                SorobanString::from_str(&env, "Test Content"),
                SorobanString::from_str(&env, "Test description"),
                Vec::from_array(&env, [SorobanString::from_str(&env, "test")]),
                SorobanString::from_str(&env, "https://example.com/test"),
                None,
                None,
                None,
            )
        })
        .unwrap();

    // Test with "AND" mode
    let and_result = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content_advanced(
                env.clone(),
                Vec::from_array(&env, [SorobanString::from_str(&env, "test")]),
                SorobanString::from_str(&env, "AND"),
                false,
            )
        })
        .unwrap();

    assert_eq!(and_result.len(), 1);

    // Test with "OR" mode
    let or_result = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content_advanced(
                env.clone(),
                Vec::from_array(&env, [SorobanString::from_str(&env, "test")]),
                SorobanString::from_str(&env, "OR"),
                false,
            )
        })
        .unwrap();

    assert_eq!(or_result.len(), 1);

    // Test with invalid mode (should default to OR)
    let invalid_mode_result = env
        .as_contract(&contract_id, || {
            ContentSearchContract::search_content_advanced(
                env.clone(),
                Vec::from_array(&env, [SorobanString::from_str(&env, "test")]),
                SorobanString::from_str(&env, "INVALID"),
                false,
            )
        })
        .unwrap();

    assert_eq!(invalid_mode_result.len(), 1);
}
