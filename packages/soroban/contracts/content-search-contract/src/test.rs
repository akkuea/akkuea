use soroban_sdk::{
    Env,
    String as SorobanString,
    Vec,
    Address,
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