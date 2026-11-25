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

/// Reserve withdrawal event data
#[contracttype]
#[derive(Clone, Debug)]
pub struct ReservesWithdrawnEvent {
    pub caller: Address,
    pub pool_id: String,
    pub recipient: Address,
    pub amount: i128,
}

/// Emitted when a liquidation writes off debt that no collateral backs
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BadDebtWrittenOffEvent {
    pub pool_id: String,
    pub borrower: Address,
    /// Total debt removed from the books
    pub amount: i128,
    /// Portion absorbed by the pool reserves
    pub covered_by_reserves: i128,
    /// Portion shared by depositors through the supply index
    pub socialized: i128,
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

/// Emit a reserve withdrawal event
pub fn emit_reserves_withdrawn(
    env: &Env,
    caller: &Address,
    pool_id: &String,
    recipient: &Address,
    amount: i128,
) {
    let event = ReservesWithdrawnEvent {
        caller: caller.clone(),
        pool_id: pool_id.clone(),
        recipient: recipient.clone(),
        amount,
    };
    env.events()
        .publish((soroban_sdk::symbol_short!("res_wd"),), event);
}

/// Emit a bad debt write-off event
pub fn emit_bad_debt_written_off(
    env: &Env,
    pool_id: &String,
    borrower: &Address,
    amount: i128,
    covered_by_reserves: i128,
    socialized: i128,
) {
    let event = BadDebtWrittenOffEvent {
        pool_id: pool_id.clone(),
        borrower: borrower.clone(),
        amount,
        covered_by_reserves,
        socialized,
    };
    env.events()
        .publish((soroban_sdk::symbol_short!("bad_debt"),), event);
}
