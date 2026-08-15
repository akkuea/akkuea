//! # Soroban Invocation Budget Check Tests
//!
//! These tests measure the CPU instruction count and memory (bytes) consumed by
//! the main `defi-rwa` contract entry-points and assert they stay within the
//! documented budget thresholds.
//!
//! ## Documented Budget Thresholds
//!
//! | Function           | Max CPU (instructions) | Max Memory (bytes) |
//! |--------------------|------------------------|--------------------|
//! | `mint_shares`      | 60 000 000             | 5 000 000          |
//! | `transfer_shares`  | 60 000 000             | 5 000 000          |
//! | `create_pool`      | 80 000 000             | 8 000 000          |
//! | `deposit`          | 80 000 000             | 8 000 000          |
//! | `withdraw`         | 80 000 000             | 8 000 000          |
//! | `borrow`           | 120 000 000            | 12 000 000         |
//! | `repay`            | 120 000 000            | 12 000 000         |
//!
//! These thresholds include a ~50 % headroom over typical observed costs and
//! are well within the Soroban network-wide limits (100 M CPU per invocation).
//! If a change causes a function to exceed its budget, the CI job
//! `invocation-budget` will fail, signalling a regression.

use super::access::AdminControl;
use super::lending::PriceOracle;
use super::*;
use sep_40_oracle::{Asset, PriceData};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Env, String, Symbol,
};

use crate::{PropertyTokenContract, PropertyTokenContractClient, PRECISION};

// ───────────────────────────────────────────────
// Mock Oracle (same as in test.rs)
// ───────────────────────────────────────────────
#[contract]
pub struct MockOracleContract;

#[contractimpl]
impl MockOracleContract {
    pub fn set_price(env: Env, asset: Address, price: i128, timestamp: u64) {
        let key = (Symbol::new(&env, "price"), asset);
        let price_data = PriceData { price, timestamp };
        env.storage().persistent().set(&key, &price_data);
    }
    pub fn lastprice(env: Env, asset: Asset) -> Option<PriceData> {
        match asset {
            Asset::Stellar(addr) => {
                let key = (Symbol::new(&env, "price"), addr);
                env.storage().persistent().get(&key)
            }
            Asset::Other(_) => None,
        }
    }
    pub fn decimals(_env: Env) -> u32 {
        18
    }
    pub fn resolution(_env: Env) -> u32 {
        1
    }
    pub fn base(_env: Env) -> Asset {
        Asset::Other(Symbol::new(&_env, "USD"))
    }
    pub fn assets(_env: Env) -> soroban_sdk::Vec<Asset> {
        soroban_sdk::Vec::new(&_env)
    }
}

// ───────────────────────────────────────────────
// Budget threshold constants
// ───────────────────────────────────────────────

/// Maximum CPU instructions for share management functions.
const BUDGET_CPU_SHARES: u64 = 60_000_000;
/// Maximum memory bytes for share management functions.
const BUDGET_MEM_SHARES: u64 = 5_000_000;

/// Maximum CPU instructions for pool/lending operations.
const BUDGET_CPU_POOL: u64 = 80_000_000;
/// Maximum memory bytes for pool/lending operations.
const BUDGET_MEM_POOL: u64 = 8_000_000;

/// Maximum CPU instructions for complex lending operations (borrow/repay).
const BUDGET_CPU_COMPLEX: u64 = 120_000_000;
/// Maximum memory bytes for complex lending operations (borrow/repay).
const BUDGET_MEM_COMPLEX: u64 = 12_000_000;

// ───────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────

struct BudgetSetup<'a> {
    env: Env,
    admin: Address,
    token_address: Address,
    token_admin: Address,
    client: PropertyTokenContractClient<'a>,
    contract_address: Address,
}

fn budget_setup() -> BudgetSetup<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let token_address = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address()
        .clone();

    let contract_address = env.register(PropertyTokenContract, (&admin,));
    let client = PropertyTokenContractClient::new(&env, &contract_address);

    BudgetSetup {
        env,
        admin,
        token_address,
        token_admin,
        client,
        contract_address,
    }
}

