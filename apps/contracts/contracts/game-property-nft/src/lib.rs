#![no_std]

use soroban_sdk::{
    contract, contractimpl, panic_with_error, symbol_short, Address, Env, Map, Symbol, Vec,
};

mod components;
mod cougr_compat;
mod errors;
mod events;

#[cfg(test)]
mod test;

pub use components::{PropertyCoords, PropertyMeta, PropertyOwner};
pub use errors::NftError;

use cougr_compat::{Ownable, Pausable, SimpleWorld};

// Grid constants
pub const TOTAL_TILES: u32 = 400;

#[soroban_sdk::contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PropertyState {
    pub id: u32,
    pub x: u32,
    pub y: u32,
    pub owner: Address,
    pub level: u32,
    pub last_claimed_ledger: u64,
    pub approved: Option<Address>,
}

#[contract]
pub struct GamePropertyNft;

#[contractimpl]
impl GamePropertyNft {
    /// Mint all 400 tiles to `treasury` logically.
    pub fn initialize(env: Env, treasury: Address, game_engine: Address) {
        let ownable = Ownable::new(symbol_short!("prop_nft"));
        if ownable.initialize(&env, &treasury).is_err() {
            panic_with_error!(&env, NftError::AlreadyInitialized);
        }

        env.storage()
            .instance()
            .set(&symbol_short!("engine"), &game_engine);

        env.storage().instance().set(
            &symbol_short!("init_ledg"),
            &(env.ledger().sequence() as u64),
        );

        let world = SimpleWorld::new(&env);
        save_world(&env, &world);

        let mut treasury_ids: Vec<u32> = Vec::new(&env);
        for id in 0..TOTAL_TILES {
            treasury_ids.push_back(id);
        }
        env.storage()
            .persistent()
            .set(&(symbol_short!("oidx"), &treasury), &treasury_ids);
        bump_owner_index(&env, &treasury);
    }

    /// Transfer property ownership.
    ///
    /// Rent uses the reset-on-transfer policy: the tile's rental checkpoint
    /// (`last_claimed_ledger`) is moved to the current ledger, so the sender
    /// forfeits any unclaimed epochs and the recipient starts earning from
    /// this ledger. The improvement `level` is preserved. A seller who wants
    /// the rent accrued so far must call `claim_rental` before transferring.
    pub fn transfer(env: Env, from: Address, to: Address, property_id: u32) {
        from.require_auth();

        let pausable = Pausable::new(symbol_short!("prop_nft"));
        if pausable.require_not_paused(&env).is_err() {
            panic_with_error!(&env, NftError::ContractPaused);
        }

        if property_id >= TOTAL_TILES {
            panic_with_error!(&env, NftError::InvalidProperty);
        }

        let ownable = Ownable::new(symbol_short!("prop_nft"));
        let treasury = ownable
            .owner(&env)
            .unwrap_or_else(|| panic_with_error!(&env, NftError::Unauthorized));

        let mut world = load_world(&env);

        let owner_comp: PropertyOwner = world
            .get_typed(&env, property_id)
            .unwrap_or(PropertyOwner { address: treasury });

        if owner_comp.address != from {
            panic_with_error!(&env, NftError::NotOwner);
        }

        world.set_typed(
            &env,
            property_id,
            &PropertyOwner {
                address: to.clone(),
            },
        );

        let mut approves = get_approvals(&env);
        approves.remove(property_id);
        save_approvals(&env, &approves);

        checkpoint_rental_ledger(&env, &mut world, property_id);
        save_world(&env, &world);

        Self::update_owner_index(&env, &from, &to, property_id);

        events::emit_transfer(&env, Some(from), to, property_id);
    }

    /// Approve spender
    pub fn approve(env: Env, owner: Address, spender: Address, property_id: u32) {
        owner.require_auth();

        let pausable = Pausable::new(symbol_short!("prop_nft"));
        if pausable.require_not_paused(&env).is_err() {
            panic_with_error!(&env, NftError::ContractPaused);
        }

        if property_id >= TOTAL_TILES {
            panic_with_error!(&env, NftError::InvalidProperty);
        }

        let ownable = Ownable::new(symbol_short!("prop_nft"));
        let treasury = ownable
            .owner(&env)
            .unwrap_or_else(|| panic_with_error!(&env, NftError::Unauthorized));

        let world = load_world(&env);

        let owner_comp: PropertyOwner = world
            .get_typed(&env, property_id)
            .unwrap_or(PropertyOwner { address: treasury });

        if owner_comp.address != owner {
            panic_with_error!(&env, NftError::NotOwner);
        }

        let mut approves = get_approvals(&env);
        approves.set(property_id, spender.clone());
        save_approvals(&env, &approves);

        events::emit_approve(&env, owner, spender, property_id);
    }

