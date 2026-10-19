//! # Soroban Invocation Budget Check Tests
//!
//! These tests measure the CPU instruction count and memory (bytes) consumed by
//! the main `defi-rwa` contract entry-points and assert they stay within the
//! documented budget thresholds.
//!
//! ## Soroban network per-transaction limits
//!
//! Every Soroban transaction is capped by the network at:
//!
//! - **100 000 000 CPU instructions** (`txMaxCpuInstructions`)
//! - **40 000 000 memory bytes** (`txMaxMemoryBytes`, i.e. 40 MB)
//!
//! No threshold in this module may exceed those values. A threshold above the
//! network limit would let a call that the network itself would reject pass as
//! "within budget", so [`assert_budget`] re-checks every threshold against the
//! network limits at run time.
//!
//! ## Threshold policy
//!
//! Each threshold is the measured cost of the checked invocation (printed as
//! `MEASURED ...` when running with `--nocapture`) times a documented **10x
//! margin**, rounded up to a round number. Host cost accounting is
//! deterministic, so the margin is not about jitter: it absorbs (a) the gap
//! between native test builds and on-chain WASM execution, which the SDK
//! documents as an under-estimate for native tests, and (b) legitimate small
//! additions to these code paths across SDK upgrades - while still failing
//! loudly on real regressions such as added storage reads or crypto calls.
//!
//! ## Measured costs
//!
//! Measured with `cargo test --package rwa-defi-contract budget_check -- --nocapture`
//! on the native test build (soroban-sdk 25.3):
//!
//! | Function          | Measured CPU  | CPU threshold (=10x, rounded) | Measured mem | Mem threshold (=10x, rounded) |
//! |-------------------|--------------:|------------------------------:|-------------:|------------------------------:|
//! | `mint_shares`     |    104 751    |                 1 100 000     |     41 670   |                    500 000    |
//! | `transfer_shares` |    111 672    |                 1 200 000     |     44 259   |                    500 000    |
//! | `create_pool`     |    321 829    |                 3 300 000     |    139 715   |                  1 500 000    |
//! | `deposit`         |    531 942    |                 5 400 000     |    208 030   |                  2 100 000    |
//! | `withdraw`        |    554 074    |                 5 600 000     |    198 439   |                  2 000 000    |
//! | `borrow`          |  1 085 172    |                11 000 000     |    403 840   |                  4 100 000    |
//! | `repay`           |    835 449    |                 8 400 000     |    293 857   |                  3 000 000    |
//!
//! Every threshold is orders of magnitude below the network limits above;
//! [`assert_budget`] additionally re-checks that invariant at run time. If a
//! change causes a function to exceed its budget, the CI job
//! `invocation-budget` will fail, signalling a regression. Conversely,
//! lowering any threshold below its measured value makes the corresponding
//! test fail - the checks are live, not decorative.

extern crate std;

use super::*;
use sep_40_oracle::{Asset, PriceData};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::StellarAssetClient,
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
// Network limits and budget threshold constants
// ───────────────────────────────────────────────

/// Soroban network per-transaction CPU instruction limit (`txMaxCpuInstructions`).
/// No threshold below may exceed this value.
const NETWORK_CPU_LIMIT: u64 = 100_000_000;
/// Soroban network per-transaction memory byte limit (`txMaxMemoryBytes` = 40 MB).
/// No threshold below may exceed this value.
const NETWORK_MEM_LIMIT: u64 = 40_000_000;

/// CPU budget for `mint_shares` (measured 104 751, 10x margin).
const BUDGET_CPU_MINT_SHARES: u64 = 1_100_000;
/// Memory budget for `mint_shares` (measured 41 670, 10x margin).
const BUDGET_MEM_MINT_SHARES: u64 = 500_000;

/// CPU budget for `transfer_shares` (measured 111 672, 10x margin).
const BUDGET_CPU_TRANSFER_SHARES: u64 = 1_200_000;
/// Memory budget for `transfer_shares` (measured 44 259, 10x margin).
const BUDGET_MEM_TRANSFER_SHARES: u64 = 500_000;