/// Helper: assert CPU and memory are within the given thresholds. Uses the
/// Soroban SDK's own `Budget::print()` (a `testutils`-gated API) to report
/// observed costs to stdout - this avoids using `println!` directly, which
/// isn't available since this crate is `no_std`.
fn assert_budget(env: &Env, label: &str, max_cpu: u64, max_mem: u64) {
    let cpu = env.budget().cpu_instruction_cost();
    let mem = env.budget().memory_bytes_cost();
    env.budget().print();
    assert!(
        cpu <= max_cpu,
        "{} exceeded CPU budget: {} > {}",
        label,
        cpu,
        max_cpu
    );
    assert!(
        mem <= max_mem,
        "{} exceeded memory budget: {} > {}",
        label,
        mem,
        max_mem
    );
}

// ───────────────────────────────────────────────
// Budget tests
// ───────────────────────────────────────────────

#[test]
fn budget_check_mint_shares() {
    let s = budget_setup();
    let recipient = Address::generate(&s.env);

    s.env.budget().reset_default();
    s.client
        .mint_shares(&s.admin, &1_u64, &recipient, &1000_u64);
    assert_budget(&s.env, "mint_shares", BUDGET_CPU_SHARES, BUDGET_MEM_SHARES);
}

#[test]
fn budget_check_transfer_shares() {
    let s = budget_setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);

    // Mint first so there is something to transfer
    s.client.mint_shares(&s.admin, &1_u64, &alice, &500_u64);

    s.env.budget().reset_default();
    s.client.transfer_shares(&alice, &bob, &1_u64, &100_u64);
    assert_budget(
        &s.env,
        "transfer_shares",
        BUDGET_CPU_SHARES,
        BUDGET_MEM_SHARES,
    );
}

#[test]
fn budget_check_create_pool() {
    let s = budget_setup();
    let pool_id = String::from_str(&s.env, "BUDGET-POOL");

    s.env.budget().reset_default();
    s.client.create_pool(
        &s.admin,
        &pool_id,
        &String::from_str(&s.env, "Budget Test Pool"),
        &String::from_str(&s.env, "USDC"),
        &s.token_address,
        &750_000_000_000_000_000_i128,
        &800_000_000_000_000_000_i128,
        &50_000_000_000_000_000_i128,
        &1000_u32,
    );
    assert_budget(&s.env, "create_pool", BUDGET_CPU_POOL, BUDGET_MEM_POOL);
}

#[test]
fn budget_check_deposit() {
    let s = budget_setup();
    let pool_id = String::from_str(&s.env, "DEP-POOL");

    s.client.create_pool(
        &s.admin,
        &pool_id,
        &String::from_str(&s.env, "Deposit Pool"),
        &String::from_str(&s.env, "USDC"),
        &s.token_address,
        &750_000_000_000_000_000_i128,
        &800_000_000_000_000_000_i128,
        &50_000_000_000_000_000_i128,
        &1000_u32,
    );

    let depositor = Address::generate(&s.env);
    let sac = StellarAssetClient::new(&s.env, &s.token_address);
    sac.mint(&depositor, &10_000_000_i128);

    s.env.budget().reset_default();
    s.client.deposit(&depositor, &pool_id, &1_000_000_i128);
    assert_budget(&s.env, "deposit", BUDGET_CPU_POOL, BUDGET_MEM_POOL);
}

#[test]
fn budget_check_withdraw() {
    let s = budget_setup();
    let pool_id = String::from_str(&s.env, "WDR-POOL");

    s.client.create_pool(
        &s.admin,
        &pool_id,
        &String::from_str(&s.env, "Withdraw Pool"),
        &String::from_str(&s.env, "USDC"),
        &s.token_address,
        &750_000_000_000_000_000_i128,
        &800_000_000_000_000_000_i128,
        &50_000_000_000_000_000_i128,
        &1000_u32,
    );

    let depositor = Address::generate(&s.env);
    let sac = StellarAssetClient::new(&s.env, &s.token_address);
    sac.mint(&depositor, &10_000_000_i128);
    s.client.deposit(&depositor, &pool_id, &5_000_000_i128);

    s.env.budget().reset_default();
    s.client.withdraw(&depositor, &pool_id, &1_000_000_i128);
    assert_budget(&s.env, "withdraw", BUDGET_CPU_POOL, BUDGET_MEM_POOL);
}

