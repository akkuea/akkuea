use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env,
};

use crate::{GamePropertyNft, GamePropertyNftClient, NftError, TOTAL_TILES};

fn setup() -> (Env, Address, Address, GamePropertyNftClient<'static>) {
    let env = Env::default();
    env.cost_estimate().budget().reset_unlimited();
    env.mock_all_auths();

    let treasury = Address::generate(&env);
    let game_engine = Address::generate(&env);

    let contract_id = env.register(GamePropertyNft, ());
    let client = GamePropertyNftClient::new(&env, &contract_id);

    (env, treasury, game_engine, client)
}

fn initialized() -> (Env, Address, Address, GamePropertyNftClient<'static>) {
    let (env, treasury, game_engine, client) = setup();
    client.initialize(&treasury, &game_engine);
    (env, treasury, game_engine, client)
}

#[test]
fn test_initialize_mints_all_400_properties() {
    let (_env, treasury, _game_engine, client) = initialized();

    assert_eq!(client.list_by_owner(&treasury).len(), TOTAL_TILES);
    for id in 0..TOTAL_TILES {
        assert_eq!(client.get_owner(&id), treasury);
    }
}

#[test]
fn test_transfer_from_treasury_succeeds() {
    let (env, treasury, _game_engine, client) = initialized();
    let buyer = Address::generate(&env);

    client.transfer(&treasury, &buyer, &0);
    assert_eq!(client.get_owner(&0), buyer);

    // Verify it updates list_by_owner
    let buyer_owned = client.list_by_owner(&buyer);
    assert_eq!(buyer_owned.len(), 1);
    assert_eq!(buyer_owned.get(0).unwrap(), 0);

    let treasury_owned = client.list_by_owner(&treasury);
    assert_eq!(treasury_owned.len(), TOTAL_TILES - 1);
}

#[test]
fn test_transfer_fails_if_not_owner() {
    let (env, _treasury, _game_engine, client) = initialized();
    let attacker = Address::generate(&env);
    let to = Address::generate(&env);

    let result = client.try_transfer(&attacker, &to, &0);
    assert_eq!(result, Err(Ok(NftError::NotOwner.into())));
}

#[test]
fn test_approve_then_transfer_from_succeeds() {
    let (env, treasury, _game_engine, client) = initialized();
    let spender = Address::generate(&env);
    let buyer = Address::generate(&env);

    client.approve(&treasury, &spender, &10);

    // Verify spender is returned in get_property
    let prop = client.get_property(&10);
    assert_eq!(prop.approved, Some(spender.clone()));

    client.transfer_from(&spender, &treasury, &buyer, &10);
    assert_eq!(client.get_owner(&10), buyer);

    // Verify approval cleared
    let prop_after = client.get_property(&10);
    assert_eq!(prop_after.approved, None);
}

#[test]
fn test_transfer_from_fails_without_approval() {
    let (env, treasury, _game_engine, client) = initialized();
    let non_approved = Address::generate(&env);
    let buyer = Address::generate(&env);

    let result = client.try_transfer_from(&non_approved, &treasury, &buyer, &10);
    assert_eq!(result, Err(Ok(NftError::NotApproved.into())));
}

#[test]
fn test_set_improvement_level_fails_if_not_game_engine() {
    let (env, _treasury, _game_engine, client) = initialized();
    let attacker = Address::generate(&env);

    let result = client.try_set_improvement_level(&attacker, &0, &1);
    assert_eq!(result, Err(Ok(NftError::Unauthorized.into())));
}

#[test]
fn test_set_improvement_level_succeeds_for_game_engine() {
    let (_env, _treasury, game_engine, client) = initialized();

    client.set_improvement_level(&game_engine, &0, &2);
    let prop = client.get_property(&0);
    assert_eq!(prop.level, 2);
}

#[test]
fn test_set_last_claimed_ledger_fails_if_not_game_engine() {
    let (env, _treasury, _game_engine, client) = initialized();
    let attacker = Address::generate(&env);

    let result = client.try_set_last_claimed_ledger(&attacker, &0, &12345);
    assert_eq!(result, Err(Ok(NftError::Unauthorized.into())));
}

