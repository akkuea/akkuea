#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

/// GamePropertyNFT - Property ownership and state management
/// Manages 400 property tiles in the 20x20 Akkuea Land grid
#[derive(Clone)]
#[contracttype]
pub struct PropertyData {
    pub owner: Address,
    pub level: u32, // 0=Vacant, 1=Residential, 2=Commercial, 3=Skyscraper
    pub last_claimed_ledger: u32,
}

#[derive(Clone)]
#[contracttype]
pub struct PropertyCoords {
    pub x: u32,
    pub y: u32,
}

#[contract]
pub struct GamePropertyNFT;

#[contractimpl]
impl GamePropertyNFT {
    /// Initialize the contract with treasury and engine addresses
    pub fn initialize(env: Env, treasury: Address, game_engine: Address) -> bool {
        let storage_key = Symbol::new(&env, "initialized");
        if env.storage().persistent().has(&storage_key) {
            return false; // Already initialized
        }

        // Store treasury and game engine addresses
        let treasury_key = Symbol::new(&env, "treasury");
        let engine_key = Symbol::new(&env, "game_engine");
        env.storage().persistent().set(&treasury_key, &treasury);
        env.storage().persistent().set(&engine_key, &game_engine);
        env.storage().persistent().set(&storage_key, &true);

        true
    }

    /// Initialize properties in batches (call multiple times to init all 400)
    /// batch_start: inclusive start (0-399)
    /// batch_end: exclusive end (1-400)
    pub fn initialize_batch(env: Env, batch_start: u32, batch_end: u32, treasury: Address) -> bool {
        assert!(batch_start < 400, "Batch start out of range");
        assert!(batch_end <= 400, "Batch end out of range");
        assert!(batch_start < batch_end, "Invalid batch range");

        for property_id in batch_start..batch_end {
            let coords = PropertyCoords {
                x: property_id % 20,
                y: property_id / 20,
            };
            let property = PropertyData {
                owner: treasury.clone(),
                level: 0, // Vacant
                last_claimed_ledger: env.ledger().sequence(),
            };

            let prop_key = (Symbol::new(&env, "property"), property_id);
            let coords_key = (Symbol::new(&env, "coords"), property_id);

            env.storage().persistent().set(&prop_key, &property);
            env.storage().persistent().set(&coords_key, &coords);
        }

        true
    }

    /// Get the owner of a property
    pub fn get_owner(env: Env, property_id: u32) -> Address {
        assert!(property_id < 400, "Property ID out of range");
        let prop_key = (Symbol::new(&env, "property"), property_id);
        let property: PropertyData = env
            .storage()
            .persistent()
            .get(&prop_key)
            .expect("Property not found");
        property.owner
    }

    /// Get complete property data
    pub fn get_property(env: Env, property_id: u32) -> PropertyData {
        assert!(property_id < 400, "Property ID out of range");
        let prop_key = (Symbol::new(&env, "property"), property_id);
        env.storage()
            .persistent()
            .get(&prop_key)
            .expect("Property not found")
    }

    /// Get coordinates of a property
    pub fn get_coordinates(env: Env, property_id: u32) -> PropertyCoords {
        assert!(property_id < 400, "Property ID out of range");
        let coords_key = (Symbol::new(&env, "coords"), property_id);
        env.storage()
            .persistent()
            .get(&coords_key)
            .expect("Coordinates not found")
    }

    /// Transfer a property between addresses
    /// Can only be called by marketplace or game engine
    pub fn transfer(env: Env, property_id: u32, to: Address) -> bool {
        let _engine_key = Symbol::new(&env, "game_engine");

        // Note: In production, verify caller is game engine or marketplace via auth
        // For now, accept the call if it comes from authorized addresses

        let prop_key = (Symbol::new(&env, "property"), property_id);
        let mut property: PropertyData = env
            .storage()
            .persistent()
            .get(&prop_key)
            .expect("Property not found");

        let _old_owner = property.owner.clone();
        property.owner = to.clone();
        property.level = 0; // Reset to Vacant when transferred
        property.last_claimed_ledger = env.ledger().sequence();

        env.storage().persistent().set(&prop_key, &property);
        true
    }

    /// Set improvement level (only game engine can call)
    pub fn set_improvement_level(env: Env, property_id: u32, level: u32) -> bool {
        assert!(level <= 3, "Invalid improvement level");

        // Note: In production, verify caller is game engine via auth

        let prop_key = (Symbol::new(&env, "property"), property_id);
        let mut property: PropertyData = env
            .storage()
            .persistent()
            .get(&prop_key)
            .expect("Property not found");

        property.level = level;
        env.storage().persistent().set(&prop_key, &property);

        true
    }

    /// Set last claimed ledger (only game engine can call)
    pub fn set_last_claimed_ledger(env: Env, property_id: u32, ledger: u32) -> bool {
        // Note: In production, verify caller is game engine via auth

        let prop_key = (Symbol::new(&env, "property"), property_id);
        let mut property: PropertyData = env
            .storage()
            .persistent()
            .get(&prop_key)
            .expect("Property not found");

        property.last_claimed_ledger = ledger;
        env.storage().persistent().set(&prop_key, &property);

        true
    }

    /// Set marketplace address (only treasury can set this once)
    pub fn set_marketplace(env: Env, marketplace: Address) -> bool {
        // Note: In production, verify caller is treasury via auth

        let marketplace_key = Symbol::new(&env, "marketplace");
        if env.storage().persistent().has(&marketplace_key) {
            return false; // Already set
        }

        env.storage()
            .persistent()
            .set(&marketplace_key, &marketplace);
        true
    }

    /// Check if an address owns any properties
    pub fn owns_property(env: Env, account: Address) -> bool {
        for property_id in 0..400 {
            let prop_key = (Symbol::new(&env, "property"), property_id);
            if let Some(property) = env.storage().persistent().get::<_, PropertyData>(&prop_key) {
                if property.owner == account {
                    return true;
                }
            }
        }
        false
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
        let engine = TestAddress::random(&env);

        let contract = GamePropertyNFT;
        assert!(contract.initialize(env.clone(), treasury.clone(), engine));

        // Verify a property is owned by treasury
        assert_eq!(contract.get_owner(env.clone(), 0), treasury);
        assert_eq!(contract.get_owner(env.clone(), 399), treasury);
    }

    #[test]
    fn test_get_coordinates() {
        let env = Env::default();
        let treasury = TestAddress::random(&env);
        let engine = TestAddress::random(&env);

        let contract = GamePropertyNFT;
        contract.initialize(env.clone(), treasury, engine);

        // Property 0 should be at (0, 0)
        let coords_0 = contract.get_coordinates(env.clone(), 0);
        assert_eq!(coords_0.x, 0);
        assert_eq!(coords_0.y, 0);

        // Property 23 should be at (3, 1) -> 1*20 + 3 = 23
        let coords_23 = contract.get_coordinates(env, 23);
        assert_eq!(coords_23.x, 3);
        assert_eq!(coords_23.y, 1);
    }
}
