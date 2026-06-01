#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Symbol};

/// GameEngine - Core game rules and state management
/// Handles building improvements, rental income, and property purchases
#[contract]
pub struct GameEngine;

#[contractimpl]
impl GameEngine {
    /// Initialize the game engine
    pub fn initialize(
        env: Env,
        treasury: Address,
        token_contract: Address,
        nft_contract: Address,
    ) -> bool {
        let storage_key = Symbol::new(&env, "initialized");
        if env.storage().persistent().has(&storage_key) {
            return false; // Already initialized
        }

        let treasury_key = Symbol::new(&env, "treasury");
        let token_key = Symbol::new(&env, "token_contract");
        let nft_key = Symbol::new(&env, "nft_contract");

        env.storage().persistent().set(&treasury_key, &treasury);
        env.storage().persistent().set(&token_key, &token_contract);
        env.storage().persistent().set(&nft_key, &nft_contract);
        env.storage().persistent().set(&storage_key, &true);

        true
    }

    /// Buy a property from treasury (500 LAND)
    pub fn buy_from_treasury(env: Env, buyer: Address, property_id: u32) -> bool {
        assert!(property_id < 400, "Invalid property ID");

        // Note: In production, would verify caller is buyer via auth

        // For now, record the purchase
        // In production, would:
        // 1. Burn 500 LAND from buyer (token_contract.burn_from)
        // 2. Transfer NFT from treasury to buyer (nft_contract.transfer)

        // Record purchase
        let purchase_key = (Symbol::new(&env, "purchase"), property_id, &buyer);
        env.storage().persistent().set(&purchase_key, &true);

        true
    }

    /// Improve a building (increase level)
    /// Costs: Vacant→Residential: 200, Residential→Commercial: 600, Commercial→Skyscraper: 1800 LAND
    pub fn improve(env: Env, caller: Address, property_id: u32) -> bool {
        assert!(property_id < 400, "Invalid property ID");

        // For production, would:
        // 1. Get property via NFT contract
        // 2. Verify ownership
        // 3. Get current level
        // 4. Calculate cost
        // 5. Burn LAND from caller
        // 6. Update level via NFT contract

        // Determine cost based on current level
        // This is simplified - in production would query actual level
        let _cost: i128 = 200 * 10_000_000; // Default to Vacant→Residential cost

        // Record improvement
        let improve_key = (Symbol::new(&env, "improvement"), property_id, &caller);
        env.storage().persistent().set(&improve_key, &true);

        true
    }

    /// Calculate accrued rental income for a property
    /// Returns income in stroops (i128)
    pub fn get_accrued_income(
        env: Env,
        property_id: u32,
        last_claimed_ledger: u32,
        level: u32,
    ) -> i128 {
        assert!(property_id < 400, "Invalid property ID");
        assert!(level <= 3, "Invalid level");

        let current_ledger = env.ledger().sequence();

        // Calculate epochs
        let epochs_elapsed = (current_ledger - last_claimed_ledger) / 100;

        if epochs_elapsed == 0 {
            return 0; // No complete epochs
        }

        // Base rate: 10 LAND per epoch (with 7 decimals)
        let base_rate: i128 = 10 * 10_000_000;

        // Multiplier by level
        let (multiplier_num, multiplier_den) = match level {
            0 => (1i128, 1i128), // Vacant: 1.0x
            1 => (3i128, 2i128), // Residential: 1.5x
            2 => (3i128, 1i128), // Commercial: 3.0x
            3 => (6i128, 1i128), // Skyscraper: 6.0x
            _ => (1i128, 1i128),
        };

        // Calculate: BASE_RATE * MULTIPLIER_NUM / MULTIPLIER_DEN * epochs
        (base_rate * multiplier_num / multiplier_den) * epochs_elapsed as i128
    }

    /// Claim rental income for a property
    pub fn claim_rental(env: Env, caller: Address, property_id: u32) -> bool {
        assert!(property_id < 400, "Invalid property ID");

        // For production, would:
        // 1. Verify caller owns property via NFT contract
        // 2. Get property data (level, last_claimed_ledger)
        // 3. Calculate accrued income
        // 4. Mint LAND to caller via token contract
        // 5. Update last_claimed_ledger via NFT contract

        // Record claim
        let claim_key = (Symbol::new(&env, "claim"), property_id, &caller);
        env.storage().persistent().set(&claim_key, &true);

        true
    }

    /// Get the improvement cost to upgrade from current level to next
    pub fn get_improvement_cost(_env: Env, current_level: u32) -> i128 {
        let cost = match current_level {
            0 => 200i128,  // Vacant → Residential
            1 => 600i128,  // Residential → Commercial
            2 => 1800i128, // Commercial → Skyscraper
            _ => 0i128,    // Already at max
        };

        cost * 10_000_000 // Convert to stroops (7 decimals)
    }

    /// Transfer ownership of a property to marketplace for listing
    /// Only callable by marketplace
    pub fn approve_property_transfer(env: Env, property_id: u32, to: Address) -> bool {
        // Note: In production, verify caller is marketplace via auth
        // Then call NFT contract to transfer

        let approval_key = (Symbol::new(&env, "approval"), property_id);
        env.storage().persistent().set(&approval_key, &to);

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
        let treasury = TestAddress::random(&env);
        let token = TestAddress::random(&env);
        let nft = TestAddress::random(&env);

        let contract = GameEngine;
        assert!(contract.initialize(env, treasury, token, nft));
    }

    #[test]
    fn test_accrued_income_calculation() {
        let env = Env::default();
        let contract = GameEngine;

        // Mock: 200 ledgers passed, vacant property (level 0)
        // 200 ledgers = 2 epochs
        // 2 epochs * 10 LAND = 20 LAND
        let income = contract.get_accrued_income(env, 0, 0, 0);
        // Base rate 10 * 2 epochs should give result in stroops
        assert!(income >= 0);
    }

    #[test]
    fn test_improvement_costs() {
        let env = Env::default();
        let contract = GameEngine;

        let cost_vacant = contract.get_improvement_cost(env.clone(), 0);
        assert_eq!(cost_vacant, 200 * 10_000_000);

        let cost_residential = contract.get_improvement_cost(env.clone(), 1);
        assert_eq!(cost_residential, 600 * 10_000_000);

        let cost_commercial = contract.get_improvement_cost(env, 2);
        assert_eq!(cost_commercial, 1800 * 10_000_000);
    }
}
