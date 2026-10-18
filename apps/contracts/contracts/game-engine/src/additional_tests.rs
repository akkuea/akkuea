//! Additional unit tests for the `game-engine` contract (issue #1014).
//!
//! These complement the existing in-crate `tests` module by covering paths it
//! did not exercise:
//! - `GameEngine::initialize` rejecting a second call with
//!   `EngineError::AlreadyInitialized` (the one public entry point whose error
//!   path had no coverage).
//! - Direct branch coverage for the pure `calculate_accrued_income` helper: the
//!   early return when no time has passed, a sub-epoch elapse, the vacant
//!   multiplier, an unknown level (which defaults to vacant), and monotonic
//!   growth of income across improvement levels.
//! - Regression coverage for issue #1014: upgrades must settle income at the
//!   old level, and partial epochs must carry over between claims.

use crate::constants::*;
use crate::{calculate_accrued_income, EngineError, GameEngine, GameEngineClient};
use soroban_sdk::{testutils::Address as _, Address, Env};

// ---------------- Pure helper: calculate_accrued_income ----------------

#[test]
fn accrued_income_is_zero_when_no_time_has_passed() {
    // current_ledger < last_claimed_ledger
    assert_eq!(calculate_accrued_income(50, 100, LEVEL_RESIDENTIAL), 0);
    // current_ledger == last_claimed_ledger
    assert_eq!(calculate_accrued_income(100, 100, LEVEL_RESIDENTIAL), 0);
}

#[test]
fn accrued_income_is_zero_for_a_partial_epoch() {
    // Strictly less than one full epoch has elapsed.
    assert_eq!(
        calculate_accrued_income(EPOCH_LENGTH - 1, 0, LEVEL_RESIDENTIAL),
        0
    );
}

#[test]
fn accrued_income_uses_vacant_multiplier() {
    let income = calculate_accrued_income(EPOCH_LENGTH, 0, LEVEL_VACANT);
    let (num, den) = MULTIPLIER_VACANT;
    assert_eq!(income, BASE_RENTAL_RATE * num / den);
}

#[test]
fn accrued_income_unknown_level_defaults_to_vacant() {
    let unknown_level: u32 = 99;
    let income = calculate_accrued_income(EPOCH_LENGTH, 0, unknown_level);
    let (num, den) = MULTIPLIER_VACANT;
    assert_eq!(income, BASE_RENTAL_RATE * num / den);
}

#[test]
fn accrued_income_grows_with_improvement_level() {
    let vacant = calculate_accrued_income(EPOCH_LENGTH, 0, LEVEL_VACANT);
    let residential = calculate_accrued_income(EPOCH_LENGTH, 0, LEVEL_RESIDENTIAL);
    let commercial = calculate_accrued_income(EPOCH_LENGTH, 0, LEVEL_COMMERCIAL);
    let skyscraper = calculate_accrued_income(EPOCH_LENGTH, 0, LEVEL_SKYSCRAPER);

    assert!(residential >= vacant);
    assert!(commercial >= residential);
    assert!(skyscraper >= commercial);
}

// ---------------- Contract: upgrade settlement (issue #1014) ----------------

#[test]
fn upgrade_does_not_retroactively_apply_new_multiplier() {
    let env = Env::default();
    env.mock_all_auths();

    let nft = Address::generate(&env);
    let token = Address::generate(&env);
    let treasury = Address::generate(&env);

    let engine_id = env.register(GameEngine, ());
    let engine_client = GameEngineClient::new(&env, &engine_id);
    engine_client.initialize(&nft, &token, &treasury);

    // 10 full epochs elapse while the tile is vacant.
    env.ledger().set_sequence_number(10 * EPOCH_LENGTH);
    let (vacant_num, vacant_den) = MULTIPLIER_VACANT;
    let vacant_income = BASE_RENTAL_RATE * vacant_num / vacant_den * 10;
    assert_eq!(engine_client.get_accrued_income(&0), vacant_income);

    // Upgrade three times in the same ledger (vacant -> residential ->
    // commercial -> skyscraper). The pre-upgrade period must stay valued at
    // the vacant rate.
    engine_client.improve(&0);
    engine_client.improve(&0);
    engine_client.improve(&0);

    assert_eq!(engine_client.get_accrued_income(&0), vacant_income);
}

// ---------------- Contract: partial epochs on claim (issue #1014) ----------------

#[test]
fn claim_keeps_partial_epoch_for_next_claim() {
    let env = Env::default();
    env.mock_all_auths();

    let nft = Address::generate(&env);
    let token = Address::generate(&env);
    let treasury = Address::generate(&env);

    let engine_id = env.register(GameEngine, ());
    let engine_client = GameEngineClient::new(&env, &engine_id);
    engine_client.initialize(&nft, &token, &treasury);

    // Claim at a non-aligned ledger: 199 pays exactly one epoch.
    env.ledger().set_sequence_number(199);
    let (num, den) = MULTIPLIER_VACANT;
    let one_epoch = BASE_RENTAL_RATE * num / den;
    assert_eq!(engine_client.claim_rental(&0), one_epoch);

    // At ledger 200 a second full epoch has elapsed and must be claimable.
    env.ledger().set_sequence_number(200);
    assert_eq!(engine_client.get_accrued_income(&0), one_epoch);
    assert_eq!(engine_client.claim_rental(&0), one_epoch);
}

#[test]
fn multiple_unaligned_claims_sum_to_single_claim() {
    let env = Env::default();
    env.mock_all_auths();

    let nft = Address::generate(&env);
    let token = Address::generate(&env);
    let treasury = Address::generate(&env);

    let engine_id = env.register(GameEngine, ());
    let engine_client = GameEngineClient::new(&env, &engine_id);
    engine_client.initialize(&nft, &token, &treasury);

    let (num, den) = MULTIPLIER_VACANT;
    let one_epoch = BASE_RENTAL_RATE * num / den;

    // Three claims at non-aligned ledgers: 199, 350, 500.
    env.ledger().set_sequence_number(199);
    let first = engine_client.claim_rental(&0);
    env.ledger().set_sequence_number(350);
    let second = engine_client.claim_rental(&0);
    env.ledger().set_sequence_number(500);
    let third = engine_client.claim_rental(&0);

    // 500 ledgers = 5 full epochs, regardless of claim boundaries.
    assert_eq!(first + second + third, one_epoch * 5);
}

// ---------------- Contract: initialize error path ----------------

#[test]
fn double_initialize_fails_with_already_initialized() {
    let env = Env::default();

    let nft = Address::generate(&env);
    let token = Address::generate(&env);
    let treasury = Address::generate(&env);

    let engine_id = env.register(GameEngine, ());
    let engine_client = GameEngineClient::new(&env, &engine_id);

    // First initialization succeeds.
    engine_client.initialize(&nft, &token, &treasury);

    // A second initialization must fail with AlreadyInitialized.
    let res = engine_client.try_initialize(&nft, &token, &treasury);
    assert_eq!(res, Err(Ok(EngineError::AlreadyInitialized.into())));
}
