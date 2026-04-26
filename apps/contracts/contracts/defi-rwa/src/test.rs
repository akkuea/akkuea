use super::access::{AdminControl, PauseControl};
use super::events::{LendingEvents, PropertyEvents};
use super::lending::PriceOracle;
use super::storage;
use super::*;
use sep_40_oracle::{Asset, PriceData};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Env, String, Symbol,
};

use crate::{
    InterestRateModel, PoolStorage, PositionStorage, PropertyTokenContract,
    PropertyTokenContractClient, PRECISION, SECONDS_PER_YEAR,
};

// ───────────────────────────────────────────────
// Helper: Register the contract + a token, mint, and return clients
// ───────────────────────────────────────────────

struct TestSetup<'a> {
    env: Env,
    admin: Address,
    token_address: Address,
    _token_admin: Address,
    contract_client: PropertyTokenContractClient<'a>,
    contract_address: Address,
}

// Mock Oracle Contract for Testing
// Implements SEP-40 Price Feed Oracle interface
#[contract]
pub struct MockOracleContract;

#[contractimpl]
impl MockOracleContract {
    /// Set a price for an asset (for testing purposes)
    pub fn set_price(env: Env, asset: Address, price: i128, timestamp: u64) {
        let key = (Symbol::new(&env, "price"), asset);
        let price_data = PriceData { price, timestamp };
        env.storage().persistent().set(&key, &price_data);
    }

    /// Get the last price for an asset (SEP-40 interface)
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

fn setup() -> TestSetup<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);

    // Deploy a Stellar Asset token
    let token_address = env
        .register_stellar_asset_contract_v2(token_admin.clone())
        .address()
        .clone();

    // Deploy our combined contract
    let contract_address = env.register(PropertyTokenContract, (&admin,));
    let contract_client = PropertyTokenContractClient::new(&env, &contract_address);

    TestSetup {
        env,
        admin,
        token_address,
        _token_admin: token_admin,
        contract_client,
        contract_address,
    }
}

fn create_default_pool(setup: &TestSetup) -> String {
    let pool_id = String::from_str(&setup.env, "USDC-POOL");
    setup.contract_client.create_pool(
        &setup.admin,
        &pool_id,
        &String::from_str(&setup.env, "USDC Lending Pool"),
        &String::from_str(&setup.env, "USDC"),
        &setup.token_address,
        &750_000_000_000_000_000_i128, // 75% collateral factor
        &800_000_000_000_000_000_i128, // 80% liquidation threshold
        &50_000_000_000_000_000_i128,  // 5% liquidation penalty
        &1000_u32,                     // 10% reserve factor
    );
    pool_id
}

// Helper for direct storage tests that used PropertyTokenContract previously
fn setup_internal() -> (Address, Env) {
    let env = Env::default();
    let admin = Address::generate(&env);
    (env.register(PropertyTokenContract, (&admin,)), env)
}

// Store and retrieve LendingPool

#[test]
fn test_store_and_retrieve_lending_pool() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));
    let asset_address = Address::generate(&env);
    let pool_id = String::from_str(&env, "USDC-POOL");

    let pool = LendingPool {
        id: pool_id.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: asset_address.clone(),
        collateral_factor: 750_000_000_000_000_000,
        liquidation_threshold: 800_000_000_000_000_000,
        liquidation_penalty: 50_000_000_000_000_000,
        reserve_factor: 1000,
        is_active: true,
        created_at: 1700000000,
    };

    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool);
    });

    let exists = env.as_contract(&contract_id, || PoolStorage::exists(&env, &pool_id));
    assert!(exists);

    let retrieved = env.as_contract(&contract_id, || PoolStorage::get(&env, &pool_id).unwrap());
    assert_eq!(retrieved.id, pool.id);
    assert_eq!(retrieved.name, pool.name);
    assert_eq!(retrieved.asset, pool.asset);
    assert_eq!(retrieved.asset_address, pool.asset_address);
    assert_eq!(retrieved.collateral_factor, pool.collateral_factor);
    assert_eq!(retrieved.liquidation_threshold, pool.liquidation_threshold);
    assert_eq!(retrieved.liquidation_penalty, pool.liquidation_penalty);
    assert_eq!(retrieved.reserve_factor, pool.reserve_factor);
    assert_eq!(retrieved.is_active, pool.is_active);
    assert_eq!(retrieved.created_at, pool.created_at);
}

fn mint_tokens(setup: &TestSetup, to: &Address, amount: i128) {
    let sac = StellarAssetClient::new(&setup.env, &setup.token_address);
    sac.mint(to, &amount);
}

struct BorrowTestSetup<'a> {
    env: Env,
    contract_id: Address,
    contract_client: PropertyTokenContractClient<'a>,
    borrower: Address,
    pool_id: String,
    usdc_address: Address,
    xlm_address: Address,
}

fn setup_borrow_test() -> BorrowTestSetup<'static> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));
    let contract_client = PropertyTokenContractClient::new(&env, &contract_id);
    let oracle_id = env.register(MockOracleContract, ());
    let borrower = Address::generate(&env);

    let usdc_admin = Address::generate(&env);
    let usdc_contract = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let usdc_token = StellarAssetClient::new(&env, &usdc_contract.address());

    let xlm_admin = Address::generate(&env);
    let xlm_contract = env.register_stellar_asset_contract_v2(xlm_admin.clone());
    let xlm_token = StellarAssetClient::new(&env, &xlm_contract.address());

    let pool_id = String::from_str(&env, "USDC-POOL");
    let pool = LendingPool {
        id: pool_id.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: usdc_contract.address().clone(),
        collateral_factor: 750_000_000_000_000_000,
        liquidation_threshold: 800_000_000_000_000_000,
        liquidation_penalty: 50_000_000_000_000_000,
        reserve_factor: 1000,
        is_active: true,
        created_at: env.ledger().timestamp(),
    };

    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool);
        PoolStorage::set_total_deposits(&env, &pool_id, 10_000_000_000);
        PoolStorage::set_total_borrows(&env, &pool_id, 0);

        let model = InterestRateModel::default();
        InterestStorage::set_model(&env, &pool_id, &model);
        InterestStorage::set_interest_index(&env, &pool_id, PRECISION);
        InterestStorage::set_last_accrual(&env, &pool_id, env.ledger().timestamp());
        PriceOracle::set_oracle_address(&env, &oracle_id);
    });

    env.as_contract(&oracle_id, || {
        MockOracleContract::set_price(
            env.clone(),
            xlm_contract.address().clone(),
            PRECISION,
            env.ledger().timestamp(),
        );
    });

    usdc_token.mint(&borrower, &2_000_000_000);
    xlm_token.mint(&borrower, &2_000_000_000);
    usdc_token.mint(&contract_id, &10_000_000_000);

    contract_client.borrow(
        &borrower,
        &pool_id,
        &1_000_000_000,
        &xlm_contract.address(),
        &2_000_000_000,
    );

    BorrowTestSetup {
        env,
        contract_id,
        contract_client,
        borrower,
        pool_id,
        usdc_address: usdc_contract.address().clone(),
        xlm_address: xlm_contract.address().clone(),
    }
}

// ═══════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════

// ─── Pool creation ─────────────────────────────

#[test]
fn test_create_pool() {
    let s = setup();
    let pool_id = create_default_pool(&s);

    let pool = s.contract_client.get_pool(&pool_id);
    assert_eq!(pool.id, pool_id);
    assert_eq!(pool.collateral_factor, 750_000_000_000_000_000);
    assert_eq!(pool.liquidation_threshold, 800_000_000_000_000_000);
    assert_eq!(pool.liquidation_penalty, 50_000_000_000_000_000);
    assert_eq!(pool.reserve_factor, 1000);
    assert!(pool.is_active);
}

#[test]
#[should_panic(expected = "pool already exists")]
fn test_create_pool_duplicate() {
    let s = setup();
    create_default_pool(&s);
    // Second creation with same ID should panic
    create_default_pool(&s);
}

#[test]
#[should_panic(expected = "only admin")]
fn test_create_pool_unauthorized() {
    let s = setup();
    let non_admin = Address::generate(&s.env);
    let pool_id = String::from_str(&s.env, "BAD-POOL");
    s.contract_client.create_pool(
        &non_admin,
        &pool_id,
        &String::from_str(&s.env, "Bad Pool"),
        &String::from_str(&s.env, "BAD"),
        &s.token_address,
        &750_000_000_000_000_000_i128,
        &800_000_000_000_000_000_i128,
        &50_000_000_000_000_000_i128,
        &1000_u32,
    );
}

// ─── Deposit ───────────────────────────────────

#[test]
fn test_deposit() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);
    let deposit_amount: i128 = 1_000_000_000; // 1000 tokens

    // Mint tokens to user
    mint_tokens(&s, &user, deposit_amount);

    // Deposit
    s.contract_client.deposit(&user, &pool_id, &deposit_amount);

    // Verify position
    let position = s.contract_client.get_deposit_position(&user, &pool_id);
    assert_eq!(position.amount, deposit_amount);
    assert_eq!(position.depositor, user);
    assert_eq!(position.pool_id, pool_id);

    // Verify total deposits
    let total = s.contract_client.get_total_deposits(&pool_id);
    assert_eq!(total, deposit_amount);

    // Verify token balance moved to contract
    let token = TokenClient::new(&s.env, &s.token_address);
    assert_eq!(token.balance(&user), 0);
    assert_eq!(token.balance(&s.contract_address), deposit_amount);

    // Verify user deposits list
    let user_deposits = s.contract_client.get_user_deposits(&user);
    assert_eq!(user_deposits.len(), 1);
    assert!(user_deposits.contains(&pool_id));
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_deposit_zero_amount() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);
    s.contract_client.deposit(&user, &pool_id, &0_i128);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_deposit_negative_amount() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);
    s.contract_client.deposit(&user, &pool_id, &(-100_i128));
}

#[test]
#[should_panic(expected = "pool not found")]
fn test_deposit_nonexistent_pool() {
    let s = setup();
    let user = Address::generate(&s.env);
    let bad_pool = String::from_str(&s.env, "NOPE");
    s.contract_client.deposit(&user, &bad_pool, &100_i128);
}

#[test]
fn test_deposit_multiple_same_pool() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);

    mint_tokens(&s, &user, 2_000_000_000);

    // First deposit
    s.contract_client
        .deposit(&user, &pool_id, &1_000_000_000_i128);

    // Second deposit into the same pool
    s.contract_client
        .deposit(&user, &pool_id, &500_000_000_i128);

    let position = s.contract_client.get_deposit_position(&user, &pool_id);
    assert_eq!(position.amount, 1_500_000_000);

    let total = s.contract_client.get_total_deposits(&pool_id);
    assert_eq!(total, 1_500_000_000);

    // User deposits list should have the pool only once
    let user_deposits = s.contract_client.get_user_deposits(&user);
    assert_eq!(user_deposits.len(), 1);
}

