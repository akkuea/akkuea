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
    assert_eq!(calculate_accrued_income(EPOCH_LENGTH - 1, 0, LEVEL_RESIDENTIAL), 0);
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
