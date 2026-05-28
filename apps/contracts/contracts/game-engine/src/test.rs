use soroban_sdk::{contract, contractimpl, contracttype, testutils::Address as _, Address, Env};

use crate::constants::*;
use crate::errors::EngineError;
use crate::{GameEngine, GameEngineClient};

// ===========================================================================
// Mock PropertyNFT contract
// ===========================================================================

#[contracttype]
#[derive(Clone)]
enum MockNftKey {
    Owner(u32),
    Level(u32),
    LastClaimed(u32),
}

#[contract]
pub struct MockPropertyNFT;

#[contractimpl]
impl MockPropertyNFT {
    /// Test helper: set up a property with an owner.
    pub fn setup(env: Env, property_id: u32, owner: Address, last_claimed_ledger: u64) {
        env.storage()
            .instance()
            .set(&MockNftKey::Owner(property_id), &owner);
        env.storage()
            .instance()
            .set(&MockNftKey::Level(property_id), &LEVEL_VACANT);
        env.storage()
            .instance()
            .set(&MockNftKey::LastClaimed(property_id), &last_claimed_ledger);
    }

    pub fn get_owner(env: Env, property_id: u32) -> Address {
        env.storage()
            .instance()
            .get(&MockNftKey::Owner(property_id))
            .unwrap()
    }

    pub fn get_level(env: Env, property_id: u32) -> u32 {
        env.storage()
            .instance()
            .get(&MockNftKey::Level(property_id))
            .unwrap_or(LEVEL_VACANT)
    }

    pub fn get_last_claimed_ledger(env: Env, property_id: u32) -> u64 {
        env.storage()
            .instance()
            .get(&MockNftKey::LastClaimed(property_id))
            .unwrap_or(0)
    }

    pub fn set_improvement_level(env: Env, _caller: Address, property_id: u32, level: u32) {
        env.storage()
            .instance()
            .set(&MockNftKey::Level(property_id), &level);
    }

    pub fn set_last_claimed_ledger(env: Env, _caller: Address, property_id: u32, ledger: u64) {
        env.storage()
            .instance()
            .set(&MockNftKey::LastClaimed(property_id), &ledger);
    }
}

// ===========================================================================
// Mock LandToken contract
// ===========================================================================

#[contracttype]
#[derive(Clone)]
enum MockTokenKey {
    Balance(Address),
}

#[contract]
pub struct MockLandToken;

#[contractimpl]
impl MockLandToken {
    /// Test helper: give an address some tokens.
    pub fn fund(env: Env, to: Address, amount: i128) {
        let balance = Self::balance(env.clone(), to.clone());
        env.storage()
            .instance()
            .set(&MockTokenKey::Balance(to), &(balance + amount));
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let balance = Self::balance(env.clone(), to.clone());
        env.storage()
            .instance()
            .set(&MockTokenKey::Balance(to), &(balance + amount));
    }

    pub fn burn_from(env: Env, _spender: Address, from: Address, amount: i128) {
        let balance = Self::balance(env.clone(), from.clone());
        assert!(balance >= amount, "insufficient balance");
        env.storage()
            .instance()
            .set(&MockTokenKey::Balance(from), &(balance - amount));
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage()
            .instance()
            .get(&MockTokenKey::Balance(id))
            .unwrap_or(0)
    }
}

// ===========================================================================
// Test helpers
// ===========================================================================

struct TestSetup {
    env: Env,
    engine: GameEngineClient<'static>,
    nft_id: Address,
    token_id: Address,
    owner: Address,
    non_owner: Address,
}

fn setup() -> TestSetup {
    let env = Env::default();
    env.mock_all_auths();

    let nft_id = env.register(MockPropertyNFT, ());
    let token_id = env.register(MockLandToken, ());
    let engine_id = env.register(GameEngine, ());

    let treasury = Address::generate(&env);
    let owner = Address::generate(&env);
    let non_owner = Address::generate(&env);

    let engine = GameEngineClient::new(&env, &engine_id);
    engine.initialize(&nft_id, &token_id, &treasury);

    // Set up property 0, owned by `owner`, last claimed at ledger 0.
    let nft_client = MockPropertyNFTClient::new(&env, &nft_id);
    nft_client.setup(&0u32, &owner, &0u64);

    // Fund the owner with enough LAND for all upgrades.
    let token_client = MockLandTokenClient::new(&env, &token_id);
    let total_cost = IMPROVEMENT_COST_RESIDENTIAL + IMPROVEMENT_COST_COMMERCIAL + IMPROVEMENT_COST_SKYSCRAPER;
    token_client.fund(&owner, &total_cost);

    TestSetup {
        env,
        engine,
        nft_id,
        token_id,
        owner,
        non_owner,
    }
}