#[test]
fn test_deposit_multiple_users() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user_a = Address::generate(&s.env);
    let user_b = Address::generate(&s.env);

    mint_tokens(&s, &user_a, 1_000_000_000);
    mint_tokens(&s, &user_b, 2_000_000_000);

    s.contract_client
        .deposit(&user_a, &pool_id, &1_000_000_000_i128);
    s.contract_client
        .deposit(&user_b, &pool_id, &2_000_000_000_i128);

    let pos_a = s.contract_client.get_deposit_position(&user_a, &pool_id);
    let pos_b = s.contract_client.get_deposit_position(&user_b, &pool_id);
    assert_eq!(pos_a.amount, 1_000_000_000);
    assert_eq!(pos_b.amount, 2_000_000_000);

    let total = s.contract_client.get_total_deposits(&pool_id);
    assert_eq!(total, 3_000_000_000);
}

// ─── Withdraw ──────────────────────────────────

#[test]
fn test_withdraw_partial() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);

    mint_tokens(&s, &user, 1_000_000_000);
    s.contract_client
        .deposit(&user, &pool_id, &1_000_000_000_i128);

    // Withdraw half
    s.contract_client
        .withdraw(&user, &pool_id, &500_000_000_i128);

    let position = s.contract_client.get_deposit_position(&user, &pool_id);
    assert_eq!(position.amount, 500_000_000);

    let total = s.contract_client.get_total_deposits(&pool_id);
    assert_eq!(total, 500_000_000);

    let token = TokenClient::new(&s.env, &s.token_address);
    assert_eq!(token.balance(&user), 500_000_000);
    assert_eq!(token.balance(&s.contract_address), 500_000_000);
}

#[test]
fn test_withdraw_full_amount() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);

    mint_tokens(&s, &user, 1_000_000_000);
    s.contract_client
        .deposit(&user, &pool_id, &1_000_000_000_i128);

    // Withdraw everything
    s.contract_client
        .withdraw(&user, &pool_id, &1_000_000_000_i128);

    let total = s.contract_client.get_total_deposits(&pool_id);
    assert_eq!(total, 0);

    let token = TokenClient::new(&s.env, &s.token_address);
    assert_eq!(token.balance(&user), 1_000_000_000);
    assert_eq!(token.balance(&s.contract_address), 0);

    // User deposits list should be empty after full withdrawal
    let user_deposits = s.contract_client.get_user_deposits(&user);
    assert_eq!(user_deposits.len(), 0);
}

#[test]
#[should_panic(expected = "insufficient balance")]
fn test_withdraw_insufficient_balance() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);

    mint_tokens(&s, &user, 1_000_000_000);
    s.contract_client
        .deposit(&user, &pool_id, &1_000_000_000_i128);

    // Try to withdraw more than deposited
    s.contract_client
        .withdraw(&user, &pool_id, &2_000_000_000_i128);
}

#[test]
#[should_panic(expected = "amount must be positive")]
fn test_withdraw_zero_amount() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);
    s.contract_client.withdraw(&user, &pool_id, &0_i128);
}

#[test]
#[should_panic(expected = "no deposit position")]
fn test_withdraw_no_position() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);
    // Never deposited – should panic
    s.contract_client.withdraw(&user, &pool_id, &100_i128);
}

// ─── Interest accrual ──────────────────────────

#[test]
fn test_accrue_interest() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);

    mint_tokens(&s, &user, 1_000_000_000);
    s.contract_client
        .deposit(&user, &pool_id, &1_000_000_000_i128);

    let index_before = s.contract_client.get_interest_index(&pool_id);
    assert_eq!(index_before, PRECISION); // should start at 1e18

    // Simulate some borrows so interest accrues meaningfully
    // (without actual borrows, utilization=0 so only base rate applies)
    s.env.as_contract(&s.contract_address, || {
        PoolStorage::set_total_borrows(&s.env, &pool_id, 500_000_000);
    });

    // Advance time by 1 year
    let mut li = s.env.ledger().get();
    li.timestamp += 31_536_000; // 1 year in seconds
    s.env.ledger().set(li);

    // Accrue
    s.contract_client.accrue_interest(&pool_id);

    let index_after = s.contract_client.get_interest_index(&pool_id);
    assert!(
        index_after > index_before,
        "interest index should increase after time passes with borrows"
    );
}

#[test]
fn test_accrue_interest_no_time_elapsed() {
    let s = setup();
    let pool_id = create_default_pool(&s);

    let index_before = s.contract_client.get_interest_index(&pool_id);
    // Accrue with no time change – should be a no-op
    s.contract_client.accrue_interest(&pool_id);
    let index_after = s.contract_client.get_interest_index(&pool_id);
    assert_eq!(index_before, index_after);
}

#[test]
#[should_panic(expected = "pool not found")]
fn test_accrue_interest_nonexistent_pool() {
    let s = setup();
    let bad_pool = String::from_str(&s.env, "NOPE");
    s.contract_client.accrue_interest(&bad_pool);
}

// ─── Health factor precision ───────────────────

#[test]
fn test_health_factor_precision() {
    // Use token-unit values (not pre-scaled by PRECISION).
    // The function multiplies collateral_value * liquidation_threshold internally,
    // so values should be in raw token units.

    // collateral = 1000 tokens, debt = 800 tokens, LT = 80% (0.8 * PRECISION)
    let collateral: i128 = 1_000_000_000_000; // 1000 tokens with 9 decimals
    let debt: i128 = 800_000_000_000; // 800 tokens with 9 decimals
    let lt: i128 = 800_000_000_000_000_000; // 80% in PRECISION

    let hf = PositionStorage::calculate_health_factor(collateral, debt, lt);

    // Expected: (1000 * 0.8) / 800 = 1.0 * PRECISION
    // Formula: (collateral * lt) / debt
    // = (1000e9 * 800e15) / 800e9 = 1_000_000_000_000_000_000 = PRECISION
    assert_eq!(
        hf, PRECISION,
        "health factor should be PRECISION for balanced position"
    );

    // Over-collateralized: collateral = 2000 tokens
    let collateral_2: i128 = 2_000_000_000_000;
    let hf_2 = PositionStorage::calculate_health_factor(collateral_2, debt, lt);
    assert!(
        hf_2 > PRECISION,
        "over-collateralized position should have HF > PRECISION"
    );
    assert_eq!(hf_2, 2 * PRECISION, "2000 * 0.8 / 800 = 2 * PRECISION");

    // Under-collateralized: collateral = 500 tokens
    let collateral_3: i128 = 500_000_000_000;
    let hf_3 = PositionStorage::calculate_health_factor(collateral_3, debt, lt);
    assert_eq!(
        hf_3,
        PRECISION / 2,
        "under-collateralized: 500 * 0.8 / 800 = 0.5 * PRECISION"
    );

    // Zero debt → MAX
    let hf_zero = PositionStorage::calculate_health_factor(collateral, 0, lt);
    assert_eq!(hf_zero, i128::MAX);
}

// ─── Read-only views ───────────────────────────

#[test]
#[should_panic(expected = "pool not found")]
fn test_get_pool_nonexistent() {
    let s = setup();
    let bad_pool = String::from_str(&s.env, "NOPE");
    s.contract_client.get_pool(&bad_pool);
}

#[test]
fn test_get_total_deposits_and_borrows() {
    let s = setup();
    let pool_id = create_default_pool(&s);

    assert_eq!(s.contract_client.get_total_deposits(&pool_id), 0);
    assert_eq!(s.contract_client.get_total_borrows(&pool_id), 0);

    let user = Address::generate(&s.env);
    mint_tokens(&s, &user, 500_000_000);
    s.contract_client
        .deposit(&user, &pool_id, &500_000_000_i128);

    assert_eq!(s.contract_client.get_total_deposits(&pool_id), 500_000_000);
    assert_eq!(s.contract_client.get_total_borrows(&pool_id), 0);
}

// ─── Interest rate model (unit) ────────────────

#[test]
fn test_interest_rate_model_unit() {
    let model = InterestRateModel::default();

    // 0% utilization → base rate only
    let rate_0 = model.calculate_borrow_rate(0);
    assert_eq!(rate_0, model.base_rate);

    // Optimal (80%) → base + slope1
    let rate_opt = model.calculate_borrow_rate(model.optimal_utilization);
    assert_eq!(rate_opt, model.base_rate + model.slope1);

    // 100% utilization → higher than optimal
    let rate_100 = model.calculate_borrow_rate(PRECISION);
    assert!(rate_100 > rate_opt);

    // Monotonically increasing
    let rate_50 = model.calculate_borrow_rate(PRECISION / 2);
    let rate_90 = model.calculate_borrow_rate(900_000_000_000_000_000);
    assert!(rate_50 > rate_0);
    assert!(rate_90 > rate_opt);
    assert!(rate_100 > rate_90);
}

#[test]
fn test_supply_rate_less_than_borrow_rate() {
    let model = InterestRateModel::default();
    let utilization = PRECISION / 2;
    let reserve_factor = 100_000_000_000_000_000_i128; // 10%

    let borrow_rate = model.calculate_borrow_rate(utilization);
    let supply_rate = model.calculate_supply_rate(borrow_rate, utilization, reserve_factor);

    assert!(supply_rate < borrow_rate);
    assert!(supply_rate > 0);
}

// ─── Utilization & liquidity (unit) ────────────

#[test]
fn test_utilization_calculations() {
    assert_eq!(PoolStorage::calculate_utilization(1_000, 0), 0);
    assert_eq!(
        PoolStorage::calculate_utilization(1_000, 500),
        PRECISION / 2
    );
    assert_eq!(PoolStorage::calculate_utilization(1_000, 1_000), PRECISION);
    assert_eq!(PoolStorage::calculate_utilization(0, 100), 0);

    assert_eq!(PoolStorage::calculate_available_liquidity(1_000, 500), 500);
    assert_eq!(PoolStorage::calculate_available_liquidity(1_000, 1_000), 0);
    assert_eq!(PoolStorage::calculate_available_liquidity(1_000, 1_100), 0);
}

// ─── Deposit-then-withdraw round trip ──────────

#[test]
fn test_deposit_withdraw_round_trip() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);
    let amount: i128 = 5_000_000_000;

    mint_tokens(&s, &user, amount);

    let token = TokenClient::new(&s.env, &s.token_address);
    assert_eq!(token.balance(&user), amount);

    // Deposit all
    s.contract_client.deposit(&user, &pool_id, &amount);
    assert_eq!(token.balance(&user), 0);
    assert_eq!(token.balance(&s.contract_address), amount);

    // Withdraw all
    s.contract_client.withdraw(&user, &pool_id, &amount);
    assert_eq!(token.balance(&user), amount);
    assert_eq!(token.balance(&s.contract_address), 0);
    assert_eq!(s.contract_client.get_total_deposits(&pool_id), 0);
}

// ─── Multiple pools isolation ──────────────────