#[test]
fn budget_check_borrow() {
    let s = budget_setup();
    let pool_id = String::from_str(&s.env, "BRW-POOL");

    // Create collateral token
    let collateral_admin = Address::generate(&s.env);
    let collateral_address = s
        .env
        .register_stellar_asset_contract_v2(collateral_admin.clone())
        .address()
        .clone();

    s.client.create_pool(
        &s.admin,
        &pool_id,
        &String::from_str(&s.env, "Borrow Pool"),
        &String::from_str(&s.env, "USDC"),
        &s.token_address,
        &750_000_000_000_000_000_i128,
        &800_000_000_000_000_000_i128,
        &50_000_000_000_000_000_i128,
        &1000_u32,
    );

    // Deploy mock oracle and set prices
    let oracle_address = s.env.register(MockOracleContract, ());
    let oracle_client = MockOracleContractClient::new(&s.env, &oracle_address);
    s.client.set_oracle(&oracle_address, &s.admin);
    oracle_client.set_price(&collateral_address, &(2 * PRECISION), &1000_u64);

    // Seed pool liquidity
    let lp = Address::generate(&s.env);
    let sac = StellarAssetClient::new(&s.env, &s.token_address);
    sac.mint(&lp, &100_000_000_i128);
    s.client.deposit(&lp, &pool_id, &50_000_000_i128);

    // Prepare borrower collateral
    let borrower = Address::generate(&s.env);
    let col_sac = StellarAssetClient::new(&s.env, &collateral_address);
    col_sac.mint(&borrower, &100_000_000_i128);

    s.env.ledger().with_mut(|li| li.timestamp = 1000);

    s.env.budget().reset_default();
    s.client.borrow(
        &borrower,
        &pool_id,
        &1_000_000_i128,
        &collateral_address,
        &10_000_000_i128,
    );
    assert_budget(&s.env, "borrow", BUDGET_CPU_COMPLEX, BUDGET_MEM_COMPLEX);
}

#[test]
fn budget_check_repay() {
    let s = budget_setup();
    let pool_id = String::from_str(&s.env, "RPY-POOL");

    // Create collateral token
    let collateral_admin = Address::generate(&s.env);
    let collateral_address = s
        .env
        .register_stellar_asset_contract_v2(collateral_admin.clone())
        .address()
        .clone();

    s.client.create_pool(
        &s.admin,
        &pool_id,
        &String::from_str(&s.env, "Repay Pool"),
        &String::from_str(&s.env, "USDC"),
        &s.token_address,
        &750_000_000_000_000_000_i128,
        &800_000_000_000_000_000_i128,
        &50_000_000_000_000_000_i128,
        &1000_u32,
    );

    // Deploy mock oracle
    let oracle_address = s.env.register(MockOracleContract, ());
    let oracle_client = MockOracleContractClient::new(&s.env, &oracle_address);
    s.client.set_oracle(&oracle_address, &s.admin);
    oracle_client.set_price(&collateral_address, &(2 * PRECISION), &1000_u64);

    // Seed pool
    let lp = Address::generate(&s.env);
    let sac = StellarAssetClient::new(&s.env, &s.token_address);
    sac.mint(&lp, &100_000_000_i128);
    s.client.deposit(&lp, &pool_id, &50_000_000_i128);

    // Borrow first
    let borrower = Address::generate(&s.env);
    let col_sac = StellarAssetClient::new(&s.env, &collateral_address);
    col_sac.mint(&borrower, &100_000_000_i128);
    sac.mint(&borrower, &100_000_000_i128); // for repay

    s.env.ledger().with_mut(|li| li.timestamp = 1000);

    s.client.borrow(
        &borrower,
        &pool_id,
        &1_000_000_i128,
        &collateral_address,
        &10_000_000_i128,
    );

    s.env.budget().reset_default();
    s.client.repay(&borrower, &pool_id, &500_000_i128);
    assert_budget(&s.env, "repay", BUDGET_CPU_COMPLEX, BUDGET_MEM_COMPLEX);
}