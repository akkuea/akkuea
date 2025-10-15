#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Bytes, Env, String};

use crate::{xlm_to_stroops, GreetingSystem, GreetingSystemClient, TierLevel};

use crate::roles;
use crate::verify_user_authorization;
use crate::Error;
use crate::Role;

fn create_test_env<'a>() -> (Env, GreetingSystemClient<'a>, Address) {
    let env = Env::default();
    let contract_id = env.register(GreetingSystem, ());
    let client = GreetingSystemClient::new(&env, &contract_id);
    let user = Address::generate(&env);

    (env, client, user)
}

#[test]
fn test_assign_basic_tier() {
    let (env, client, user) = create_test_env();
    env.mock_all_auths();

    // 100 XLM should give Basic tier
    let contribution = xlm_to_stroops(100);

    client.assign_premium_tier(&user, &contribution);

    // Verify tier was assigned
    let tier = client.get_premium_status(&user);
    assert_eq!(tier.tier, TierLevel::Basic);
    assert_eq!(tier.contribution, contribution);
    assert_eq!(tier.features.max_greetings_per_day, 50);
}

#[test]
fn test_assign_pro_tier() {
    let (env, client, user) = create_test_env();
    env.mock_all_auths();

    // 500 XLM should give Pro tier
    let contribution = xlm_to_stroops(500);

    client.assign_premium_tier(&user, &contribution);

    let tier = client.get_premium_status(&user);
    assert_eq!(tier.tier, TierLevel::Pro);
    assert_eq!(tier.features.max_greetings_per_day, 200);
    assert!(tier.features.priority_support);
}

#[test]
fn test_assign_elite_tier() {
    let (env, client, user) = create_test_env();
    env.mock_all_auths();

    // 2000 XLM should give Elite tier
    let contribution = xlm_to_stroops(2000);

    client.assign_premium_tier(&user, &contribution);

    let tier = client.get_premium_status(&user);
    assert_eq!(tier.tier, TierLevel::Elite);
    assert_eq!(tier.features.max_greetings_per_day, 1000);
    assert_eq!(tier.features.api_rate_limit, 500);
}

#[test]
fn test_assign_tier_zero_contribution() {
    let (env, client, user) = create_test_env();
    env.mock_all_auths();

    // Zero contribution should fail
    let contribution = 0;

    let result = client.try_assign_premium_tier(&user, &contribution);
    assert!(result.is_err());
}

#[test]
fn test_assign_tier_negative_contribution() {
    let (env, client, user) = create_test_env();
    env.mock_all_auths();

    // Negative contribution should fail
    let contribution = -100;

    let result = client.try_assign_premium_tier(&user, &contribution);
    assert!(result.is_err());
}

#[test]
fn test_assign_tier_already_exists() {
    let (env, client, user) = create_test_env();
    env.mock_all_auths();

    let contribution = xlm_to_stroops(100);

    // First assignment should succeed
    client.assign_premium_tier(&user, &contribution);

    // Second assignment should fail
    let result = client.try_assign_premium_tier(&user, &contribution);
    assert!(result.is_err());
}

#[test]
fn test_upgrade_tier() {
    let (env, client, user) = create_test_env();
    env.mock_all_auths();

    // Start with Basic tier (100 XLM)
    let initial_contribution = xlm_to_stroops(100);
    client.assign_premium_tier(&user, &initial_contribution);

    let tier = client.get_premium_status(&user);
    assert_eq!(tier.tier, TierLevel::Basic);

    // Upgrade to Pro tier (add 400 XLM, total 500 XLM)
    let additional_contribution = xlm_to_stroops(400);
    client.upgrade_premium_tier(&user, &additional_contribution);

    let tier = client.get_premium_status(&user);
    assert_eq!(tier.tier, TierLevel::Pro);
    assert_eq!(tier.contribution, xlm_to_stroops(500));
}

