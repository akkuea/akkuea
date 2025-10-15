use crate::{TokenizedEducationalContent, TokenizedEducationalContentClient, VerificationLevel};
use soroban_sdk::{
    testutils::{Address as AddressTrait, BytesN as _},
    vec, Address, BytesN, Env, String,
};

#[test]
fn test_publish_content() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let title = String::from_str(&env, "Introduction to Blockchain");
    let content_hash = BytesN::random(&env);
    let subject_tags = vec![
        &env,
        String::from_str(&env, "blockchain"),
        String::from_str(&env, "education"),
    ];

    // Configure authentication for the creator
    env.mock_all_auths();

    // Publish content
    let content_id = client.publish_content(&creator, &title, &content_hash, &subject_tags);

    // Get content and verify
    let content = client.get_content(&content_id);
    assert_eq!(content.id, content_id);
    assert_eq!(content.creator, creator);
    assert_eq!(content.title, title);
    assert_eq!(content.content_hash, content_hash);
    assert_eq!(content.subject_tags, subject_tags);
    assert_eq!(content.upvotes, 0);
    assert_eq!(content.verification_level, VerificationLevel::None);
}

#[test]
fn test_multiple_content_publish() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    let creator = Address::generate(&env);

    // Configure authentication for the creator
    env.mock_all_auths();

    // Publish first content
    let title1 = String::from_str(&env, "Introduction to Smart Contracts");
    let content_hash1 = BytesN::random(&env);
    let subject_tags1 = vec![
        &env,
        String::from_str(&env, "smart contracts"),
        String::from_str(&env, "beginner"),
    ];
    let content_id1 = client.publish_content(&creator, &title1, &content_hash1, &subject_tags1);

    // Publish second content
    let title2 = String::from_str(&env, "Advanced Smart Contract Development");
    let content_hash2 = BytesN::random(&env);
    let subject_tags2 = vec![
        &env,
        String::from_str(&env, "smart contracts"),
        String::from_str(&env, "advanced"),
    ];
    let content_id2 = client.publish_content(&creator, &title2, &content_hash2, &subject_tags2);

    // Verify IDs are sequential
    assert_eq!(content_id2, content_id1 + 1);

    // Verify both contents can be retrieved
    let content1 = client.get_content(&content_id1);
    let content2 = client.get_content(&content_id2);

    assert_eq!(content1.title, title1);
    assert_eq!(content2.title, title2);
}

#[test]
fn test_publish_empty_tags() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    let creator = Address::generate(&env);
    let title = String::from_str(&env, "Content with no tags");
    let content_hash = BytesN::random(&env);
    let subject_tags = vec![&env]; // Empty tags vector

    // Configure authentication for the creator
    env.mock_all_auths();

    // Publish content with empty tags
    let content_id = client.publish_content(&creator, &title, &content_hash, &subject_tags);

    // Verify content was published with empty tags
    let content = client.get_content(&content_id);
    assert_eq!(content.subject_tags, subject_tags);
}

#[test]
fn test_upvote_content() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication for all users
    env.mock_all_auths();

    // Create content
    let creator = Address::generate(&env);
    let title = String::from_str(&env, "Blockchain Basics");
    let content_hash = BytesN::random(&env);
    let subject_tags = vec![&env, String::from_str(&env, "blockchain")];
    let content_id = client.publish_content(&creator, &title, &content_hash, &subject_tags);

    // Upvote content
    let voter1 = Address::generate(&env);
    let upvotes = client.upvote_content(&content_id, &voter1);
    assert_eq!(upvotes, 1);

    // Verify upvote was recorded
    let content = client.get_content(&content_id);
    assert_eq!(content.upvotes, 1);

    // Test second upvote from different user
    let voter2 = Address::generate(&env);
    let upvotes = client.upvote_content(&content_id, &voter2);
    assert_eq!(upvotes, 2);
}

#[test]
fn test_multiple_upvotes() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication for all users
    env.mock_all_auths();

    // Create content
    let creator = Address::generate(&env);
    let title = String::from_str(&env, "Web3 Development");
    let content_hash = BytesN::random(&env);
    let subject_tags = vec![
        &env,
        String::from_str(&env, "web3"),
        String::from_str(&env, "development"),
    ];
    let content_id = client.publish_content(&creator, &title, &content_hash, &subject_tags);

    // Add multiple upvotes (10 different users)
    let expected_upvotes = 10;
    for i in 0..expected_upvotes {
        let voter = Address::generate(&env);
        let upvotes = client.upvote_content(&content_id, &voter);
        assert_eq!(upvotes, i + 1);
    }

    // Verify final upvote count
    let content = client.get_content(&content_id);
    assert_eq!(content.upvotes, expected_upvotes);
}

#[test]
#[should_panic(expected = "user has already voted for this content")]
fn test_duplicate_upvote() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication for all users
    env.mock_all_auths();

    // Create content
    let creator = Address::generate(&env);
    let title = String::from_str(&env, "Smart Contracts 101");
    let content_hash = BytesN::random(&env);
    let subject_tags = vec![&env, String::from_str(&env, "smart contracts")];
    let content_id = client.publish_content(&creator, &title, &content_hash, &subject_tags);

    // Upvote content
    let voter = Address::generate(&env);
    client.upvote_content(&content_id, &voter);

    // Try to upvote again - should panic
    client.upvote_content(&content_id, &voter);
}

#[test]
#[should_panic(expected = "content with ID")]
fn test_upvote_nonexistent_content() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();

    // Try to upvote content that doesn't exist
    let voter = Address::generate(&env);
    client.upvote_content(&999, &voter);
}

#[test]
fn test_verify_content() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();

    // Create content
    let creator = Address::generate(&env);
    let title = String::from_str(&env, "Advanced Cryptography");
    let content_hash = BytesN::random(&env);
    let subject_tags = vec![
        &env,
        String::from_str(&env, "cryptography"),
        String::from_str(&env, "security"),
    ];
    let content_id = client.publish_content(&creator, &title, &content_hash, &subject_tags);

    // Verify the content is not verified initially
    let content = client.get_content(&content_id);
    assert_eq!(content.verification_level, VerificationLevel::None);

    // Verify content to Peer level
    let verifier = Address::generate(&env);
    let verified_level = client.verify_content(&content_id, &verifier, &VerificationLevel::Peer);
    assert_eq!(verified_level, VerificationLevel::Peer);

    // Check that the content is now verified to the correct level
    let content = client.get_content(&content_id);
    assert_eq!(content.verification_level, VerificationLevel::Peer);
}

#[test]
fn test_multiple_verifications() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();

    // Create content
    let creator = Address::generate(&env);
    let title = String::from_str(&env, "Cryptocurrency Fundamentals");
    let content_hash = BytesN::random(&env);
    let subject_tags = vec![&env, String::from_str(&env, "cryptocurrency")];
    let content_id = client.publish_content(&creator, &title, &content_hash, &subject_tags);

    // First verification (to Peer)
    let verifier1 = Address::generate(&env);
    let verified_level1 = client.verify_content(&content_id, &verifier1, &VerificationLevel::Peer);
    assert_eq!(verified_level1, VerificationLevel::Peer);

    // Second verification (upgrade to Expert)
    let verifier2 = Address::generate(&env);
    let verified_level2 =
        client.verify_content(&content_id, &verifier2, &VerificationLevel::Expert);
    assert_eq!(verified_level2, VerificationLevel::Expert);

    // The content should now have the highest verification level submitted
    let content = client.get_content(&content_id);
    assert_eq!(content.verification_level, VerificationLevel::Expert);
}

#[test]
#[should_panic(expected = "content with ID")]
fn test_verify_nonexistent_content() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();

    // Try to verify content that doesn't exist
    let verifier = Address::generate(&env);
    client.verify_content(&999, &verifier, &VerificationLevel::Peer);
}

#[test]
fn test_creator_can_verify_own_content() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();

    // Create content
    let creator = Address::generate(&env);
    let title = String::from_str(&env, "Self-verified Content");
    let content_hash = BytesN::random(&env);
    let subject_tags = vec![&env, String::from_str(&env, "self-verified")];
    let content_id = client.publish_content(&creator, &title, &content_hash, &subject_tags);

    // MODIFIED: Call verify_content with a specific level
    client.verify_content(&content_id, &creator, &VerificationLevel::Peer);

    let content = client.get_content(&content_id);
    // MODIFIED: Check for the correct verification level
    assert_eq!(content.verification_level, VerificationLevel::Peer);
}

