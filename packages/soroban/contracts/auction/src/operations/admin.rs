use super::storage::get_admin;
use crate::datatype::StorageKey;
use soroban_sdk::{Address, Env, Vec};

// Initialize the contract with an admin
pub fn initialize(env: &Env, admin: &Address) {
    if env.storage().instance().has(&StorageKey::Admin) {
        panic!("Contract already initialized");
    }

    admin.require_auth();
    env.storage().instance().set(&StorageKey::Admin, admin);
    env.storage()
        .instance()
        .set(&StorageKey::AuctionCounter, &0u32);

    // Initialize empty verifiers and resolvers lists
    env.storage()
        .instance()
        .set(&StorageKey::Verifiers, &Vec::<Address>::new(env));

    env.storage()
        .instance()
        .set(&StorageKey::Resolvers, &Vec::<Address>::new(env));
}

// Add a verifier (admin only)
pub fn add_verifier(env: &Env, admin: &Address, verifier: &Address) {
    admin.require_auth();

    // Check if caller is admin
    let stored_admin = get_admin(env);
    if *admin != stored_admin {
        panic!("Only admin can add verifiers");
    }

    // Add to verifiers list if not already present
    let mut verifiers: Vec<Address> = env
        .storage()
        .instance()
        .get(&StorageKey::Verifiers)
        .unwrap_or_else(|| Vec::new(env));

    if !verifiers.contains(verifier) {
        verifiers.push_back(verifier.clone());
        env.storage()
            .instance()
            .set(&StorageKey::Verifiers, &verifiers);
    }
}

// Add a resolver (admin only)
pub fn add_resolver(env: &Env, admin: &Address, resolver: &Address) {
    admin.require_auth();

    // Check if caller is admin
    let stored_admin = get_admin(env);
    if *admin != stored_admin {
        panic!("Only admin can add resolvers");
    }

    // Add to resolvers list if not already present
    let mut resolvers: Vec<Address> = env
        .storage()
        .instance()
        .get(&StorageKey::Resolvers)
        .unwrap_or_else(|| Vec::new(env));

    if !resolvers.contains(resolver) {
        resolvers.push_back(resolver.clone());
        env.storage()
            .instance()
            .set(&StorageKey::Resolvers, &resolvers);
    }
}