#[test]
fn test_upgrade_tier_to_elite() {
    let (env, client, user) = create_test_env();
    env.mock_all_auths();

    // Start with Pro tier (500 XLM)
    let initial_contribution = xlm_to_stroops(500);
    client.assign_premium_tier(&user, &initial_contribution);

    // Upgrade to Elite tier (add 1500 XLM, total 2000 XLM)
    let additional_contribution = xlm_to_stroops(1500);
    client.upgrade_premium_tier(&user, &additional_contribution);

    let tier = client.get_premium_status(&user);
    assert_eq!(tier.tier, TierLevel::Elite);
    assert_eq!(tier.contribution, xlm_to_stroops(2000));
}

#[test]
fn test_upgrade_tier_no_downgrade() {
    let (env, client, user) = create_test_env();
    env.mock_all_auths();

    // Start with Elite tier (2000 XLM)
    let initial_contribution = xlm_to_stroops(2000);
    client.assign_premium_tier(&user, &initial_contribution);

    // Try to add small amount that wouldn't change tier
    let additional_contribution = xlm_to_stroops(10);
    client.upgrade_premium_tier(&user, &additional_contribution);

    let tier = client.get_premium_status(&user);
    assert_eq!(tier.tier, TierLevel::Elite);
}

#[test]
fn test_get_tier_level() {
    let (env, client, user) = create_test_env();
    env.mock_all_auths();

    let contribution = xlm_to_stroops(500);
    client.assign_premium_tier(&user, &contribution);

    let tier_level = client.get_tier_level(&user);
    assert_eq!(tier_level, TierLevel::Pro);
}

#[test]
fn test_get_user_features() {
    let (env, client, user) = create_test_env();
    env.mock_all_auths();

    let contribution = xlm_to_stroops(2000);
    client.assign_premium_tier(&user, &contribution);

    let features = client.get_user_features(&user);
    assert_eq!(features.max_greetings_per_day, 1000);
    assert!(features.custom_greeting_messages);
    assert!(features.priority_support);
    assert!(features.analytics_access);
    assert_eq!(features.api_rate_limit, 500);
}

#[test]
fn test_get_total_contribution() {
    let (env, client, user) = create_test_env();
    env.mock_all_auths();

    let initial_contribution = xlm_to_stroops(100);
    client.assign_premium_tier(&user, &initial_contribution);

    let additional_contribution = xlm_to_stroops(400);
    client.upgrade_premium_tier(&user, &additional_contribution);

    let total = client.get_total_contribution(&user);
    assert_eq!(total, xlm_to_stroops(500));
}

#[test]
fn test_get_premium_status_not_found() {
    let (_env, client, user) = create_test_env();

    let result = client.try_get_premium_status(&user);
    assert!(result.is_err());
}

#[test]
fn test_tier_level_from_contribution() {
    // Test tier thresholds
    assert_eq!(
        TierLevel::from_contribution(xlm_to_stroops(50)),
        TierLevel::None
    );
    assert_eq!(
        TierLevel::from_contribution(xlm_to_stroops(100)),
        TierLevel::Basic
    );
    assert_eq!(
        TierLevel::from_contribution(xlm_to_stroops(499)),
        TierLevel::Basic
    );
    assert_eq!(
        TierLevel::from_contribution(xlm_to_stroops(500)),
        TierLevel::Pro
    );
    assert_eq!(
        TierLevel::from_contribution(xlm_to_stroops(1999)),
        TierLevel::Pro
    );
    assert_eq!(
        TierLevel::from_contribution(xlm_to_stroops(2000)),
        TierLevel::Elite
    );
    assert_eq!(
        TierLevel::from_contribution(xlm_to_stroops(10000)),
        TierLevel::Elite
    );
}

#[test]
fn test_tier_features_basic() {
    let features = TierLevel::Basic.get_features();
    assert_eq!(features.max_greetings_per_day, 50);
    assert!(features.custom_greeting_messages);
    assert!(!features.priority_support);
    assert!(!features.analytics_access);
    assert_eq!(features.api_rate_limit, 30);
}