#[test]
fn test_content_with_long_title_and_many_tags() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();

    // Create content with long title
    let creator = Address::generate(&env);
    let long_title = String::from_str(&env, "This is a very long title for educational content that tests the storage and retrieval of lengthy metadata strings in the Soroban smart contract platform");
    let content_hash = BytesN::random(&env);

    // Create many tags
    let mut subject_tags = vec![&env];
    for i in 1..20 {
        // Create tags directly without unused temporary variable
        let full_tag = if i < 10 {
            match i {
                1 => String::from_str(&env, "tag01"),
                2 => String::from_str(&env, "tag02"),
                3 => String::from_str(&env, "tag03"),
                4 => String::from_str(&env, "tag04"),
                5 => String::from_str(&env, "tag05"),
                6 => String::from_str(&env, "tag06"),
                7 => String::from_str(&env, "tag07"),
                8 => String::from_str(&env, "tag08"),
                9 => String::from_str(&env, "tag09"),
                _ => unreachable!(),
            }
        } else {
            match i {
                10 => String::from_str(&env, "tag10"),
                11 => String::from_str(&env, "tag11"),
                12 => String::from_str(&env, "tag12"),
                13 => String::from_str(&env, "tag13"),
                14 => String::from_str(&env, "tag14"),
                15 => String::from_str(&env, "tag15"),
                16 => String::from_str(&env, "tag16"),
                17 => String::from_str(&env, "tag17"),
                18 => String::from_str(&env, "tag18"),
                19 => String::from_str(&env, "tag19"),
                _ => unreachable!(),
            }
        };

        subject_tags.push_back(full_tag);
    }

    // Publish content with long title and many tags
    let content_id = client.publish_content(&creator, &long_title, &content_hash, &subject_tags);

    // Verify content was stored correctly
    let content = client.get_content(&content_id);
    assert_eq!(content.title, long_title);
    assert_eq!(content.subject_tags, subject_tags);
    assert_eq!(content.subject_tags.len(), 19);
}

#[test]
fn test_multiple_content_and_popularity_tracking() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();

    // Create 5 different content entries
    let creator = Address::generate(&env);
    let mut content_ids = vec![&env];

    for i in 0..5 {
        // Replace concatenation with static strings
        let title = match i {
            0 => String::from_str(&env, "Educational Content 0"),
            1 => String::from_str(&env, "Educational Content 1"),
            2 => String::from_str(&env, "Educational Content 2"),
            3 => String::from_str(&env, "Educational Content 3"),
            4 => String::from_str(&env, "Educational Content 4"),
            _ => unreachable!(),
        };

        let content_hash = BytesN::random(&env);
        let subject_tags = vec![&env, String::from_str(&env, "education")];

        let content_id = client.publish_content(&creator, &title, &content_hash, &subject_tags);
        content_ids.push_back(content_id);
    }

    // Different voting patterns for each content:
    // Content 0: 5 votes
    // Content 1: 3 votes
    // Content 2: 0 votes
    // Content 3: 10 votes
    // Content 4: 1 vote

    // Create a pool of voters
    let mut voters = vec![&env];
    for _ in 0..15 {
        voters.push_back(Address::generate(&env));
    }

    // Content 0: 5 votes (voters 0-4)
    for i in 0..5 {
        client.upvote_content(&content_ids.get(0).unwrap(), &voters.get(i).unwrap());
    }

    // Content 1: 3 votes (voters 5-7)
    for i in 5..8 {
        client.upvote_content(&content_ids.get(1).unwrap(), &voters.get(i).unwrap());
    }

    // Content 2: 0 votes (skip)

    // Content 3: 10 votes (voters 0-9)
    for i in 0..10 {
        client.upvote_content(&content_ids.get(3).unwrap(), &voters.get(i).unwrap());
    }

    // Content 4: 1 vote (voter 10)
    client.upvote_content(&content_ids.get(4).unwrap(), &voters.get(10).unwrap());

    // Verify vote counts
    let content0 = client.get_content(&content_ids.get(0).unwrap());
    let content1 = client.get_content(&content_ids.get(1).unwrap());
    let content2 = client.get_content(&content_ids.get(2).unwrap());
    let content3 = client.get_content(&content_ids.get(3).unwrap());
    let content4 = client.get_content(&content_ids.get(4).unwrap());

    assert_eq!(content0.upvotes, 5);
    assert_eq!(content1.upvotes, 3);
    assert_eq!(content2.upvotes, 0);
    assert_eq!(content3.upvotes, 10);
    assert_eq!(content4.upvotes, 1);

    // The most popular content should be content3
    assert!(content3.upvotes > content0.upvotes);
    assert!(content3.upvotes > content1.upvotes);
    assert!(content3.upvotes > content2.upvotes);
    assert!(content3.upvotes > content4.upvotes);
}

#[test]
fn test_verify_before_and_after_upvotes() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();

    // Create content
    let creator = Address::generate(&env);
    let title = String::from_str(&env, "Verification and Upvotes Interaction");
    let content_hash = BytesN::random(&env);
    let subject_tags = vec![
        &env,
        String::from_str(&env, "testing"),
        String::from_str(&env, "verification"),
    ];

    let content_id = client.publish_content(&creator, &title, &content_hash, &subject_tags);

    // Scenario 1: Verify first, then upvote
    let verifier = Address::generate(&env);
    client.verify_content(&content_id, &verifier, &VerificationLevel::Expert);

    // Check content is verified
    let content = client.get_content(&content_id);
    assert_eq!(content.verification_level, VerificationLevel::Expert);
    assert_eq!(content.upvotes, 0);

    // Now add some upvotes
    let voters = [
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    ];

    for voter in &voters {
        client.upvote_content(&content_id, voter);
    }

    // Verify upvotes were added and verification status maintained
    let content_after_votes = client.get_content(&content_id);
    assert_eq!(
        content_after_votes.verification_level,
        VerificationLevel::Expert
    );
    assert_eq!(content_after_votes.upvotes, 3);

    // Scenario 2: New content - upvote first, then verify
    let title2 = String::from_str(&env, "Upvotes before Verification");
    let content_hash2 = BytesN::random(&env);
    let content_id2 = client.publish_content(&creator, &title2, &content_hash2, &subject_tags);

    // Add upvotes first
    let voters2 = [Address::generate(&env), Address::generate(&env)];

    for voter in &voters2 {
        client.upvote_content(&content_id2, voter);
    }

    // Check content has upvotes but is not verified
    let content2 = client.get_content(&content_id2);
    assert_eq!(content2.verification_level, VerificationLevel::None);
    assert_eq!(content2.upvotes, 2);

    // Now verify the content
    client.verify_content(&content_id2, &verifier, &VerificationLevel::Peer);

    let content2_after_verify = client.get_content(&content_id2);
    assert_eq!(
        content2_after_verify.verification_level,
        VerificationLevel::Peer
    );
    assert_eq!(content2_after_verify.upvotes, 2);
}

#[test]
fn test_complex_workflow() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();

    // 1. Create several content entries
    let creator1 = Address::generate(&env);
    let creator2 = Address::generate(&env);

    // Content 1
    let content_id1 = client.publish_content(
        &creator1,
        &String::from_str(&env, "Solidity Security"),
        &BytesN::random(&env),
        &vec![
            &env,
            String::from_str(&env, "solidity"),
            String::from_str(&env, "security"),
        ],
    );

    // Content 2
    let content_id2 = client.publish_content(
        &creator2,
        &String::from_str(&env, "Rust for Blockchain"),
        &BytesN::random(&env),
        &vec![
            &env,
            String::from_str(&env, "rust"),
            String::from_str(&env, "blockchain"),
        ],
    );

    // 2. Upvote both contents
    let voters = [
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    ];

    // Vote for content 1 (3 votes)
    client.upvote_content(&content_id1, &voters[0]);
    client.upvote_content(&content_id1, &voters[1]);
    client.upvote_content(&content_id1, &voters[2]);

    // Vote for content 2 (2 votes)
    client.upvote_content(&content_id2, &voters[3]);
    client.upvote_content(&content_id2, &voters[4]);

    // 3. Verify only content 2
    let verifier = Address::generate(&env);
    client.verify_content(&content_id2, &verifier, &VerificationLevel::Institutional);

    // 4. Retrieve and check both contents
    let content1 = client.get_content(&content_id1);
    let content2 = client.get_content(&content_id2);

    // Content 1 should have 3 upvotes and not be verified
    assert_eq!(content1.upvotes, 3);
    assert_eq!(content1.verification_level, VerificationLevel::None);

    // Content 2 should have 2 upvotes and be verified
    assert_eq!(content2.upvotes, 2);
    assert_eq!(
        content2.verification_level,
        VerificationLevel::Institutional
    );
}

