use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

// Created this contract just for testing storage
#[contract]
pub struct TestContract;

#[contractimpl]
impl TestContract {
    pub fn __constructor(_env: Env) {
        // Empty constructor
    }
}

// Store and retrieve LendingPool

#[test]
fn test_store_and_retrieve_lending_pool() {
    let env = Env::default();
    let contract_id = env.register(TestContract, ());
    let asset_address = Address::generate(&env);
    let pool_id = String::from_str(&env, "USDC-POOL");

    let pool = LendingPool {
        id: pool_id.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: asset_address.clone(),
        collateral_factor: 750_000_000_000_000_000, // 75%
        liquidation_threshold: 800_000_000_000_000_000, // 80%
        liquidation_penalty: 50_000_000_000_000_000, // 5%
        reserve_factor: 1000,                       // 10%
        is_active: true,
        created_at: 1700000000,
    };

    // Store the pool
    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool);
    });

    // Verify pool exists
    let exists = env.as_contract(&contract_id, || PoolStorage::exists(&env, &pool_id));
    assert!(exists);

    // Retrieve and verify data integrity
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

// Store and retrieve deposit position

#[test]
fn test_store_and_retrieve_deposit_position() {
    let env = Env::default();
    let contract_id = env.register(TestContract, ());
    let user = Address::generate(&env);
    let pool_id = String::from_str(&env, "USDC-POOL");

    let position = DepositPosition {
        pool_id: pool_id.clone(),
        depositor: user.clone(),
        amount: 1_000_000_000, // 1000 USDC (6 decimals)
        shares: 1_000_000_000,
        index_at_deposit: PRECISION,
        deposited_at: 1700000000,
    };

    // Store deposit position
    env.as_contract(&contract_id, || {
        PositionStorage::set_deposit(&env, &position);
    });

    // Retrieve and verify correct values
    let retrieved = env.as_contract(&contract_id, || {
        PositionStorage::get_deposit(&env, &user, &pool_id).unwrap()
    });
    assert_eq!(retrieved.amount, 1_000_000_000);
    assert_eq!(retrieved.shares, 1_000_000_000);
    assert_eq!(retrieved.index_at_deposit, PRECISION);
    assert_eq!(retrieved.deposited_at, 1700000000);
    assert_eq!(retrieved.pool_id, pool_id);
    assert_eq!(retrieved.depositor, user);

    // Verify user deposits list
    let user_deposits = env.as_contract(&contract_id, || {
        PositionStorage::get_user_deposits(&env, &user)
    });
    assert_eq!(user_deposits.len(), 1);
    assert_eq!(user_deposits.get(0).unwrap(), pool_id);
}

#[test]
fn test_store_and_retrieve_borrow_position() {
    let env = Env::default();
    let contract_id = env.register(TestContract, ());
    let user = Address::generate(&env);
    let pool_id = String::from_str(&env, "USDC-POOL");
    let collateral_asset = Address::generate(&env);

    let position = BorrowPosition {
        pool_id: pool_id.clone(),
        borrower: user.clone(),
        principal: 500_000_000, // 500 USDC
        index_at_borrow: PRECISION,
        collateral_amount: 1_000_000_000,
        collateral_asset: collateral_asset.clone(),
        borrowed_at: 1700000000,
    };

    // Store borrow position
    env.as_contract(&contract_id, || {
        PositionStorage::set_borrow(&env, &position);
    });

    // Retrieve and verify correct values
    let retrieved = env.as_contract(&contract_id, || {
        PositionStorage::get_borrow(&env, &user, &pool_id).unwrap()
    });
    assert_eq!(retrieved.principal, 500_000_000);
    assert_eq!(retrieved.index_at_borrow, PRECISION);
    assert_eq!(retrieved.collateral_amount, 1_000_000_000);
    assert_eq!(retrieved.collateral_asset, collateral_asset);
    assert_eq!(retrieved.borrowed_at, 1700000000);
    assert_eq!(retrieved.pool_id, pool_id);
    assert_eq!(retrieved.borrower, user);

    // Verify user borrows list
    let user_borrows = env.as_contract(&contract_id, || {
        PositionStorage::get_user_borrows(&env, &user)
    });
    assert_eq!(user_borrows.len(), 1);
    assert_eq!(user_borrows.get(0).unwrap(), pool_id);
}

