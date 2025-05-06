#[cfg(test)]
mod tests {
    use soroban_sdk::{testutils::Address as _, Address, Env, String as SorobanString, Vec};

    use crate::{
        Content, ContentSearchContract, ContentStorage,
    };

    #[test]
    fn test_add_and_search_content() {
        let env = Env::default();
        let contract = ContentSearchContract;
        let admin = Address::generate(&env);

        // Add test content
        let title = SorobanString::from_str(&env, "Introduction to Blockchain");
        let description = SorobanString::from_str(&env, "Basic concepts of blockchain");
        let tags = Vec::from_array(&env, [
            SorobanString::from_str(&env, "blockchain"),
            SorobanString::from_str(&env, "cryptocurrency"),
            SorobanString::from_str(&env, "technology"),
        ]);
        let url = SorobanString::from_str(&env, "https://example.com/blockchain");

        let content_id = contract.add_content(
            title.clone(),
            description.clone(),
            tags.clone(),
            url.clone(),
        );

        // Verify content was added correctly
        let stored_content = ContentStorage::get_content(&env, content_id).unwrap();
        assert_eq!(stored_content.title, title);
        assert_eq!(stored_content.description, description);
        assert_eq!(stored_content.subject_tags, tags);
        assert_eq!(stored_content.content_url, url);

        // Search content
        let search_term = SorobanString::from_str(&env, "blockchain");
        let results = contract.search_content(search_term).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results.get_unchecked(0).title, title);
    }

    #[test]
    fn test_search_no_results() {
        let env = Env::default();
        let contract = ContentSearchContract;

        // Search for non-existent content
        let search_term = SorobanString::from_str(&env, "nonexistent");
        let result = contract.search_content(search_term);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_input() {
        let env = Env::default();
        let contract = ContentSearchContract;

        // Try to add content with empty title
        let result = contract.add_content(
            SorobanString::from_str(&env, ""),
            SorobanString::from_str(&env, "Description"),
            Vec::from_array(&env, [SorobanString::from_str(&env, "tag")]),
            SorobanString::from_str(&env, "https://example.com"),
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_case_insensitive_search() {
        let env = Env::default();
        let contract = ContentSearchContract;

        // Add content
        let content_id = contract.add_content(
            SorobanString::from_str(&env, "Blockchain Basics"),
            SorobanString::from_str(&env, "Description"),
            Vec::from_array(&env, [SorobanString::from_str(&env, "BLOCKCHAIN")]),
            SorobanString::from_str(&env, "https://example.com"),
        );

        // Search with different cases
        let search_terms = [
            "blockchain",
            "BLOCKCHAIN",
            "Blockchain",
        ];

        for term in search_terms {
            let results = contract.search_content(SorobanString::from_str(&env, term)).unwrap();
            assert_eq!(results.len(), 1);
            assert_eq!(results.get_unchecked(0).id, content_id);
        }
    }
} 