#[test]
fn test_tier_features_pro() {
    let features = TierLevel::Pro.get_features();
    assert_eq!(features.max_greetings_per_day, 200);
    assert!(features.custom_greeting_messages);
    assert!(features.priority_support);
    assert!(features.analytics_access);
    assert_eq!(features.api_rate_limit, 100);
}

#[test]
fn test_tier_features_elite() {
    let features = TierLevel::Elite.get_features();
    assert_eq!(features.max_greetings_per_day, 1000);
    assert!(features.custom_greeting_messages);
    assert!(features.priority_support);
    assert!(features.analytics_access);
    assert_eq!(features.api_rate_limit, 500);
}

#[test]
fn test_register_user_and_get_profile() {
    let (env, client, user) = create_test_env();
    env.mock_all_auths();

    let name = String::from_str(&env, "Alice");
    let prefs = String::from_str(&env, "friend");

    client.register_user(&user, &name, &prefs);

    let profile = client.get_user_profile(&user);
    assert_eq!(profile.user, user);
    assert_eq!(profile.name, name);
    assert_eq!(profile.preferences, prefs);
}

#[test]
fn test_register_user_duplicate_fails() {
    let (env, client, user) = create_test_env();
    env.mock_all_auths();

    let name = String::from_str(&env, "Bob");
    let prefs = String::from_str(&env, "casual");

    client.register_user(&user, &name, &prefs);
    let result = client.try_register_user(&user, &name, &prefs);
    assert!(result.is_err());
}

#[test]
fn test_stress_register_many_users() {
    let (env, client, _user) = create_test_env();
    env.mock_all_auths();

    let total = 10u32;
    for i in 0..total {
        let u = Address::generate(&env);
        let name = String::from_str(&env, "User");

        let prefs = String::from_str(&env, "p");
        client.register_user(&u, &name, &prefs);

        if i % 200 == 0 {
            let profile = client.get_user_profile(&u);
            assert_eq!(profile.user, u);
        }
    }
}

// ==================== Role Management Tests ====================