// Interest rate calculation

#[test]
fn test_interest_rate_calculation() {
    let model = InterestRateModel::default();

    // Test at 0% utilization
    let rate_0 = model.calculate_borrow_rate(0);
    assert_eq!(rate_0, model.base_rate);

    // Test at optimal utilization (80%)
    let rate_optimal = model.calculate_borrow_rate(model.optimal_utilization);
    assert_eq!(rate_optimal, model.base_rate + model.slope1);

    // Test at 100% utilization
    let rate_100 = model.calculate_borrow_rate(PRECISION);
    assert!(rate_100 > rate_optimal);

    // Test at 50% utilization (below optimal)
    let utilization_50 = PRECISION / 2;
    let rate_50 = model.calculate_borrow_rate(utilization_50);
    assert!(rate_50 > model.base_rate);
    assert!(rate_50 < rate_optimal);

    // Test at 90% utilization (above optimal)
    let utilization_90 = 900_000_000_000_000_000; // 90%
    let rate_90 = model.calculate_borrow_rate(utilization_90);
    assert!(rate_90 > rate_optimal);
    assert!(rate_90 < rate_100);

    // Verify APY computation accuracy
    // APY = (1 + rate)^(SECONDS_PER_YEAR / time_elapsed) - 1
    // For simplicity, verify that rate increases with utilization
    let rate_20 = model.calculate_borrow_rate(200_000_000_000_000_000); // 20%
    let rate_40 = model.calculate_borrow_rate(400_000_000_000_000_000); // 40%
    assert!(rate_40 > rate_20);
}

#[test]
fn test_supply_rate_calculation() {
    let model = InterestRateModel::default();
    let utilization = 500_000_000_000_000_000; // 50%
    let reserve_factor = 100_000_000_000_000_000; // 10% in PRECISION units

    let borrow_rate = model.calculate_borrow_rate(utilization);
    let supply_rate = model.calculate_supply_rate(borrow_rate, utilization, reserve_factor);

    // Supply rate should be less than borrow rate due to reserve factor
    assert!(supply_rate < borrow_rate);
    assert!(supply_rate > 0);
}

// Utilization rate calculation

#[test]
fn test_utilization_rate_calculation() {
    // Test at 0% utilization (no borrows)
    let utilization_0 = PoolStorage::calculate_utilization(1_000_000_000, 0);
    assert_eq!(utilization_0, 0);

    // Test at 50% utilization
    let total_deposits = 1_000_000_000;
    let total_borrows = 500_000_000;
    let utilization_50 = PoolStorage::calculate_utilization(total_deposits, total_borrows);
    assert_eq!(utilization_50, PRECISION / 2);

    // Test at 100% utilization
    let utilization_100 = PoolStorage::calculate_utilization(total_deposits, total_deposits);
    assert_eq!(utilization_100, PRECISION);

    // Test at 75% utilization
    let total_borrows_75 = 750_000_000;
    let utilization_75 = PoolStorage::calculate_utilization(total_deposits, total_borrows_75);
    assert_eq!(utilization_75, 750_000_000_000_000_000);

    // Test with zero deposits
    let utilization_zero_deposits = PoolStorage::calculate_utilization(0, 100_000_000);
    assert_eq!(utilization_zero_deposits, 0);

    // Test available liquidity calculation
    let available = PoolStorage::calculate_available_liquidity(total_deposits, total_borrows);
    assert_eq!(available, 500_000_000);

    // Test available liquidity when fully utilized
    let available_full = PoolStorage::calculate_available_liquidity(total_deposits, total_deposits);
    assert_eq!(available_full, 0);

    // Test available liquidity when borrows exceed deposits
    let available_negative =
        PoolStorage::calculate_available_liquidity(total_deposits, total_deposits + 100);
    assert_eq!(available_negative, 0);
}

