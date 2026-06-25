#![no_std]
#![allow(deprecated)]

extern crate alloc;

use soroban_sdk::{
    contract, contracterror, contractimpl, panic_with_error, symbol_short, Address, Env,
};

pub mod constants;
pub mod cougr_core;

use constants::*;
use cougr_core::app::{named_system, GameApp, ScheduleStage};
// Define PropertyState structure for cross-contract communication
#[soroban_sdk::contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PropertyState {
    pub id: u32,
    pub x: u32,
    pub y: u32,
    pub owner: Address,
    pub level: u32,
    pub last_claimed_ledger: u64,
    pub approved: Option<Address>,
}

// Declare local contract client traits to avoid linking compile dependencies
#[soroban_sdk::contractclient(name = "GamePropertyNftClient")]
pub trait GamePropertyNft {
    fn initialize(env: Env, treasury: Address, game_engine: Address);
    fn transfer(env: Env, from: Address, to: Address, property_id: u32);
    fn get_property(env: Env, property_id: u32) -> PropertyState;
    fn get_owner(env: Env, property_id: u32) -> Address;
    fn set_improvement_level(env: Env, caller: Address, property_id: u32, level: u32);
    fn set_last_claimed_ledger(env: Env, caller: Address, property_id: u32, ledger: u64);
}

#[soroban_sdk::contractclient(name = "GameLandTokenClient")]
pub trait GameLandToken {
    fn initialize(env: Env, treasury: Address, engine: Address, is_testnet: bool);
    fn mint(env: Env, caller: Address, to: Address, amount: i128);
    fn burn_from(env: Env, spender: Address, from: Address, amount: i128);
    fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32);
    fn balance(env: Env, id: Address) -> i128;

    fn faucet(env: Env, recipient: Address);
}

#[contracterror]
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum EngineError {
    AlreadyInitialized = 1,
    NotOwner = 2,
    AlreadyMaxLevel = 3,
    NothingToClaim = 4,
    InsufficientBalance = 5,
}

#[soroban_sdk::contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StorageKey {
    NftContract,
    TokenContract,
    Treasury,
    Initialized,
}

#[contract]
pub struct GameEngine;

#[contractimpl]
impl GameEngine {
    pub fn initialize(env: Env, nft_contract: Address, token_contract: Address, treasury: Address) {
        if env.storage().instance().has(&StorageKey::Initialized) {
            panic_with_error!(&env, EngineError::AlreadyInitialized);
        }
        env.storage()
            .instance()
            .set(&StorageKey::NftContract, &nft_contract);
        env.storage()
            .instance()
            .set(&StorageKey::TokenContract, &token_contract);
        env.storage()
            .instance()
            .set(&StorageKey::Treasury, &treasury);
        env.storage()
            .instance()
            .set(&StorageKey::Initialized, &true);
    }

    pub fn improve(env: Env, caller: Address, property_id: u32) {
        caller.require_auth();

        // safe: storage is always set during initialize; panics on uninitialized contract
        let nft_contract: Address = env
            .storage()
            .instance()
            .get(&StorageKey::NftContract)
            .unwrap();
        // safe: storage is always set during initialize; panics on uninitialized contract
        let token_contract: Address = env
            .storage()
            .instance()
            .get(&StorageKey::TokenContract)
            .unwrap();

        let nft_client = GamePropertyNftClient::new(&env, &nft_contract);
        let prop = nft_client.get_property(&property_id);
        let current_level = prop.level;

        if current_level >= LEVEL_SKYSCRAPER {
            panic_with_error!(&env, EngineError::AlreadyMaxLevel);
        }

        let target_level = current_level + 1;

        // Build the improve ECS pipeline and execute
        let mut app = build_improve_app(
            &env,
            caller.clone(),
            property_id,
            target_level,
            nft_contract,
            token_contract,
        );
        app.run();
    }

