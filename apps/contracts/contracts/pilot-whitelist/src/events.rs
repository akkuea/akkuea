#![allow(deprecated)]

use soroban_sdk::{contracttype, symbol_short, Address, Env};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WhitelistMutationEvent {
    pub admin: Address,
    pub address: Address,
}

pub fn emit_initialized(env: &Env, admin: Address) {
    env.events().publish((symbol_short!("init"),), admin);
}

pub fn emit_approved(env: &Env, admin: Address, address: Address) {
    env.events().publish(
        (symbol_short!("approve"),),
        WhitelistMutationEvent { admin, address },
    );
}

pub fn emit_revoked(env: &Env, admin: Address, address: Address) {
    env.events().publish(
        (symbol_short!("revoke"),),
        WhitelistMutationEvent { admin, address },
    );
}