fn get_balance(env: &Env, token_id: &Address, who: &Address) -> i128 {
    MockLandTokenClient::new(env, token_id).balance(who)
}

fn get_level(env: &Env, nft_id: &Address, property_id: u32) -> u32 {
    MockPropertyNFTClient::new(env, nft_id).get_level(&property_id)
}

fn get_last_claimed(env: &Env, nft_id: &Address, property_id: u32) -> u64 {
    MockPropertyNFTClient::new(env, nft_id).get_last_claimed_ledger(&property_id)
}

// ===========================================================================
// Improve tests
// ===========================================================================

#[test]
fn improve_vacant_to_residential_succeeds() {
    let t = setup();

    let before = get_balance(&t.env, &t.token_id, &t.owner);
    t.engine.improve(&t.owner, &0u32);
    let after = get_balance(&t.env, &t.token_id, &t.owner);

    assert_eq!(get_level(&t.env, &t.nft_id, 0), LEVEL_RESIDENTIAL);
    assert_eq!(before - after, IMPROVEMENT_COST_RESIDENTIAL);
}

#[test]
fn improve_residential_to_commercial_succeeds() {
    let t = setup();

    t.engine.improve(&t.owner, &0u32); // Vacant → Residential

    let before = get_balance(&t.env, &t.token_id, &t.owner);
    t.engine.improve(&t.owner, &0u32); // Residential → Commercial
    let after = get_balance(&t.env, &t.token_id, &t.owner);

    assert_eq!(get_level(&t.env, &t.nft_id, 0), LEVEL_COMMERCIAL);
    assert_eq!(before - after, IMPROVEMENT_COST_COMMERCIAL);
}

#[test]
fn improve_commercial_to_skyscraper_succeeds() {
    let t = setup();

    t.engine.improve(&t.owner, &0u32); // Vacant → Residential
    t.engine.improve(&t.owner, &0u32); // Residential → Commercial

    let before = get_balance(&t.env, &t.token_id, &t.owner);
    t.engine.improve(&t.owner, &0u32); // Commercial → Skyscraper
    let after = get_balance(&t.env, &t.token_id, &t.owner);

    assert_eq!(get_level(&t.env, &t.nft_id, 0), LEVEL_SKYSCRAPER);
    assert_eq!(before - after, IMPROVEMENT_COST_SKYSCRAPER);
}

#[test]
fn improve_deducts_correct_cost() {
    let t = setup();

    let initial = get_balance(&t.env, &t.token_id, &t.owner);

    t.engine.improve(&t.owner, &0u32); // Vacant → Residential
    t.engine.improve(&t.owner, &0u32); // Residential → Commercial
    t.engine.improve(&t.owner, &0u32); // Commercial → Skyscraper

    let final_balance = get_balance(&t.env, &t.token_id, &t.owner);
    let total_spent = initial - final_balance;
    let expected = IMPROVEMENT_COST_RESIDENTIAL + IMPROVEMENT_COST_COMMERCIAL + IMPROVEMENT_COST_SKYSCRAPER;

    assert_eq!(total_spent, expected);
    assert_eq!(final_balance, 0); // funded exactly enough
}

#[test]
fn improve_skyscraper_fails_already_max() {
    let t = setup();

    t.engine.improve(&t.owner, &0u32);
    t.engine.improve(&t.owner, &0u32);
    t.engine.improve(&t.owner, &0u32);

    assert_eq!(get_level(&t.env, &t.nft_id, 0), LEVEL_SKYSCRAPER);

    let result = t.engine.try_improve(&t.owner, &0u32);
    assert_eq!(result, Err(Ok(EngineError::AlreadyMaxLevel)));
}

#[test]
fn improve_fails_if_not_owner() {
    let t = setup();

    let result = t.engine.try_improve(&t.non_owner, &0u32);
    assert_eq!(result, Err(Ok(EngineError::NotOwner)));

    // Level unchanged.
    assert_eq!(get_level(&t.env, &t.nft_id, 0), LEVEL_VACANT);
}

// ===========================================================================
// Claim rental tests
// ===========================================================================

#[test]
fn claim_rental_vacant_property() {
    let t = setup();

    // Advance 200 ledgers = 2 epochs for a vacant property.
    t.env.ledger().with_mut(|li| {
        li.sequence_number = 200;
    });

    let before = get_balance(&t.env, &t.token_id, &t.owner);
    t.engine.claim_rental(&t.owner, &0u32);
    let after = get_balance(&t.env, &t.token_id, &t.owner);

    // Vacant: 1/1 multiplier, 2 epochs, 10 LAND base = 20 LAND.
    let expected = BASE_RENTAL_RATE * 2;
    assert_eq!(after - before, expected);
}

