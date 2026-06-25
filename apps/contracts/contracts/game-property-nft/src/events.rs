use soroban_sdk::{contractevent, Address, Env};

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TransferEvent {
    pub from: Option<Address>,
    pub to: Address,
    pub id: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApproveEvent {
    pub owner: Address,
    pub spender: Address,
    pub id: u32,
}

// #[contractevent]
// #[derive(Clone, Debug, Eq, PartialEq)]
// pub struct ImprovedEvent {
//     pub owner: Address,
//     pub id: u32,
//     pub level: u32,
// }

pub fn emit_transfer(env: &Env, from: Option<Address>, to: Address, id: u32) {
    TransferEvent { from, to, id }.publish(env);
}

pub fn emit_approve(env: &Env, owner: Address, spender: Address, id: u32) {
    ApproveEvent { owner, spender, id }.publish(env);
}

// pub fn emit_improved(env: &Env, owner: Address, id: u32, level: u32) {
//     ImprovedEvent { owner, id, level }.publish(env);
// }