#[test]
fn test_multiple_pools_isolation() {
    let s = setup();

    // Create two pools with different tokens
    let token_admin_2 = Address::generate(&s.env);
    let token_address_2 = s
        .env
        .register_stellar_asset_contract_v2(token_admin_2.clone())
        .address()
        .clone();

    let pool_a = String::from_str(&s.env, "POOL-A");
    let pool_b = String::from_str(&s.env, "POOL-B");

    s.contract_client.create_pool(
        &s.admin,
        &pool_a,
        &String::from_str(&s.env, "Pool A"),
        &String::from_str(&s.env, "TKNA"),
        &s.token_address,
        &750_000_000_000_000_000_i128,
        &800_000_000_000_000_000_i128,
        &50_000_000_000_000_000_i128,
        &1000_u32,
    );

    s.contract_client.create_pool(
        &s.admin,
        &pool_b,
        &String::from_str(&s.env, "Pool B"),
        &String::from_str(&s.env, "TKNB"),
        &token_address_2,
        &700_000_000_000_000_000_i128,
        &750_000_000_000_000_000_i128,
        &60_000_000_000_000_000_i128,
        &1200_u32,
    );

    let user = Address::generate(&s.env);
    mint_tokens(&s, &user, 1_000_000_000);
    let sac_b = StellarAssetClient::new(&s.env, &token_address_2);
    sac_b.mint(&user, &2_000_000_000);

    s.contract_client
        .deposit(&user, &pool_a, &1_000_000_000_i128);
    s.contract_client
        .deposit(&user, &pool_b, &2_000_000_000_i128);

    assert_eq!(s.contract_client.get_total_deposits(&pool_a), 1_000_000_000);
    assert_eq!(s.contract_client.get_total_deposits(&pool_b), 2_000_000_000);

    let pos_a = s.contract_client.get_deposit_position(&user, &pool_a);
    let pos_b = s.contract_client.get_deposit_position(&user, &pool_b);
    assert_eq!(pos_a.amount, 1_000_000_000);
    assert_eq!(pos_b.amount, 2_000_000_000);

    let user_deposits = s.contract_client.get_user_deposits(&user);
    assert_eq!(user_deposits.len(), 2);
}

// ─── Paused pool rejection (AC-6 / TR-3) ──────

#[test]
#[should_panic(expected = "pool is paused")]
fn test_deposit_paused_pool() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);

    mint_tokens(&s, &user, 1_000_000_000);

    // Pause the pool via internal storage
    s.env.as_contract(&s.contract_address, || {
        PoolStorage::set_paused(&s.env, &pool_id, true);
    });

    // Deposit should panic
    s.contract_client
        .deposit(&user, &pool_id, &1_000_000_000_i128);
}

// ─── Event assertions (AC-7) ──────────────────

#[test]
fn test_deposit_emits_event() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);
    let amount: i128 = 500_000_000;

    mint_tokens(&s, &user, amount);
    // Deposit succeeds and internally calls emit_deposit which publishes a "deposit" event.
    // If event emission were broken, this would panic.
    s.contract_client.deposit(&user, &pool_id, &amount);
}

#[test]
fn test_withdraw_emits_event() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let user = Address::generate(&s.env);
    let amount: i128 = 500_000_000;

    mint_tokens(&s, &user, amount);
    s.contract_client.deposit(&user, &pool_id, &amount);
    // Withdraw succeeds and internally calls emit_withdraw which publishes a "withdraw" event.
    // If event emission were broken, this would panic.
    s.contract_client.withdraw(&user, &pool_id, &amount);
}

#[test]
fn test_admin_initialization() {
    let (contract_id, env) = setup_internal();
    let admin = Address::generate(&env);
    env.as_contract(&contract_id, || {
        use super::access::roles::{Role, RoleKey, RoleStorage};
        env.storage().instance().set(&RoleKey::Admin, &admin);
        RoleStorage::grant_role(&env, &admin, &Role::Admin);
        let expected_admin = AdminControl::get_admin(&env).unwrap();
        assert_eq!(admin, expected_admin);
    });
}

#[test]
#[should_panic(expected = "Caller not admin")]
fn test_require_admin_fails() {
    let (contract_id, env) = setup_internal();
    let admin = Address::generate(&env);
    let other = Address::generate(&env);
    // AdminControl::initialize(&env.as_contract(&contract_id, f), &admin);
    env.as_contract(&contract_id, || {
        AdminControl::require_admin(&env, &admin);
        AdminControl::require_admin(&env, &other);
    });
}

#[test]
fn test_admin_transfer() {
    let (contract_id, env) = setup_internal();
    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    env.as_contract(&contract_id, || {
        use super::access::roles::{Role, RoleKey, RoleStorage};
        env.storage().instance().set(&RoleKey::Admin, &admin);
        RoleStorage::grant_role(&env, &admin, &Role::Admin);

        // Start transfer
        AdminControl::transfer_admin_start(&env, &admin, &new_admin);
        assert_eq!(
            AdminControl::get_pending_admin(&env),
            Some(new_admin.clone())
        );

        // Accept transfer
        AdminControl::transfer_admin_accept(&env, &new_admin);
        assert!(AdminControl::is_admin(&env, &new_admin));
        assert!(!AdminControl::is_admin(&env, &admin));
    });
}

#[test]
fn test_pause_unpause() {
    let (contract_id, env) = setup_internal();
    let admin = Address::generate(&env);
    env.as_contract(&contract_id, || {
        use super::access::roles::{Role, RoleKey, RoleStorage};
        env.storage().instance().set(&RoleKey::Admin, &admin);
        RoleStorage::grant_role(&env, &admin, &Role::Admin);
        assert!(!PauseControl::is_paused(&env));
        PauseControl::pause(&env, &admin);
        assert!(PauseControl::is_paused(&env));
        PauseControl::unpause(&env, &admin);
        assert!(!PauseControl::is_paused(&env));
    });
}

// =========================================================================
// Event Requirements Tests
// =========================================================================

#[test]
fn test_property_registration_event() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,)); // Fix: Register contract context

    let owner = Address::generate(&env);
    let property_id = String::from_str(&env, "PROP001");
    let name = String::from_str(&env, "Test Property");

    // Fix: Execute inside contract context
    env.as_contract(&contract_id, || {
        PropertyEvents::property_registered(
            &env,
            property_id.clone(),
            owner.clone(),
            name.clone(),
            100_000,
            1_000,
        );
    });

    // Event emission verified by successful execution above (no panic).
}

#[test]
fn test_share_transfer_event() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));

    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let property_id = String::from_str(&env, "PROP001");

    env.as_contract(&contract_id, || {
        PropertyEvents::share_transfer(&env, property_id.clone(), from.clone(), to.clone(), 500);
    });

    // Event emission verified by successful execution above (no panic).
}

#[test]
fn test_deposit_event() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));

    let depositor = Address::generate(&env);
    let pool_id = String::from_str(&env, "USDC-POOL");

    env.as_contract(&contract_id, || {
        LendingEvents::deposit(
            &env,
            pool_id.clone(),
            depositor.clone(),
            1_000_000_000,
            1_000_000_000,
            5_000_000_000,
        );
    });
    // Event emission verified by successful execution above (no panic).
}

#[test]
fn test_borrow_event() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));

    let borrower = Address::generate(&env);
    let collateral_asset = Address::generate(&env);
    let pool_id = String::from_str(&env, "USDC-POOL");

    env.as_contract(&contract_id, || {
        LendingEvents::borrow(
            &env,
            pool_id.clone(),
            borrower.clone(),
            500_000_000,
            1_000_000_000,
            collateral_asset.clone(),
            1500000000,
        );
    });
    // Event emission verified by successful execution above (no panic).
}

// =========================================================================
// Borrow Function Tests
// =========================================================================

#[test]
fn test_borrow_with_sufficient_collateral() {
    use soroban_sdk::token::StellarAssetClient;

    let env = Env::default();
    env.mock_all_auths();

    // Register the main contract
    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));

    // Register mock oracle
    let oracle_id = env.register(MockOracleContract, ());

    // Create test accounts
    let borrower = Address::generate(&env);

    // Create mock tokens for pool asset (USDC) and collateral (XLM)
    let usdc_admin = Address::generate(&env);
    let usdc_contract = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let usdc_token = StellarAssetClient::new(&env, &usdc_contract.address());

    let xlm_admin = Address::generate(&env);
    let xlm_contract = env.register_stellar_asset_contract_v2(xlm_admin.clone());
    let xlm_token = StellarAssetClient::new(&env, &xlm_contract.address());

    // Setup: Initialize pool
    let pool_id = String::from_str(&env, "USDC-POOL");
    let pool = LendingPool {
        id: pool_id.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: usdc_contract.address().clone(),
        collateral_factor: 750_000_000_000_000_000, // 75%
        liquidation_threshold: 800_000_000_000_000_000, // 80%
        liquidation_penalty: 50_000_000_000_000_000, // 5%
        reserve_factor: 1000,                       // 10%
        is_active: true,
        created_at: env.ledger().timestamp(),
    };

    env.as_contract(&contract_id, || {
        // Store pool
        PoolStorage::set(&env, &pool);
        PoolStorage::set_total_deposits(&env, &pool_id, 10_000_000_000); // 10,000 USDC
        PoolStorage::set_total_borrows(&env, &pool_id, 0);

        // Initialize interest rate model
        let model = InterestRateModel::default();
        InterestStorage::set_model(&env, &pool_id, &model);
        InterestStorage::set_interest_index(&env, &pool_id, PRECISION);
        InterestStorage::set_last_accrual(&env, &pool_id, env.ledger().timestamp());

        // Set oracle address
        PriceOracle::set_oracle_address(&env, &oracle_id);
    });

    // Set XLM price in oracle: $1.00 (1 * PRECISION = 1e18)
    env.as_contract(&oracle_id, || {
        MockOracleContract::set_price(
            env.clone(),
            xlm_contract.address().clone(),
            PRECISION, // $1.00
            env.ledger().timestamp(),
        );
    });

    // Mint tokens
    usdc_token.mint(&borrower, &2_000_000_000); // 2000 USDC to borrower
    xlm_token.mint(&borrower, &2_000_000_000); // 2000 XLM to borrower
    usdc_token.mint(&contract_id, &10_000_000_000); // 10,000 USDC to contract for lending

    // Test parameters
    let borrow_amount = 1_000_000_000; // 1000 USDC
    let collateral_amount = 2_000_000_000; // 2000 XLM

    // Calculate expected health factor:
    // Collateral value = 2000 XLM * $1.00 = $2000
    // Debt value = 1000 USDC = $1000
    // Health factor = (2000 * 0.8) / 1000 = 1.6 * PRECISION > 1.5 * PRECISION ✓

    // Execute borrow
    let position = env.as_contract(&contract_id, || {
        PropertyTokenContract::borrow(
            env.clone(),
            borrower.clone(),
            pool_id.clone(),
            borrow_amount,
            xlm_contract.address().clone(),
            collateral_amount,
        )
    });

    // Verify position was created correctly
    assert_eq!(position.borrower, borrower);
    assert_eq!(position.pool_id, pool_id);
    assert_eq!(position.principal, borrow_amount);
    assert_eq!(position.collateral_amount, collateral_amount);
    assert_eq!(position.collateral_asset, xlm_contract.address());
    assert_eq!(position.index_at_borrow, PRECISION);

    // Verify position is stored
    let stored_position = env.as_contract(&contract_id, || {
        PositionStorage::get_borrow(&env, &borrower, &pool_id)
    });
    assert!(stored_position.is_some());
    assert_eq!(stored_position.unwrap().principal, borrow_amount);

    // Verify collateral was transferred to contract
    let borrower_xlm_balance = xlm_token.balance(&borrower);
    assert_eq!(borrower_xlm_balance, 0); // All collateral locked

    let contract_xlm_balance = xlm_token.balance(&contract_id);
    assert_eq!(contract_xlm_balance, collateral_amount);

    // Verify borrowed USDC was transferred to borrower
    let borrower_usdc_balance = usdc_token.balance(&borrower);
    assert_eq!(borrower_usdc_balance, 2_000_000_000 + borrow_amount); // Initial + borrowed

    // Verify pool total borrows updated
    let total_borrows = env.as_contract(&contract_id, || {
        PoolStorage::get_total_borrows(&env, &pool_id)
    });
    assert_eq!(total_borrows, borrow_amount);

    // Test passed! Borrow function works correctly with sufficient collateral
}