// Multiple pools storage

#[test]
fn test_multiple_pools_storage() {
    let env = Env::default();
    let contract_id = env.register(TestContract, ());
    let asset_address_1 = Address::generate(&env);
    let asset_address_2 = Address::generate(&env);
    let asset_address_3 = Address::generate(&env);

    let pool_id_1 = String::from_str(&env, "USDC-POOL");
    let pool_id_2 = String::from_str(&env, "USDT-POOL");
    let pool_id_3 = String::from_str(&env, "DAI-POOL");

    // Create and store first pool
    let pool_1 = LendingPool {
        id: pool_id_1.clone(),
        name: String::from_str(&env, "USDC Lending Pool"),
        asset: String::from_str(&env, "USDC"),
        asset_address: asset_address_1.clone(),
        collateral_factor: 750_000_000_000_000_000,
        liquidation_threshold: 800_000_000_000_000_000,
        liquidation_penalty: 50_000_000_000_000_000,
        reserve_factor: 1000,
        is_active: true,
        created_at: 1700000000,
    };
    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool_1);
        PoolStorage::add_to_list(&env, &pool_id_1);
    });

    // Create and store second pool
    let pool_2 = LendingPool {
        id: pool_id_2.clone(),
        name: String::from_str(&env, "USDT Lending Pool"),
        asset: String::from_str(&env, "USDT"),
        asset_address: asset_address_2.clone(),
        collateral_factor: 700_000_000_000_000_000, // Different value
        liquidation_threshold: 750_000_000_000_000_000,
        liquidation_penalty: 50_000_000_000_000_000,
        reserve_factor: 1200, // Different value
        is_active: true,
        created_at: 1700000100,
    };
    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool_2);
        PoolStorage::add_to_list(&env, &pool_id_2);
    });

    // Create and store third pool
    let pool_3 = LendingPool {
        id: pool_id_3.clone(),
        name: String::from_str(&env, "DAI Lending Pool"),
        asset: String::from_str(&env, "DAI"),
        asset_address: asset_address_3.clone(),
        collateral_factor: 800_000_000_000_000_000,
        liquidation_threshold: 850_000_000_000_000_000,
        liquidation_penalty: 60_000_000_000_000_000,
        reserve_factor: 1500,
        is_active: false, // Different value
        created_at: 1700000200,
    };
    env.as_contract(&contract_id, || {
        PoolStorage::set(&env, &pool_3);
        PoolStorage::add_to_list(&env, &pool_id_3);
    });

    // Verify all pools exist
    let exists_1 = env.as_contract(&contract_id, || PoolStorage::exists(&env, &pool_id_1));
    let exists_2 = env.as_contract(&contract_id, || PoolStorage::exists(&env, &pool_id_2));
    let exists_3 = env.as_contract(&contract_id, || PoolStorage::exists(&env, &pool_id_3));
    assert!(exists_1);
    assert!(exists_2);
    assert!(exists_3);

    // Verify pools are isolated correctly - retrieve each and verify data integrity
    let retrieved_1 = env.as_contract(&contract_id, || PoolStorage::get(&env, &pool_id_1).unwrap());
    assert_eq!(retrieved_1.asset, String::from_str(&env, "USDC"));
    assert_eq!(retrieved_1.asset_address, asset_address_1);
    assert_eq!(retrieved_1.collateral_factor, 750_000_000_000_000_000);
    assert_eq!(retrieved_1.reserve_factor, 1000);

    let retrieved_2 = env.as_contract(&contract_id, || PoolStorage::get(&env, &pool_id_2).unwrap());
    assert_eq!(retrieved_2.asset, String::from_str(&env, "USDT"));
    assert_eq!(retrieved_2.asset_address, asset_address_2);
    assert_eq!(retrieved_2.collateral_factor, 700_000_000_000_000_000);
    assert_eq!(retrieved_2.reserve_factor, 1200);

    let retrieved_3 = env.as_contract(&contract_id, || PoolStorage::get(&env, &pool_id_3).unwrap());
    assert_eq!(retrieved_3.asset, String::from_str(&env, "DAI"));
    assert_eq!(retrieved_3.asset_address, asset_address_3);
    assert_eq!(retrieved_3.collateral_factor, 800_000_000_000_000_000);
    assert_eq!(retrieved_3.reserve_factor, 1500);
    assert!(!retrieved_3.is_active);

    // Verify pool list contains all pools
    let pool_list = env.as_contract(&contract_id, || PoolStorage::get_list(&env));
    assert!(pool_list.len() >= 3);
    assert!(pool_list.contains(&pool_id_1));
    assert!(pool_list.contains(&pool_id_2));
    assert!(pool_list.contains(&pool_id_3));

    // Test that pool-specific data is isolated
    env.as_contract(&contract_id, || {
        PoolStorage::set_total_deposits(&env, &pool_id_1, 1_000_000_000);
        PoolStorage::set_total_deposits(&env, &pool_id_2, 2_000_000_000);
        PoolStorage::set_total_deposits(&env, &pool_id_3, 3_000_000_000);
    });

    let deposits_1 = env.as_contract(&contract_id, || {
        PoolStorage::get_total_deposits(&env, &pool_id_1)
    });
    let deposits_2 = env.as_contract(&contract_id, || {
        PoolStorage::get_total_deposits(&env, &pool_id_2)
    });
    let deposits_3 = env.as_contract(&contract_id, || {
        PoolStorage::get_total_deposits(&env, &pool_id_3)
    });
    assert_eq!(deposits_1, 1_000_000_000);
    assert_eq!(deposits_2, 2_000_000_000);
    assert_eq!(deposits_3, 3_000_000_000);

    // Test that positions are isolated per pool
    let user_1 = Address::generate(&env);

    let deposit_1 = DepositPosition {
        pool_id: pool_id_1.clone(),
        depositor: user_1.clone(),
        amount: 100_000_000,
        shares: 100_000_000,
        index_at_deposit: PRECISION,
        deposited_at: 1700000000,
    };

    let deposit_2 = DepositPosition {
        pool_id: pool_id_2.clone(),
        depositor: user_1.clone(),
        amount: 200_000_000,
        shares: 200_000_000,
        index_at_deposit: PRECISION,
        deposited_at: 1700000100,
    };

    env.as_contract(&contract_id, || {
        PositionStorage::set_deposit(&env, &deposit_1);
        PositionStorage::set_deposit(&env, &deposit_2);
    });

    let retrieved_deposit_1 = env.as_contract(&contract_id, || {
        PositionStorage::get_deposit(&env, &user_1, &pool_id_1).unwrap()
    });
    let retrieved_deposit_2 = env.as_contract(&contract_id, || {
        PositionStorage::get_deposit(&env, &user_1, &pool_id_2).unwrap()
    });

    assert_eq!(retrieved_deposit_1.amount, 100_000_000);
    assert_eq!(retrieved_deposit_2.amount, 200_000_000);
    assert_eq!(retrieved_deposit_1.pool_id, pool_id_1);
    assert_eq!(retrieved_deposit_2.pool_id, pool_id_2);

    // Verify user has deposits in both pools
    let user_deposits = env.as_contract(&contract_id, || {
        PositionStorage::get_user_deposits(&env, &user_1)
    });
    assert!(user_deposits.len() >= 2);
    assert!(user_deposits.contains(&pool_id_1));
    assert!(user_deposits.contains(&pool_id_2));
}
