#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};

use crate::{xlm_to_stroops, GreetingSystem, GreetingSystemClient, TierLevel};

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
    let err = client.try_register_user(&user, &name, &prefs);
    assert!(err.is_err());
}

#[test]
fn test_stress_register_many_users() {
    let (env, client, _user) = create_test_env();
    env.mock_all_auths();

    let total = 1000u32;
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