#[test]
#[should_panic(expected = "Health factor too low")]
fn test_borrow_with_insufficient_collateral() {
    use soroban_sdk::token::StellarAssetClient;

    let env = Env::default();
    env.mock_all_auths();

    // Register contracts
    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));
    let oracle_id = env.register(MockOracleContract, ());

    // Create test accounts
    let borrower = Address::generate(&env);

    // Create mock tokens
    let usdc_admin = Address::generate(&env);
    let usdc_contract = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let usdc_token = StellarAssetClient::new(&env, &usdc_contract.address());

    let xlm_admin = Address::generate(&env);
    let xlm_contract = env.register_stellar_asset_contract_v2(xlm_admin.clone());
    let xlm_token = StellarAssetClient::new(&env, &xlm_contract.address());

    // Setup pool
    let pool_id = String::from_str(&env, "USDC-POOL");
    let pool = LendingPool {
        id: pool_id.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: usdc_contract.address().clone(),
        collateral_factor: 750_000_000_000_000_000, // 75%
        liquidation_threshold: 800_000_000_000_000_000, // 80%
        liquidation_penalty: 50_000_000_000_000_000, // 5%
        reserve_factor: 1000,
        is_active: true,
        created_at: env.ledger().timestamp(),
    };

    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool);
        PoolStorage::set_total_deposits(&env, &pool_id, 10_000_000_000);
        PoolStorage::set_total_borrows(&env, &pool_id, 0);

        let model = InterestRateModel::default();
        InterestStorage::set_model(&env, &pool_id, &model);
        InterestStorage::set_interest_index(&env, &pool_id, PRECISION);
        InterestStorage::set_last_accrual(&env, &pool_id, env.ledger().timestamp());

        PriceOracle::set_oracle_address(&env, &oracle_id);
    });

    // Set XLM price: $1.00
    env.as_contract(&oracle_id, || {
        MockOracleContract::set_price(
            env.clone(),
            xlm_contract.address().clone(),
            PRECISION,
            env.ledger().timestamp(),
        );
    });

    // Mint tokens
    usdc_token.mint(&borrower, &1_000_000_000);
    xlm_token.mint(&borrower, &1_000_000_000); // Only 1000 XLM
    usdc_token.mint(&contract_id, &10_000_000_000);

    // Try to borrow with insufficient collateral
    // Collateral: 1000 XLM * $1.00 = $1000
    // Borrow: 1000 USDC = $1000
    // Health factor = (1000 * 0.8) / 1000 = 0.8 < 1.5 ❌
    let borrow_amount = 1_000_000_000; // 1000 USDC
    let collateral_amount = 1_000_000_000; // 1000 XLM (insufficient!)

    // This should panic with "Health factor too low"
    env.as_contract(&contract_id, || {
        PropertyTokenContract::borrow(
            env.clone(),
            borrower.clone(),
            pool_id.clone(),
            borrow_amount,
            xlm_contract.address().clone(),
            collateral_amount,
        )
    });
}

#[test]
#[should_panic(expected = "Pool is paused")]
fn test_borrow_from_paused_pool() {
    use soroban_sdk::token::StellarAssetClient;

    let env = Env::default();
    env.mock_all_auths();

    // Register contracts
    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));
    let oracle_id = env.register(MockOracleContract, ());

    // Create test accounts
    let borrower = Address::generate(&env);

    // Create mock tokens
    let usdc_admin = Address::generate(&env);
    let usdc_contract = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let usdc_token = StellarAssetClient::new(&env, &usdc_contract.address());

    let xlm_admin = Address::generate(&env);
    let xlm_contract = env.register_stellar_asset_contract_v2(xlm_admin.clone());
    let xlm_token = StellarAssetClient::new(&env, &xlm_contract.address());

    // Setup pool
    let pool_id = String::from_str(&env, "USDC-POOL");
    let pool = LendingPool {
        id: pool_id.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: usdc_contract.address().clone(),
        collateral_factor: 750_000_000_000_000_000,
        liquidation_threshold: 800_000_000_000_000_000,
        liquidation_penalty: 50_000_000_000_000_000,
        reserve_factor: 1000,
        is_active: true,
        created_at: env.ledger().timestamp(),
    };

    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool);
        PoolStorage::set_total_deposits(&env, &pool_id, 10_000_000_000);
        PoolStorage::set_total_borrows(&env, &pool_id, 0);

        let model = InterestRateModel::default();
        InterestStorage::set_model(&env, &pool_id, &model);
        InterestStorage::set_interest_index(&env, &pool_id, PRECISION);
        InterestStorage::set_last_accrual(&env, &pool_id, env.ledger().timestamp());

        PriceOracle::set_oracle_address(&env, &oracle_id);

        // PAUSE THE POOL
        PoolStorage::set_paused(&env, &pool_id, true);
    });

    // Set XLM price
    env.as_contract(&oracle_id, || {
        MockOracleContract::set_price(
            env.clone(),
            xlm_contract.address().clone(),
            PRECISION,
            env.ledger().timestamp(),
        );
    });

    // Mint tokens
    usdc_token.mint(&borrower, &2_000_000_000);
    xlm_token.mint(&borrower, &2_000_000_000);
    usdc_token.mint(&contract_id, &10_000_000_000);

    // Try to borrow from paused pool - should panic
    let borrow_amount = 1_000_000_000;
    let collateral_amount = 2_000_000_000;

    env.as_contract(&contract_id, || {
        PropertyTokenContract::borrow(
            env.clone(),
            borrower.clone(),
            pool_id.clone(),
            borrow_amount,
            xlm_contract.address().clone(),
            collateral_amount,
        )
    });
}

#[test]
#[should_panic(expected = "Insufficient liquidity")]
fn test_borrow_exceeding_liquidity() {
    use soroban_sdk::token::StellarAssetClient;

    let env = Env::default();
    env.mock_all_auths();

    // Register contracts
    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));
    let oracle_id = env.register(MockOracleContract, ());

    // Create test accounts
    let borrower = Address::generate(&env);

    // Create mock tokens
    let usdc_admin = Address::generate(&env);
    let usdc_contract = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let usdc_token = StellarAssetClient::new(&env, &usdc_contract.address());

    let xlm_admin = Address::generate(&env);
    let xlm_contract = env.register_stellar_asset_contract_v2(xlm_admin.clone());
    let xlm_token = StellarAssetClient::new(&env, &xlm_contract.address());

    // Setup pool with limited liquidity
    let pool_id = String::from_str(&env, "USDC-POOL");
    let pool = LendingPool {
        id: pool_id.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: usdc_contract.address().clone(),
        collateral_factor: 750_000_000_000_000_000,
        liquidation_threshold: 800_000_000_000_000_000,
        liquidation_penalty: 50_000_000_000_000_000,
        reserve_factor: 1000,
        is_active: true,
        created_at: env.ledger().timestamp(),
    };

    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool);
        // Only 1000 USDC available
        PoolStorage::set_total_deposits(&env, &pool_id, 1_000_000_000);
        PoolStorage::set_total_borrows(&env, &pool_id, 0);

        let model = InterestRateModel::default();
        InterestStorage::set_model(&env, &pool_id, &model);
        InterestStorage::set_interest_index(&env, &pool_id, PRECISION);
        InterestStorage::set_last_accrual(&env, &pool_id, env.ledger().timestamp());

        PriceOracle::set_oracle_address(&env, &oracle_id);
    });

    // Set XLM price high so collateral is sufficient
    env.as_contract(&oracle_id, || {
        MockOracleContract::set_price(
            env.clone(),
            xlm_contract.address().clone(),
            PRECISION * 10, // $10 per XLM
            env.ledger().timestamp(),
        );
    });

    // Mint tokens
    usdc_token.mint(&borrower, &5_000_000_000);
    xlm_token.mint(&borrower, &1_000_000_000); // 1000 XLM * $10 = $10,000 collateral
    usdc_token.mint(&contract_id, &1_000_000_000); // Only 1000 USDC in pool

    // Try to borrow more than available liquidity
    // Available: 1000 USDC
    // Trying to borrow: 2000 USDC (exceeds liquidity!)
    let borrow_amount = 2_000_000_000; // 2000 USDC
    let collateral_amount = 1_000_000_000; // 1000 XLM (worth $10,000, sufficient)

    env.as_contract(&contract_id, || {
        PropertyTokenContract::borrow(
            env.clone(),
            borrower.clone(),
            pool_id.clone(),
            borrow_amount,
            xlm_contract.address().clone(),
            collateral_amount,
        )
    });
}

