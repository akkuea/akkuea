use soroban_sdk::symbol_short;
use soroban_sdk::{contractimpl, Address, Env};

use crate::datatype::RewardType;
use crate::interface::RewardTrait;
use crate::{BalanceTrait, Error, RewardSystem, RewardSystemArgs, RewardSystemClient};

#[contractimpl]
impl RewardTrait for RewardSystem {
    fn distribute_rewards(
        env: Env,
        recipient: Address,
        reward_type: RewardType,
        amount: i128,
    ) -> Result<(), Error> {
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        <RewardSystem as BalanceTrait>::update_balance(env.clone(), recipient.clone(), amount)?;

        env.events().publish(
            (symbol_short!("rd_issued"), recipient),
            (reward_type, amount, env.ledger().timestamp()),
        );

        Ok(())
    }

    fn log_reward_event(env: Env, recipient: Address, reward_type: RewardType, amount: i128) {
        env.events().publish(
            (symbol_short!("rd_issued"),),
            (reward_type, recipient, amount, env.ledger().timestamp()),
        );
    }
}