    /// Transfer from approved spender.
    ///
    /// Applies the same reset-on-transfer rental policy as [`Self::transfer`]:
    /// the rental checkpoint moves to the current ledger and `level` is kept.
    /// The marketplace relies on this when it takes escrow custody, so escrow
    /// time never accrues rent for the seller or the buyer.
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, property_id: u32) {
        spender.require_auth();

        let pausable = Pausable::new(symbol_short!("prop_nft"));
        if pausable.require_not_paused(&env).is_err() {
            panic_with_error!(&env, NftError::ContractPaused);
        }

        if property_id >= TOTAL_TILES {
            panic_with_error!(&env, NftError::InvalidProperty);
        }

        let ownable = Ownable::new(symbol_short!("prop_nft"));
        let treasury = ownable
            .owner(&env)
            .unwrap_or_else(|| panic_with_error!(&env, NftError::Unauthorized));

        let mut world = load_world(&env);

        let owner_comp: PropertyOwner = world
            .get_typed(&env, property_id)
            .unwrap_or(PropertyOwner { address: treasury });

        if owner_comp.address != from {
            panic_with_error!(&env, NftError::NotOwner);
        }

        let approves = get_approvals(&env);
        match approves.get(property_id) {
            Some(addr) if addr == spender => {}
            _ => panic_with_error!(&env, NftError::NotApproved),
        }

        world.set_typed(
            &env,
            property_id,
            &PropertyOwner {
                address: to.clone(),
            },
        );

        let mut approves = approves;
        approves.remove(property_id);
        save_approvals(&env, &approves);

        checkpoint_rental_ledger(&env, &mut world, property_id);
        save_world(&env, &world);

        Self::update_owner_index(&env, &from, &to, property_id);

        events::emit_transfer(&env, Some(from), to, property_id);
    }

    /// Get property
    pub fn get_property(env: Env, property_id: u32) -> PropertyState {
        if property_id >= TOTAL_TILES {
            panic_with_error!(&env, NftError::InvalidProperty);
        }

        let ownable = Ownable::new(symbol_short!("prop_nft"));
        let treasury = ownable
            .owner(&env)
            .unwrap_or_else(|| panic_with_error!(&env, NftError::Unauthorized));

        let init_ledger = env
            .storage()
            .instance()
            .get(&symbol_short!("init_ledg"))
            .unwrap_or(0u64);

        let world = load_world(&env);

        let coords: PropertyCoords = world
            .get_typed(&env, property_id)
            .unwrap_or(PropertyCoords {
                x: property_id % 20,
                y: property_id / 20,
            });

        let owner_comp: PropertyOwner = world
            .get_typed(&env, property_id)
            .unwrap_or(PropertyOwner { address: treasury });

        let meta: PropertyMeta = world.get_typed(&env, property_id).unwrap_or(PropertyMeta {
            level: 0,
            last_claimed_ledger: init_ledger,
            approved_spender: 0,
        });

        let approves = get_approvals(&env);

        PropertyState {
            id: property_id,
            x: coords.x,
            y: coords.y,
            owner: owner_comp.address,
            level: meta.level,
            last_claimed_ledger: meta.last_claimed_ledger,
            approved: approves.get(property_id),
        }
    }

    pub fn get_owner(env: Env, property_id: u32) -> Address {
        if property_id >= TOTAL_TILES {
            panic_with_error!(&env, NftError::InvalidProperty);
        }

        let ownable = Ownable::new(symbol_short!("prop_nft"));
        let treasury = ownable
            .owner(&env)
            .unwrap_or_else(|| panic_with_error!(&env, NftError::Unauthorized));

        let world = load_world(&env);

        let owner_comp: PropertyOwner = world
            .get_typed(&env, property_id)
            .unwrap_or(PropertyOwner { address: treasury });

        owner_comp.address
    }

    fn update_owner_index(env: &Env, old_owner: &Address, new_owner: &Address, id: u32) {
        let old_ids: Vec<u32> = env
            .storage()
            .persistent()
            .get(&(symbol_short!("oidx"), old_owner))
            .unwrap_or_else(|| Vec::new(env));

        let mut new_old_ids: Vec<u32> = Vec::new(env);
        for i in 0..old_ids.len() {
            // safe: i is bounded by old_ids.len()
            let x = old_ids.get(i).unwrap();
            if x != id {
                new_old_ids.push_back(x);
            }
        }

        env.storage()
            .persistent()
            .set(&(symbol_short!("oidx"), old_owner), &new_old_ids);
        bump_owner_index(env, old_owner);

        let mut new_ids: Vec<u32> = env
            .storage()
            .persistent()
            .get(&(symbol_short!("oidx"), new_owner))
            .unwrap_or_else(|| Vec::new(env));
        new_ids.push_back(id);
        env.storage()
            .persistent()
            .set(&(symbol_short!("oidx"), new_owner), &new_ids);
        bump_owner_index(env, new_owner);
    }

    pub fn list_by_owner(env: Env, owner: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&(symbol_short!("oidx"), &owner))
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn set_improvement_level(env: Env, caller: Address, property_id: u32, level: u32) {
        caller.require_auth();

        let stored_engine: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("engine"))
            .unwrap_or_else(|| panic_with_error!(&env, NftError::Unauthorized));

        if caller != stored_engine {
            panic_with_error!(&env, NftError::Unauthorized);
        }

        if property_id >= TOTAL_TILES {
            panic_with_error!(&env, NftError::InvalidProperty);
        }

        let init_ledger = env
            .storage()
            .instance()
            .get(&symbol_short!("init_ledg"))
            .unwrap_or(0u64);

        let mut world = load_world(&env);

        let mut meta: PropertyMeta = world.get_typed(&env, property_id).unwrap_or(PropertyMeta {
            level: 0,
            last_claimed_ledger: init_ledger,
            approved_spender: 0,
        });

        meta.level = level;

        world.set_typed(&env, property_id, &meta);
        save_world(&env, &world);
    }

    pub fn set_last_claimed_ledger(env: Env, caller: Address, property_id: u32, ledger: u64) {
        caller.require_auth();

        let stored_engine: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("engine"))
            .unwrap_or_else(|| panic_with_error!(&env, NftError::Unauthorized));

        if caller != stored_engine {
            panic_with_error!(&env, NftError::Unauthorized);
        }

        if property_id >= TOTAL_TILES {
            panic_with_error!(&env, NftError::InvalidProperty);
        }

        let mut world = load_world(&env);

        let mut meta: PropertyMeta = world.get_typed(&env, property_id).unwrap_or(PropertyMeta {
            level: 0,
            last_claimed_ledger: get_init_ledger(&env),
            approved_spender: 0,
        });

        meta.last_claimed_ledger = ledger;

        world.set_typed(&env, property_id, &meta);
        save_world(&env, &world);
    }

    pub fn pause(env: Env, admin: Address) {
        admin.require_auth();

        let ownable = Ownable::new(symbol_short!("prop_nft"));
        if ownable.require_owner(&env, &admin).is_err() {
            panic_with_error!(&env, NftError::Unauthorized);
        }

        let pausable = Pausable::new(symbol_short!("prop_nft"));
        if pausable.pause(&env, &admin).is_err() {
            panic_with_error!(&env, NftError::Unauthorized);
        }
    }

    pub fn unpause(env: Env, admin: Address) {
        admin.require_auth();

        let ownable = Ownable::new(symbol_short!("prop_nft"));
        if ownable.require_owner(&env, &admin).is_err() {
            panic_with_error!(&env, NftError::Unauthorized);
        }

        let pausable = Pausable::new(symbol_short!("prop_nft"));
        if pausable.unpause(&env, &admin).is_err() {
            panic_with_error!(&env, NftError::Unauthorized);
        }
    }
}

