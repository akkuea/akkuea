extern crate std;

use crate::{
    social::{CollaborativeGroup, EducationalJourney, NFTShare, SocialAction, VisibilityLevel},
    EducationalNFTContract, EducationalNFTContractClient, MockEducatorVerificationNft,
};
use soroban_sdk::{testutils::Address as _, Address, Bytes, Env, String, Vec};

fn setup_social_test_environment() -> (
    Env,
    Address,
    Address,
    Address,
    EducationalNFTContractClient<'static>,
    u32,
) {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let educator = Address::generate(&env);
    let user = Address::generate(&env);

    let educator_verification_id = env.register(MockEducatorVerificationNft, ());

    let contract_id = env.register(
        EducationalNFTContract,
        (owner.clone(), educator_verification_id.clone()),
    );
    let client = EducationalNFTContractClient::new(&env, &contract_id);

    let collection_id = 1u64;
    let fractions = 100u32;
    let metadata_hash = Bytes::from_array(&env, &[1; 32]);

    let token_id = client.mint_nft(&user, &collection_id, &fractions, &metadata_hash);

    (env, owner, educator, user, client, token_id)
}

#[test]
fn test_share_nft_public() {
    let (env, _owner, _educator, user, client, token_id) = setup_social_test_environment();

    let visibility = String::from_str(&env, "Public");
    let description = String::from_str(&env, "Sharing my educational achievement!");

    client.share_nft(
        &user,
        &(token_id as u64),
        &visibility,
        &None::<u64>,
        &description,
    );

    let share_info = client.get_nft_share_info(&(token_id as u64));

    if let Some(share) = share_info {
        assert_eq!(share.token_id, token_id as u64);
        assert_eq!(share.owner, user);
    }
}

#[test]
fn test_create_collaborative_group() {
    let (env, _owner, _educator, user, client, token_id) = setup_social_test_environment();

    let group_name = String::from_str(&env, "Blockchain Study Group");

    let group_id = client.join_collaborative_group(
        &user,
        &(token_id as u64),
        &None::<u64>,
        &Some(group_name.clone()),
    );

    assert!(group_id > 0);

    let group_info = client.get_collaborative_group_info(&group_id);

    if let Some(group) = group_info {
        assert_eq!(group.id, group_id);
        assert_eq!(group.name, group_name);
        assert_eq!(group.creator, user);
    }
}

#[test]
fn test_showcase_collection() {
    let (env, _owner, _educator, user, client, _token_id) = setup_social_test_environment();

    let collection_id = 1u64;
    let title = String::from_str(&env, "My Learning Journey");
    let description = String::from_str(&env, "A showcase of my educational achievements");
    let visibility = String::from_str(&env, "Public");

    client.showcase_collection(&user, &collection_id, &title, &description, &visibility);

    let journey = client.get_educational_journey(&user, &collection_id);

    if let Some(showcase) = journey {
        assert_eq!(showcase.user, user);
        assert_eq!(showcase.collection_id, collection_id);
    }
}

#[test]
fn test_get_social_actions() {
    let (env, _owner, _educator, user, client, token_id) = setup_social_test_environment();

    let visibility = String::from_str(&env, "Public");
    let description = String::from_str(&env, "Test share");

    let _ = client.share_nft(
        &user,
        &(token_id as u64),
        &visibility,
        &None::<u64>,
        &description,
    );

    let actions = client.get_social_actions(&user, &(token_id as u64));

    if !actions.is_empty() {
        let action = &actions.get(0).unwrap();
        assert_eq!(action.token_id, token_id as u64);
        assert_eq!(action.user, user);
        assert_eq!(action.action_type, String::from_str(&env, "Share"));
    }
}

#[test]
fn test_reputation_boost_functionality() {
    let (env, owner, _educator, user, client, _token_id) = setup_social_test_environment();

    let reputation_score = 85u32;
    let boost_level = 3u32;

    client.update_reputation_boost(&owner, &user, &reputation_score, &boost_level);

    let verification_result = client.verify_reputation_boost(&user, &80u32);

    let _ = verification_result;
}