#[test]
fn test_filter_by_verification_empty_results() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();

    // Test filtering when no content exists
    let verified_content = client.filter_by_verification();
    assert_eq!(verified_content.len(), 0);

    // Create some content but don't verify any
    let creator = Address::generate(&env);
    let title = String::from_str(&env, "Unverified Content");
    let content_hash = BytesN::random(&env);
    let subject_tags = vec![&env, String::from_str(&env, "test")];

    client.publish_content(&creator, &title, &content_hash, &subject_tags);

    // Filter should still return empty results
    let verified_content = client.filter_by_verification();
    assert_eq!(verified_content.len(), 0);
}

#[test]
fn test_filter_by_verification_mixed_content() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();

    // Create multiple content items with mixed verification status
    let creator = Address::generate(&env);
    let verifier = Address::generate(&env);

    // Content 1: Verified
    let content_id1 = client.publish_content(
        &creator,
        &String::from_str(&env, "Verified Content 1"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "verified")],
    );
    client.verify_content(&content_id1, &verifier, &VerificationLevel::Peer);

    // Content 2: Not verified
    let content_id2 = client.publish_content(
        &creator,
        &String::from_str(&env, "Unverified Content"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "unverified")],
    );

    // Content 3: Verified
    let content_id3 = client.publish_content(
        &creator,
        &String::from_str(&env, "Verified Content 2"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "verified")],
    );
    client.verify_content(&content_id3, &verifier, &VerificationLevel::Institutional);

    // Filter by verification
    let verified_content = client.filter_by_verification();

    // Should return exactly 2 verified content items
    assert_eq!(verified_content.len(), 2);

    // Check that all returned content is verified
    for i in 0..verified_content.len() {
        let content = verified_content.get(i).unwrap();
        assert!(content.verification_level > VerificationLevel::None);
    }

    // Check that the correct content IDs are returned
    let mut found_content_1 = false;
    let mut found_content_3 = false;
    let mut found_content_2 = false;

    for i in 0..verified_content.len() {
        let content = verified_content.get(i).unwrap();
        if content.id == content_id1 {
            found_content_1 = true;
        }
        if content.id == content_id3 {
            found_content_3 = true;
        }
        if content.id == content_id2 {
            found_content_2 = true;
        }
    }

    assert!(found_content_1);
    assert!(found_content_3);
    assert!(!found_content_2);
}

#[test]
fn test_filter_by_min_upvotes_empty_results() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();

    // Test filtering when no content exists
    let popular_content = client.filter_by_min_upvotes(&5);
    assert_eq!(popular_content.len(), 0);

    // Create content with low upvotes
    let creator = Address::generate(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Low Upvote Content"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "test")],
    );

    // Add only 2 upvotes
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    client.upvote_content(&content_id, &voter1);
    client.upvote_content(&content_id, &voter2);

    // Filter with min_upvotes = 5 should return empty
    let popular_content = client.filter_by_min_upvotes(&5);
    assert_eq!(popular_content.len(), 0);
}

#[test]
fn test_filter_by_min_upvotes_various_thresholds() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();

    let creator = Address::generate(&env);

    // Create content with different upvote counts
    // Content 1: 0 upvotes
    let _content_id1 = client.publish_content(
        &creator,
        &String::from_str(&env, "No Upvotes"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "zero")],
    );

    // Content 2: 3 upvotes
    let content_id2 = client.publish_content(
        &creator,
        &String::from_str(&env, "Three Upvotes"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "three")],
    );
    for _ in 0..3 {
        let voter = Address::generate(&env);
        client.upvote_content(&content_id2, &voter);
    }

    // Content 3: 7 upvotes
    let content_id3 = client.publish_content(
        &creator,
        &String::from_str(&env, "Seven Upvotes"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "seven")],
    );
    for _ in 0..7 {
        let voter = Address::generate(&env);
        client.upvote_content(&content_id3, &voter);
    }

    // Content 4: 10 upvotes
    let content_id4 = client.publish_content(
        &creator,
        &String::from_str(&env, "Ten Upvotes"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "ten")],
    );
    for _ in 0..10 {
        let voter = Address::generate(&env);
        client.upvote_content(&content_id4, &voter);
    }

    // Test different thresholds

    // min_upvotes = 0: should return all content
    let result_0 = client.filter_by_min_upvotes(&0);
    assert_eq!(result_0.len(), 4);

    // min_upvotes = 1: should return content 2, 3, 4
    let result_1 = client.filter_by_min_upvotes(&1);
    assert_eq!(result_1.len(), 3);

    // min_upvotes = 5: should return content 3, 4
    let result_5 = client.filter_by_min_upvotes(&5);
    assert_eq!(result_5.len(), 2);

    // min_upvotes = 10: should return only content 4
    let result_10 = client.filter_by_min_upvotes(&10);
    assert_eq!(result_10.len(), 1);
    assert_eq!(result_10.get(0).unwrap().id, content_id4);

    // min_upvotes = 15: should return no content
    let result_15 = client.filter_by_min_upvotes(&15);
    assert_eq!(result_15.len(), 0);
}

#[test]
fn test_filter_combinations_verified_and_popular() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let verifier = Address::generate(&env);

    // Create diverse content for comprehensive testing

    // Content 1: Verified + High upvotes (10)
    let content_id1 = client.publish_content(
        &creator,
        &String::from_str(&env, "Verified and Popular"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "best")],
    );
    client.verify_content(&content_id1, &verifier, &VerificationLevel::Institutional);
    for _ in 0..10 {
        let voter = Address::generate(&env);
        client.upvote_content(&content_id1, &voter);
    }

    // Content 2: Verified + Low upvotes (2)
    let content_id2 = client.publish_content(
        &creator,
        &String::from_str(&env, "Verified but Unpopular"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "verified")],
    );
    client.verify_content(&content_id2, &verifier, &VerificationLevel::Peer);
    for _ in 0..2 {
        let voter = Address::generate(&env);
        client.upvote_content(&content_id2, &voter);
    }

    // Content 3: Not verified + High upvotes (8)
    let content_id3 = client.publish_content(
        &creator,
        &String::from_str(&env, "Popular but Unverified"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "popular")],
    );
    for _ in 0..8 {
        let voter = Address::generate(&env);
        client.upvote_content(&content_id3, &voter);
    }

    // Content 4: Not verified + Low upvotes (1)
    let content_id4 = client.publish_content(
        &creator,
        &String::from_str(&env, "Neither Verified nor Popular"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "basic")],
    );
    let voter = Address::generate(&env);
    client.upvote_content(&content_id4, &voter);

    // Test individual filters

    // Filter by verification: should return content 1 and 2
    let verified_content = client.filter_by_verification();
    assert_eq!(verified_content.len(), 2);
    let mut found_verified_1 = false;
    let mut found_verified_2 = false;

    for i in 0..verified_content.len() {
        let content = verified_content.get(i).unwrap();
        if content.id == content_id1 {
            found_verified_1 = true;
        }
        if content.id == content_id2 {
            found_verified_2 = true;
        }
    }

    assert!(found_verified_1);
    assert!(found_verified_2);

    // Filter by min_upvotes = 5: should return content 1 and 3
    let popular_content = client.filter_by_min_upvotes(&5);
    assert_eq!(popular_content.len(), 2);
    let mut found_popular_1 = false;
    let mut found_popular_3 = false;

    for i in 0..popular_content.len() {
        let content = popular_content.get(i).unwrap();
        if content.id == content_id1 {
            found_popular_1 = true;
        }
        if content.id == content_id3 {
            found_popular_3 = true;
        }
    }

    assert!(found_popular_1);
    assert!(found_popular_3);

    // Test edge cases

    // Filter by min_upvotes = 0: should return all content
    let all_content = client.filter_by_min_upvotes(&0);
    assert_eq!(all_content.len(), 4);

    // Filter by min_upvotes = 10: should return only content 1
    let very_popular = client.filter_by_min_upvotes(&10);
    assert_eq!(very_popular.len(), 1);
    assert_eq!(very_popular.get(0).unwrap().id, content_id1);
}

