#![allow(deprecated)]

use soroban_sdk::{contracttype, symbol_short, Address, Env, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenInitializedEvent {
    pub admin: Address,
    pub whitelist: Address,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MintedEvent {
    pub admin: Address,
    pub total_supply: i128,
    pub holder_count: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransferEvent {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
}

pub fn emit_initialized(env: &Env, admin: Address, whitelist: Address) {
    env.events().publish(
        (symbol_short!("init"),),
        TokenInitializedEvent { admin, whitelist },
    );
}

pub fn emit_minted(env: &Env, admin: Address, total_supply: i128, holder_count: u32) {
    env.events().publish(
        (symbol_short!("mint"),),
        MintedEvent {
            admin,
            total_supply,
            holder_count,
        },
    );
}

pub fn emit_transfer(env: &Env, from: Address, to: Address, amount: i128) {
    env.events().publish(
        (symbol_short!("transfer"),),
        TransferEvent { from, to, amount },
    );
}

/// Emitted once when the pilot is permanently marked wound down.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WoundDownRecordedEvent {
    pub admin: Address,
    pub reason: String,
    pub at: u64,
}

pub fn emit_wound_down_recorded(env: &Env, admin: Address, reason: String, at: u64) {
    env.events().publish(
        (symbol_short!("wounddown"),),
        WoundDownRecordedEvent { admin, reason, at },
    );
}