/// CPU budget for `create_pool` (measured 321 829, 10x margin).
const BUDGET_CPU_CREATE_POOL: u64 = 3_300_000;
/// Memory budget for `create_pool` (measured 139 715, 10x margin).
const BUDGET_MEM_CREATE_POOL: u64 = 1_500_000;

/// CPU budget for `deposit` (measured 531 942, 10x margin).
const BUDGET_CPU_DEPOSIT: u64 = 5_400_000;
/// Memory budget for `deposit` (measured 208 030, 10x margin).
const BUDGET_MEM_DEPOSIT: u64 = 2_100_000;

/// CPU budget for `withdraw` (measured 554 074, 10x margin).
const BUDGET_CPU_WITHDRAW: u64 = 5_600_000;
/// Memory budget for `withdraw` (measured 198 439, 10x margin).
const BUDGET_MEM_WITHDRAW: u64 = 2_000_000;

/// CPU budget for `borrow` (measured 1 085 172, 10x margin).
const BUDGET_CPU_BORROW: u64 = 11_000_000;
/// Memory budget for `borrow` (measured 403 840, 10x margin).
const BUDGET_MEM_BORROW: u64 = 4_100_000;

/// CPU budget for `repay` (measured 835 449, 10x margin).
const BUDGET_CPU_REPAY: u64 = 8_400_000;
/// Memory budget for `repay` (measured 293 857, 10x margin).
const BUDGET_MEM_REPAY: u64 = 3_000_000;

// ───────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────

struct BudgetSetup<'a> {
    env: Env,
    admin: Address,
    token_address: Address,
    // `_token_admin` mirrors test.rs: retained only so the registered
    // stellar asset contract has a named admin in setup.
    _token_admin: Address,
    client: PropertyTokenContractClient<'a>,
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
        _token_admin: token_admin,
        client,
    }
}

/// Assert that the measured invocation succeeded *before* its budget is
/// checked. A failed invocation aborts early and consumes almost nothing, so
/// without this a failing call could pass as "cheap".
macro_rules! assert_invocation_ok {
    ($result:expr, $label:expr) => {
        // Only the error arms are formatted, so the success type does not
        // need to implement `Debug`.
        match $result {
            Ok(Ok(_)) => (),
            Ok(Err(e)) => panic!("{} invocation failed (conversion): {:?}", $label, e),
            Err(e) => panic!("{} invocation failed (contract/host): {:?}", $label, e),
        }
    };
}

/// Helper: assert CPU and memory are within the given thresholds. Uses the
/// Soroban SDK's own `Budget::print()` (a `testutils`-gated API) to report
/// observed costs to stdout, plus a greppable `MEASURED` line, so running
/// with `--nocapture` documents the real cost of every checked call.
fn assert_budget(env: &Env, label: &str, max_cpu: u64, max_mem: u64) {
    // Guard the guards: a threshold above the network limit is dishonest,
    // because the network would reject such a call before the budget here
    // would ever complain.
    assert!(
        max_cpu <= NETWORK_CPU_LIMIT,
        "{} CPU threshold {} exceeds the network limit {}",
        label,
        max_cpu,
        NETWORK_CPU_LIMIT
    );
    assert!(
        max_mem <= NETWORK_MEM_LIMIT,
        "{} memory threshold {} exceeds the network limit {}",
        label,
        max_mem,
        NETWORK_MEM_LIMIT
    );

    let budget = env.cost_estimate().budget();
    let cpu = budget.cpu_instruction_cost();
    let mem = budget.memory_bytes_cost();
    budget.print();
    std::println!("MEASURED {} cpu={} mem={}", label, cpu, mem);
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

    s.env.cost_estimate().budget().reset_unlimited();
    let res = s
        .client
        .try_mint_shares(&s.admin, &1_u64, &recipient, &1000_u64);
    assert_invocation_ok!(res, "mint_shares");
    assert_budget(
        &s.env,
        "mint_shares",
        BUDGET_CPU_MINT_SHARES,
        BUDGET_MEM_MINT_SHARES,
    );
}

