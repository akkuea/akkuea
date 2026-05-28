use soroban_sdk::{contracttype, Address, Env};

#[contracttype]
pub enum StorageKey {
    NftContract,
    TokenContract,
    Treasury,
    Initialized,
}

pub fn is_initialized(env: &Env) -> bool {
    env.storage()
        .instance()
        .get::<StorageKey, bool>(&StorageKey::Initialized)
        .unwrap_or(false)
}

pub fn set_initialized(env: &Env) {
    env.storage()
        .instance()
        .set(&StorageKey::Initialized, &true);
}

pub fn set_nft_contract(env: &Env, address: &Address) {
    env.storage()
        .instance()
        .set(&StorageKey::NftContract, address);
}

pub fn get_nft_contract(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&StorageKey::NftContract)
        .unwrap()
}

pub fn set_token_contract(env: &Env, address: &Address) {
    env.storage()
        .instance()
        .set(&StorageKey::TokenContract, address);
}

pub fn get_token_contract(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&StorageKey::TokenContract)
        .unwrap()
}

pub fn set_treasury(env: &Env, address: &Address) {
    env.storage()
        .instance()
        .set(&StorageKey::Treasury, address);
}
