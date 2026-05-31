#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

/// GameLandToken - SEP-41 Fungible Token for Akkuea Land
/// Token for all in-game transactions and income
#[derive(Clone)]
#[contracttype]
pub struct TokenData {
    pub name: Symbol,
    pub symbol: Symbol,
    pub decimals: u32,
}

#[contract]
pub struct GameLandTokenContract;

#[contractimpl]
impl GameLandTokenContract {
    /// Initialize the LAND token
    /// admin: Treasury address that can mint tokens
    pub fn initialize(env: Env, admin: Address) -> bool {
        let storage_key = Symbol::new(&env, "initialized");
        if env.storage().persistent().has(&storage_key) {
            return false; // Already initialized
        }

        // Store admin address
        let admin_key = Symbol::new(&env, "admin");
        env.storage().persistent().set(&admin_key, &admin);

        // Mark as initialized
        env.storage().persistent().set(&storage_key, &true);

        true
    }

    /// Mint new LAND tokens (only admin can call)
    pub fn mint(env: Env, to: Address, amount: i128) -> bool {
        // Note: In production, verify caller is admin via auth
        assert!(amount > 0, "Amount must be positive");

        // Get total supply
        let supply_key = Symbol::new(&env, "total_supply");
        let current_supply: i128 = env
            .storage()
            .persistent()
            .get(&supply_key)
            .unwrap_or(0i128);

        // Update balances
        let balance_key = (Symbol::new(&env, "balance"), &to);
        let current_balance: i128 = env
            .storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(0i128);

        env.storage()
            .persistent()
            .set(&balance_key, &(current_balance + amount));

        // Update total supply
        env.storage()
            .persistent()
            .set(&supply_key, &(current_supply + amount));

        true
    }

    /// Burn LAND tokens from an address (only admin can call)
    pub fn burn_from(env: Env, from: Address, amount: i128) -> bool {
        // Note: In production, verify caller is admin via auth
        assert!(amount > 0, "Amount must be positive");

        // Get balance
        let balance_key = (Symbol::new(&env, "balance"), &from);
        let current_balance: i128 = env
            .storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(0i128);

        assert!(current_balance >= amount, "Insufficient balance");

        // Update balance
        env.storage()
            .persistent()
            .set(&balance_key, &(current_balance - amount));

        // Update total supply
        let supply_key = Symbol::new(&env, "total_supply");
        let current_supply: i128 = env
            .storage()
            .persistent()
            .get(&supply_key)
            .unwrap_or(0i128);

        env.storage()
            .persistent()
            .set(&supply_key, &(current_supply - amount));

        true
    }

    /// Get balance of an address
    pub fn balance_of(env: Env, account: Address) -> i128 {
        let balance_key = (Symbol::new(&env, "balance"), account);
        env.storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(0i128)
    }

    /// Get total supply
    pub fn total_supply(env: Env) -> i128 {
        let supply_key = Symbol::new(&env, "total_supply");
        env.storage()
            .persistent()
            .get(&supply_key)
            .unwrap_or(0i128)
    }

    /// Faucet: Claim 1000 LAND (testnet only, one per address)
    pub fn faucet(env: Env, account: Address) -> bool {
        let faucet_key = (Symbol::new(&env, "faucet_claimed"), &account);

        // Check if already claimed
        if env.storage().persistent().has(&faucet_key) {
            return false; // Already claimed
        }

        // Mark as claimed
        env.storage().persistent().set(&faucet_key, &true);

        // Mint 1000 LAND (with 7 decimals: 10_000_000_000_000)
        let amount: i128 = 1_000 * 10_000_000;

        let balance_key = (Symbol::new(&env, "balance"), &account);
        let current_balance: i128 = env
            .storage()
            .persistent()
            .get(&balance_key)
            .unwrap_or(0i128);

        env.storage()
            .persistent()
            .set(&balance_key, &(current_balance + amount));

        let supply_key = Symbol::new(&env, "total_supply");
        let current_supply: i128 = env
            .storage()
            .persistent()
            .get(&supply_key)
            .unwrap_or(0i128);

        env.storage()
            .persistent()
            .set(&supply_key, &(current_supply + amount));

        true
    }

    /// Transfer LAND between addresses
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> bool {
        // Note: In production, verify caller is sender via auth
        assert!(amount > 0, "Amount must be positive");

        // Get sender balance
        let from_balance_key = (Symbol::new(&env, "balance"), &from);
        let from_balance: i128 = env
            .storage()
            .persistent()
            .get(&from_balance_key)
            .unwrap_or(0i128);

        assert!(from_balance >= amount, "Insufficient balance");

        // Get receiver balance
        let to_balance_key = (Symbol::new(&env, "balance"), &to);
        let to_balance: i128 = env
            .storage()
            .persistent()
            .get(&to_balance_key)
            .unwrap_or(0i128);

        // Update balances
        env.storage()
            .persistent()
            .set(&from_balance_key, &(from_balance - amount));
        env.storage()
            .persistent()
            .set(&to_balance_key, &(to_balance + amount));

        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as TestAddress;

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let admin = TestAddress::random(&env);
        let contract = GameLandTokenContract;

        assert!(contract.initialize(env.clone(), admin.clone()));
        // Should not be able to initialize again
        assert!(!contract.initialize(env, admin));
    }

    #[test]
    fn test_mint() {
        let env = Env::default();
        let admin = TestAddress::random(&env);
        let user = TestAddress::random(&env);

        let contract = GameLandTokenContract;
        contract.initialize(env.clone(), admin.clone());

        // Admin mints tokens
        assert!(contract.mint(env.clone(), user.clone(), 1000));

        // Check balance
        assert_eq!(contract.balance_of(env.clone(), user), 1000);
    }

    #[test]
    fn test_faucet() {
        let env = Env::default();
        let admin = TestAddress::random(&env);
        let user = TestAddress::random(&env);

        let contract = GameLandTokenContract;
        contract.initialize(env.clone(), admin);

        // First faucet claim succeeds
        assert!(contract.faucet(env.clone(), user.clone()));

        // Second claim fails
        assert!(!contract.faucet(env.clone(), user));
    }
}
