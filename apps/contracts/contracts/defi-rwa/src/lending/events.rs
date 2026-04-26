use soroban_sdk::{contracttype, Address, Env, String};

/// Lending pool event data
#[contracttype]
#[derive(Clone, Debug)]
pub struct DepositEvent {
    pub depositor: Address,
    pub pool_id: String,
    pub amount: i128,
}

/// Withdraw event data
#[contracttype]
#[derive(Clone, Debug)]
pub struct WithdrawEvent {
    pub depositor: Address,
    pub pool_id: String,
    pub amount: i128,
}

/// Pool created event data
#[contracttype]
#[derive(Clone, Debug)]
pub struct PoolCreatedEvent {
    pub admin: Address,
    pub pool_id: String,
}

/// Emit a deposit event
pub fn emit_deposit(env: &Env, depositor: &Address, pool_id: &String, amount: i128) {
    let event = DepositEvent {
        depositor: depositor.clone(),
        pool_id: pool_id.clone(),
        amount,
    };
    env.events()
        .publish((soroban_sdk::symbol_short!("deposit"),), event);
}

/// Emit a withdraw event
pub fn emit_withdraw(env: &Env, depositor: &Address, pool_id: &String, amount: i128) {
    let event = WithdrawEvent {
        depositor: depositor.clone(),
        pool_id: pool_id.clone(),
        amount,
    };
    env.events()
        .publish((soroban_sdk::symbol_short!("withdraw"),), event);
}

/// Emit a pool created event
pub fn emit_pool_created(env: &Env, admin: &Address, pool_id: &String) {
    let event = PoolCreatedEvent {
        admin: admin.clone(),
        pool_id: pool_id.clone(),
    };
    env.events()
        .publish((soroban_sdk::symbol_short!("pool_new"),), event);
}