#[test]
fn claim_rental_residential_multiplier() {
    let t = setup();

    // Upgrade to residential first.
    t.engine.improve(&t.owner, &0u32);

    // Reset last claimed to 0 for clean test.
    MockPropertyNFTClient::new(&t.env, &t.nft_id)
        .set_last_claimed_ledger(&t.owner, &0u32, &0u64);

    // Advance 100 ledgers = 1 epoch.
    t.env.ledger().with_mut(|li| {
        li.sequence_number = 100;
    });

    let before = get_balance(&t.env, &t.token_id, &t.owner);
    t.engine.claim_rental(&t.owner, &0u32);
    let after = get_balance(&t.env, &t.token_id, &t.owner);

    // Residential: 3/2 multiplier, 1 epoch = 10 * 3/2 = 15 LAND.
    let expected = BASE_RENTAL_RATE * 3 / 2;
    assert_eq!(after - before, expected);
}

#[test]
fn claim_rental_commercial_multiplier() {
    let t = setup();

    t.engine.improve(&t.owner, &0u32); // Residential
    t.engine.improve(&t.owner, &0u32); // Commercial

    MockPropertyNFTClient::new(&t.env, &t.nft_id)
        .set_last_claimed_ledger(&t.owner, &0u32, &0u64);

    t.env.ledger().with_mut(|li| {
        li.sequence_number = 100;
    });

    let before = get_balance(&t.env, &t.token_id, &t.owner);
    t.engine.claim_rental(&t.owner, &0u32);
    let after = get_balance(&t.env, &t.token_id, &t.owner);

    // Commercial: 3/1 multiplier, 1 epoch = 10 * 3 = 30 LAND.
    let expected = BASE_RENTAL_RATE * 3;
    assert_eq!(after - before, expected);
}

#[test]
fn claim_rental_skyscraper_multiplier() {
    let t = setup();

    t.engine.improve(&t.owner, &0u32); // Residential
    t.engine.improve(&t.owner, &0u32); // Commercial
    t.engine.improve(&t.owner, &0u32); // Skyscraper

    MockPropertyNFTClient::new(&t.env, &t.nft_id)
        .set_last_claimed_ledger(&t.owner, &0u32, &0u64);

    t.env.ledger().with_mut(|li| {
        li.sequence_number = 100;
    });

    let before = get_balance(&t.env, &t.token_id, &t.owner);
    t.engine.claim_rental(&t.owner, &0u32);
    let after = get_balance(&t.env, &t.token_id, &t.owner);

    // Skyscraper: 6/1 multiplier, 1 epoch = 10 * 6 = 60 LAND.
    let expected = BASE_RENTAL_RATE * 6;
    assert_eq!(after - before, expected);
}

#[test]
fn claim_rental_fails_if_not_owner() {
    let t = setup();

    t.env.ledger().with_mut(|li| {
        li.sequence_number = 200;
    });

    let result = t.engine.try_claim_rental(&t.non_owner, &0u32);
    assert_eq!(result, Err(Ok(EngineError::NotOwner)));
}

#[test]
fn claim_rental_fails_nothing_to_claim() {
    let t = setup();

    // Ledger is 0, last claimed is 0 → 0 epochs → nothing to claim.
    let result = t.engine.try_claim_rental(&t.owner, &0u32);
    assert_eq!(result, Err(Ok(EngineError::NothingToClaim)));
}

#[test]
fn claim_rental_partial_epoch_earns_nothing() {
    let t = setup();

    // Advance 99 ledgers (< 1 epoch of 100).
    t.env.ledger().with_mut(|li| {
        li.sequence_number = 99;
    });

    let result = t.engine.try_claim_rental(&t.owner, &0u32);
    assert_eq!(result, Err(Ok(EngineError::NothingToClaim)));
}

#[test]
fn rental_accumulates_across_multiple_epochs() {
    let t = setup();

    // Advance 500 ledgers = 5 epochs.
    t.env.ledger().with_mut(|li| {
        li.sequence_number = 500;
    });

    let before = get_balance(&t.env, &t.token_id, &t.owner);
    t.engine.claim_rental(&t.owner, &0u32);
    let after = get_balance(&t.env, &t.token_id, &t.owner);

    // Vacant: 5 epochs × 10 LAND = 50 LAND.
    let expected = BASE_RENTAL_RATE * 5;
    assert_eq!(after - before, expected);
}

