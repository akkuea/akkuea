#![no_std]

mod constants;
mod ecs;
mod errors;
mod storage;
mod systems;

use soroban_sdk::{contract, contractimpl, vec, Address, Env, IntoVal, Symbol};

use constants::calculate_accrued_income;
use ecs::World;
use errors::EngineError;

#[contract]
pub struct GameEngine;

#[contractimpl]
impl GameEngine {
    /// Initializes the GameEngine with references to the PropertyNFT and
    /// LandToken contracts, plus the treasury address.
    pub fn initialize(
        env: Env,
        nft_contract: Address,
        token_contract: Address,
        treasury: Address,
    ) -> Result<(), EngineError> {
        if storage::is_initialized(&env) {
            return Err(EngineError::AlreadyInitialized);
        }

        storage::set_nft_contract(&env, &nft_contract);
        storage::set_token_contract(&env, &token_contract);
        storage::set_treasury(&env, &treasury);
        storage::set_initialized(&env);

        Ok(())
    }

    /// Upgrades a property to the next improvement level.
    ///
    /// The caller must own the property and have approved the GameEngine
    /// to spend enough LAND to cover the improvement cost.
    pub fn improve(env: Env, caller: Address, property_id: u32) -> Result<(), EngineError> {
        caller.require_auth();

        let nft_contract = storage::get_nft_contract(&env);
        let token_contract = storage::get_token_contract(&env);

        let mut world = World::new(property_id, caller, nft_contract, token_contract);
        let app = systems::build_improve_app();
        app.run(&env, &mut world)
    }

    /// Claims accrued rental income for a property the caller owns.
    ///
    /// Income is calculated based on whole epochs elapsed since the last
    /// claim, multiplied by the property's rental rate. LAND is minted
    /// directly into the caller's balance.
    pub fn claim_rental(env: Env, caller: Address, property_id: u32) -> Result<(), EngineError> {
        caller.require_auth();

        let nft_contract = storage::get_nft_contract(&env);
        let token_contract = storage::get_token_contract(&env);

        let mut world = World::new(property_id, caller, nft_contract, token_contract);
        let app = systems::build_claim_app();
        app.run(&env, &mut world)
    }

    /// Read-only: returns the accrued rental income for a property
    /// without claiming it.
    pub fn get_accrued_income(env: Env, property_id: u32) -> i128 {
        let nft_contract = storage::get_nft_contract(&env);

        let level: u32 = env.invoke_contract(
            &nft_contract,
            &Symbol::new(&env, "get_level"),
            vec![&env, property_id.into_val(&env)],
        );

        let last_claimed: u64 = env.invoke_contract(
            &nft_contract,
            &Symbol::new(&env, "get_last_claimed_ledger"),
            vec![&env, property_id.into_val(&env)],
        );

        let current_ledger = env.ledger().sequence() as u64;
        calculate_accrued_income(current_ledger, last_claimed, level)
    }
}

#[cfg(test)]
mod test;