#[test]
fn test_filters_with_large_dataset() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let verifier = Address::generate(&env);

    // Create 20 content items with varied properties
    let mut content_ids = vec![&env];
    let mut expected_verified = 0u32;
    let mut expected_popular_5 = 0u32;
    let mut expected_popular_10 = 0u32;

    for i in 0..20 {
        let title = match i {
            0 => String::from_str(&env, "Content 00"),
            1 => String::from_str(&env, "Content 01"),
            2 => String::from_str(&env, "Content 02"),
            3 => String::from_str(&env, "Content 03"),
            4 => String::from_str(&env, "Content 04"),
            5 => String::from_str(&env, "Content 05"),
            6 => String::from_str(&env, "Content 06"),
            7 => String::from_str(&env, "Content 07"),
            8 => String::from_str(&env, "Content 08"),
            9 => String::from_str(&env, "Content 09"),
            10 => String::from_str(&env, "Content 10"),
            11 => String::from_str(&env, "Content 11"),
            12 => String::from_str(&env, "Content 12"),
            13 => String::from_str(&env, "Content 13"),
            14 => String::from_str(&env, "Content 14"),
            15 => String::from_str(&env, "Content 15"),
            16 => String::from_str(&env, "Content 16"),
            17 => String::from_str(&env, "Content 17"),
            18 => String::from_str(&env, "Content 18"),
            19 => String::from_str(&env, "Content 19"),
            _ => unreachable!(),
        };

        let content_id = client.publish_content(
            &creator,
            &title,
            &BytesN::random(&env),
            &vec![&env, String::from_str(&env, "test")],
        );
        content_ids.push_back(content_id);

        // Verify every 3rd content (indices 0, 3, 6, 9, 12, 15, 18)
        if i % 3 == 0 {
            client.verify_content(&content_id, &verifier, &VerificationLevel::Peer);
            expected_verified += 1;
        }

        // Add upvotes based on index
        let upvote_count = i / 2; // 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9
        for _ in 0..upvote_count {
            let voter = Address::generate(&env);
            client.upvote_content(&content_id, &voter);
        }

        if upvote_count >= 5 {
            expected_popular_5 += 1;
        }
        if upvote_count >= 10 {
            expected_popular_10 += 1;
        }
    }

    // Test filters

    // Filter by verification
    let verified_results = client.filter_by_verification();
    assert_eq!(verified_results.len(), expected_verified);

    // Verify all returned content is actually verified
    for i in 0..verified_results.len() {
        let content = verified_results.get(i).unwrap();
        assert!(content.verification_level > VerificationLevel::None);
    }

    // Filter by min_upvotes = 5
    let popular_5_results = client.filter_by_min_upvotes(&5);
    assert_eq!(popular_5_results.len(), expected_popular_5);

    // Verify all returned content has >= 5 upvotes
    for i in 0..popular_5_results.len() {
        let content = popular_5_results.get(i).unwrap();
        assert!(content.upvotes >= 5);
    }

    // Filter by min_upvotes = 10
    let popular_10_results = client.filter_by_min_upvotes(&10);
    assert_eq!(popular_10_results.len(), expected_popular_10);

    // Verify all returned content has >= 10 upvotes
    for i in 0..popular_10_results.len() {
        let content = popular_10_results.get(i).unwrap();
        assert!(content.upvotes >= 10);
    }
}

#[test]
fn test_filter_by_verification_level() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let verifier = Address::generate(&env);

    // Content 1: Peer verified
    let content_id1 = client.publish_content(
        &creator,
        &String::from_str(&env, "Peer Verified"),
        &BytesN::random(&env),
        &vec![&env],
    );
    client.verify_content(&content_id1, &verifier, &VerificationLevel::Peer);

    // Content 2: Not verified
    let content_id2 = client.publish_content(
        &creator,
        &String::from_str(&env, "Unverified"),
        &BytesN::random(&env),
        &vec![&env],
    );

    // Content 3: Institutional verified
    let content_id3 = client.publish_content(
        &creator,
        &String::from_str(&env, "Inst Verified"),
        &BytesN::random(&env),
        &vec![&env],
    );
    client.verify_content(&content_id3, &verifier, &VerificationLevel::Institutional);

    // Content 4: Another Peer verified
    let content_id4 = client.publish_content(
        &creator,
        &String::from_str(&env, "Peer Verified 2"),
        &BytesN::random(&env),
        &vec![&env],
    );
    client.verify_content(&content_id4, &verifier, &VerificationLevel::Peer);

    // Filter by Peer - should return 2 items
    let peer_verified = client.filter_by_verification_level(&VerificationLevel::Peer);
    assert_eq!(peer_verified.len(), 2);

    // Filter by Institutional - should return 1 item
    let inst_verified = client.filter_by_verification_level(&VerificationLevel::Institutional);
    assert_eq!(inst_verified.len(), 1);
    assert_eq!(inst_verified.get(0).unwrap().id, content_id3);

    // Filter by Expert - should return 0 items
    let expert_verified = client.filter_by_verification_level(&VerificationLevel::Expert);
    assert_eq!(expert_verified.len(), 0);

    // Filter by None - should return 1 item
    let none_verified = client.filter_by_verification_level(&VerificationLevel::None);
    assert_eq!(none_verified.len(), 1);
    assert_eq!(none_verified.get(0).unwrap().id, content_id2);
}

#[test]
fn test_verification_tier_upgrade() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let verifier = Address::generate(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Tiered Verification"),
        &BytesN::random(&env),
        &vec![&env],
    );

    assert_eq!(
        client.get_content(&content_id).verification_level,
        VerificationLevel::None
    );

    // 1. Verify to Peer
    let level = client.verify_content(&content_id, &verifier, &VerificationLevel::Peer);
    assert_eq!(level, VerificationLevel::Peer);
    assert_eq!(
        client.get_content(&content_id).verification_level,
        VerificationLevel::Peer
    );

    // 2. Upgrade to Expert
    let level = client.verify_content(&content_id, &verifier, &VerificationLevel::Expert);
    assert_eq!(level, VerificationLevel::Expert);
    assert_eq!(
        client.get_content(&content_id).verification_level,
        VerificationLevel::Expert
    );

    // 3. Upgrade to Institutional
    let level = client.verify_content(&content_id, &verifier, &VerificationLevel::Institutional);
    assert_eq!(level, VerificationLevel::Institutional);
    assert_eq!(
        client.get_content(&content_id).verification_level,
        VerificationLevel::Institutional
    );
}

#[test]
#[should_panic(expected = "cannot overwrite a higher or equal verification level")]
fn test_prevent_verification_downgrade() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let verifier = Address::generate(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Test Downgrade"),
        &BytesN::random(&env),
        &vec![&env],
    );

    client.verify_content(&content_id, &verifier, &VerificationLevel::Institutional);
    client.verify_content(&content_id, &verifier, &VerificationLevel::Peer); // Should panic
}

#[test]
#[should_panic(expected = "cannot overwrite a higher or equal verification level")]
fn test_prevent_same_level_verification() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    // Configure authentication
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let verifier = Address::generate(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Test Same Level"),
        &BytesN::random(&env),
        &vec![&env],
    );

    client.verify_content(&content_id, &verifier, &VerificationLevel::Expert);
    client.verify_content(&content_id, &verifier, &VerificationLevel::Expert); // Should panic
}

///
/// VERSIONING TESTS
///
#[test]
fn test_create_new_version_content() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    // Create original content
    let creator = Address::generate(&env);
    let original_title = String::from_str(&env, "Original Content");
    let original_hash = BytesN::random(&env);
    let original_tags = vec![&env, String::from_str(&env, "original")];

    let content_id =
        client.publish_content(&creator, &original_title, &original_hash, &original_tags);

    // Create new version
    let new_title = String::from_str(&env, "Updated Content");
    let new_hash = BytesN::random(&env);
    let new_tags = vec![&env, String::from_str(&env, "updated")];
    let change_notes = String::from_str(&env, "Updated with new information");

    let version = client.create_new_version_content(
        &content_id,
        &creator,
        &new_title,
        &new_hash,
        &new_tags,
        &change_notes,
    );

    assert_eq!(version, 1);

    // Verify the main content was updated
    let updated_content = client.get_content(&content_id);
    assert_eq!(updated_content.title, new_title);
    assert_eq!(updated_content.content_hash, new_hash);
    assert_eq!(updated_content.subject_tags, new_tags);
}

