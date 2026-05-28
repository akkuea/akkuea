//! ECS game systems for the GameEngine contract.
//!
//! Each function is a named system that operates on the shared `World`.
//! Systems are grouped by flow (improve / claim) and assigned to stages.

use soroban_sdk::{symbol_short, vec, Env, IntoVal, Symbol};

use crate::constants::{calculate_accrued_income, improvement_cost, EPOCH_LENGTH, LEVEL_SKYSCRAPER};
use crate::ecs::{named_system, GameApp, ScheduleStage, World};
use crate::errors::EngineError;

// ---------------------------------------------------------------------------
// Improve flow
// ---------------------------------------------------------------------------

/// PreUpdate: validates the caller owns the property and reads current level.
fn validate_improve_ownership(env: &Env, world: &mut World) -> Result<(), EngineError> {
    let owner: soroban_sdk::Address = env.invoke_contract(
        &world.nft_contract,
        &Symbol::new(env, "get_owner"),
        vec![env, world.property_id.into_val(env)],
    );

    if owner != world.caller {
        return Err(EngineError::NotOwner);
    }

    let level: u32 = env.invoke_contract(
        &world.nft_contract,
        &Symbol::new(env, "get_level"),
        vec![env, world.property_id.into_val(env)],
    );

    if level >= LEVEL_SKYSCRAPER {
        return Err(EngineError::AlreadyMaxLevel);
    }

    world.current_level = level;
    world.next_level = level + 1;
    Ok(())
}

/// Update: calculates the improvement cost and burns LAND from the caller.
fn deduct_improvement_cost(env: &Env, world: &mut World) -> Result<(), EngineError> {
    world.cost = improvement_cost(world.next_level);

    // Burn LAND from the caller's balance.
    // The caller must have approved the GameEngine as a spender beforehand.
    let _: () = env.invoke_contract(
        &world.token_contract,
        &Symbol::new(env, "burn_from"),
        vec![
            env,
            env.current_contract_address().into_val(env),
            world.caller.clone().into_val(env),
            world.cost.into_val(env),
        ],
    );

    Ok(())
}

/// PostUpdate: applies the new improvement level on the PropertyNFT.
fn apply_improvement(env: &Env, world: &mut World) -> Result<(), EngineError> {
    let _: () = env.invoke_contract(
        &world.nft_contract,
        &Symbol::new(env, "set_improvement_level"),
        vec![
            env,
            world.caller.clone().into_val(env),
            world.property_id.into_val(env),
            world.next_level.into_val(env),
        ],
    );

    env.events().publish(
        (symbol_short!("improved"), world.caller.clone()),
        (world.property_id, world.next_level),
    );

    Ok(())
}

/// Builds a GameApp for the improve flow.
pub fn build_improve_app() -> GameApp {
    let mut app = GameApp::new();
    app.add_systems(&[
        named_system("validate_ownership", validate_improve_ownership)
            .in_stage(ScheduleStage::PreUpdate),
        named_system("deduct_improvement_cost", deduct_improvement_cost)
            .in_stage(ScheduleStage::Update),
        named_system("apply_improvement", apply_improvement)
            .in_stage(ScheduleStage::PostUpdate),
    ]);
    app
}

// ---------------------------------------------------------------------------
// Claim rental flow
// ---------------------------------------------------------------------------

/// PreUpdate: validates the caller owns the property and reads rental state.
fn validate_claim_ownership(env: &Env, world: &mut World) -> Result<(), EngineError> {
    let owner: soroban_sdk::Address = env.invoke_contract(
        &world.nft_contract,
        &Symbol::new(env, "get_owner"),
        vec![env, world.property_id.into_val(env)],
    );

    if owner != world.caller {
        return Err(EngineError::NotOwner);
    }

    world.current_level = env.invoke_contract(
        &world.nft_contract,
        &Symbol::new(env, "get_level"),
        vec![env, world.property_id.into_val(env)],
    );

    world.last_claimed_ledger = env.invoke_contract(
        &world.nft_contract,
        &Symbol::new(env, "get_last_claimed_ledger"),
        vec![env, world.property_id.into_val(env)],
    );

    Ok(())
}

/// Update: calculates accrued rental income.
fn calculate_income(env: &Env, world: &mut World) -> Result<(), EngineError> {
    let current_ledger = env.ledger().sequence() as u64;
    world.income = calculate_accrued_income(
        current_ledger,
        world.last_claimed_ledger,
        world.current_level,
    );

    if world.income == 0 {
        return Err(EngineError::NothingToClaim);
    }

    Ok(())
}

/// PostUpdate: mints rental income to the caller and updates the last-claimed ledger.
fn distribute_income(env: &Env, world: &mut World) -> Result<(), EngineError> {
    // Mint LAND to the caller.
    let _: () = env.invoke_contract(
        &world.token_contract,
        &Symbol::new(env, "mint"),
        vec![
            env,
            world.caller.clone().into_val(env),
            world.income.into_val(env),
        ],
    );

    // Update last-claimed ledger, preserving fractional-epoch carry.
    let current_ledger = env.ledger().sequence() as u64;
    let epochs_elapsed = (current_ledger - world.last_claimed_ledger) / EPOCH_LENGTH;
    let new_last_claimed = world.last_claimed_ledger + epochs_elapsed * EPOCH_LENGTH;

    let _: () = env.invoke_contract(
        &world.nft_contract,
        &Symbol::new(env, "set_last_claimed_ledger"),
        vec![
            env,
            world.caller.clone().into_val(env),
            world.property_id.into_val(env),
            new_last_claimed.into_val(env),
        ],
    );

    env.events().publish(
        (symbol_short!("claimed"), world.caller.clone()),
        (world.property_id, world.income),
    );

    Ok(())
}

/// Builds a GameApp for the claim rental flow.
pub fn build_claim_app() -> GameApp {
    let mut app = GameApp::new();
    app.add_systems(&[
        named_system("validate_claim_ownership", validate_claim_ownership)
            .in_stage(ScheduleStage::PreUpdate),
        named_system("calculate_income", calculate_income).in_stage(ScheduleStage::Update),
        named_system("distribute_income", distribute_income).in_stage(ScheduleStage::PostUpdate),
    ]);
    app
}