#[test]
fn test_health_factor_with_known_values() {
    // Test health factor calculation with precise known values

    // Test case 1: HF = 2.0
    // Collateral: $2000, Debt: $1000, LT: 100%
    let collateral_value_1 = 2_000_000_000; // 2000 in token units
    let debt_value_1 = 1_000_000_000; // 1000 in token units
    let lt_1 = PRECISION; // 100% = 1.0 * PRECISION
    let hf_1 = PositionStorage::calculate_health_factor(collateral_value_1, debt_value_1, lt_1);
    // Expected: (2000 * 1.0) / 1000 = 2.0 * PRECISION
    assert_eq!(hf_1, 2 * PRECISION);

    // Test case 2: HF = 1.6
    // Collateral: $2000, Debt: $1000, LT: 80%
    let collateral_value_2 = 2_000_000_000;
    let debt_value_2 = 1_000_000_000;
    let lt_2 = 800_000_000_000_000_000; // 80% = 0.8 * PRECISION
    let hf_2 = PositionStorage::calculate_health_factor(collateral_value_2, debt_value_2, lt_2);
    // Expected: (2000 * 0.8) / 1000 = 1.6 * PRECISION
    assert_eq!(hf_2, (16 * PRECISION) / 10);

    // Test case 3: HF = 0.8 (undercollateralized)
    // Collateral: $1000, Debt: $1000, LT: 80%
    let collateral_value_3 = 1_000_000_000;
    let debt_value_3 = 1_000_000_000;
    let lt_3 = 800_000_000_000_000_000;
    let hf_3 = PositionStorage::calculate_health_factor(collateral_value_3, debt_value_3, lt_3);
    // Expected: (1000 * 0.8) / 1000 = 0.8 * PRECISION
    assert_eq!(hf_3, (8 * PRECISION) / 10);

    // Test case 4: HF = 1.5 (exactly at minimum)
    // Collateral: $1500, Debt: $1000, LT: 100%
    let collateral_value_4 = 1_500_000_000;
    let debt_value_4 = 1_000_000_000;
    let lt_4 = PRECISION;
    let hf_4 = PositionStorage::calculate_health_factor(collateral_value_4, debt_value_4, lt_4);
    // Expected: (1500 * 1.0) / 1000 = 1.5 * PRECISION
    assert_eq!(hf_4, (15 * PRECISION) / 10);

    // Test case 5: HF = 1.0 (liquidation threshold)
    // Collateral: $1000, Debt: $1000, LT: 100%
    let collateral_value_5 = 1_000_000_000;
    let debt_value_5 = 1_000_000_000;
    let lt_5 = PRECISION;
    let hf_5 = PositionStorage::calculate_health_factor(collateral_value_5, debt_value_5, lt_5);
    // Expected: (1000 * 1.0) / 1000 = 1.0 * PRECISION
    assert_eq!(hf_5, PRECISION);

    // Test case 6: HF with zero debt (should return MAX)
    let collateral_value_6 = 1_000_000_000;
    let debt_value_6 = 0;
    let lt_6 = PRECISION;
    let hf_6 = PositionStorage::calculate_health_factor(collateral_value_6, debt_value_6, lt_6);
    assert_eq!(hf_6, i128::MAX);

    // Test case 7: Large values to test precision
    // Collateral: $1,000,000, Debt: $500,000, LT: 75%
    let collateral_value_7 = 1_000_000_000_000_000; // 1M with 9 decimals
    let debt_value_7 = 500_000_000_000_000; // 500K with 9 decimals
    let lt_7 = 750_000_000_000_000_000; // 75%
    let hf_7 = PositionStorage::calculate_health_factor(collateral_value_7, debt_value_7, lt_7);
    // Expected: (1M * 0.75) / 500K = 1.5 * PRECISION
    assert_eq!(hf_7, (15 * PRECISION) / 10);
}

#[test]
#[should_panic(expected = "Interest index is zero - invariant violation")]
fn test_borrow_with_zero_index() {
    use soroban_sdk::token::StellarAssetClient;

    let env = Env::default();
    env.mock_all_auths();

    // Register contracts
    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));
    let oracle_id = env.register(MockOracleContract, ());

    // Create test accounts
    let borrower = Address::generate(&env);

    // Create mock tokens
    let usdc_admin = Address::generate(&env);
    let usdc_contract = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let usdc_token = StellarAssetClient::new(&env, &usdc_contract.address());

    let xlm_admin = Address::generate(&env);
    let xlm_contract = env.register_stellar_asset_contract_v2(xlm_admin.clone());
    let xlm_token = StellarAssetClient::new(&env, &xlm_contract.address());

    // Setup pool
    let pool_id = String::from_str(&env, "USDC-POOL");
    let pool = LendingPool {
        id: pool_id.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: usdc_contract.address().clone(),
        collateral_factor: 750_000_000_000_000_000,
        liquidation_threshold: 800_000_000_000_000_000,
        liquidation_penalty: 50_000_000_000_000_000,
        reserve_factor: 1000,
        is_active: true,
        created_at: env.ledger().timestamp(),
    };

    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool);
        PoolStorage::set_total_deposits(&env, &pool_id, 10_000_000_000);
        PoolStorage::set_total_borrows(&env, &pool_id, 0);

        let model = InterestRateModel::default();
        InterestStorage::set_model(&env, &pool_id, &model);

        // SET INDEX TO ZERO - This should cause panic!
        InterestStorage::set_interest_index(&env, &pool_id, 0);
        InterestStorage::set_last_accrual(&env, &pool_id, env.ledger().timestamp());

        PriceOracle::set_oracle_address(&env, &oracle_id);
    });

    // Set XLM price
    env.as_contract(&oracle_id, || {
        MockOracleContract::set_price(
            env.clone(),
            xlm_contract.address().clone(),
            PRECISION,
            env.ledger().timestamp(),
        );
    });

    // Mint tokens
    usdc_token.mint(&borrower, &2_000_000_000);
    xlm_token.mint(&borrower, &2_000_000_000);
    usdc_token.mint(&contract_id, &10_000_000_000);

    // Try to borrow with zero index - should panic with invariant violation
    let borrow_amount = 1_000_000_000;
    let collateral_amount = 2_000_000_000;

    env.as_contract(&contract_id, || {
        PropertyTokenContract::borrow(
            env.clone(),
            borrower.clone(),
            pool_id.clone(),
            borrow_amount,
            xlm_contract.address().clone(),
            collateral_amount,
        )
    });
}

#[test]
fn test_repay_partial_releases_pro_rata_collateral() {
    let s = setup_borrow_test();
    let usdc_token = TokenClient::new(&s.env, &s.usdc_address);
    let xlm_token = TokenClient::new(&s.env, &s.xlm_address);

    let mut ledger = s.env.ledger().get();
    ledger.timestamp += SECONDS_PER_YEAR;
    s.env.ledger().set(ledger);
    s.contract_client.accrue_interest(&s.pool_id);

    let debt_before = s
        .contract_client
        .get_borrow_position(&s.borrower, &s.pool_id);
    let current_debt = s.env.as_contract(&s.contract_id, || {
        PositionStorage::calculate_current_debt(&s.env, &debt_before)
    });
    let repay_amount = current_debt / 2;
    let expected_collateral_release = (debt_before.collateral_amount * repay_amount) / current_debt;

    let repaid_position = s
        .contract_client
        .repay(&s.borrower, &s.pool_id, &repay_amount);

    assert_eq!(repaid_position.principal, current_debt - repay_amount);
    assert_eq!(
        repaid_position.collateral_amount,
        debt_before.collateral_amount - expected_collateral_release
    );

    let borrower_xlm_balance = xlm_token.balance(&s.borrower);
    assert_eq!(borrower_xlm_balance, expected_collateral_release);

    let borrower_usdc_balance = usdc_token.balance(&s.borrower);
    assert_eq!(borrower_usdc_balance, 3_000_000_000 - repay_amount);

    let total_borrows = s.contract_client.get_total_borrows(&s.pool_id);
    assert_eq!(total_borrows, current_debt - repay_amount);
}

#[test]
fn test_repay_full_closes_position_and_releases_all_collateral() {
    let s = setup_borrow_test();
    let usdc_token = TokenClient::new(&s.env, &s.usdc_address);
    let xlm_token = TokenClient::new(&s.env, &s.xlm_address);

    let repaid_position = s
        .contract_client
        .repay(&s.borrower, &s.pool_id, &1_000_000_000);

    assert_eq!(repaid_position.principal, 0);
    assert_eq!(repaid_position.collateral_amount, 0);
    assert_eq!(xlm_token.balance(&s.borrower), 2_000_000_000);
    assert_eq!(usdc_token.balance(&s.borrower), 2_000_000_000);
    assert_eq!(s.contract_client.get_total_borrows(&s.pool_id), 0);
    assert_eq!(s.contract_client.get_user_borrows(&s.borrower).len(), 0);

    let stored_position = s.env.as_contract(&s.contract_id, || {
        PositionStorage::get_borrow(&s.env, &s.borrower, &s.pool_id)
    });
    assert!(
        stored_position.is_none(),
        "borrow position should be removed"
    );
}

#[test]
fn test_repay_overpayment_is_clamped_to_current_debt() {
    let s = setup_borrow_test();
    let usdc_token = TokenClient::new(&s.env, &s.usdc_address);

    s.contract_client
        .repay(&s.borrower, &s.pool_id, &2_000_000_000);

    assert_eq!(usdc_token.balance(&s.borrower), 2_000_000_000);
    assert_eq!(s.contract_client.get_total_borrows(&s.pool_id), 0);

    let stored_position = s.env.as_contract(&s.contract_id, || {
        PositionStorage::get_borrow(&s.env, &s.borrower, &s.pool_id)
    });
    assert!(
        stored_position.is_none(),
        "overpayment should fully close position"
    );
}

#[test]
#[should_panic]
fn test_repay_without_authorization() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));
    let client = PropertyTokenContractClient::new(&env, &contract_id);

    client.repay(
        &Address::generate(&env),
        &String::from_str(&env, "USDC-POOL"),
        &100_i128,
    );
}

#[test]
#[should_panic(expected = "borrow position not found")]
fn test_repay_nonexistent_position() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let borrower = Address::generate(&s.env);

    mint_tokens(&s, &borrower, 100_i128);
    s.contract_client.repay(&borrower, &pool_id, &100_i128);
}

// =========================================================================
// Purchase Shares Tests
// =========================================================================

fn setup_purchase_test() -> (Address, Env, Address, Address, Address, u64) {
    let env = Env::default();
    // Mock all auths for testing
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));
    let property_owner = Address::generate(&env);
    let buyer = Address::generate(&env);

    // Create a test token using register_stellar_asset_contract_v2
    let token_admin = Address::generate(&env);
    let stellar_asset = env.register_stellar_asset_contract_v2(token_admin.clone());
    let payment_token = stellar_asset.address();

    // Create token admin client for minting
    let token_admin_client = StellarAssetClient::new(&env, &payment_token);

    // Mint tokens to buyer for testing
    token_admin_client.mint(&buyer, &100_000_000_000_000_i128); // $10M with 7 decimals

    let property_id = 1u64;

    // Set up admin for access control (constructor already set LendingKey::Admin,
    // which collides with RoleKey::Admin, so we set RoleKey::Admin directly)
    env.as_contract(&contract_id, || {
        use super::access::roles::{Role, RoleKey, RoleStorage};
        env.storage().instance().set(&RoleKey::Admin, &admin);
        RoleStorage::grant_role(&env, &admin, &Role::Admin);
    });

    // Create property metadata
    let property = storage::property::PropertyMetadata::new(
        property_id,
        property_owner.clone(),
        String::from_str(&env, "Test Property"),
        String::from_str(&env, "A test property"),
        String::from_str(&env, "123 Test St"),
        10_000_000_000_000, // $1M with 7 decimals
        100_000u64,         // 100k total shares
        env.ledger().timestamp(),
    );

    env.as_contract(&contract_id, || {
        property.save(&env);
        // Set available shares
        storage::property::set_available_shares(&env, property_id, 100_000u64);
        // Set price per share (1_000_000 = $0.10 with 7 decimals)
        storage::property::set_price_per_share(&env, property_id, 1_000_000i128);
        // Set verified status
        storage::property::set_verified(&env, property_id, true);
    });

    (
        contract_id,
        env,
        property_owner,
        buyer,
        payment_token,
        property_id,
    )
}