#[test]
fn test_create_multiple_versions() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);

    // Create original content
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Version 0"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "v0")],
    );

    // Create version 1
    let version1 = client.create_new_version_content(
        &content_id,
        &creator,
        &String::from_str(&env, "Version 1"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "v1")],
        &String::from_str(&env, "First update"),
    );
    assert_eq!(version1, 1);

    // Create version 2
    let version2 = client.create_new_version_content(
        &content_id,
        &creator,
        &String::from_str(&env, "Version 2"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "v2")],
        &String::from_str(&env, "Second update"),
    );
    assert_eq!(version2, 2);

    // Verify current content is version 2
    let current_content = client.get_content(&content_id);
    assert_eq!(current_content.title, String::from_str(&env, "Version 2"));
}

#[test]
fn test_get_content_at_version() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);

    // Create original content (version 0)
    let original_title = String::from_str(&env, "Original Title");
    let original_hash = BytesN::random(&env);
    let original_tags = vec![&env, String::from_str(&env, "original")];

    let content_id =
        client.publish_content(&creator, &original_title, &original_hash, &original_tags);

    // Create version 1
    let v1_title = String::from_str(&env, "Version 1 Title");
    let v1_hash = BytesN::random(&env);
    let v1_tags = vec![&env, String::from_str(&env, "v1")];

    client.create_new_version_content(
        &content_id,
        &creator,
        &v1_title,
        &v1_hash,
        &v1_tags,
        &String::from_str(&env, "First update"),
    );

    // Get content at version 0 (original)
    let content_v0 = client.get_content_at_version(&content_id, &0);
    assert_eq!(content_v0.title, original_title);
    assert_eq!(content_v0.content_hash, original_hash);
    assert_eq!(content_v0.subject_tags, original_tags);

    // Get content at version 1 (current)
    let content_v1 = client.get_content_at_version(&content_id, &1);
    assert_eq!(content_v1.title, v1_title);
    assert_eq!(content_v1.content_hash, v1_hash);
    assert_eq!(content_v1.subject_tags, v1_tags);
}

#[test]
fn test_get_version_info() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);

    // Create original content
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Original"),
        &BytesN::random(&env),
        &vec![&env],
    );

    // Create version 1
    let change_notes = String::from_str(&env, "Added new examples and fixed typos");
    let version = client.create_new_version_content(
        &content_id,
        &creator,
        &String::from_str(&env, "Updated"),
        &BytesN::random(&env),
        &vec![&env],
        &change_notes,
    );

    // Get version info
    let version_info = client.get_version_info(&content_id, &version);

    assert_eq!(version_info.version, 1);
    assert_eq!(version_info.creator, creator);
    assert_eq!(version_info.change_notes, change_notes);
    assert_eq!(version_info.upvotes, 0);
    assert_eq!(version_info.verification_level, VerificationLevel::None);
}

#[test]
fn test_upvote_version() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);

    // Create content and version
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Original"),
        &BytesN::random(&env),
        &vec![&env],
    );

    let version = client.create_new_version_content(
        &content_id,
        &creator,
        &String::from_str(&env, "Updated"),
        &BytesN::random(&env),
        &vec![&env],
        &String::from_str(&env, "Updates"),
    );

    // Upvote the version
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);

    let upvotes1 = client.upvote_version(&content_id, &version, &voter1);
    assert_eq!(upvotes1, 1);

    let upvotes2 = client.upvote_version(&content_id, &version, &voter2);
    assert_eq!(upvotes2, 2);

    // Verify version info reflects upvotes
    let version_info = client.get_version_info(&content_id, &version);
    assert_eq!(version_info.upvotes, 2);
}

#[test]
fn test_verify_version() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);
    let verifier = Address::generate(&env);

    // Create content and version
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Original"),
        &BytesN::random(&env),
        &vec![&env],
    );

    let version = client.create_new_version_content(
        &content_id,
        &creator,
        &String::from_str(&env, "Updated"),
        &BytesN::random(&env),
        &vec![&env],
        &String::from_str(&env, "Updates"),
    );

    // Verify the version
    let verified_level =
        client.verify_version(&content_id, &version, &verifier, &VerificationLevel::Expert);
    assert_eq!(verified_level, VerificationLevel::Expert);

    // Check version info reflects verification
    let version_info = client.get_version_info(&content_id, &version);
    assert_eq!(version_info.verification_level, VerificationLevel::Expert);
}

#[test]
fn test_get_version_diff() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);

    // Create original content
    let original_title = String::from_str(&env, "Original Title");
    let original_hash = BytesN::random(&env);

    let content_id = client.publish_content(
        &creator,
        &original_title,
        &original_hash,
        &vec![&env, String::from_str(&env, "original")],
    );

    // Create version 1 - change title only
    let v1_title = String::from_str(&env, "Updated Title");
    client.create_new_version_content(
        &content_id,
        &creator,
        &v1_title,
        &original_hash, // Same hash
        &vec![&env, String::from_str(&env, "original")],
        &String::from_str(&env, "Title update"),
    );

    // Create version 2 - change content only
    let v2_hash = BytesN::random(&env);
    client.create_new_version_content(
        &content_id,
        &creator,
        &v1_title, // Same title as v1
        &v2_hash,  // New hash
        &vec![&env, String::from_str(&env, "original")],
        &String::from_str(&env, "Content update"),
    );

    // Test version diffs

    // v0 to v1: title changed, content same
    let diff_0_to_1 = client.get_version_diff(&content_id, &0, &1);
    assert_eq!(diff_0_to_1.from_version, 0);
    assert_eq!(diff_0_to_1.to_version, 1);
    assert!(diff_0_to_1.title_changed);
    assert!(!diff_0_to_1.content_changed);

    // v1 to v2: title same, content changed
    let diff_1_to_2 = client.get_version_diff(&content_id, &1, &2);
    assert_eq!(diff_1_to_2.from_version, 1);
    assert_eq!(diff_1_to_2.to_version, 2);
    assert!(!diff_1_to_2.title_changed);
    assert!(diff_1_to_2.content_changed);

    // v0 to v2: both changed (spanning multiple versions)
    let diff_0_to_2 = client.get_version_diff(&content_id, &0, &2);
    assert_eq!(diff_0_to_2.from_version, 0);
    assert_eq!(diff_0_to_2.to_version, 2);
    assert!(diff_0_to_2.title_changed);
    assert!(diff_0_to_2.content_changed);
}

#[test]
fn test_version_independence() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);
    let verifier = Address::generate(&env);

    // Create content and versions
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Original"),
        &BytesN::random(&env),
        &vec![&env],
    );

    let version1 = client.create_new_version_content(
        &content_id,
        &creator,
        &String::from_str(&env, "Version 1"),
        &BytesN::random(&env),
        &vec![&env],
        &String::from_str(&env, "First update"),
    );

    let version2 = client.create_new_version_content(
        &content_id,
        &creator,
        &String::from_str(&env, "Version 2"),
        &BytesN::random(&env),
        &vec![&env],
        &String::from_str(&env, "Second update"),
    );

    // Vote on version 1 only
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    client.upvote_version(&content_id, &version1, &voter1);
    client.upvote_version(&content_id, &version1, &voter2);

    // Verify version 2 only
    client.verify_version(
        &content_id,
        &version2,
        &verifier,
        &VerificationLevel::Expert,
    );

    // Check that versions have independent stats
    let v1_info = client.get_version_info(&content_id, &version1);
    let v2_info = client.get_version_info(&content_id, &version2);

    assert_eq!(v1_info.upvotes, 2);
    assert_eq!(v1_info.verification_level, VerificationLevel::None);

    assert_eq!(v2_info.upvotes, 0);
    assert_eq!(v2_info.verification_level, VerificationLevel::Expert);
}

