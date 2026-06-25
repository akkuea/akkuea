#![no_std]

use soroban_sdk::{contract, contractimpl, panic_with_error, Address, Env, String};

mod errors;
mod events;
mod storage;

pub use errors::TokenError;
use storage::{
    get_allowance, get_balance, get_engine, get_treasury, has_claimed_faucet, is_testnet,
    set_allowance, set_balance, set_engine, set_faucet_claimed, set_testnet, set_treasury, DataKey,
};

#[contract]
pub struct GameLandToken;

#[contractimpl]
impl GameLandToken {
    /// Initialize the contract with basic token metadata and configuration.
    pub fn initialize(env: Env, treasury: Address, engine: Address, is_testnet: bool) {
        if env.storage().instance().has(&DataKey::Treasury) {
            panic_with_error!(&env, TokenError::AlreadyInitialized);
        }

        set_treasury(&env, &treasury);
        set_engine(&env, &engine);
        set_testnet(&env, is_testnet);

        env.storage()
            .instance()
            .set(&DataKey::Name, &String::from_str(&env, "Akkuea Land Token"));
        env.storage()
            .instance()
            .set(&DataKey::Symbol, &String::from_str(&env, "LAND"));
        env.storage().instance().set(&DataKey::Decimals, &7u32);
    }

    // --- SEP-41 Interface ---

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        get_allowance(&env, &from, &spender)
    }

    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        _expiration_ledger: u32,
    ) {
        from.require_auth();
        set_allowance(&env, &from, &spender, amount);
        events::emit_approval(&env, from, spender, amount);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        get_balance(&env, &id)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        Self::do_transfer(&env, from, to, amount);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();

        let allowance = get_allowance(&env, &from, &spender);
        if allowance < amount {
            panic_with_error!(&env, TokenError::InsufficientAllowance);
        }

        set_allowance(&env, &from, &spender, allowance - amount);
        Self::do_transfer(&env, from, to, amount);
    }

    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();

        let balance = get_balance(&env, &from);
        if balance < amount {
            panic_with_error!(&env, TokenError::InsufficientBalance);
        }

        set_balance(&env, &from, balance - amount);
        events::emit_burn(&env, from, amount);
    }

    pub fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();

        let allowance = get_allowance(&env, &from, &spender);
        if allowance < amount {
            panic_with_error!(&env, TokenError::InsufficientAllowance);
        }

        let balance = get_balance(&env, &from);
        if balance < amount {
            panic_with_error!(&env, TokenError::InsufficientBalance);
        }

        set_allowance(&env, &from, &spender, allowance - amount);
        set_balance(&env, &from, balance - amount);
        events::emit_burn(&env, from, amount);
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Decimals)
            .unwrap_or(7)
    }

    pub fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .unwrap_or_else(|| String::from_str(&env, "Akkuea Land Token"))
    }

    pub fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Symbol)
            .unwrap_or_else(|| String::from_str(&env, "LAND"))
    }

    // --- Custom Logic ---

    pub fn mint(env: Env, caller: Address, to: Address, amount: i128) {
        caller.require_auth();
        let treasury =
            get_treasury(&env).unwrap_or_else(|| panic_with_error!(&env, TokenError::Unauthorized));
        let engine =
            get_engine(&env).unwrap_or_else(|| panic_with_error!(&env, TokenError::Unauthorized));
        if caller != treasury && caller != engine {
            panic_with_error!(&env, TokenError::Unauthorized);
        }
        let balance = get_balance(&env, &to);
        set_balance(&env, &to, balance + amount);
        events::emit_mint(&env, to, amount);
    }

    pub fn faucet(env: Env, to: Address) {
        to.require_auth();

        if !is_testnet(&env) {
            panic_with_error!(&env, TokenError::NotOnTestnet);
        }

        if has_claimed_faucet(&env, &to) {
            panic_with_error!(&env, TokenError::AlreadyClaimed);
        }

        let faucet_amount: i128 = 1000 * 10_000_000; // 1,000 LAND with 7 decimals
        let balance = get_balance(&env, &to);

        set_balance(&env, &to, balance + faucet_amount);
        set_faucet_claimed(&env, &to);
        events::emit_mint(&env, to, faucet_amount);
    }

    // --- Internal Helpers ---

    fn do_transfer(env: &Env, from: Address, to: Address, amount: i128) {
        let from_balance = get_balance(env, &from);
        if from_balance < amount {
            panic_with_error!(env, TokenError::InsufficientBalance);
        }

        let to_balance = get_balance(env, &to);
        set_balance(env, &from, from_balance - amount);
        set_balance(env, &to, to_balance + amount);
        events::emit_transfer(env, from, to, amount);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    fn setup_test(env: &Env) -> (Address, Address, Address, GameLandTokenClient<'static>) {
        let treasury = Address::generate(env);
        let engine = Address::generate(env);
        let user = Address::generate(env);
        let contract_id = env.register(GameLandToken, ());
        let client = GameLandTokenClient::new(env, &contract_id);
        (treasury, engine, user, client)
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let (treasury, engine, _, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);
        assert_eq!(client.name(), String::from_str(&env, "Akkuea Land Token"));
        assert_eq!(client.symbol(), String::from_str(&env, "LAND"));
        assert_eq!(client.decimals(), 7);
    }

    #[test]
    fn test_faucet() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        client.faucet(&user);
        assert_eq!(client.balance(&user), 1000 * 10_000_000);
    }

    #[test]
    #[should_panic(expected = "Error(Contract, #5)")]
    fn test_faucet_already_claimed() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        client.faucet(&user);
        client.faucet(&user);
    }

    #[test]
    fn test_transfer() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        client.faucet(&user);
        let receiver = Address::generate(&env);
        client.transfer(&user, &receiver, &500);

        assert_eq!(client.balance(&user), (1000 * 10_000_000) - 500);
        assert_eq!(client.balance(&receiver), 500);
    }

    #[test]
    fn test_mint_auth() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        client.mint(&treasury, &user, &1000);
        assert_eq!(client.balance(&user), 1000);
    }

    #[test]
    fn test_approve_and_allowance() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        let spender = Address::generate(&env);
        client.approve(&user, &spender, &500, &100);
        assert_eq!(client.allowance(&user, &spender), 500);
    }

    #[test]
    fn test_transfer_from() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        client.faucet(&user);
        let spender = Address::generate(&env);
        client.approve(&user, &spender, &500, &100);

        let receiver = Address::generate(&env);
        client.transfer_from(&spender, &user, &receiver, &200);

        assert_eq!(client.balance(&user), (1000 * 10_000_000) - 200);
        assert_eq!(client.balance(&receiver), 200);
        assert_eq!(client.allowance(&user, &spender), 300);
    }

    #[test]
    fn test_burn() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        client.faucet(&user);
        client.burn(&user, &500);

        assert_eq!(client.balance(&user), (1000 * 10_000_000) - 500);
    }

    #[test]
    fn test_burn_from() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        client.faucet(&user);
        let spender = Address::generate(&env);
        client.approve(&user, &spender, &500, &100);

        client.burn_from(&spender, &user, &200);

        assert_eq!(client.balance(&user), (1000 * 10_000_000) - 200);
        assert_eq!(client.allowance(&user, &spender), 300);
    }
}