// ================= Helpers =================

fn load_world(env: &Env) -> SimpleWorld {
    SimpleWorld::new(env)
}

fn get_init_ledger(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&symbol_short!("init_ledg"))
        .unwrap_or(0u64)
}

/// Ownership-change checkpoint for rental accrual.
///
/// Akkuea Land uses the reset-on-transfer design: whenever a tile changes
/// owner (direct transfer, approved transfer, or marketplace escrow) its
/// `last_claimed_ledger` is set to the current ledger. Unclaimed rent belongs
/// to the previous owner and is forfeited unless they claimed before moving
/// the tile; the new owner accrues from this ledger onward. `level` and the
/// approval marker are left untouched here.
fn checkpoint_rental_ledger(env: &Env, world: &mut SimpleWorld, property_id: u32) {
    let mut meta: PropertyMeta = world.get_typed(env, property_id).unwrap_or(PropertyMeta {
        level: 0,
        last_claimed_ledger: get_init_ledger(env),
        approved_spender: 0,
    });

    meta.last_claimed_ledger = env.ledger().sequence() as u64;

    world.set_typed(env, property_id, &meta);
}

fn save_world(_env: &Env, _world: &SimpleWorld) {}

fn get_approvals(env: &Env) -> Map<u32, Address> {
    env.storage()
        .persistent()
        .get(&symbol_short!("approves"))
        .unwrap_or_else(|| Map::new(env))
}

fn save_approvals(env: &Env, approvals: &Map<u32, Address>) {
    let key = symbol_short!("approves");
    env.storage().persistent().set(&key, approvals);
    bump_persistent(env, &key);
}

fn bump_persistent(env: &Env, key: &Symbol) {
    env.storage().persistent().extend_ttl(key, 518_400, 518_400);
}

fn bump_owner_index(env: &Env, owner: &Address) {
    env.storage()
        .persistent()
        .extend_ttl(&(symbol_short!("oidx"), owner), 518_400, 518_400);
}