#[test]
fn test_versioning_workflow() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);
    let verifier = Address::generate(&env);

    // 1. Create original content
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Blockchain Basics"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "blockchain")],
    );

    // 2. Create version 1
    let version1 = client.create_new_version_content(
        &content_id,
        &creator,
        &String::from_str(&env, "Blockchain Fundamentals"),
        &BytesN::random(&env),
        &vec![
            &env,
            String::from_str(&env, "blockchain"),
            String::from_str(&env, "advanced"),
        ],
        &String::from_str(&env, "Added advanced topics"),
    );

    // 3. Vote and verify version 1
    let voter = Address::generate(&env);
    client.upvote_version(&content_id, &version1, &voter);
    client.verify_version(
        &content_id,
        &version1,
        &verifier,
        &VerificationLevel::Expert,
    );

    // 4. Create version 2
    let version2 = client.create_new_version_content(
        &content_id,
        &creator,
        &String::from_str(&env, "Complete Blockchain Guide"),
        &BytesN::random(&env),
        &vec![
            &env,
            String::from_str(&env, "blockchain"),
            String::from_str(&env, "complete"),
        ],
        &String::from_str(&env, "Complete rewrite"),
    );

    // 5. Verify all versions exist and are correct
    let original = client.get_content_at_version(&content_id, &0);
    let v1_content = client.get_content_at_version(&content_id, &1);
    let v2_content = client.get_content_at_version(&content_id, &2);
    let current = client.get_content(&content_id);

    assert_eq!(original.title, String::from_str(&env, "Blockchain Basics"));
    assert_eq!(
        v1_content.title,
        String::from_str(&env, "Blockchain Fundamentals")
    );
    assert_eq!(
        v2_content.title,
        String::from_str(&env, "Complete Blockchain Guide")
    );
    assert_eq!(
        current.title,
        String::from_str(&env, "Complete Blockchain Guide")
    );

    // 6. Check version info
    let v1_info = client.get_version_info(&content_id, &version1);
    let v2_info = client.get_version_info(&content_id, &version2);

    assert_eq!(v1_info.upvotes, 1);
    assert_eq!(v1_info.verification_level, VerificationLevel::Expert);

    assert_eq!(v2_info.upvotes, 0);
    assert_eq!(v2_info.verification_level, VerificationLevel::None);
}

#[test]
#[should_panic(expected = "only the creator can create a new version")]
fn test_create_version_non_creator() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);
    let non_creator = Address::generate(&env);

    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Original Content"),
        &BytesN::random(&env),
        &vec![&env],
    );

    // Non-creator tries to create version
    client.create_new_version_content(
        &content_id,
        &non_creator, // Wrong creator
        &String::from_str(&env, "Unauthorized Update"),
        &BytesN::random(&env),
        &vec![&env],
        &String::from_str(&env, "Unauthorized change"),
    );
}

#[test]
#[should_panic(expected = "version does not exist")]
fn test_get_content_at_nonexistent_version() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Test Content"),
        &BytesN::random(&env),
        &vec![&env],
    );

    // Try to get version that doesn't exist
    client.get_content_at_version(&content_id, &999);
}

#[test]
#[should_panic(expected = "already voted on this version")]
fn test_duplicate_version_vote() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);
    let voter = Address::generate(&env);

    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Test Content"),
        &BytesN::random(&env),
        &vec![&env],
    );

    let version = client.create_new_version_content(
        &content_id,
        &creator,
        &String::from_str(&env, "Updated"),
        &BytesN::random(&env),
        &vec![&env],
        &String::from_str(&env, "Update"),
    );

    // Vote once
    client.upvote_version(&content_id, &version, &voter);

    // Try to vote again - should panic
    client.upvote_version(&content_id, &version, &voter);
}

#[test]
#[should_panic(expected = "cannot downgrade verification")]
fn test_version_verification_downgrade() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);
    let verifier = Address::generate(&env);

    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Test Content"),
        &BytesN::random(&env),
        &vec![&env],
    );

    let version = client.create_new_version_content(
        &content_id,
        &creator,
        &String::from_str(&env, "Updated"),
        &BytesN::random(&env),
        &vec![&env],
        &String::from_str(&env, "Update"),
    );

    // Verify to Expert level
    client.verify_version(&content_id, &version, &verifier, &VerificationLevel::Expert);

    // Try to downgrade to Peer - should panic
    client.verify_version(&content_id, &version, &verifier, &VerificationLevel::Peer);
}

///
/// COLLABORATIVE TESTS
///
#[test]
fn test_grant_permission() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    // Create content
    let creator = Address::generate(&env);
    let collaborator = Address::generate(&env);

    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Collaborative Content"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "collaboration")],
    );

    // Grant permission
    let success = client.grant_permission(&content_id, &creator, &collaborator);
    assert!(success);

    // Verify permission was granted
    let permission = client.get_collaborative_permission(&collaborator, &content_id);
    assert_eq!(permission.collaborator, collaborator);
    assert_eq!(permission.content_id, content_id);
    assert_eq!(permission.granted_by, creator);
}

#[test]
fn test_submit_for_review() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    // Setup: Create content and grant permission
    let creator = Address::generate(&env);
    let collaborator = Address::generate(&env);

    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Original Content"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "original")],
    );

    client.grant_permission(&content_id, &creator, &collaborator);

    // Submit for review
    let new_content_hash = BytesN::random(&env);
    let new_subject_tags = vec![&env, String::from_str(&env, "updated")];
    let change_notes = String::from_str(&env, "Fixed typos and added examples");

    let success = client.submit_for_review(
        &content_id,
        &collaborator,
        &new_content_hash,
        &new_subject_tags,
        &change_notes,
    );
    assert!(success);

    // Verify submission was created
    let submission = client.get_collaborative_submission(&collaborator, &content_id);
    assert_eq!(submission.content_id, content_id);
    assert_eq!(submission.collaborator, collaborator);
    assert_eq!(submission.new_content_hash, new_content_hash);
    assert_eq!(submission.new_subject_tags, new_subject_tags);
    assert_eq!(submission.change_notes, change_notes);
}

#[test]
fn test_review_submission_accept() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    // Setup: Create content, grant permission, and submit for review
    let creator = Address::generate(&env);
    let collaborator = Address::generate(&env);

    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Original Content"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "original")],
    );

    client.grant_permission(&content_id, &creator, &collaborator);

    let new_content_hash = BytesN::random(&env);
    let new_subject_tags = vec![&env, String::from_str(&env, "updated")];
    let change_notes = String::from_str(&env, "Improved content quality");

    client.submit_for_review(
        &content_id,
        &collaborator,
        &new_content_hash,
        &new_subject_tags,
        &change_notes,
    );

    // Accept the submission
    let feedback = String::from_str(&env, "Great improvements!");
    let success = client.review_submission(
        &content_id,
        &collaborator,
        &creator,
        &true, // accept
        &feedback,
    );
    assert!(success);

    // Verify submission was accepted and content was updated
    let submission = client.get_collaborative_submission(&collaborator, &content_id);
    assert_eq!(submission.reviewer, Some(creator));
    assert_eq!(submission.review_feedback, Some(feedback));

    // Verify content was updated to new version
    let updated_content = client.get_content(&content_id);
    assert_eq!(
        updated_content.title,
        String::from_str(&env, "Original Content")
    ); // Title unchanged in this test
    assert_eq!(updated_content.content_hash, new_content_hash);
    assert_eq!(updated_content.subject_tags, new_subject_tags);
}

#[test]
fn test_review_submission_reject() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    // Setup: Create content, grant permission, and submit for review
    let creator = Address::generate(&env);
    let collaborator = Address::generate(&env);

    let original_hash = BytesN::random(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Original Content"),
        &original_hash,
        &vec![&env, String::from_str(&env, "original")],
    );

    client.grant_permission(&content_id, &creator, &collaborator);

    let new_content_hash = BytesN::random(&env);
    let new_subject_tags = vec![&env, String::from_str(&env, "updated")];

    client.submit_for_review(
        &content_id,
        &collaborator,
        &new_content_hash,
        &new_subject_tags,
        &String::from_str(&env, "Some changes"),
    );

    // Reject the submission
    let feedback = String::from_str(&env, "Needs more work");
    let success = client.review_submission(
        &content_id,
        &collaborator,
        &creator,
        &false, // reject
        &feedback,
    );
    assert!(success);

    // Verify submission was rejected
    let submission = client.get_collaborative_submission(&collaborator, &content_id);
    assert_eq!(submission.reviewer, Some(creator));
    assert_eq!(submission.review_feedback, Some(feedback));

    // Verify content was NOT updated (remains original)
    let content = client.get_content(&content_id);
    assert_eq!(content.content_hash, original_hash); // Should remain original
}

