#![no_std]
#![allow(deprecated)]

extern crate alloc;

use soroban_sdk::{
    contract, contracterror, contractimpl, panic_with_error, symbol_short, Address, Env,
};

pub mod constants;
pub mod cougr_core;

#[cfg(test)]
mod additional_tests;

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

        // Settle the period at the old level before the level changes so that
        // income earned before the upgrade is valued at the rate it was earned
        // at. Any accrued income is paid out here (same mint and `claimed`
        // event as `claim_rental`), and `last_claimed_ledger` is advanced by
        // the number of whole epochs paid so the remainder carries over.
        Self::settle_rental(&env, &caller, property_id, &nft_contract, &token_contract);

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

        // Calculate income and paid epoch count
        let prop = nft_client.get_property(&property_id);
        let current_ledger = env.ledger().sequence() as u64;
        let (income, epochs_paid) = calculate_accrued_income_with_epochs(
            current_ledger,
            prop.last_claimed_ledger,
            prop.level,
        );
        if income == 0 {
            panic_with_error!(&env, EngineError::NothingToClaim);
        }

        // Mint token payout
        let token_client = GameLandTokenClient::new(&env, &token_contract);
        token_client.mint(&env.current_contract_address(), &caller, &income);

        // Advance last claimed ledger by the epochs actually paid so the
        // partial-epoch remainder carries over to the next claim.
        let new_last_claimed = prop
            .last_claimed_ledger
            .saturating_add(epochs_paid.saturating_mul(EPOCH_LENGTH));
        nft_client.set_last_claimed_ledger(
            &env.current_contract_address(),
            &property_id,
            &new_last_claimed,
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

    /// Settle any accrued rental income for `property_id` at its current level,
    /// paying it out to `caller` and advancing `last_claimed_ledger` by the
    /// number of whole epochs paid. Does nothing if no whole epoch has elapsed.
    fn settle_rental(
        env: &Env,
        caller: &Address,
        property_id: u32,
        nft_contract: &Address,
        token_contract: &Address,
    ) {
        let nft_client = GamePropertyNftClient::new(env, nft_contract);
        let prop = nft_client.get_property(&property_id);
        let current_ledger = env.ledger().sequence() as u64;
        let (income, epochs_paid) = calculate_accrued_income_with_epochs(
            current_ledger,
            prop.last_claimed_ledger,
            prop.level,
        );
        if income == 0 || epochs_paid == 0 {
            return;
        }

        let token_client = GameLandTokenClient::new(env, token_contract);
        token_client.mint(&env.current_contract_address(), caller, &income);

        let new_last_claimed = prop
            .last_claimed_ledger
            .saturating_add(epochs_paid.saturating_mul(EPOCH_LENGTH));
        nft_client.set_last_claimed_ledger(
            &env.current_contract_address(),
            &property_id,
            &new_last_claimed,
        );

        env.events().publish(
            (symbol_short!("claimed"), caller.clone(), property_id),
            income,
        );
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
    calculate_accrued_income_with_epochs(current_ledger, last_claimed_ledger, level).0
}

/// Returns `(income, epochs_paid)` where `epochs_paid` is the number of whole
/// epochs used to compute `income`. Overflow-safe.
pub fn calculate_accrued_income_with_epochs(
    current_ledger: u64,
    last_claimed_ledger: u64,
    level: u32,
) -> (i128, u64) {
    if current_ledger <= last_claimed_ledger {
        return (0, 0);
    }
    let epochs_elapsed = (current_ledger - last_claimed_ledger) / EPOCH_LENGTH;
    if epochs_elapsed == 0 {
        return (0, 0);
    }

    let (num, den) = match level {
        LEVEL_RESIDENTIAL => MULTIPLIER_RESIDENTIAL,
        LEVEL_COMMERCIAL => MULTIPLIER_COMMERCIAL,
        LEVEL_SKYSCRAPER => MULTIPLIER_SKYSCRAPER,
        _ => MULTIPLIER_VACANT,
    };

    let rate_multip