#[test]
fn test_set_last_claimed_ledger_succeeds_for_game_engine() {
    let (_env, _treasury, game_engine, client) = initialized();

    client.set_last_claimed_ledger(&game_engine, &0, &12345);
    let prop = client.get_property(&0);
    assert_eq!(prop.last_claimed_ledger, 12345);
}

#[test]
fn test_pause_blocks_transfer() {
    let (env, treasury, _game_engine, client) = initialized();
    let buyer = Address::generate(&env);

    client.pause(&treasury);

    let result = client.try_transfer(&treasury, &buyer, &0);
    assert_eq!(result, Err(Ok(NftError::ContractPaused.into())));

    // Unpause resumes
    client.unpause(&treasury);
    client.transfer(&treasury, &buyer, &0);
    assert_eq!(client.get_owner(&0), buyer);
}

#[test]
fn test_pause_unpause_non_owner_fails() {
    let (env, _treasury, _game_engine, client) = initialized();
    let attacker = Address::generate(&env);

    let result = client.try_pause(&attacker);
    assert_eq!(result, Err(Ok(NftError::Unauthorized.into())));
}

#[test]
fn test_get_property_invalid_id() {
    let (_env, _treasury, _game_engine, client) = initialized();

    let result = client.try_get_property(&400);
    assert_eq!(result, Err(Ok(NftError::InvalidProperty.into())));
}

#[test]
fn test_set_last_claimed_ledger_rejects_invalid_property_id() {
    let (_env, _treasury, game_engine, client) = initialized();

    let at_bound = client.try_set_last_claimed_ledger(&game_engine, &TOTAL_TILES, &500);
    assert_eq!(at_bound, Err(Ok(NftError::InvalidProperty.into())));

    let above_bound = client.try_set_last_claimed_ledger(&game_engine, &u32::MAX, &500);
    assert_eq!(above_bound, Err(Ok(NftError::InvalidProperty.into())));
}

#[test]
fn test_set_last_claimed_ledger_keeps_level_zero_on_untouched_tile() {
    let (env, treasury, game_engine, client) = setup();
    env.ledger().with_mut(|li| {
        li.sequence_number = 250;
    });
    client.initialize(&treasury, &game_engine);

    let before = client.get_property(&7);
    assert_eq!(before.level, 0);
    assert_eq!(before.last_claimed_ledger, 250);

    client.set_last_claimed_ledger(&game_engine, &7, &600);
    let after = client.get_property(&7);
    assert_eq!(after.level, 0);
    assert_eq!(after.last_claimed_ledger, 600);
}

#[test]
fn test_transfer_and_transfer_from_checkpoint_rent_and_preserve_level() {
    let (env, treasury, game_engine, client) = setup();
    env.ledger().with_mut(|li| {
        li.sequence_number = 100;
    });
    client.initialize(&treasury, &game_engine);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let spender = Address::generate(&env);

    // Upgrade tile 3 while in treasury, then age 500 ledgers and transfer.
    client.set_improvement_level(&game_engine, &3, &2);
    env.ledger().with_mut(|li| {
        li.sequence_number = 600;
    });
    client.transfer(&treasury, &alice, &3);

    let after_direct = client.get_property(&3);
    assert_eq!(after_direct.owner, alice);
    assert_eq!(after_direct.level, 2);
    assert_eq!(after_direct.last_claimed_ledger, 600);

    // Age another 400 ledgers and transfer via approved spender.
    client.set_improvement_level(&game_engine, &3, &3);
    client.approve(&alice, &spender, &3);
    env.ledger().with_mut(|li| {
        li.sequence_number = 1000;
    });
    client.transfer_from(&spender, &alice, &bob, &3);

    let after_approved = client.get_property(&3);
    assert_eq!(after_approved.owner, bob);
    assert_eq!(after_approved.level, 3);
    assert_eq!(after_approved.last_claimed_ledger, 1000);
    assert_eq!(after_approved.approved, None);
}