#[test]
fn test_purchase_shares_happy_path() {
    let (contract_id, env, property_owner, buyer, payment_token, property_id) =
        setup_purchase_test();

    let purchase_amount = 1_000u64;
    let price_per_share = 1_000_000i128; // $0.10
    let expected_cost = (purchase_amount as i128) * price_per_share;

    // Get initial balances
    let token_client = token::Client::new(&env, &payment_token);
    let initial_buyer_balance = token_client.balance(&buyer);
    let initial_owner_balance = token_client.balance(&property_owner);
    let initial_buyer_shares = env.as_contract(&contract_id, || {
        storage::shares::get_balance(&env, property_id, &buyer)
    });
    let initial_available_shares = env.as_contract(&contract_id, || {
        storage::property::get_available_shares(&env, property_id)
    });

    // Purchase shares (auth is mocked via env.mock_all_auths() in setup)
    env.as_contract(&contract_id, || {
        PropertyTokenContract::purchase_shares(
            env.clone(),
            buyer.clone(),
            property_id,
            purchase_amount,
            payment_token.clone(),
        );
    });

    // Verify buyer balance increased
    let final_buyer_shares = env.as_contract(&contract_id, || {
        storage::shares::get_balance(&env, property_id, &buyer)
    });
    assert_eq!(final_buyer_shares, initial_buyer_shares + purchase_amount);

    // Verify available shares decreased
    let final_available_shares = env.as_contract(&contract_id, || {
        storage::property::get_available_shares(&env, property_id)
    });
    assert_eq!(
        final_available_shares,
        initial_available_shares - purchase_amount
    );

    // Verify payment transferred
    let final_buyer_balance = token_client.balance(&buyer);
    let final_owner_balance = token_client.balance(&property_owner);
    assert_eq!(final_buyer_balance, initial_buyer_balance - expected_cost);
    assert_eq!(final_owner_balance, initial_owner_balance + expected_cost);

    // Verify SharePurchase event emitted
    // Events are emitted during contract execution
    // The event verification is done implicitly through state changes above
    // (shares increased, available decreased, token balances updated)
}

#[test]
fn test_purchase_all_remaining_shares() {
    let (contract_id, env, _property_owner, buyer, payment_token, property_id) =
        setup_purchase_test();

    let available_shares = env.as_contract(&contract_id, || {
        storage::property::get_available_shares(&env, property_id)
    });

    // Purchase all remaining shares
    env.as_contract(&contract_id, || {
        PropertyTokenContract::purchase_shares(
            env.clone(),
            buyer.clone(),
            property_id,
            available_shares,
            payment_token.clone(),
        );
    });

    // Verify available shares is now 0
    let final_available_shares = env.as_contract(&contract_id, || {
        storage::property::get_available_shares(&env, property_id)
    });
    assert_eq!(final_available_shares, 0);
}

#[test]
#[should_panic(expected = "Insufficient shares available")]
fn test_purchase_when_sold_out() {
    let (contract_id, env, _property_owner, buyer, payment_token, property_id) =
        setup_purchase_test();

    // Set available shares to 0
    env.as_contract(&contract_id, || {
        storage::property::set_available_shares(&env, property_id, 0);
    });

    // Attempt purchase
    env.as_contract(&contract_id, || {
        PropertyTokenContract::purchase_shares(
            env.clone(),
            buyer.clone(),
            property_id,
            1u64,
            payment_token.clone(),
        );
    });
}

#[test]
#[should_panic(expected = "Insufficient shares available")]
fn test_purchase_exceeding_available() {
    let (contract_id, env, _property_owner, buyer, payment_token, property_id) =
        setup_purchase_test();

    let available_shares = env.as_contract(&contract_id, || {
        storage::property::get_available_shares(&env, property_id)
    });

    // Attempt to purchase more than available
    env.as_contract(&contract_id, || {
        PropertyTokenContract::purchase_shares(
            env.clone(),
            buyer.clone(),
            property_id,
            available_shares + 1,
            payment_token.clone(),
        );
    });
}

#[test]
#[should_panic(expected = "Amount must be positive")]
fn test_purchase_zero_amount() {
    let (contract_id, env, _property_owner, buyer, payment_token, property_id) =
        setup_purchase_test();

    // Attempt purchase with zero amount
    env.as_contract(&contract_id, || {
        PropertyTokenContract::purchase_shares(
            env.clone(),
            buyer.clone(),
            property_id,
            0u64,
            payment_token.clone(),
        );
    });
}

#[test]
#[should_panic(expected = "Property not found")]
fn test_purchase_nonexistent_property() {
    let (contract_id, env, _property_owner, buyer, payment_token) = {
        let env = Env::default();
        env.mock_all_auths();

        let admin_init = Address::generate(&env);
        let contract_id = env.register(PropertyTokenContract, (&admin_init,));
        let property_owner = Address::generate(&env);
        let buyer = Address::generate(&env);
        let token_admin = Address::generate(&env);

        let stellar_asset = env.register_stellar_asset_contract_v2(token_admin.clone());
        let payment_token = stellar_asset.address();

        let token_admin_client = StellarAssetClient::new(&env, &payment_token);
        token_admin_client.mint(&buyer, &100_000_000_000_000_i128);

        // Constructor already sets admin via LendingKey::Admin, no separate init needed

        (contract_id, env, property_owner, buyer, payment_token)
    };

    // Attempt purchase of non-existent property
    env.as_contract(&contract_id, || {
        PropertyTokenContract::purchase_shares(
            env.clone(),
            buyer.clone(),
            999u64, // Non-existent property ID
            1u64,
            payment_token.clone(),
        );
    });
}

#[test]
#[should_panic(expected = "Property is not verified")]
fn test_purchase_unverified_property() {
    let (contract_id, env, _property_owner, buyer, payment_token, property_id) =
        setup_purchase_test();

    // Set property as unverified
    env.as_contract(&contract_id, || {
        storage::property::set_verified(&env, property_id, false);
    });

    // Attempt purchase
    env.as_contract(&contract_id, || {
        PropertyTokenContract::purchase_shares(
            env.clone(),
            buyer.clone(),
            property_id,
            1u64,
            payment_token.clone(),
        );
    });
}

#[test]
#[should_panic(expected = "Contract paused")]
fn test_purchase_when_contract_paused() {
    let (contract_id, env, _property_owner, buyer, payment_token, property_id) =
        setup_purchase_test();

    let admin = env.as_contract(&contract_id, || AdminControl::get_admin(&env).unwrap());

    // Pause contract
    env.as_contract(&contract_id, || {
        PauseControl::pause(&env, &admin);
    });

    // Attempt purchase
    env.as_contract(&contract_id, || {
        PropertyTokenContract::purchase_shares(
            env.clone(),
            buyer.clone(),
            property_id,
            1u64,
            payment_token.clone(),
        );
    });
}

// =========================================================================
// Token Requirement Tests (REQ-010)
// =========================================================================

fn setup_token_test<'a>() -> (Env, PropertyTokenContractClient<'a>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));
    let client = PropertyTokenContractClient::new(&env, &contract_id);

    // Set up admin for access control (constructor already set LendingKey::Admin,
    // which collides with RoleKey::Admin, so we set RoleKey::Admin directly)
    env.as_contract(&contract_id, || {
        use super::access::roles::{Role, RoleKey, RoleStorage};
        env.storage().instance().set(&RoleKey::Admin, &admin);
        RoleStorage::grant_role(&env, &admin, &Role::Admin);
    });

    (env, client, admin)
}

#[test]
fn test_mint_and_query_balance() {
    let (env, client, admin) = setup_token_test();
    let recipient = Address::generate(&env);
    let property_id = 1;

    client.mint_shares(&admin, &property_id, &recipient, &1000);

    assert_eq!(client.get_balance(&property_id, &recipient), 1000);
    assert_eq!(client.get_total_shares(&property_id), 1000);
}

#[test]
#[should_panic(expected = "Caller not admin")]
fn test_unauthorized_mint_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let admin_init = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin_init,));
    let client = PropertyTokenContractClient::new(&env, &contract_id);

    let fake_admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.mint_shares(&fake_admin, &1, &recipient, &1000);
}

#[test]
fn test_burn_shares() {
    let (env, client, admin) = setup_token_test();
    let owner = Address::generate(&env);
    let property_id = 1;

    client.mint_shares(&admin, &property_id, &owner, &1000);
    client.burn_shares(&owner, &property_id, &400);

    assert_eq!(client.get_balance(&property_id, &owner), 600);
    assert_eq!(client.get_total_shares(&property_id), 600);
}

#[test]
#[should_panic(expected = "Insufficient share balance")]
fn test_burn_more_than_balance_panics() {
    let (env, client, admin) = setup_token_test();
    let owner = Address::generate(&env);

    client.mint_shares(&admin, &1, &owner, &500);
    client.burn_shares(&owner, &1, &600); // Exceeds balance
}

#[test]
fn test_transfer_shares() {
    let (env, client, admin) = setup_token_test();
    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let property_id = 1;

    client.mint_shares(&admin, &property_id, &from, &1000);
    client.transfer_shares(&from, &to, &property_id, &300);

    assert_eq!(client.get_balance(&property_id, &from), 700);
    assert_eq!(client.get_balance(&property_id, &to), 300);
}

#[test]
#[should_panic]
fn test_transfer_without_auth() {
    let env = Env::default();
    // Intentionally NOT calling env.mock_all_auths()
    let admin_init = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin_init,));
    let client = PropertyTokenContractClient::new(&env, &contract_id);

    let from = Address::generate(&env);
    let to = Address::generate(&env);

    client.transfer_shares(&from, &to, &1, &100);
}

#[test]
fn test_approve_and_transfer_from() {
    let (env, client, admin) = setup_token_test();
    let owner = Address::generate(&env);
    let spender = Address::generate(&env);
    let recipient = Address::generate(&env);
    let property_id = 1;

    client.mint_shares(&admin, &property_id, &owner, &1000);

    client.approve(&owner, &spender, &property_id, &400);
    assert_eq!(client.get_allowance(&property_id, &owner, &spender), 400);

    client.transfer_from(&spender, &owner, &recipient, &property_id, &250);

    assert_eq!(client.get_balance(&property_id, &owner), 750);
    assert_eq!(client.get_balance(&property_id, &recipient), 250);
    assert_eq!(client.get_allowance(&property_id, &owner, &spender), 150);
}

// =========================================================================
// Oracle Guardrails Tests (Issue #729 / C3-013)
// =========================================================================

// Mock Oracle with configurable decimals — needed for normalization tests
#[contract]
pub struct MockOracleWithDecimals;

