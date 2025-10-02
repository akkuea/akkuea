use soroban_sdk::{symbol_short, Address, Env, IntoVal};

use crate::{
    get_current_timestamp, is_greeting_eligible, is_reward_claimed, load_greeting_reward,
    mark_reward_claimed, save_greeting_reward, validate_token_amount, Error, GreetingReward,
};

/// Cross-contract call helper to the tipping contract to send reward tokens.
/// We reuse its `send_tip` method for distribution to avoid duplicating logic.
fn distribute_tokens_via_tipping(
    env: &Env,
    tipping_contract: &Address,
    from: &Address,
    to: &Address,
    amount: i128,
    token: &Address,
    memo: Option<soroban_sdk::String>,
) -> Result<(), Error> {
    // Build args in Soroban ABI form
    let args = (from.clone(), to.clone(), amount, token.clone(), memo).into_val(env);
    // Method name in tipping contract
    let func = symbol_short!("send_tip");
    let _res = env
        .try_invoke_contract::<(), Error>(tipping_contract, &func, args)
        .map_err(|_| Error::ExternalCallFailed)?;
    Ok(())
}

/// Check if a greeting exists by probing storage key used by social module
fn greeting_exists(env: &Env, greeting_id: u64) -> bool {
    env.storage()
        .persistent()
        .has(&(symbol_short!("GRT"), greeting_id))
}

/// Issues tokens for a popular greeting, persists a `GreetingReward`, and emits event.
pub fn issue_greeting_reward(
    env: Env,
    greeting_id: u64,
    token_amount: i128,
    creator: Address,
    token: Address,
    tipping_contract: Address,
) -> Result<GreetingReward, Error> {
    // Require creator auth to prevent spoofed claims
    creator.require_auth();

    // Validate greeting
    if !greeting_exists(&env, greeting_id) {
        return Err(Error::GreetingNotFound);
    }
    if is_reward_claimed(&env, &greeting_id) {
        return Err(Error::RewardAlreadyClaimed);
    }
    if !is_greeting_eligible(&env, greeting_id) {
        return Err(Error::NotEligible);
    }

    // Validate amount
    validate_token_amount(token_amount)?;

    // Distribute tokens using tipping contract (from contract address to creator)
    let from = env.current_contract_address();
    let memo = Some(soroban_sdk::String::from_str(&env, "greeting_reward"));
    distribute_tokens_via_tipping(
        &env,
        &tipping_contract,
        &from,
        &creator,
        token_amount,
        &token,
        memo,
    )?;

    // Record reward
    let reward = GreetingReward {
        greeting_id,
        creator: creator.clone(),
        token_amount,
        timestamp: get_current_timestamp(&env),
    };

    save_greeting_reward(&env, &reward)?;
    mark_reward_claimed(&env, &greeting_id);

    // Emit event
    crate::emit_greeting_reward(&env, &reward)?;

    Ok(reward)
}

/// Verifies if a greeting meets reward criteria based on engagement metrics.
pub fn check_reward_eligibility(env: Env, greeting_id: u64) -> Result<bool, Error> {
    if !greeting_exists(&env, greeting_id) {
        return Err(Error::GreetingNotFound);
    }
    Ok(is_greeting_eligible(&env, greeting_id) && !is_reward_claimed(&env, &greeting_id))
}

/// Getter for reward by greeting id
pub fn get_reward(env: Env, greeting_id: u64) -> Option<GreetingReward> {
    load_greeting_reward(&env, &greeting_id)
}