    pub fn claim_rental(env: Env, caller: Address, property_id: u32) {
        caller.require_auth();

        // safe: storage is always set during initialize; panics on uninitialized contract
        let nft_contract: Address = env
            .storage()
            .instance()
            .get(&StorageKey::NftContract)
            .unwrap();
        // safe: storage is always set during initialize; panics on uninitialized contract
        let token_contract: Address = env
            .storage()
            .instance()
            .get(&StorageKey::TokenContract)
            .unwrap();

        let nft_client = GamePropertyNftClient::new(&env, &nft_contract);

        // Verify owner
        let owner = nft_client.get_owner(&property_id);
        if owner != caller {
            panic_with_error!(&env, EngineError::NotOwner);
        }

        // Calculate income
        let income = Self::get_accrued_income(env.clone(), property_id);
        if income == 0 {
            panic_with_error!(&env, EngineError::NothingToClaim);
        }

        // Mint token payout
        let token_client = GameLandTokenClient::new(&env, &token_contract);
        token_client.mint(&env.current_contract_address(), &caller, &income);

        // Update last claimed ledger
        let current_ledger = env.ledger().sequence() as u64;
        nft_client.set_last_claimed_ledger(
            &env.current_contract_address(),
            &property_id,
            &current_ledger,
        );

        // Emit claimed event
        env.events()
            .publish((symbol_short!("claimed"), caller, property_id), income);
    }

    pub fn get_accrued_income(env: Env, property_id: u32) -> i128 {
        // safe: storage is always set during initialize; panics on uninitialized contract
        let nft_contract: Address = env
            .storage()
            .instance()
            .get(&StorageKey::NftContract)
            .unwrap();
        let nft_client = GamePropertyNftClient::new(&env, &nft_contract);

        let prop = nft_client.get_property(&property_id);
        let current_ledger = env.ledger().sequence() as u64;

        calculate_accrued_income(current_ledger, prop.last_claimed_ledger, prop.level)
    }
}

// ================= Staged ECS Pipeline Builder =================

fn build_improve_app(
    env: &Env,
    caller: Address,
    property_id: u32,
    target_level: u32,
    nft_contract: Address,
    token_contract: Address,
) -> GameApp {
    let mut app = GameApp::new(env);

    let caller_pre = caller.clone();
    let nft_pre = nft_contract.clone();

    let caller_upd = caller.clone();
    let token_upd = token_contract.clone();

    let caller_post = caller.clone();
    let nft_post = nft_contract.clone();

    app.add_systems((
        // PreUpdate: Ownership validation
        named_system("validate_ownership", move |_world, env| {
            let nft_client = GamePropertyNftClient::new(env, &nft_pre);
            let owner = nft_client.get_owner(&property_id);
            if owner != caller_pre {
                panic_with_error!(env, EngineError::NotOwner);
            }
        })
        .in_stage(ScheduleStage::PreUpdate),
        // Update: Improvement cost deduction
        named_system("deduct_improvement_cost", move |_world, env| {
            let cost = match target_level {
                LEVEL_RESIDENTIAL => IMPROVEMENT_COST_RESIDENTIAL,
                LEVEL_COMMERCIAL => IMPROVEMENT_COST_COMMERCIAL,
                LEVEL_SKYSCRAPER => IMPROVEMENT_COST_SKYSCRAPER,
                _ => 0,
            };

            let token_client = GameLandTokenClient::new(env, &token_upd);
            let balance = token_client.balance(&caller_upd);
            if balance < cost {
                panic_with_error!(env, EngineError::InsufficientBalance);
            }

            token_client.burn_from(&env.current_contract_address(), &caller_upd, &cost);
        })
        .in_stage(ScheduleStage::Update),
        // PostUpdate: Upgrade application, contract event emission
        named_system("apply_improvement", move |_world, env| {
            let nft_client = GamePropertyNftClient::new(env, &nft_post);
            nft_client.set_improvement_level(
                &env.current_contract_address(),
                &property_id,
                &target_level,
            );

            env.events().publish(
                (symbol_short!("improved"), caller_post.clone(), property_id),
                target_level,
            );
        })
        .in_stage(ScheduleStage::PostUpdate),
    ));

    app
}

// ================= Rental Income Helper =================

pub fn calculate_accrued_income(current_ledger: u64, last_claimed_ledger: u64, level: u32) -> i128 {
    if current_ledger <= last_claimed_ledger {
        return 0;
    }
    let epochs_elapsed = (current_ledger - last_claimed_ledger) / EPOCH_LENGTH;
    if epochs_elapsed == 0 {
        return 0;
    }

    let (num, den) = match level {
        LEVEL_RESIDENTIAL => MULTIPLIER_RESIDENTIAL,
        LEVEL_COMMERCIAL => MULTIPLIER_COMMERCIAL,
        LEVEL_SKYSCRAPER => MULTIPLIER_SKYSCRAPER,
        _ => MULTIPLIER_VACANT,
    };

    let rate_multiplier = BASE_RENTAL_RATE
        .checked_mul(num)
        .and_then(|r| r.checked_div(den));

    match rate_multiplier {
        Some(rate) => rate.checked_mul(epochs_elapsed as i128).unwrap_or(0),
        None => 0,
    }
}

