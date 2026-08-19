#![no_std]
#![allow(linker_messages)]

use soroban_sdk::{
    contract, contractclient, contractimpl, panic_with_error, Address, Env, String, Vec,
};

mod errors;
mod events;
mod storage;

pub use errors::IncomeTokenError;
use storage::{DataKey, Storage};

#[contractclient(name = "WhitelistClient")]
pub trait Whitelist {
    fn is_approved(env: Env, address: Address) -> bool;
}

#[contract]
pub struct PilotIncomeToken;

#[contractimpl]
impl PilotIncomeToken {
    /// Initialize token metadata and the whitelist contract used for mint gating.
    pub fn initialize(
        env: Env,
        admin: Address,
        whitelist: Address,
        name: String,
        symbol: String,
        decimals: u32,
    ) {
        if Storage::is_initialized(&env) {
            panic_with_error!(&env, IncomeTokenError::AlreadyInitialized);
        }

        Storage::set_admin(&env, &admin);
        Storage::set_whitelist(&env, &whitelist);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::Decimals, &decimals);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);
        env.storage()
            .instance()
            .set(&DataKey::Holders, &Vec::<Address>::new(&env));
        env.storage().instance().set(&DataKey::Minted, &false);

        events::emit_initialized(&env, admin, whitelist);
    }

    /// Mint the fixed pilot supply once to approved holders.
    pub fn mint_fixed_supply(env: Env, admin: Address, holders: Vec<Address>, amounts: Vec<i128>) {
        admin.require_auth();
        Self::require_admin(&env, &admin);

        if Storage::has_minted(&env) {
            panic_with_error!(&env, IncomeTokenError::AlreadyMinted);
        }

        if holders.is_empty() {
            panic_with_error!(&env, IncomeTokenError::EmptyHolderSet);
        }

        if holders.len() != amounts.len() {
            panic_with_error!(&env, IncomeTokenError::HolderAmountLengthMismatch);
        }

        let whitelist_address = Storage::whitelist(&env)
            .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::NotInitialized));
        let whitelist = WhitelistClient::new(&env, &whitelist_address);

        let mut minted_holders: Vec<Address> = Vec::new(&env);
        let mut total_supply = 0i128;

        for i in 0..holders.len() {
            let holder = holders
                .get(i)
                .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::InternalInvariant));
            let amount = amounts
                .get(i)
                .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::InternalInvariant));

            if amount <= 0 {
                panic_with_error!(&env, IncomeTokenError::InvalidAmount);
            }

            if !whitelist.is_approved(&holder) {
                panic_with_error!(&env, IncomeTokenError::HolderNotApproved);
            }

            let current = Storage::balance(&env, &holder);
            let next = current
                .checked_add(amount)
                .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::BalanceOverflow));
            Storage::set_balance(&env, &holder, next);

            total_supply = total_supply
                .checked_add(amount)
                .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::SupplyOverflow));

            if !Self::contains_holder(&minted_holders, &holder) {
                minted_holders.push_back(holder);
            }
        }

        Storage::set_total_supply(&env, total_supply);
        Storage::set_holders(&env, &minted_holders);
        Storage::set_minted(&env);
        events::emit_minted(&env, admin, total_supply, minted_holders.len());
    }

    /// Return the balance of an address.
    pub fn balance(env: Env, id: Address) -> i128 {
        Storage::balance(&env, &id)
    }

    /// Return token name.
    pub fn name(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Name)
            .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::NotInitialized))
    }

    /// Return token symbol.
    pub fn symbol(env: Env) -> String {
        env.storage()
            .instance()
            .get(&DataKey::Symbol)
            .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::NotInitialized))
    }

    /// Return token decimal precision.
    pub fn decimals(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Decimals)
            .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::NotInitialized))
    }

    /// Return total minted supply.
    pub fn total_supply(env: Env) -> i128 {
        Storage::total_supply(&env)
    }

    /// Return the fixed holder set used by payout distribution.
    pub fn holders(env: Env) -> Vec<Address> {
        Storage::holders(&env)
    }

    /// Return the configured token admin.
    pub fn admin(env: Env) -> Address {
        Storage::admin(&env)
            .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::NotInitialized))
    }

    /// Admin-only correction transfer. Holders cannot transfer the token.
    pub fn transfer(env: Env, caller: Address, from: Address, to: Address, amount: i128) {
        caller.require_auth();
        Self::require_admin(&env, &caller);

        if amount <= 0 {
            panic_with_error!(&env, IncomeTokenError::InvalidAmount);
        }

        let whitelist_address = Storage::whitelist(&env)
            .unwrap_or_else(|| panic_with_error!(&env, IncomeTokenError::NotInitialized));
        let whitelist = WhitelistClient::new(&env, &whitelist_address);
        if !whitelist.is_approved(&to) {
            panic_with_error!(&env, IncomeTokenError::HolderNotApproved);
        }

        Self::move_balance(&env, from, to, amount);
    }

    fn require_admin(env: &Env, caller: &Address) {
        let admin = Storage::admin(env)
            .unwrap_or_else(|| panic_with_error!(env, IncomeTokenError::NotInitialized));
        if admin != caller.clone() {
            panic_with_error!(env, IncomeTokenError::Unauthorized);
        }
    }

    fn move_balance(env: &Env, from: Address, to: Address, amount: i128) {
        let from_balance = Storage::balance(env, &from);
        let next_from = from_balance
            .checked_sub(amount)
            .unwrap_or_else(|| panic_with_error!(env, IncomeTokenError::InsufficientBalance));
        let to_balance = Storage::balance(env, &to);
        let next_to = to_balance
            .checked_add(amount)
            .unwrap_or_else(|| panic_with_error!(env, IncomeTokenError::BalanceOverflow));

        Storage::set_balance(env, &from, next_from);
        Storage::set_balance(env, &to, next_to);
        Self::upsert_holder(env, &to);
        events::emit_transfer(env, from, to, amount);
    }

    fn upsert_holder(env: &Env, holder: &Address) {
        let mut holders = Storage::holders(env);
        if !Self::contains_holder(&holders, holder) {
            holders.push_back(holder.clone());
            Storage::set_holders(env, &holders);
        }
    }

    fn contains_holder(holders: &Vec<Address>, holder: &Address) -> bool {
        for i in 0..holders.len() {
            if holders
                .get(i)
                .is_some_and(|candidate| candidate == holder.clone())
            {
                return true;
            }
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use pilot_whitelist::{PilotWhitelist, PilotWhitelistClient};
    use soroban_sdk::{testutils::Address as _, vec, Error};

    struct Setup {
        env: Env,
        admin: Address,
        whitelist_admin: Address,
        holder_one: Address,
        holder_two: Address,
        unapproved: Address,
        whitelist: PilotWhitelistClient<'static>,
        token: PilotIncomeTokenClient<'static>,
    }

    fn setup() -> Setup {
        let env = Env::default();
        let admin = Address::generate(&env);
        let whitelist_admin = Address::generate(&env);
        let holder_one = Address::generate(&env);
        let holder_two = Address::generate(&env);
        let unapproved = Address::generate(&env);

        let whitelist_id = env.register(PilotWhitelist, ());
        let whitelist = PilotWhitelistClient::new(&env, &whitelist_id);
        whitelist.initialize(&whitelist_admin);

        let token_id = env.register(PilotIncomeToken, ());
        let token = PilotIncomeTokenClient::new(&env, &token_id);
        token.initialize(
            &admin,
            &whitelist_id,
            &String::from_str(&env, "Akkuea Pilot Income"),
            &String::from_str(&env, "AKIN"),
            &7,
        );

        Setup {
            env,
            admin,
            whitelist_admin,
            holder_one,
            holder_two,
            unapproved,
            whitelist,
            token,
        }
    }

    fn approve_default_holders(s: &Setup) {
        s.whitelist.approve(&s.whitelist_admin, &s.holder_one);
        s.whitelist.approve(&s.whitelist_admin, &s.holder_two);
    }

    #[test]
    fn initialize_sets_metadata() {
        let s = setup();

        assert_eq!(
            s.token.name(),
            String::from_str(&s.env, "Akkuea Pilot Income")
        );
        assert_eq!(s.token.symbol(), String::from_str(&s.env, "AKIN"));
        assert_eq!(s.token.decimals(), 7);
        assert_eq!(s.token.total_supply(), 0);
        assert_eq!(s.token.admin(), s.admin);
    }

    #[test]
    fn mint_fixed_supply_to_approved_holders_once() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);

        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        assert_eq!(s.token.balance(&s.holder_one), 700);
        assert_eq!(s.token.balance(&s.holder_two), 300);
        assert_eq!(s.token.total_supply(), 1000);
        assert_eq!(s.token.holders().len(), 2);
    }

    #[test]
    fn mint_rejects_unapproved_holder() {
        let s = setup();
        s.env.mock_all_auths();
        s.whitelist.approve(&s.whitelist_admin, &s.holder_one);

        let res = s.token.try_mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.unapproved.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::HolderNotApproved as u32
            )))
        );
    }

    #[test]
    fn mint_rejects_zero_amount() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);

        let res = s.token.try_mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 0i128],
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::InvalidAmount as u32
            )))
        );
    }

    #[test]
    fn mint_rejects_mismatched_vectors() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);

        let res = s.token.try_mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128],
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::HolderAmountLengthMismatch as u32
            )))
        );
    }

    #[test]
    fn mint_rejects_second_call() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);

        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        let res = s.token.try_mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone()],
            &vec![&s.env, 1000i128],
        );

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::AlreadyMinted as u32
            )))
        );
    }

    #[test]
    fn non_admin_transfer_is_rejected() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);
        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        let res = s
            .token
            .try_transfer(&s.holder_one, &s.holder_one, &s.holder_two, &100);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::Unauthorized as u32
            )))
        );
    }

    #[test]
    fn admin_transfer_can_correct_balances() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);
        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        s.token
            .transfer(&s.admin, &s.holder_one, &s.holder_two, &200);

        assert_eq!(s.token.balance(&s.holder_one), 500);
        assert_eq!(s.token.balance(&s.holder_two), 500);
    }

    #[test]
    fn admin_transfer_rejects_unapproved_recipient() {
        let s = setup();
        s.env.mock_all_auths();
        approve_default_holders(&s);
        s.token.mint_fixed_supply(
            &s.admin,
            &vec![&s.env, s.holder_one.clone(), s.holder_two.clone()],
            &vec![&s.env, 700i128, 300i128],
        );

        let res = s
            .token
            .try_transfer(&s.admin, &s.holder_one, &s.unapproved, &100);

        assert_eq!(
            res,
            Err(Ok(Error::from_contract_error(
                IncomeTokenError::HolderNotApproved as u32
            )))
        );
    }
}
