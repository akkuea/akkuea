use soroban_sdk::{Address, Env, Vec};

const ADMIN_KEY: &str = "admin";
const EDUCATORS_KEY: &str = "educators";

pub fn has_admin(env: &Env) -> bool {
    env.storage().instance().has(&ADMIN_KEY)
}

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&ADMIN_KEY).unwrap()
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&ADMIN_KEY, admin);
}

pub fn is_admin(env: &Env, address: &Address) -> bool {
    if !has_admin(env) {
        return false;
    }
    get_admin(env) == *address
}

// Educator management
pub fn get_educators(env: &Env) -> Vec<Address> {
    env.storage().instance().get(&EDUCATORS_KEY).unwrap_or(Vec::new(env))
}

pub fn add_educator(env: &Env, educator: &Address) {
    let mut educators = get_educators(env);
    if !educators.contains(educator) {
        educators.push_back(educator.clone());
        env.storage().instance().set(&EDUCATORS_KEY, &educators);
    }
}

pub fn remove_educator(env: &Env, educator: &Address) {
    let educators = get_educators(env);
    let mut new_educators = Vec::new(env);
    
    for addr in educators.iter() {
        if addr != *educator {
            new_educators.push_back(addr);
        }
    }
    
    env.storage().instance().set(&EDUCATORS_KEY, &new_educators);
}

pub fn is_educator(env: &Env, educator: &Address) -> bool {
    let educators = get_educators(env);
    educators.contains(educator)
}