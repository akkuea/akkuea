#![allow(deprecated)]
use soroban_sdk::{symbol_short, Address, Env};

pub fn emit_transfer(env: &Env, from: Address, to: Address, amount: i128) {
    env.events()
        .publish((symbol_short!("transfer"), from), (to, amount));
}

pub fn emit_approval(env: &Env, from: Address, spender: Address, amount: i128) {
    env.events()
        .publish((symbol_short!("approval"), from, spender), amount);
}

pub fn emit_mint(env: &Env, to: Address, amount: i128) {
    env.events().publish((symbol_short!("mint"), to), amount);
}

pub fn emit_burn(env: &Env, from: Address, amount: i128) {
    env.events().publish((symbol_short!("burn"), from), amount);
}
