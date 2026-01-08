use soroban_sdk::{contractimpl, symbol_short, Address, Env, Map, Symbol};

use crate::{BalanceTrait, Error, RewardSystem, RewardSystemArgs, RewardSystemClient};

const BALANCE_KEY: Symbol = symbol_short!("balance");

#[contractimpl]
impl BalanceTrait for RewardSystem {
    fn update_balance(env: Env, recipient: Address, amount: i128) -> Result<(), Error> {
        let mut balances: Map<Address, i128> = env
            .storage()
            .persistent()
            .get(&BALANCE_KEY)
            .unwrap_or(Map::new(&env));

        let current_balance = balances.get(recipient.clone()).unwrap_or(0);
        let new_balance = current_balance
            .checked_add(amount)
            .ok_or(Error::BalanceUpdateFailed)?;

        balances.set(recipient.clone(), new_balance);
        env.storage().persistent().set(&BALANCE_KEY, &balances);

        Ok(())
    }

    fn get_balance(env: Env, recipient: Address) -> Result<i128, Error> {
        let balances: Map<Address, i128> = env
            .storage()
            .persistent()
            .get(&BALANCE_KEY)
            .unwrap_or(Map::new(&env));

        Ok(balances.get(recipient.clone()).unwrap_or(0))
    }
}