#[test]
fn claim_preserves_fractional_epoch_carry() {
    let t = setup();

    // Advance 250 ledgers = 2 full epochs + 50 leftover.
    t.env.ledger().with_mut(|li| {
        li.sequence_number = 250;
    });

    t.engine.claim_rental(&t.owner, &0u32);

    // last_claimed should be 200 (2 epochs × 100), not 250.
    let last_claimed = get_last_claimed(&t.env, &t.nft_id, 0);
    assert_eq!(last_claimed, 200);

    // Advance to 350: 150 ledgers from last claim (200), = 1 full epoch + 50 leftover.
    t.env.ledger().with_mut(|li| {
        li.sequence_number = 350;
    });

    let before = get_balance(&t.env, &t.token_id, &t.owner);
    t.engine.claim_rental(&t.owner, &0u32);
    let after = get_balance(&t.env, &t.token_id, &t.owner);

    assert_eq!(after - before, BASE_RENTAL_RATE); // 1 epoch
    assert_eq!(get_last_claimed(&t.env, &t.nft_id, 0), 300);
}

// ===========================================================================
// get_accrued_income tests
// ===========================================================================

#[test]
fn get_accrued_income_returns_correct_amount() {
    let t = setup();

    t.env.ledger().with_mut(|li| {
        li.sequence_number = 300;
    });

    let income = t.engine.get_accrued_income(&0u32);

    // Vacant, 3 epochs, 10 LAND base = 30 LAND.
    assert_eq!(income, BASE_RENTAL_RATE * 3);
}

#[test]
fn get_accrued_income_zero_for_partial_epoch() {
    let t = setup();

    t.env.ledger().with_mut(|li| {
        li.sequence_number = 50;
    });

    let income = t.engine.get_accrued_income(&0u32);
    assert_eq!(income, 0);
}

#[test]
fn get_accrued_income_reflects_improvement_level() {
    let t = setup();

    t.engine.improve(&t.owner, &0u32); // Upgrade to Residential

    MockPropertyNFTClient::new(&t.env, &t.nft_id)
        .set_last_claimed_ledger(&t.owner, &0u32, &0u64);

    t.env.ledger().with_mut(|li| {
        li.sequence_number = 200;
    });

    let income = t.engine.get_accrued_income(&0u32);

    // Residential: 3/2 multiplier, 2 epochs = 10 * 3/2 * 2 = 30 LAND.
    assert_eq!(income, BASE_RENTAL_RATE * 3 / 2 * 2);
}

// ===========================================================================
// Initialize tests
// ===========================================================================

#[test]
fn initialize_twice_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let nft_id = env.register(MockPropertyNFT, ());
    let token_id = env.register(MockLandToken, ());
    let engine_id = env.register(GameEngine, ());
    let treasury = Address::generate(&env);

    let engine = GameEngineClient::new(&env, &engine_id);
    engine.initialize(&nft_id, &token_id, &treasury);

    let result = engine.try_initialize(&nft_id, &token_id, &treasury);
    assert_eq!(result, Err(Ok(EngineError::AlreadyInitialized)));
}

// ===========================================================================
// Unit tests for calculate_accrued_income
// ===========================================================================

#[test]
fn accrued_income_formula_vacant() {
    assert_eq!(calculate_accrued_income(100, 0, LEVEL_VACANT), BASE_RENTAL_RATE);
    assert_eq!(calculate_accrued_income(500, 0, LEVEL_VACANT), BASE_RENTAL_RATE * 5);
    assert_eq!(calculate_accrued_income(99, 0, LEVEL_VACANT), 0);
    assert_eq!(calculate_accrued_income(0, 0, LEVEL_VACANT), 0);
}

#[test]
fn accrued_income_formula_residential() {
    // 1 epoch: 10 * 3/2 = 15 LAND
    assert_eq!(
        calculate_accrued_income(100, 0, LEVEL_RESIDENTIAL),
        BASE_RENTAL_RATE * 3 / 2
    );
}

#[test]
fn accrued_income_formula_commercial() {
    // 1 epoch: 10 * 3/1 = 30 LAND
    assert_eq!(
        calculate_accrued_income(100, 0, LEVEL_COMMERCIAL),
        BASE_RENTAL_RATE * 3
    );
}

#[test]
fn accrued_income_formula_skyscraper() {
    // 1 epoch: 10 * 6/1 = 60 LAND
    assert_eq!(
        calculate_accrued_income(100, 0, LEVEL_SKYSCRAPER),
        BASE_RENTAL_RATE * 6
    );
}

#[test]
fn accrued_income_no_negative_when_current_less_than_last() {
    assert_eq!(calculate_accrued_income(50, 100, LEVEL_VACANT), 0);
}