// ================= Unit Tests =================

#[cfg(test)]
mod tests {
    use super::*;
    use game_land_token::GameLandToken;
    use game_property_nft::GamePropertyNft;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Address, Env,
    };

    struct TestEnv {
        env: Env,
        treasury: Address,
        owner: Address,
        engine_client: GameEngineClient<'static>,
        nft_client: GamePropertyNftClient<'static>,
        token_client: GameLandTokenClient<'static>,
    }

    fn setup_test() -> TestEnv {
        let env = Env::default();
        env.cost_estimate().budget().reset_unlimited();
        env.mock_all_auths();

        let treasury = Address::generate(&env);
        let owner = Address::generate(&env);

        // Register contracts
        let engine_id = env.register(GameEngine, ());
        let nft_id = env.register(GamePropertyNft, ());
        let token_id = env.register(GameLandToken, ());

        let engine_client = GameEngineClient::new(&env, &engine_id);
        let nft_client = GamePropertyNftClient::new(&env, &nft_id);
        let token_client = GameLandTokenClient::new(&env, &token_id);

        // Initialize PropertyNFT
        nft_client.initialize(&treasury, &engine_id);

        // Initialize LandToken in testnet_mode = true
        token_client.initialize(&treasury, &engine_id, &true);

        // Initialize GameEngine
        engine_client.initialize(&nft_id, &token_id, &treasury);

        // Claim faucet tokens to give owner starting LAND balance (1,000 LAND)
        token_client.faucet(&owner);
        // Mint additional tokens to owner so they have enough to buy improvements
        // Standard admin mint (requires treasury auth)
        token_client.mint(&treasury, &owner, &10_000_000_000); // 1,000 extra LAND
        token_client.mint(&treasury, &owner, &10_000_000_000); // 1,000 extra LAND

        // Approve GameEngine to transfer/burn tokens on behalf of owner
        token_client.approve(&owner, &engine_id, &100_000_000_000, &9999);

        // Transfer property 0 from treasury to owner
        nft_client.transfer(&treasury, &owner, &0);

        TestEnv {
            env,
            treasury,
            owner,
            engine_client,
            nft_client,
            token_client,
        }
    }

    #[test]
    fn test_improve_vacant_to_residential_succeeds() {
        let test = setup_test();

        let initial_prop = test.nft_client.get_property(&0);
        assert_eq!(initial_prop.level, LEVEL_VACANT);

        test.engine_client.improve(&test.owner, &0);

        let final_prop = test.nft_client.get_property(&0);
        assert_eq!(final_prop.level, LEVEL_RESIDENTIAL);
    }

    #[test]
    fn test_improve_skyscraper_fails_already_max() {
        let test = setup_test();

        // Vacant -> Residential
        test.engine_client.improve(&test.owner, &0);
        // Residential -> Commercial
        test.engine_client.improve(&test.owner, &0);
        // Commercial -> Skyscraper
        test.engine_client.improve(&test.owner, &0);

        let prop = test.nft_client.get_property(&0);
        assert_eq!(prop.level, LEVEL_SKYSCRAPER);

        // Try to improve past skyscraper
        let res = test.engine_client.try_improve(&test.owner, &0);
        assert_eq!(res, Err(Ok(EngineError::AlreadyMaxLevel.into())));
    }

    #[test]
    fn test_improve_fails_if_not_owner() {
        let test = setup_test();
        let attacker = Address::generate(&test.env);

        let res = test.engine_client.try_improve(&attacker, &0);
        assert_eq!(res, Err(Ok(EngineError::NotOwner.into())));
    }

    #[test]
    fn test_improve_deducts_correct_cost() {
        let test = setup_test();

        let balance_start = test.token_client.balance(&test.owner);

        // Improve Vacant -> Residential (Cost: 200 LAND)
        test.engine_client.improve(&test.owner, &0);
        let balance_after_res = test.token_client.balance(&test.owner);
        assert_eq!(
            balance_start - balance_after_res,
            IMPROVEMENT_COST_RESIDENTIAL
        );

        // Improve Residential -> Commercial (Cost: 600 LAND)
        test.engine_client.improve(&test.owner, &0);
        let balance_after_comm = test.token_client.balance(&test.owner);
        assert_eq!(
            balance_after_res - balance_after_comm,
            IMPROVEMENT_COST_COMMERCIAL
        );

        // Improve Commercial -> Skyscraper (Cost: 1,800 LAND)
        test.engine_client.improve(&test.owner, &0);
        let balance_after_sky = test.token_client.balance(&test.owner);
        assert_eq!(
            balance_after_comm - balance_after_sky,
            IMPROVEMENT_COST_SKYSCRAPER
        );
    }

    #[test]
    fn test_improve_fails_insufficient_balance() {
        let test = setup_test();
        let poor_owner = Address::generate(&test.env);
        // Transfer property 1 to poor_owner
        test.nft_client.transfer(&test.treasury, &poor_owner, &1);

        // poor_owner has 0 balance, let's try to improve property 1
        let res = test.engine_client.try_improve(&poor_owner, &1);
        assert_eq!(res, Err(Ok(EngineError::InsufficientBalance.into())));
    }

    #[test]
    fn test_claim_rental_vacant_property() {
        let test = setup_test();

        let initial_balance = test.token_client.balance(&test.owner);

        // Advance ledger by 1 epoch (100 ledgers)
        let mut ledger = test.env.ledger().get();
        ledger.sequence_number += 100;
        test.env.ledger().set(ledger);

        // Accrued income should be: BASE_RENTAL_RATE * 1/1 * 1 = 10 LAND
        let accrued = test.engine_client.get_accrued_income(&0);
        assert_eq!(accrued, BASE_RENTAL_RATE);

        test.engine_client.claim_rental(&test.owner, &0);

        let final_balance = test.token_client.balance(&test.owner);
        assert_eq!(final_balance - initial_balance, BASE_RENTAL_RATE);
    }

    #[test]
    fn test_claim_rental_skyscraper_multiplier() {
        let test = setup_test();

        // Vacant -> Residential -> Commercial -> Skyscraper
        test.engine_client.improve(&test.owner, &0);
        test.engine_client.improve(&test.owner, &0);
        test.engine_client.improve(&test.owner, &0);

        let initial_balance = test.token_client.balance(&test.owner);

        // Advance ledger by 1 epoch (100 ledgers)
        let mut ledger = test.env.ledger().get();
        ledger.sequence_number += 100;
        test.env.ledger().set(ledger);

        // Accrued income should be: BASE_RENTAL_RATE * 6/1 * 1 = 60 LAND
        let expected_income = BASE_RENTAL_RATE * 6;
        let accrued = test.engine_client.get_accrued_income(&0);
        assert_eq!(accrued, expected_income);

        test.engine_client.claim_rental(&test.owner, &0);

        let final_balance = test.token_client.balance(&test.owner);
        assert_eq!(final_balance - initial_balance, expected_income);
    }

    #[test]
    fn test_claim_rental_fails_if_not_owner() {
        let test = setup_test();
        let attacker = Address::generate(&test.env);

        let res = test.engine_client.try_claim_rental(&attacker, &0);
        assert_eq!(res, Err(Ok(EngineError::NotOwner.into())));
    }

    #[test]
    fn test_get_accrued_income_returns_correct_amount() {
        let test = setup_test();

        // Advance ledger by 99 (less than 1 epoch)
        let mut ledger = test.env.ledger().get();
        ledger.sequence_number += 99;
        test.env.ledger().set(ledger.clone());

        assert_eq!(test.engine_client.get_accrued_income(&0), 0);

        // Advance ledger by 1 more (total 100, exactly 1 epoch)
        ledger.sequence_number += 1;
        test.env.ledger().set(ledger.clone());

        assert_eq!(test.engine_client.get_accrued_income(&0), BASE_RENTAL_RATE);

        // Advance ledger by 50 more (total 150, still 1 epoch because integer division)
        ledger.sequence_number += 50;
        test.env.ledger().set(ledger);

        assert_eq!(test.engine_client.get_accrued_income(&0), BASE_RENTAL_RATE);
    }

    #[test]
    fn test_rental_accumulates_across_multiple_epochs() {
        let test = setup_test();

        // Advance ledger by 5 epochs (500 ledgers)
        let mut ledger = test.env.ledger().get();
        ledger.sequence_number += 500;
        test.env.ledger().set(ledger);

        // Accrued income should be: BASE_RENTAL_RATE * 5 = 50 LAND
        assert_eq!(
            test.engine_client.get_accrued_income(&0),
            BASE_RENTAL_RATE * 5
        );
    }

    #[test]
    fn test_claim_rental_fails_nothing_to_claim() {
        let test = setup_test();

        let res = test.engine_client.try_claim_rental(&test.owner, &0);
        assert_eq!(res, Err(Ok(EngineError::NothingToClaim.into())));
    }
}