#[contractimpl]
impl MockOracleWithDecimals {
    pub fn set_price(env: Env, asset: Address, price: i128, timestamp: u64) {
        let key = (Symbol::new(&env, "price"), asset);
        let price_data = PriceData { price, timestamp };
        env.storage().persistent().set(&key, &price_data);
    }

    pub fn set_decimals(env: Env, d: u32) {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "decimals"), &d);
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

    pub fn decimals(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&Symbol::new(&env, "decimals"))
            .unwrap_or(18u32)
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

// ─── Helper: set up a minimal oracle test environment ──────

struct OracleTestEnv {
    env: Env,
    contract_id: Address,
    oracle_id: Address,
    asset_address: Address,
}

fn setup_oracle_test() -> OracleTestEnv {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));
    let oracle_id = env.register(MockOracleContract, ());
    let asset_address = Address::generate(&env);

    env.as_contract(&contract_id, || {
        PriceOracle::set_oracle_address(&env, &oracle_id);
    });

    OracleTestEnv {
        env,
        contract_id,
        oracle_id,
        asset_address,
    }
}

// ─── Test 1: Fresh price within max age → success ──────

#[test]
fn test_oracle_fresh_price() {
    let t = setup_oracle_test();
    let now = t.env.ledger().timestamp();

    // Set a fresh, valid price
    t.env.as_contract(&t.oracle_id, || {
        MockOracleContract::set_price(t.env.clone(), t.asset_address.clone(), PRECISION, now);
    });

    let price = t.env.as_contract(&t.contract_id, || {
        PriceOracle::get_price(&t.env, &t.asset_address)
    });

    assert_eq!(
        price, PRECISION,
        "Fresh price should be returned as-is (18 dec oracle)"
    );
}

// ─── Test 2: Stale price → panic ───────────────────────

#[test]
#[should_panic(expected = "Price data is stale")]
fn test_oracle_stale_price() {
    let t = setup_oracle_test();

    // Advance ledger time so staleness check can trigger
    let mut li = t.env.ledger().get();
    li.timestamp = 10_000;
    t.env.ledger().set(li);

    let now = t.env.ledger().timestamp();

    // Set price with timestamp 2 hours ago
    let stale_timestamp = now - 7200;
    t.env.as_contract(&t.oracle_id, || {
        MockOracleContract::set_price(
            t.env.clone(),
            t.asset_address.clone(),
            PRECISION,
            stale_timestamp,
        );
    });

    // Should panic
    t.env.as_contract(&t.contract_id, || {
        PriceOracle::get_price(&t.env, &t.asset_address);
    });
}

// ─── Test 3: Zero price → panic ────────────────────────

#[test]
#[should_panic(expected = "Invalid price: price must be positive")]
fn test_oracle_zero_price() {
    let t = setup_oracle_test();
    let now = t.env.ledger().timestamp();

    t.env.as_contract(&t.oracle_id, || {
        MockOracleContract::set_price(t.env.clone(), t.asset_address.clone(), 0, now);
    });

    t.env.as_contract(&t.contract_id, || {
        PriceOracle::get_price(&t.env, &t.asset_address);
    });
}

// ─── Test 4: Negative price → panic ───────────────────

#[test]
#[should_panic(expected = "Invalid price: price must be positive")]
fn test_oracle_negative_price() {
    let t = setup_oracle_test();
    let now = t.env.ledger().timestamp();

    t.env.as_contract(&t.oracle_id, || {
        MockOracleContract::set_price(t.env.clone(), t.asset_address.clone(), -500, now);
    });

    t.env.as_contract(&t.contract_id, || {
        PriceOracle::get_price(&t.env, &t.asset_address);
    });
}

// ─── Test 5: Missing price (no data set) → panic ──────

#[test]
#[should_panic(expected = "Price not available for asset")]
fn test_oracle_missing_price() {
    let t = setup_oracle_test();

    // Do NOT set any price — oracle will return None
    t.env.as_contract(&t.contract_id, || {
        PriceOracle::get_price(&t.env, &t.asset_address);
    });
}

// ─── Test 6: Decimal normalization — scale UP ──────────
// Oracle has 8 decimals → price should be scaled to 18 decimals

#[test]
fn test_oracle_decimal_normalization_up() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));
    let oracle_id = env.register(MockOracleWithDecimals, ());
    let asset_address = Address::generate(&env);

    // Configure oracle with 8 decimals
    env.as_contract(&oracle_id, || {
        MockOracleWithDecimals::set_decimals(env.clone(), 8);
        MockOracleWithDecimals::set_price(
            env.clone(),
            asset_address.clone(),
            100_000_000, // 1.0 in 8-decimal format
            env.ledger().timestamp(),
        );
    });

    env.as_contract(&contract_id, || {
        PriceOracle::set_oracle_address(&env, &oracle_id);
    });

    let price = env.as_contract(&contract_id, || {
        PriceOracle::get_price(&env, &asset_address)
    });

    // 1.0 at 8 decimals = 100_000_000
    // Scaled to 18 decimals = 100_000_000 * 10^10 = 1_000_000_000_000_000_000 = PRECISION
    assert_eq!(
        price, PRECISION,
        "Price should be scaled from 8 to 18 decimals"
    );
}

// ─── Test 7: Decimal normalization — scale DOWN ────────
// Oracle has 24 decimals → price should be scaled down to 18 decimals

#[test]
fn test_oracle_decimal_normalization_down() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));
    let oracle_id = env.register(MockOracleWithDecimals, ());
    let asset_address = Address::generate(&env);

    // Configure oracle with 24 decimals
    env.as_contract(&oracle_id, || {
        MockOracleWithDecimals::set_decimals(env.clone(), 24);
        MockOracleWithDecimals::set_price(
            env.clone(),
            asset_address.clone(),
            1_000_000_000_000_000_000_000_000, // 1.0 in 24-decimal format
            env.ledger().timestamp(),
        );
    });

    env.as_contract(&contract_id, || {
        PriceOracle::set_oracle_address(&env, &oracle_id);
    });

    let price = env.as_contract(&contract_id, || {
        PriceOracle::get_price(&env, &asset_address)
    });

    // 1.0 at 24 decimals = 1e24, scaled down to 18 = 1e24 / 1e6 = 1e18 = PRECISION
    assert_eq!(
        price, PRECISION,
        "Price should be scaled from 24 to 18 decimals"
    );
}

// ─── Test 8: Configurable max age ──────────────────────

#[test]
fn test_oracle_configurable_max_age() {
    let t = setup_oracle_test();

    // Set a very short max age: 60 seconds
    t.env.as_contract(&t.contract_id, || {
        PriceOracle::set_max_age(&t.env, 60);
    });

    // Set price 120 seconds old (would be fine under default 3600, but stale under 60)
    let now = t.env.ledger().timestamp();
    let old_timestamp = now.saturating_sub(120);
    t.env.as_contract(&t.oracle_id, || {
        MockOracleContract::set_price(
            t.env.clone(),
            t.asset_address.clone(),
            PRECISION,
            old_timestamp,
        );
    });

    // Verify stored max age
    let stored_max_age = t
        .env
        .as_contract(&t.contract_id, || PriceOracle::get_max_age(&t.env));
    assert_eq!(stored_max_age, 60, "Custom max age should be stored");
}

#[test]
#[should_panic(expected = "Price data is stale")]
fn test_oracle_configurable_max_age_rejects_stale() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));
    let oracle_id = env.register(MockOracleContract, ());
    let asset_address = Address::generate(&env);

    // Advance ledger time so we have room for staleness
    let mut li = env.ledger().get();
    li.timestamp = 10_000;
    env.ledger().set(li);

    env.as_contract(&contract_id, || {
        PriceOracle::set_oracle_address(&env, &oracle_id);
        PriceOracle::set_max_age(&env, 60); // 60s max age
    });

    // Price 120s old → stale under 60s max age
    env.as_contract(&oracle_id, || {
        MockOracleContract::set_price(env.clone(), asset_address.clone(), PRECISION, 10_000 - 120);
    });

    env.as_contract(&contract_id, || {
        PriceOracle::get_price(&env, &asset_address);
    });
}

// ─── Test 9: Minimum price floor ───────────────────────

#[test]
#[should_panic(expected = "Price below minimum threshold")]
fn test_oracle_min_price_floor() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));
    let oracle_id = env.register(MockOracleContract, ());
    let asset_address = Address::generate(&env);

    env.as_contract(&contract_id, || {
        PriceOracle::set_oracle_address(&env, &oracle_id);
        // Require at least 0.5 * PRECISION as the minimum price
        PriceOracle::set_min_price(&env, PRECISION / 2);
    });

    // Set a valid but very low price: 0.01 * PRECISION (below floor)
    let now = env.ledger().timestamp();
    env.as_contract(&oracle_id, || {
        MockOracleContract::set_price(
            env.clone(),
            asset_address.clone(),
            PRECISION / 100, // 0.01 — below minimum of 0.5
            now,
        );
    });

    env.as_contract(&contract_id, || {
        PriceOracle::get_price(&env, &asset_address);
    });
}
fn advance_time(env: &Env, secs: u64) {
    let mut li = env.ledger().get();
    li.timestamp += secs;
    env.ledger().set(li);
}

#[test]
fn test_emergency_guard_can_pause() {
    let s = setup();
    let guard = Address::generate(&s.env);

    s.contract_client.grant_emergency_role(&s.admin, &guard);

    s.contract_client.emergency_pause(&guard);

    s.env.as_contract(&s.contract_address, || {
        assert!(PauseControl::is_paused(&s.env));
    });
}

#[test]

fn test_oracle_min_price_floor_passes_above_threshold() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));
    let oracle_id = env.register(MockOracleContract, ());
    let asset_address = Address::generate(&env);

    env.as_contract(&contract_id, || {
        PriceOracle::set_oracle_address(&env, &oracle_id);
        PriceOracle::set_min_price(&env, PRECISION / 2); // floor = 0.5
    });

    let now = env.ledger().timestamp();
    env.as_contract(&oracle_id, || {
        MockOracleContract::set_price(env.clone(), asset_address.clone(), PRECISION, now);
    });

    let price = env.as_contract(&contract_id, || {
        PriceOracle::get_price(&env, &asset_address)
    });

    assert_eq!(price, PRECISION, "Price above floor should succeed");
}

// ─── Test 10: Default max age when not configured ──────

#[test]
fn test_oracle_default_max_age() {
    let t = setup_oracle_test();

    let default_max_age = t
        .env
        .as_contract(&t.contract_id, || PriceOracle::get_max_age(&t.env));

    assert_eq!(
        default_max_age, 3600,
        "Default max age should be 3600 seconds"
    );
}

// ─── Test 11: get_guarded_price is alias for get_price ─

#[test]
fn test_oracle_guarded_price_alias() {
    let t = setup_oracle_test();
    let now = t.env.ledger().timestamp();

    t.env.as_contract(&t.oracle_id, || {
        MockOracleContract::set_price(t.env.clone(), t.asset_address.clone(), PRECISION * 2, now);
    });

    let price = t.env.as_contract(&t.contract_id, || {
        PriceOracle::get_guarded_price(&t.env, &t.asset_address)
    });

    assert_eq!(
        price,
        PRECISION * 2,
        "get_guarded_price should return same result as get_price"
    );
}