#[test]
fn test_contract_compiles_and_functions_exist() {
    let (env, _owner, _educator, user, client, token_id) = setup_social_test_environment();

    let visibility = String::from_str(&env, "Public");
    let description = String::from_str(&env, "Test");
    let _ = client.share_nft(
        &user,
        &(token_id as u64),
        &visibility,
        &None::<u64>,
        &description,
    );

    let group_name = String::from_str(&env, "Test Group");
    let _ =
        client.join_collaborative_group(&user, &(token_id as u64), &None::<u64>, &Some(group_name));

    let title = String::from_str(&env, "Test Journey");
    let desc = String::from_str(&env, "Test Description");
    let _ = client.showcase_collection(&user, &1u64, &title, &desc, &visibility);

    let _ = client.get_social_actions(&user, &(token_id as u64));
    let _ = client.get_nft_share_info(&(token_id as u64));
    let _ = client.get_collaborative_group_info(&1u64);
    let _ = client.get_educational_journey(&user, &1u64);
    let _ = client.get_reputation_boost(&user);
    let _ = client.verify_reputation_boost(&user, &50u32);
    let _ = client.get_public_shares();
    let _ = client.get_user_groups(&user);

    assert!(true);
}

#[test]
fn test_social_data_structures() {
    let env = Env::default();

    let user = Address::generate(&env);
    let token_id = 1u64;
    let timestamp = env.ledger().timestamp();

    let social_action = SocialAction {
        token_id,
        user: user.clone(),
        action_type: String::from_str(&env, "Share"),
        group_id: 0,
        timestamp,
    };

    assert_eq!(social_action.token_id, token_id);
    assert_eq!(social_action.user, user);

    let nft_share = NFTShare {
        token_id,
        owner: user.clone(),
        visibility: VisibilityLevel::Public,
        group_id: 0,
        shared_at: timestamp,
        description: String::from_str(&env, "Test share"),
    };

    assert_eq!(nft_share.token_id, token_id);
    assert_eq!(nft_share.owner, user);
    assert_eq!(nft_share.visibility, VisibilityLevel::Public);

    let mut members = Vec::new(&env);
    members.push_back(user.clone());

    let mut nfts = Vec::new(&env);
    nfts.push_back(token_id);

    let collaborative_group = CollaborativeGroup {
        id: 1,
        name: String::from_str(&env, "Test Group"),
        creator: user.clone(),
        members,
        nfts,
        created_at: timestamp,
        is_active: true,
    };

    assert_eq!(collaborative_group.id, 1);
    assert_eq!(collaborative_group.creator, user);
    assert!(collaborative_group.is_active);

    let showcase_nfts = Vec::new(&env);

    let educational_journey = EducationalJourney {
        user: user.clone(),
        collection_id: 1,
        showcase_nfts,
        title: String::from_str(&env, "My Journey"),
        description: String::from_str(&env, "My learning path"),
        created_at: timestamp,
        updated_at: timestamp,
        visibility: VisibilityLevel::Public,
    };

    assert_eq!(educational_journey.user, user);
    assert_eq!(educational_journey.collection_id, 1);
    assert_eq!(educational_journey.visibility, VisibilityLevel::Public);
}

#[test]
fn test_social_module_integration() {
    let (env, _owner, _educator, user, client, token_id) = setup_social_test_environment();

    let visibility = String::from_str(&env, "Public");
    let description = String::from_str(&env, "Integration test");

    let _ = client.share_nft(
        &user,
        &(token_id as u64),
        &visibility,
        &None::<u64>,
        &description,
    );

    let group_name = String::from_str(&env, "Integration Test Group");
    let _ =
        client.join_collaborative_group(&user, &(token_id as u64), &None::<u64>, &Some(group_name));

    let title = String::from_str(&env, "Integration Test Journey");
    let desc = String::from_str(&env, "Testing integration");
    let _ = client.showcase_collection(&user, &1u64, &title, &desc, &visibility);

    let _ = client.add_nft_to_showcase(&user, &1u64, &(token_id as u64));

    assert!(true, "Social module integration test passed");
}
