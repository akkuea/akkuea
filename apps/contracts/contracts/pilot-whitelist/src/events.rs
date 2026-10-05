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

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminTransferStartedEvent {
    pub current_admin: Address,
    pub new_admin: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminTransferAcceptedEvent {
    pub old_admin: Address,
    pub new_admin: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdminTransferCancelledEvent {
    pub admin: Address,
}

pub fn emit_admin_transfer_started(env: &Env, current_admin: Address, new_admin: Address) {
    env.events().publish(
        (symbol_short!("adminsta"),),
        AdminTransferStartedEvent {
            current_admin,
            new_admin,
        },
    );
}

pub fn emit_admin_transfer_accepted(env: &Env, old_admin: Address, new_admin: Address) {
    env.events().publish(
        (symbol_short!("adminacc"),),
        AdminTransferAcceptedEvent {
            old_admin,
            new_admin,
        },
    );
}

pub fn emit_admin_transfer_cancelled(env: &Env, admin: Address) {
    env.events().publish(
        (symbol_short!("admincan"),),
        AdminTransferCancelledEvent { admin },
    );
}

pub fn emit_paused(env: &Env, admin: Address) {
    env.events().publish((symbol_short!("pause"),), admin);
}

pub fn emit_unpaused(env: &Env, admin: Address) {
    env.events().publish((symbol_short!("unpause"),), admin);
}
