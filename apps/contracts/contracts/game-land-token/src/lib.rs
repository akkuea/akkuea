#![no_std]

use soroban_sdk::{contract, contractimpl, panic_with_error, Address, Env, String};

mod errors;
mod events;
mod storage;

pub use errors::TokenError;
use storage::{
    get_allowance, get_allowance_data, get_balance, get_engine, get_treasury, has_claimed_faucet,
    is_testnet, set_allowance, set_balance, set_engine, set_faucet_claimed, set_testnet,
    set_treasury, DataKey,
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

    /// Approve `spender` to spend up to `amount` from `from` until
    /// `expiration_ledger`.
    ///
    /// Amounts are signed: a negative amount fails with
    /// [`TokenError::NegativeAmount`]. Zero is meaningful here and is accepted:
    /// it revokes the spender's allowance (the entry is written with
    /// `amount = 0` and the requested expiration), it is not a no-op.
    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) {
        from.require_auth();
        if amount < 0 {
            panic_with_error!(&env, TokenError::NegativeAmount);
        }
        set_allowance(&env, &from, &spender, amount, expiration_ledger);
        events::emit_approval(&env, from, spender, amount);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        get_balance(&env, &id)
    }

    /// Transfer `amount` from `from` to `to`.
    ///
    /// A negative amount fails with [`TokenError::NegativeAmount`]. Zero is a
    /// no-op: the call still requires `from`'s authorization, but no balance
    /// changes and no event is emitted.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        if amount < 0 {
            panic_with_error!(&env, TokenError::NegativeAmount);
        }
        if amount == 0 {
            return;
        }
        Self::do_transfer(&env, from, to, amount);
    }

    /// Spend `spender`'s allowance to move `amount` from `from` to `to`.
    ///
    /// A negative amount fails with [`TokenError::NegativeAmount`]. Zero is a
    /// no-op: no allowance is consumed, no balance changes and no event is
    /// emitted. A partial spend keeps the remaining allowance and its original
    /// expiration, so the rest stays usable.
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();

        if amount < 0 {
            panic_with_error!(&env, TokenError::NegativeAmount);
        }
        if amount == 0 {
            return;
        }

        let allowance = get_allowance(&env, &from, &spender);
        if allowance < amount {
            panic_with_error!(&env, TokenError::InsufficientAllowance);
        }

        let new_allowance = allowance
            .checked_sub(amount)
            .unwrap_or_else(|| panic_with_error!(&env, TokenError::Overflow));
        // Carry the original expiration forward. Writing 0 here would make the
        // remaining allowance look expired on the very next `allowance` read.
        let expiration_ledger = get_allowance_data(&env, &from, &spender)
            .map(|data| data.expiration_ledger)
            .unwrap_or(0);
        set_allowance(&env, &from, &spender, new_allowance, expiration_ledger);
        Self::do_transfer(&env, from, to, amount);
    }

    /// Burn `amount` from `from`, reducing the total supply.
    ///
    /// A negative amount fails with [`TokenError::NegativeAmount`]. Zero is a
    /// no-op: no balance changes and no event is emitted.
    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();

        if amount < 0 {
            panic_with_error!(&env, TokenError::NegativeAmount);
        }
        if amount == 0 {
            return;
        }

        let balance = get_balance(&env, &from);
        if balance < amount {
            panic_with_error!(&env, TokenError::InsufficientBalance);
        }

        let new_balance = balance
            .checked_sub(amount)
            .unwrap_or_else(|| panic_with_error!(&env, TokenError::Overflow));
        set_balance(&env, &from, new_balance);
        events::emit_burn(&env, from, amount);
    }

    /// Spend `spender`'s allowance to burn `amount` from `from`.
    ///
    /// A negative amount fails with [`TokenError::NegativeAmount`]. Zero is a
    /// no-op: no allowance is consumed, no balance changes and no event is
    /// emitted. A partial spend keeps the remaining allowance and its original
    /// expiration.
    pub fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();

        if amount < 0 {
            panic_with_error!(&env, TokenError::NegativeAmount);
        }
        if amount == 0 {
            return;
        }

        let allowance = get_allowance(&env, &from, &spender);
        if allowance < amount {
            panic_with_error!(&env, TokenError::InsufficientAllowance);
        }

        let balance = get_balance(&env, &from);
        if balance < amount {
            panic_with_error!(&env, TokenError::InsufficientBalance);
        }

        let new_allowance = allowance
            .checked_sub(amount)
            .unwrap_or_else(|| panic_with_error!(&env, TokenError::Overflow));
        let new_balance = balance
            .checked_sub(amount)
            .unwrap_or_else(|| panic_with_error!(&env, TokenError::Overflow));
        // Carry the original expiration forward. Writing 0 here would make the
        // remaining allowance look expired on the very next `allowance` read.
        let expiration_ledger = get_allowance_data(&env, &from, &spender)
            .map(|data| data.expiration_ledger)
            .unwrap_or(0);
        set_allowance(&env, &from, &spender, new_allowance, expiration_ledger);
        set_balance(&env, &from, new_balance);
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

    /// Mint `amount` to `to`. Only the treasury or the game engine may call it.
    ///
    /// A negative amount fails with [`TokenError::NegativeAmount`]. Zero is a
    /// no-op: no balance changes and no event is emitted.
    pub fn mint(env: Env, caller: Address, to: Address, amount: i128) {
        caller.require_auth();
        let treasury =
            get_treasury(&env).unwrap_or_else(|| panic_with_error!(&env, TokenError::Unauthorized));
        let engine =
            get_engine(&env).unwrap_or_else(|| panic_with_error!(&env, TokenError::Unauthorized));
        if caller != treasury && caller != engine {
            panic_with_error!(&env, TokenError::Unauthorized);
        }
        if amount < 0 {
            panic_with_error!(&env, TokenError::NegativeAmount);
        }
        if amount == 0 {
            return;
        }
        let balance = get_balance(&env, &to);
        let new_balance = balance
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(&env, TokenError::Overflow));
        set_balance(&env, &to, new_balance);
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

        let new_balance = balance
            .checked_add(faucet_amount)
            .unwrap_or_else(|| panic_with_error!(&env, TokenError::Overflow));
        set_balance(&env, &to, new_balance);
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
        let new_from_balance = from_balance
            .checked_sub(amount)
            .unwrap_or_else(|| panic_with_error!(env, TokenError::Overflow));
        let new_to_balance = to_balance
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(env, TokenError::Overflow));
        set_balance(env, &from, new_from_balance);
        set_balance(env, &to, new_to_balance);
        events::emit_transfer(env, from, to, amount);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::testutils::Ledger as _;

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

    use soroban_sdk::Error;

    #[test]
    fn test_initialize_already_initialized_fails() {
        let env = Env::default();
        let (treasury, engine, _, client) = setup_test(&env);

        client.initialize(&treasury, &engine, &true);
        let res = client.try_initialize(&treasury, &engine, &true);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                TokenError::AlreadyInitialized as u32
            )))
        );
    }

    #[test]
    fn test_mint_unauthorized_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        let unauthorized_caller = Address::generate(&env);
        let res = client.try_mint(&unauthorized_caller, &user, &1000);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                TokenError::Unauthorized as u32
            )))
        );
    }

    #[test]
    fn test_transfer_insufficient_balance_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        let receiver = Address::generate(&env);
        let res = client.try_transfer(&user, &receiver, &500);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                TokenError::InsufficientBalance as u32
            )))
        );
    }

    #[test]
    fn test_transfer_from_insufficient_allowance_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        client.faucet(&user);
        let spender = Address::generate(&env);
        let receiver = Address::generate(&env);
        client.approve(&user, &spender, &100, &100);

        let res = client.try_transfer_from(&spender, &user, &receiver, &200);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                TokenError::InsufficientAllowance as u32
            )))
        );
    }

    #[test]
    fn test_transfer_negative_amount_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        client.faucet(&user);
        let receiver = Address::generate(&env);
        let res = client.try_transfer(&user, &receiver, &-1);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                TokenError::NegativeAmount as u32
            )))
        );
        assert_eq!(client.balance(&user), 1000 * 10_000_000);
        assert_eq!(client.balance(&receiver), 0);
    }

    #[test]
    fn test_transfer_from_negative_amount_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        client.faucet(&user);
        let spender = Address::generate(&env);
        let receiver = Address::generate(&env);
        client.approve(&user, &spender, &500, &100);

        let res = client.try_transfer_from(&spender, &user, &receiver, &-1);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                TokenError::NegativeAmount as u32
            )))
        );
        assert_eq!(client.balance(&user), 1000 * 10_000_000);
        assert_eq!(client.balance(&receiver), 0);
        assert_eq!(client.allowance(&user, &spender), 500);
    }

    #[test]
    fn test_burn_negative_amount_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        client.faucet(&user);
        let res = client.try_burn(&user, &-1);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                TokenError::NegativeAmount as u32
            )))
        );
        assert_eq!(client.balance(&user), 1000 * 10_000_000);
    }

    #[test]
    fn test_burn_from_negative_amount_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        client.faucet(&user);
        let spender = Address::generate(&env);
        client.approve(&user, &spender, &500, &100);

        let res = client.try_burn_from(&spender, &user, &-1);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                TokenError::NegativeAmount as u32
            )))
        );
        assert_eq!(client.balance(&user), 1000 * 10_000_000);
        assert_eq!(client.allowance(&user, &spender), 500);
    }

    #[test]
    fn test_approve_negative_amount_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        let spender = Address::generate(&env);
        let res = client.try_approve(&user, &spender, &-1, &100);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                TokenError::NegativeAmount as u32
            )))
        );
        assert_eq!(client.allowance(&user, &spender), 0);
    }

    #[test]
    fn test_mint_negative_amount_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        let res = client.try_mint(&treasury, &user, &-1);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                TokenError::NegativeAmount as u32
            )))
        );
        assert_eq!(client.balance(&user), 0);
    }

    #[test]
    fn test_transfer_overflow_fails() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        let max_holder = Address::generate(&env);
        client.mint(&treasury, &max_holder, &i128::MAX);
        client.mint(&treasury, &user, &1);

        let res = client.try_transfer(&user, &max_holder, &1);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(TokenError::Overflow as u32)))
        );
        assert_eq!(client.balance(&user), 1);
        assert_eq!(client.balance(&max_holder), i128::MAX);
    }

    #[test]
    fn test_expired_allowance_is_zero() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        client.faucet(&user);
        let spender = Address::generate(&env);
        let receiver = Address::generate(&env);

        let current_ledger = env.ledger().sequence();
        client.approve(&user, &spender, &500, &(current_ledger + 1));

        env.ledger().with_mut(|ledger| {
            ledger.sequence_number = current_ledger + 2;
        });

        assert_eq!(client.allowance(&user, &spender), 0);

        let res = client.try_transfer_from(&spender, &user, &receiver, &100);
        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                TokenError::InsufficientAllowance as u32
            )))
        );
    }

    #[test]
    fn test_partial_transfer_from_keeps_remaining_allowance_usable() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        client.faucet(&user);
        let spender = Address::generate(&env);
        let receiver = Address::generate(&env);
        let expiration = env.ledger().sequence() + 100;
        client.approve(&user, &spender, &500, &expiration);

        client.transfer_from(&spender, &user, &receiver, &200);

        // The remaining allowance must stay visible and keep its expiration.
        assert_eq!(client.allowance(&user, &spender), 300);

        // ... and it must still be spendable after the partial transfer.
        client.transfer_from(&spender, &user, &receiver, &300);

        assert_eq!(client.allowance(&user, &spender), 0);
        assert_eq!(client.balance(&receiver), 500);
        assert_eq!(client.balance(&user), (1000 * 10_000_000) - 500);
    }

    #[test]
    fn test_partial_burn_from_keeps_remaining_allowance_usable() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        client.faucet(&user);
        let spender = Address::generate(&env);
        let expiration = env.ledger().sequence() + 100;
        client.approve(&user, &spender, &500, &expiration);

        client.burn_from(&spender, &user, &200);

        assert_eq!(client.allowance(&user, &spender), 300);

        client.burn_from(&spender, &user, &300);

        assert_eq!(client.allowance(&user, &spender), 0);
        assert_eq!(client.balance(&user), (1000 * 10_000_000) - 500);
    }

    #[test]
    fn test_zero_amount_is_a_noop() {
        let env = Env::default();
        env.mock_all_auths();
        let (treasury, engine, user, client) = setup_test(&env);
        client.initialize(&treasury, &engine, &true);

        client.faucet(&user);
        let spender = Address::generate(&env);
        let receiver = Address::generate(&env);
        let expiration = env.ledger().sequence() + 100;
        client.approve(&user, &spender, &500, &expiration);

        let start = client.balance(&user);

        client.transfer(&user, &receiver, &0);
        client.transfer_from(&spender, &user, &receiver, &0);
        client.burn(&user, &0);
        client.burn_from(&spender, &user, &0);
        client.mint(&treasury, &receiver, &0);

        assert_eq!(client.balance(&user), start);
        assert_eq!(client.balance(&receiver), 0);
        assert_eq!(client.allowance(&user, &spender), 500);

        // approve(0) is not a no-op: it revokes the allowance.
        client.approve(&user, &spender, &0, &expiration);
        assert_eq!(client.allowance(&user, &spender), 0);
    }
}