#[test]
fn test_get_user_contribution_history() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    // Setup
    let creator = Address::generate(&env);
    let collaborator = Address::generate(&env);

    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Content for History Test"),
        &BytesN::random(&env),
        &vec![&env],
    );

    client.grant_permission(&content_id, &creator, &collaborator);

    // Submit first contribution
    client.submit_for_review(
        &content_id,
        &collaborator,
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "v1")],
        &String::from_str(&env, "First contribution"),
    );

    // Review first contribution (accept)
    client.review_submission(
        &content_id,
        &collaborator,
        &creator,
        &true,
        &String::from_str(&env, "Good work"),
    );

    // Submit second contribution
    client.submit_for_review(
        &content_id,
        &collaborator,
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "v2")],
        &String::from_str(&env, "Second contribution"),
    );

    // Review second contribution (reject)
    client.review_submission(
        &content_id,
        &collaborator,
        &creator,
        &false,
        &String::from_str(&env, "Needs improvement"),
    );

    // Get contribution history
    let history = client.get_user_contribution_history(&collaborator, &content_id);

    // Should have 2 contributions in history
    assert_eq!(history.len(), 2);

    // Verify first contribution
    let first_contribution = history.get(0).unwrap();
    assert_eq!(
        first_contribution.change_notes,
        String::from_str(&env, "First contribution")
    );
    assert_eq!(
        first_contribution.review_feedback,
        Some(String::from_str(&env, "Good work"))
    );

    // Verify second contribution
    let second_contribution = history.get(1).unwrap();
    assert_eq!(
        second_contribution.change_notes,
        String::from_str(&env, "Second contribution")
    );
    assert_eq!(
        second_contribution.review_feedback,
        Some(String::from_str(&env, "Needs improvement"))
    );
}

#[test]
fn test_collaborative_workflow_complete() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    // 1. Creator publishes content
    let creator = Address::generate(&env);
    let collaborator1 = Address::generate(&env);
    let collaborator2 = Address::generate(&env);

    let original_hash = BytesN::random(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Educational Article"),
        &original_hash,
        &vec![&env, String::from_str(&env, "education")],
    );

    // 2. Creator grants permissions to collaborators
    client.grant_permission(&content_id, &creator, &collaborator1);
    client.grant_permission(&content_id, &creator, &collaborator2);

    // 3. Collaborator1 submits improvement
    let improved_hash = BytesN::random(&env);
    client.submit_for_review(
        &content_id,
        &collaborator1,
        &improved_hash,
        &vec![
            &env,
            String::from_str(&env, "education"),
            String::from_str(&env, "improved"),
        ],
        &String::from_str(&env, "Added examples and fixed grammar"),
    );

    // 4. Creator accepts collaborator1's submission
    client.review_submission(
        &content_id,
        &collaborator1,
        &creator,
        &true,
        &String::from_str(&env, "Excellent improvements!"),
    );

    // 5. Verify content was updated
    let updated_content = client.get_content(&content_id);
    assert_eq!(updated_content.content_hash, improved_hash);

    // 6. Collaborator2 submits another improvement
    let further_improved_hash = BytesN::random(&env);
    client.submit_for_review(
        &content_id,
        &collaborator2,
        &further_improved_hash,
        &vec![
            &env,
            String::from_str(&env, "education"),
            String::from_str(&env, "advanced"),
        ],
        &String::from_str(&env, "Added advanced concepts"),
    );

    // 7. Creator rejects collaborator2's submission
    client.review_submission(
        &content_id,
        &collaborator2,
        &creator,
        &false,
        &String::from_str(&env, "Too advanced for target audience"),
    );

    // 8. Verify content remains at collaborator1's version
    let final_content = client.get_content(&content_id);
    assert_eq!(final_content.content_hash, improved_hash); // Still collaborator1's version

    // 9. Check contribution histories
    let history1 = client.get_user_contribution_history(&collaborator1, &content_id);
    let history2 = client.get_user_contribution_history(&collaborator2, &content_id);

    assert_eq!(history1.len(), 1); // One accepted contribution
    assert_eq!(history2.len(), 1); // One rejected contribution
}

#[test]
fn test_multiple_collaborators_same_content() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    // Setup
    let creator = Address::generate(&env);
    let collaborators = [
        Address::generate(&env),
        Address::generate(&env),
        Address::generate(&env),
    ];

    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Multi-Collaborator Content"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "collaborative")],
    );

    // Grant permissions to all collaborators
    for collaborator in &collaborators {
        client.grant_permission(&content_id, &creator, collaborator);
    }

    // Each collaborator submits a different improvement
    for (i, collaborator) in collaborators.iter().enumerate() {
        let change_notes = match i {
            0 => String::from_str(&env, "Added introduction"),
            1 => String::from_str(&env, "Improved examples"),
            2 => String::from_str(&env, "Added conclusion"),
            _ => unreachable!(),
        };

        client.submit_for_review(
            &content_id,
            collaborator,
            &BytesN::random(&env),
            &vec![&env, String::from_str(&env, "collaborative")],
            &change_notes,
        );
    }

    // Creator reviews all submissions - accept first two, reject last one
    for (i, collaborator) in collaborators.iter().enumerate() {
        let accept = i < 2; // Accept first two, reject third
        let feedback = if accept {
            String::from_str(&env, "Great contribution!")
        } else {
            String::from_str(&env, "Overlaps with existing content")
        };

        client.review_submission(&content_id, collaborator, &creator, &accept, &feedback);
    }

    // Verify all collaborators have history entries
    for collaborator in &collaborators {
        let history = client.get_user_contribution_history(collaborator, &content_id);
        assert_eq!(history.len(), 1);
    }
}

#[test]
#[should_panic(expected = "Only content creator can grant permissions")]
fn test_grant_permission_non_creator() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);
    let non_creator = Address::generate(&env);
    let collaborator = Address::generate(&env);

    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Test Content"),
        &BytesN::random(&env),
        &vec![&env],
    );

    // Non-creator tries to grant permission
    client.grant_permission(&content_id, &non_creator, &collaborator);
}

#[test]
#[should_panic(expected = "permission not found for user and content_id")]
fn test_submit_without_permission() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);
    let unauthorized_user = Address::generate(&env);

    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Test Content"),
        &BytesN::random(&env),
        &vec![&env],
    );

    // Try to submit without permission
    client.submit_for_review(
        &content_id,
        &unauthorized_user,
        &BytesN::random(&env),
        &vec![&env],
        &String::from_str(&env, "Unauthorized change"),
    );
}

#[test]
#[should_panic(expected = "Only content creator can review submissions")]
fn test_review_submission_non_creator() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);
    let collaborator = Address::generate(&env);
    let non_creator = Address::generate(&env);

    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Test Content"),
        &BytesN::random(&env),
        &vec![&env],
    );

    client.grant_permission(&content_id, &creator, &collaborator);

    client.submit_for_review(
        &content_id,
        &collaborator,
        &BytesN::random(&env),
        &vec![&env],
        &String::from_str(&env, "Some changes"),
    );

    // Non-creator tries to review
    client.review_submission(
        &content_id,
        &collaborator,
        &non_creator, // Wrong reviewer
        &true,
        &String::from_str(&env, "Unauthorized review"),
    );
}

#[test]
#[should_panic(expected = "Submission must be pending to review")]
fn test_review_already_reviewed_submission() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);
    let collaborator = Address::generate(&env);

    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Test Content"),
        &BytesN::random(&env),
        &vec![&env],
    );

    client.grant_permission(&content_id, &creator, &collaborator);

    client.submit_for_review(
        &content_id,
        &collaborator,
        &BytesN::random(&env),
        &vec![&env],
        &String::from_str(&env, "Some changes"),
    );

    // Review once (accept)
    client.review_submission(
        &content_id,
        &collaborator,
        &creator,
        &true,
        &String::from_str(&env, "Good work"),
    );

    // Try to review again - should panic
    client.review_submission(
        &content_id,
        &collaborator,
        &creator,
        &false,
        &String::from_str(&env, "Changed my mind"),
    );
}

#[test]
#[should_panic(expected = "permission not found for user and content_id")]
fn test_get_nonexistent_permission() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);
    let user = Address::generate(&env);

    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Test Content"),
        &BytesN::random(&env),
        &vec![&env],
    );

    // Try to get permission that doesn't exist
    client.get_collaborative_permission(&user, &content_id);
}

#[test]
#[should_panic(expected = "submission not found for submitter and content_id")]
fn test_get_nonexistent_submission() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);

    env.mock_all_auths();

    let creator = Address::generate(&env);
    let user = Address::generate(&env);

    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Test Content"),
        &BytesN::random(&env),
        &vec![&env],
    );

    // Try to get submission that doesn't exist
    client.get_collaborative_submission(&user, &content_id);
}

#[test]
fn test_flag_and_get_flags() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let flagger = Address::generate(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Flaggable Content"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "test")],
    );
    client.flag_content(&content_id, &flagger, &String::from_str(&env, "spam"));
    let flags = client.get_flags(&content_id);
    assert_eq!(flags.len(), 1);
    assert_eq!(flags.get(0).unwrap().flagger, flagger);
}