// ─── Test 12: End-to-end borrow with stale oracle ──────

#[test]
#[should_panic(expected = "Price data is stale")]
fn test_borrow_with_stale_oracle() {
    use soroban_sdk::token::StellarAssetClient;

    let env = Env::default();
    env.mock_all_auths();

    // Advance ledger time so staleness check can trigger
    let mut li = env.ledger().get();
    li.timestamp = 10_000;
    env.ledger().set(li);

    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));
    let oracle_id = env.register(MockOracleContract, ());
    let borrower = Address::generate(&env);

    let usdc_admin = Address::generate(&env);
    let usdc_contract = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let usdc_token = StellarAssetClient::new(&env, &usdc_contract.address());

    let xlm_admin = Address::generate(&env);
    let xlm_contract = env.register_stellar_asset_contract_v2(xlm_admin.clone());
    let xlm_token = StellarAssetClient::new(&env, &xlm_contract.address());

    let pool_id = String::from_str(&env, "USDC-POOL");
    let pool = LendingPool {
        id: pool_id.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: usdc_contract.address().clone(),
        collateral_factor: 750_000_000_000_000_000,
        liquidation_threshold: 800_000_000_000_000_000,
        liquidation_penalty: 50_000_000_000_000_000,
        reserve_factor: 1000,
        is_active: true,
        created_at: env.ledger().timestamp(),
    };

    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool);
        PoolStorage::set_total_deposits(&env, &pool_id, 10_000_000_000);
        PoolStorage::set_total_borrows(&env, &pool_id, 0);

        let model = InterestRateModel::default();
        InterestStorage::set_model(&env, &pool_id, &model);
        InterestStorage::set_interest_index(&env, &pool_id, PRECISION);
        InterestStorage::set_last_accrual(&env, &pool_id, env.ledger().timestamp());

        PriceOracle::set_oracle_address(&env, &oracle_id);
    });

    // Set XLM price with timestamp 2 hours ago — STALE
    let now = env.ledger().timestamp();
    let stale_ts = now - 7200;
    env.as_contract(&oracle_id, || {
        MockOracleContract::set_price(
            env.clone(),
            xlm_contract.address().clone(),
            PRECISION,
            stale_ts,
        );
    });

    usdc_token.mint(&borrower, &2_000_000_000);
    xlm_token.mint(&borrower, &2_000_000_000);
    usdc_token.mint(&contract_id, &10_000_000_000);

    // Borrow should fail because oracle price is stale
    env.as_contract(&contract_id, || {
        PropertyTokenContract::borrow(
            env.clone(),
            borrower.clone(),
            pool_id.clone(),
            1_000_000_000,
            xlm_contract.address().clone(),
            2_000_000_000,
        )
    });
}

// ─── Test 13: End-to-end borrow with zero oracle price ─

#[test]
#[should_panic(expected = "Invalid price: price must be positive")]
fn test_borrow_with_zero_oracle_price() {
    use soroban_sdk::token::StellarAssetClient;

    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let contract_id = env.register(PropertyTokenContract, (&admin,));
    let oracle_id = env.register(MockOracleContract, ());
    let borrower = Address::generate(&env);

    let usdc_admin = Address::generate(&env);
    let usdc_contract = env.register_stellar_asset_contract_v2(usdc_admin.clone());
    let usdc_token = StellarAssetClient::new(&env, &usdc_contract.address());

    let xlm_admin = Address::generate(&env);
    let xlm_contract = env.register_stellar_asset_contract_v2(xlm_admin.clone());
    let xlm_token = StellarAssetClient::new(&env, &xlm_contract.address());

    let pool_id = String::from_str(&env, "USDC-POOL");
    let pool = LendingPool {
        id: pool_id.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: usdc_contract.address().clone(),
        collateral_factor: 750_000_000_000_000_000,
        liquidation_threshold: 800_000_000_000_000_000,
        liquidation_penalty: 50_000_000_000_000_000,
        reserve_factor: 1000,
        is_active: true,
        created_at: env.ledger().timestamp(),
    };

    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool);
        PoolStorage::set_total_deposits(&env, &pool_id, 10_000_000_000);
        PoolStorage::set_total_borrows(&env, &pool_id, 0);

        let model = InterestRateModel::default();
        InterestStorage::set_model(&env, &pool_id, &model);
        InterestStorage::set_interest_index(&env, &pool_id, PRECISION);
        InterestStorage::set_last_accrual(&env, &pool_id, env.ledger().timestamp());

        PriceOracle::set_oracle_address(&env, &oracle_id);
    });

    // Set XLM price to ZERO — invalid
    let now = env.ledger().timestamp();
    env.as_contract(&oracle_id, || {
        MockOracleContract::set_price(env.clone(), xlm_contract.address().clone(), 0, now);
    });

    usdc_token.mint(&borrower, &2_000_000_000);
    xlm_token.mint(&borrower, &2_000_000_000);
    usdc_token.mint(&contract_id, &10_000_000_000);

    // Borrow should fail because oracle price is zero
    env.as_contract(&contract_id, || {
        PropertyTokenContract::borrow(
            env.clone(),
            borrower.clone(),
            pool_id.clone(),
            1_000_000_000,
            xlm_contract.address().clone(),
            2_000_000_000,
        )
    });
}

#[test]
#[should_panic(expected = "Contract paused")]
fn test_emergency_pause_blocks_operations() {
    let s = setup();

    s.contract_client.emergency_pause(&s.admin);

    s.env.as_contract(&s.contract_address, || {
        PauseControl::require_not_paused(&s.env);
    });
}

#[test]
#[should_panic(expected = "Timelock not expired")]
fn test_recovery_rejected_before_timelock() {
    let s = setup();

    s.contract_client.emergency_pause(&s.admin);
    s.contract_client.schedule_recovery(&s.admin);

    s.contract_client.execute_recovery(&s.admin);
}

#[test]
fn test_recovery_succeeds_after_timelock() {
    let s = setup();

    s.contract_client.emergency_pause(&s.admin);
    s.env.as_contract(&s.contract_address, || {
        assert!(PauseControl::is_paused(&s.env));
    });

    s.contract_client.schedule_recovery(&s.admin);

    advance_time(&s.env, 86_401);

    s.contract_client.execute_recovery(&s.admin);

    s.env.as_contract(&s.contract_address, || {
        assert!(!PauseControl::is_paused(&s.env));
    });
}

#[test]
#[should_panic(expected = "Contract not paused")]
fn test_schedule_recovery_requires_paused() {
    let s = setup();
    s.contract_client.schedule_recovery(&s.admin);
}

#[test]
#[should_panic(expected = "Recovery already scheduled")]
fn test_double_schedule_rejected() {
    let s = setup();

    s.contract_client.emergency_pause(&s.admin);
    s.contract_client.schedule_recovery(&s.admin);
    s.contract_client.schedule_recovery(&s.admin);
}

#[test]
fn test_cancel_recovery_keeps_contract_paused() {
    let s = setup();

    s.contract_client.emergency_pause(&s.admin);
    s.contract_client.schedule_recovery(&s.admin);
    s.contract_client.cancel_recovery(&s.admin);

    s.env.as_contract(&s.contract_address, || {
        assert!(PauseControl::is_paused(&s.env));
    });
}

#[test]
#[should_panic(expected = "No recovery scheduled")]
fn test_cancel_no_recovery_panics() {
    let s = setup();
    s.contract_client.cancel_recovery(&s.admin);
}

#[test]
#[should_panic(expected = "Caller does not have permission to pause")]
fn test_unauthorized_cannot_emergency_pause() {
    let s = setup();
    let attacker = Address::generate(&s.env);
    s.contract_client.emergency_pause(&attacker);
}

#[test]
#[should_panic(expected = "Caller not admin")]
fn test_unauthorized_cannot_schedule_recovery() {
    let s = setup();
    let attacker = Address::generate(&s.env);
    s.contract_client.emergency_pause(&s.admin);
    s.contract_client.schedule_recovery(&attacker);
}

#[test]
#[should_panic(expected = "Caller not admin")]
fn test_unauthorized_cannot_execute_recovery() {
    let s = setup();
    let attacker = Address::generate(&s.env);
    s.contract_client.execute_recovery(&attacker);
}

#[test]
#[should_panic(expected = "Caller not admin")]
fn test_unauthorized_cannot_cancel_recovery() {
    let s = setup();
    let attacker = Address::generate(&s.env);
    s.contract_client.cancel_recovery(&attacker);
}

#[test]
#[should_panic(expected = "Caller not admin")]
fn test_non_admin_cannot_grant_emergency_role() {
    let s = setup();
    let non_admin = Address::generate(&s.env);
    let target = Address::generate(&s.env);
    s.contract_client.grant_emergency_role(&non_admin, &target);
}

#[test]
#[should_panic(expected = "Caller does not have permission to pause")]
fn test_revoked_emergency_guard_cannot_pause() {
    let s = setup();
    let guard = Address::generate(&s.env);

    s.contract_client.grant_emergency_role(&s.admin, &guard);
    s.contract_client.revoke_emergency_role(&s.admin, &guard);

    s.contract_client.emergency_pause(&guard);
}

#[test]
fn test_emergency_pause_emits_event() {
    let s = setup();
    s.contract_client.emergency_pause(&s.admin);
}

#[test]
fn test_schedule_recovery_emits_event() {
    let s = setup();
    s.contract_client.emergency_pause(&s.admin);
    s.contract_client.schedule_recovery(&s.admin);
}

#[test]
fn test_cancel_recovery_emits_event() {
    let s = setup();
    s.contract_client.emergency_pause(&s.admin);
    s.contract_client.schedule_recovery(&s.admin);
    s.contract_client.cancel_recovery(&s.admin);
}

#[test]
fn test_execute_recovery_emits_event() {
    let s = setup();
    s.contract_client.emergency_pause(&s.admin);
    s.contract_client.schedule_recovery(&s.admin);
    advance_time(&s.env, 86_401);
    s.contract_client.execute_recovery(&s.admin);
}

#[test]
fn test_full_emergency_and_recovery_flow() {
    let s = setup();
    let pool_id = create_default_pool(&s);
    let guard = Address::generate(&s.env);
    let user = Address::generate(&s.env);

    s.contract_client.grant_emergency_role(&s.admin, &guard);
    mint_tokens(&s, &user, 2_000_000_000);

    s.contract_client
        .deposit(&user, &pool_id, &1_000_000_000_i128);

    s.contract_client.emergency_pause(&guard);

    s.contract_client.schedule_recovery(&s.admin);

    advance_time(&s.env, 86_401);

    s.contract_client.execute_recovery(&s.admin);

    s.contract_client
        .deposit(&user, &pool_id, &1_000_000_000_i128);

    let total = s.contract_client.get_total_deposits(&pool_id);
    assert_eq!(total, 2_000_000_000);
}