#[cfg(test)]
mod role_tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, String};

    #[test]
    fn test_initialize_roles_and_get_owner() {
        let env = Env::default();
        let contract_id = env.register(crate::GreetingSystem, ());
        let client = crate::GreetingSystemClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        env.mock_all_auths();

        client.initialize_roles(&owner);

        let stored_owner = client.get_contract_owner();
        assert_eq!(stored_owner, owner);

        let role = client.get_role(&owner);
        assert_eq!(role, String::from_str(&env, "admin"));
    }

    #[test]
    fn test_assign_role() {
        let env = Env::default();
        let contract_id = env.register(crate::GreetingSystem, ());
        let client = crate::GreetingSystemClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let user = Address::generate(&env);

        env.mock_all_auths();
        client.initialize_roles(&owner);
        client.assign_role(&owner, &user, &String::from_str(&env, "moderator"));

        let role = client.get_role(&user);
        assert_eq!(role, String::from_str(&env, "moderator"));
    }

    #[test]
    fn test_has_role() {
        let env = Env::default();
        let contract_id = env.register(crate::GreetingSystem, ());
        let client = crate::GreetingSystemClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let user = Address::generate(&env);

        env.mock_all_auths();
        client.initialize_roles(&owner);
        client.assign_role(&owner, &user, &String::from_str(&env, "user"));

        assert!(client.has_role(&user, &String::from_str(&env, "user")));
        assert!(!client.has_role(&user, &String::from_str(&env, "admin")));
    }

    #[test]
    fn test_revoke_role() {
        let env = Env::default();
        let contract_id = env.register(crate::GreetingSystem, ());
        let client = crate::GreetingSystemClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let user = Address::generate(&env);

        env.mock_all_auths();
        client.initialize_roles(&owner);
        client.assign_role(&owner, &user, &String::from_str(&env, "moderator"));
        client.revoke_role(&owner, &user);

        let role_after = client.get_role(&user);
        assert_eq!(role_after, String::from_str(&env, "none"));
    }

    // Non-admin should panic when trying to assign a role (#201)
    #[test]
    #[should_panic(expected = "#201")]
    fn test_non_admin_cannot_assign_role() {
        let env = Env::default();
        let contract_id = env.register(crate::GreetingSystem, ());
        let client = crate::GreetingSystemClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);

        env.mock_all_auths();
        client.initialize_roles(&owner);
        client.assign_role(&owner, &user1, &String::from_str(&env, "user"));

        // user1 is not admin — should panic
        client.assign_role(&user1, &user2, &String::from_str(&env, "moderator"));
    }

    // Should panic when owner tries to revoke their own role (#202)
    #[test]
    #[should_panic(expected = "#202")]
    fn test_cannot_revoke_owner_role() {
        let env = Env::default();
        let contract_id = env.register(crate::GreetingSystem, ());
        let client = crate::GreetingSystemClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        env.mock_all_auths();

        client.initialize_roles(&owner);

        // Should panic when revoking owner
        client.revoke_role(&owner, &owner);
    }

    #[test]
    fn test_is_admin() {
        let env = Env::default();
        let contract_id = env.register(crate::GreetingSystem, ());
        let client = crate::GreetingSystemClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let user = Address::generate(&env);

        env.mock_all_auths();
        client.initialize_roles(&owner);

        assert!(client.is_admin(&owner));
        assert!(!client.is_admin(&user));
    }

    #[test]
    fn test_multiple_role_assignments() {
        let env = Env::default();
        let contract_id = env.register(crate::GreetingSystem, ());
        let client = crate::GreetingSystemClient::new(&env, &contract_id);

        let owner = Address::generate(&env);
        let user1 = Address::generate(&env);
        let user2 = Address::generate(&env);
        let user3 = Address::generate(&env);

        env.mock_all_auths();
        client.initialize_roles(&owner);

        client.assign_role(&owner, &user1, &String::from_str(&env, "admin"));
        client.assign_role(&owner, &user2, &String::from_str(&env, "moderator"));
        client.assign_role(&owner, &user3, &String::from_str(&env, "user"));

        assert_eq!(client.get_role(&user1), String::from_str(&env, "admin"));
        assert_eq!(client.get_role(&user2), String::from_str(&env, "moderator"));
        assert_eq!(client.get_role(&user3), String::from_str(&env, "user"));
    }

    // ==================== Interaction Tests ====================

    #[test]
    fn test_like_greeting_success() {
        let (env, client, user) = create_test_env();
        env.mock_all_auths();

        // Create a greeting first
        let greeting_id = 1u64;
        let text = String::from_str(&env, "Hello, World!");
        client.create_greeting(&greeting_id, &text, &user);

        // Like the greeting
        client.like_greeting(&user, &greeting_id);

        // Verify the like was recorded
        let interaction = client.get_interaction(&greeting_id);
        assert_eq!(interaction.likes, 1);
        assert_eq!(interaction.liked_by.len(), 1);
        assert_eq!(interaction.liked_by.get(0).unwrap(), user);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #21)")]
    fn test_like_greeting_duplicate_fails() {
        let (env, client, user) = create_test_env();
        env.mock_all_auths();

        // Create a greeting
        let greeting_id = 1u64;
        let text = String::from_str(&env, "Hello!");
        client.create_greeting(&greeting_id, &text, &user);

        // First like should succeed
        client.like_greeting(&user, &greeting_id);

        // Second like by same user should fail
        client.like_greeting(&user, &greeting_id);
    }

    #[test]
    fn test_like_greeting_multiple_users() {
        let (env, client, user1) = create_test_env();
        env.mock_all_auths();

        let user2 = Address::generate(&env);
        let user3 = Address::generate(&env);

        // Create a greeting
        let greeting_id = 1u64;
        let text = String::from_str(&env, "Popular greeting!");
        client.create_greeting(&greeting_id, &text, &user1);

        // Multiple users like the greeting
        client.like_greeting(&user1, &greeting_id);
        client.like_greeting(&user2, &greeting_id);
        client.like_greeting(&user3, &greeting_id);

        // Verify all likes were recorded
        let interaction = client.get_interaction(&greeting_id);
        assert_eq!(interaction.likes, 3);
        assert_eq!(interaction.liked_by.len(), 3);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #11)")]
    fn test_like_greeting_not_found() {
        let (env, client, user) = create_test_env();
        env.mock_all_auths();

        // Try to like non-existent greeting
        let greeting_id = 999u64;
        client.like_greeting(&user, &greeting_id);
    }

    #[test]
    fn test_add_comment_success() {
        let (env, client, user) = create_test_env();
        env.mock_all_auths();

        // Create a greeting
        let greeting_id = 1u64;
        let greeting_text = String::from_str(&env, "Test greeting");
        client.create_greeting(&greeting_id, &greeting_text, &user);

        // Add a comment
        let comment_text = String::from_str(&env, "Nice greeting!");
        client.add_comment(&user, &greeting_id, &comment_text);

        // Verify the comment was added
        let interaction = client.get_interaction(&greeting_id);
        assert_eq!(interaction.comments.len(), 1);

        let comment = interaction.comments.get(0).unwrap();
        assert_eq!(comment.author, user);
        assert_eq!(comment.text, comment_text);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #22)")]
    fn test_add_comment_empty_fails() {
        let (env, client, user) = create_test_env();
        env.mock_all_auths();

        // Create a greeting
        let greeting_id = 1u64;
        let text = String::from_str(&env, "Test");
        client.create_greeting(&greeting_id, &text, &user);

        // Try to add empty comment
        let empty_comment = String::from_str(&env, "");
        client.add_comment(&user, &greeting_id, &empty_comment);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #23)")]
    fn test_add_comment_too_long_fails() {
        let (env, client, user) = create_test_env();
        env.mock_all_auths();

        // Create a greeting
        let greeting_id = 1u64;
        let text = String::from_str(&env, "Test");
        client.create_greeting(&greeting_id, &text, &user);

        // Create a comment longer than 500 characters
        let long_text = "a".repeat(501);
        let long_comment = String::from_str(&env, &long_text);
        let result = client.add_comment(&user, &greeting_id, &long_comment);
    }

    #[test]
    fn test_add_comment_multiple() {
        let (env, client, user1) = create_test_env();
        env.mock_all_auths();

        let user2 = Address::generate(&env);

        // Create a greeting
        let greeting_id = 1u64;
        let text = String::from_str(&env, "Discuss this!");
        client.create_greeting(&greeting_id, &text, &user1);

        // Add multiple comments
        let comment1 = String::from_str(&env, "First comment");
        let comment2 = String::from_str(&env, "Second comment");
        let comment3 = String::from_str(&env, "Third comment");

        client.add_comment(&user1, &greeting_id, &comment1);
        client.add_comment(&user2, &greeting_id, &comment2);
        client.add_comment(&user1, &greeting_id, &comment3);

        // Verify all comments were added
        let interaction = client.get_interaction(&greeting_id);
        assert_eq!(interaction.comments.len(), 3);
        assert_eq!(interaction.comments.get(0).unwrap().text, comment1);
        assert_eq!(interaction.comments.get(1).unwrap().text, comment2);
        assert_eq!(interaction.comments.get(2).unwrap().text, comment3);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #11)")]
    fn test_add_comment_not_found() {
        let (env, client, user) = create_test_env();
        env.mock_all_auths();

        // Try to comment on non-existent greeting
        let greeting_id = 999u64;
        let comment = String::from_str(&env, "Comment");
        let result = client.add_comment(&user, &greeting_id, &comment);
    }

    #[test]
    fn test_get_interaction_empty() {
        let (env, client, user) = create_test_env();
        env.mock_all_auths();

        // Create a greeting with no interactions
        let greeting_id = 1u64;
        let text = String::from_str(&env, "No interactions yet");
        client.create_greeting(&greeting_id, &text, &user);

        // Get interaction should return empty interaction
        let interaction = client.get_interaction(&greeting_id);
        assert_eq!(interaction.greeting_id, greeting_id);
        assert_eq!(interaction.likes, 0);
        assert_eq!(interaction.liked_by.len(), 0);
        assert_eq!(interaction.comments.len(), 0);
    }

    #[test]
    fn test_get_likes_count() {
        let (env, client, user1) = create_test_env();
        env.mock_all_auths();

        let user2 = Address::generate(&env);

        // Create a greeting
        let greeting_id = 1u64;
        let text = String::from_str(&env, "Like this!");
        client.create_greeting(&greeting_id, &text, &user1);

        // Initially no likes
        let count = client.get_likes_count(&greeting_id);
        assert_eq!(count, 0);

        // Add likes
        client.like_greeting(&user1, &greeting_id);
        client.like_greeting(&user2, &greeting_id);

        // Verify count
        let count = client.get_likes_count(&greeting_id);
        assert_eq!(count, 2);
    }

    #[test]
    fn test_get_comments_count() {
        let (env, client, user) = create_test_env();
        env.mock_all_auths();

        // Create a greeting
        let greeting_id = 1u64;
        let text = String::from_str(&env, "Comment here");
        client.create_greeting(&greeting_id, &text, &user);

        // Initially no comments
        let count = client.get_comments_count(&greeting_id);
        assert_eq!(count, 0);

        // Add comments
        let comment1 = String::from_str(&env, "First");
        let comment2 = String::from_str(&env, "Second");
        client.add_comment(&user, &greeting_id, &comment1);
        client.add_comment(&user, &greeting_id, &comment2);

        // Verify count
        let count = client.get_comments_count(&greeting_id);
        assert_eq!(count, 2);
    }

    #[test]
    fn test_likes_and_comments_combined() {
        let (env, client, user1) = create_test_env();
        env.mock_all_auths();

        let user2 = Address::generate(&env);

        // Create a greeting
        let greeting_id = 1u64;
        let text = String::from_str(&env, "Engage with this!");
        client.create_greeting(&greeting_id, &text, &user1);

        // Add likes and comments
        client.like_greeting(&user1, &greeting_id);
        client.like_greeting(&user2, &greeting_id);

        let comment1 = String::from_str(&env, "Great!");
        let comment2 = String::from_str(&env, "Awesome!");
        client.add_comment(&user1, &greeting_id, &comment1);
        client.add_comment(&user2, &greeting_id, &comment2);

        // Verify both likes and comments
        let interaction = client.get_interaction(&greeting_id);
        assert_eq!(interaction.likes, 2);
        assert_eq!(interaction.comments.len(), 2);

        // Verify counts
        assert_eq!(client.get_likes_count(&greeting_id), 2);
        assert_eq!(client.get_comments_count(&greeting_id), 2);
    }

    #[test]
    fn test_create_and_get_multimedia_greeting() {
        let env = Env::default();
        let creator = Address::random(&env);
        let media_hash = Bytes::from_slice(&env, b"Qm1234567890abcdef");

        // Create greeting
        let result = GreetingSystem::create_multimedia_greeting(
            env.clone(),
            1,
            String::from_str(&env, "Hello multimedia!"),
            media_hash.clone(),
            creator.clone(),
        );
        assert!(result.is_ok());

        // Retrieve media
        let retrieved = GreetingSystem::get_greeting_media(env.clone(), 1);
        assert_eq!(retrieved.unwrap(), media_hash);
    }
}