#[test]
fn test_moderate_and_get_history() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let moderator = Address::generate(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Moderatable Content"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "test")],
    );
    client.flag_content(&content_id, &creator, &String::from_str(&env, "abuse"));
    client.moderate_content(
        &content_id,
        &moderator,
        &crate::storage::ModerationStatus::Removed,
        &String::from_str(&env, "confirmed abuse"),
    );
    let history = client.get_moderation_history(&content_id);
    assert_eq!(history.len(), 1);
    assert_eq!(history.get(0).unwrap().moderator, moderator);
    assert_eq!(
        history.get(0).unwrap().action,
        crate::storage::ModerationStatus::Removed
    );
}

#[test]
fn test_create_and_resolve_dispute() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let resolver = Address::generate(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Disputable Content"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "test")],
    );
    let dispute_id = client.create_dispute(
        &content_id,
        &creator,
        &String::from_str(&env, "unfair removal"),
    );
    let dispute = client.get_dispute(&dispute_id).unwrap();
    assert_eq!(
        dispute.status,
        crate::storage::ModerationStatus::UnderDispute
    );
    client.resolve_dispute(&dispute_id, &resolver, &true);
    let dispute = client.get_dispute(&dispute_id).unwrap();
    assert_eq!(dispute.status, crate::storage::ModerationStatus::Approved);
    assert_eq!(dispute.resolver.unwrap(), resolver);
}

#[test]
fn test_advanced_verification_and_delegation() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);
    env.mock_all_auths();
    let creator = Address::generate(&env);
    let verifier = Address::generate(&env);
    let delegatee = Address::generate(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Advanced Verification"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "test")],
    );
    // Delegate
    client.delegate_verification(&verifier, &delegatee, &Some(100000));
    // Advanced verification with delegation
    let level = client.verify_content_advanced(
        &content_id,
        &delegatee,
        &VerificationLevel::Expert,
        &Some(verifier.clone()),
        &50,
        &Some(1000),
    );
    assert_eq!(level, VerificationLevel::Expert);
    // Renew verification
    client.renew_verification(&content_id, &delegatee, &2000);
    // Revoke delegation
    client.revoke_delegation(&verifier, &delegatee);
}

// ========================================
// ANALYTICS TESTS
// ========================================

#[test]
fn test_record_content_view() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Test Content for Analytics"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "analytics")],
    );

    // Record multiple views
    client.record_content_view(&content_id);
    client.record_content_view(&content_id);
    client.record_content_view(&content_id);

    // Get analytics and verify
    let analytics = client.get_content_analytics(&content_id);
    assert_eq!(analytics.content_id, content_id);
    assert_eq!(analytics.total_views, 3);
    assert_eq!(analytics.total_upvotes, 0);
    assert_eq!(analytics.total_downvotes, 0);
    assert_eq!(analytics.engagement_rate, 0); // No engagement yet
}

#[test]
fn test_record_content_upvotes_and_downvotes() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Content for Voting Analytics"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "voting")],
    );

    // Record views first
    client.record_content_view(&content_id);
    client.record_content_view(&content_id);
    client.record_content_view(&content_id);
    client.record_content_view(&content_id);
    client.record_content_view(&content_id);

    // Record upvotes and downvotes
    client.record_content_upvote(&content_id);
    client.record_content_upvote(&content_id);
    client.record_content_upvote(&content_id);
    client.record_content_downvote(&content_id);

    // Get analytics and verify
    let analytics = client.get_content_analytics(&content_id);
    assert_eq!(analytics.total_views, 5);
    assert_eq!(analytics.total_upvotes, 3);
    assert_eq!(analytics.total_downvotes, 1);
    assert_eq!(analytics.engagement_rate, 8000); // (3+1)/5 * 10000 = 8000
    assert!(analytics.average_rating > 25000); // Should be above neutral (25000)
}

#[test]
fn test_update_category_analytics() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Category Analytics Test"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "blockchain")],
    );

    // Record some activity
    client.record_content_view(&content_id);
    client.record_content_upvote(&content_id);

    // Update category analytics
    client.update_category_analytics(&content_id);

    // Note: Category analytics retrieval would need to be implemented
    // For now, we just verify the function doesn't panic
}

// ========================================
// TRENDING TESTS
// ========================================

#[test]
fn test_calculate_trending_score() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Trending Content Test"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "trending")],
    );

    // Record activity to generate analytics
    client.record_content_view(&content_id);
    client.record_content_upvote(&content_id);
    client.record_content_upvote(&content_id);

    // Calculate trending score for daily period
    let trending_score =
        client.calculate_trending_score(&content_id, &crate::storage::TrendingPeriod::Daily);

    // Verify trending score is calculated (should be > 0 due to activity)
    assert!(trending_score > 0);
}

#[test]
fn test_update_trending_content() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Update Trending Test"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "trending")],
    );

    // Record some activity
    client.record_content_view(&content_id);
    client.record_content_upvote(&content_id);

    // Update trending content for daily period
    client.update_trending_content(&content_id, &crate::storage::TrendingPeriod::Daily);

    // Note: Trending content retrieval would need to be implemented
    // For now, we just verify the function doesn't panic
}

#[test]
fn test_create_trending_snapshot() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Snapshot Test Content"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "snapshot")],
    );

    // Record activity
    client.record_content_view(&content_id);
    client.record_content_upvote(&content_id);

    // Create trending snapshot for daily period
    let snapshot = client.create_trending_snapshot(&crate::storage::TrendingPeriod::Daily);

    // Verify snapshot was created
    assert_eq!(snapshot.period, crate::storage::TrendingPeriod::Daily);
    // Note: timestamp might be 0 in test environment, which is acceptable
    // Note: trending_content_ids might be empty if no content meets trending criteria
}

#[test]
fn test_update_all_trending_content() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "All Trending Update Test"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "trending")],
    );

    // Record activity
    client.record_content_view(&content_id);
    client.record_content_upvote(&content_id);

    // Update all trending content
    client.update_all_trending_content(&content_id);

    // Note: This function should update trending for all periods
    // For now, we just verify the function doesn't panic
}

// ========================================
// INTEGRATION TESTS
// ========================================

#[test]
fn test_analytics_and_trending_integration() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);
    env.mock_all_auths();

    let creator = Address::generate(&env);
    let content_id = client.publish_content(
        &creator,
        &String::from_str(&env, "Integration Test Content"),
        &BytesN::random(&env),
        &vec![&env, String::from_str(&env, "integration")],
    );

    // Simulate content becoming popular
    for _ in 0..10 {
        client.record_content_view(&content_id);
    }

    for _ in 0..8 {
        client.record_content_upvote(&content_id);
    }

    for _ in 0..2 {
        client.record_content_downvote(&content_id);
    }

    // Get analytics
    let analytics = client.get_content_analytics(&content_id);
    assert_eq!(analytics.total_views, 10);
    assert_eq!(analytics.total_upvotes, 8);
    assert_eq!(analytics.total_downvotes, 2);
    assert_eq!(analytics.engagement_rate, 10000); // (8+2)/10 * 10000 = 10000

    // Calculate trending score
    let trending_score =
        client.calculate_trending_score(&content_id, &crate::storage::TrendingPeriod::Daily);
    assert!(trending_score > 0);

    // Update trending content
    client.update_trending_content(&content_id, &crate::storage::TrendingPeriod::Daily);

    // Create snapshot
    let snapshot = client.create_trending_snapshot(&crate::storage::TrendingPeriod::Daily);
    assert_eq!(snapshot.period, crate::storage::TrendingPeriod::Daily);
    // Note: timestamp might be 0 in test environment, which is acceptable

    // Update category analytics
    client.update_category_analytics(&content_id);
}

#[test]
#[should_panic(expected = "Content does not exist")]
fn test_analytics_nonexistent_content() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);
    env.mock_all_auths();

    // Try to record view for non-existent content
    client.record_content_view(&999);
}

#[test]
#[should_panic(expected = "Content does not exist")]
fn test_trending_nonexistent_content() {
    let env = Env::default();
    let contract_id = env.register(TokenizedEducationalContent, ());
    let client = TokenizedEducationalContentClient::new(&env, &contract_id);
    env.mock_all_auths();

    // Try to calculate trending score for non-existent content
    client.calculate_trending_score(&999, &crate::storage::TrendingPeriod::Daily);
}