#[test]
fn budget_check_transfer_shares() {
    let s = budget_setup();
    let alice = Address::generate(&s.env);
    let bob = Address::generate(&s.env);

    // Mint first so there is something to transfer
    s.client.mint_shares(&s.admin, &1_u64, &alice, &500_u64);

    s.env.cost_estimate().budget().reset_unlimited();
    let res = s.client.try_transfer_shares(&alice, &bob, &1_u64, &100_u64);
    assert_invocation_ok!(res, "transfer_shares");
    assert_budget(
        &s.env,
        "transfer_shares",
        BUDGET_CPU_TRANSFER_SHARES,
        BUDGET_MEM_TRANSFER_SHARES,
    );
}

#[test]
fn budget_check_create_pool() {
    let s = budget_setup();
    let pool_id = String::from_str(&s.env, "BUDGET-POOL");

    s.env.cost_estimate().budget().reset_unlimited();
    let res = s.client.try_create_pool(
        &s.admin,
        &pool_id,
        &String::from_str(&s.env, "Budget Test Pool"),
        &String::from_str(&s.env, "USDC"),
        &s.token_address,
        &750_000_000_000_000_000_i128,
        &800_000_000_000_000_000_i128,
        &50_000_000_000_000_000_i128,
        &500_000_000_000_000_000_i128,
        &1000_u32,
    );
    assert_invocation_ok!(res, "create_pool");
    assert_budget(
        &s.env,
        "create_pool",
        BUDGET_CPU_CREATE_POOL,
        BUDGET_MEM_CREATE_POOL,
    );
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
        &500_000_000_000_000_000_i128,
        &1000_u32,
    );

    let depositor = Address::generate(&s.env);
    let sac = StellarAssetClient::new(&s.env, &s.token_address);
    sac.mint(&depositor, &10_000_000_i128);

    s.env.cost_estimate().budget().reset_unlimited();
    let res = s.client.try_deposit(&depositor, &pool_id, &1_000_000_i128);
    assert_invocation_ok!(res, "deposit");
    assert_budget(&s.env, "deposit", BUDGET_CPU_DEPOSIT, BUDGET_MEM_DEPOSIT);
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
        &500_000_000_000_000_000_i128,
        &1000_u32,
    );

    let depositor = Address::generate(&s.env);
    let sac = StellarAssetClient::new(&s.env, &s.token_address);
    sac.mint(&depositor, &10_000_000_i128);
    s.client.deposit(&depositor, &pool_id, &5_000_000_i128);

    s.env.cost_estimate().budget().reset_unlimited();
    let res = s.client.try_withdraw(&depositor, &pool_id, &1_000_000_i128);
    assert_invocation_ok!(res, "withdraw");
    assert_budget(&s.env, "withdraw", BUDGET_CPU_WITHDRAW, BUDGET_MEM_WITHDRAW);
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
        &500_000_000_000_000_000_i128,
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

    s.env.cost_estimate().budget().reset_unlimited();
    let res = s.client.try_borrow(
        &borrower,
        &pool_id,
        &1_000_000_i128,
        &collateral_address,
        &10_000_000_i128,
    );
    assert_invocation_ok!(res, "borrow");
    assert_budget(&s.env, "borrow", BUDGET_CPU_BORROW, BUDGET_MEM_BORROW);
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
        &500_000_000_000_000_000_i128,
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

    s.env.cost_estimate().budget().reset_unlimited();
    let res = s.client.try_repay(&borrower, &pool_id, &500_000_i128);
    assert_invocation_ok!(res, "repay");
    assert_budget(&s.env, "repay", BUDGET_CPU_REPAY, BUDGET_MEM_REPAY);
}
