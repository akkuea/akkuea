extern crate std;

use super::*;
use crate::oracle_types::{Asset, PriceData};
use proptest::prelude::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _, Ledger as _},
    token::{StellarAssetClient, TokenClient},
    Address, Env, String, Symbol,
};

#[contract]
struct AccountingOracle;

#[contractimpl]
impl AccountingOracle {
    pub fn set_price(env: Env, asset: Address, price: i128, timestamp: u64) {
        env.storage().persistent().set(
            &(Symbol::new(&env, "price"), asset),
            &PriceData { price, timestamp },
        );
    }

    pub fn lastprice(env: Env, asset: Asset) -> Option<PriceData> {
        match asset {
            Asset::Stellar(address) => env
                .storage()
                .persistent()
                .get(&(Symbol::new(&env, "price"), address)),
            Asset::Other(_) => None,
        }
    }

    pub fn decimals(_env: Env) -> u32 {
        18
    }

    pub fn resolution(_env: Env) -> u32 {
        1
    }

    pub fn base(env: Env) -> Asset {
        Asset::Other(Symbol::new(&env, "USD"))
    }

    pub fn assets(env: Env) -> soroban_sdk::Vec<Asset> {
        soroban_sdk::Vec::new(&env)
    }
}

struct AccountingSetup<'a> {
    env: Env,
    admin: Address,
    contract: Address,
    client: PropertyTokenContractClient<'a>,
    pool_id: String,
    asset: Address,
    collateral: Address,
    other_collateral: Address,
}

fn setup_accounting() -> AccountingSetup<'static> {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract = env.register(PropertyTokenContract, (&admin,));
    let client = PropertyTokenContractClient::new(&env, &contract);
    let oracle = env.register(AccountingOracle, ());
    let asset_admin = Address::generate(&env);
    let asset = env
        .register_stellar_asset_contract_v2(asset_admin)
        .address()
        .clone();
    let collateral_admin = Address::generate(&env);
    let collateral = env
        .register_stellar_asset_contract_v2(collateral_admin)
        .address()
        .clone();
    let other_admin = Address::generate(&env);
    let other_collateral = env
        .register_stellar_asset_contract_v2(other_admin)
        .address()
        .clone();
    let pool_id = String::from_str(&env, "ACCOUNTING-POOL");

    client.create_pool(
        &admin,
        &pool_id,
        &String::from_str(&env, "Accounting Pool"),
        &String::from_str(&env, "USD"),
        &asset,
        &750_000_000_000_000_000_i128,
        &800_000_000_000_000_000_i128,
        &50_000_000_000_000_000_i128,
        &500_000_000_000_000_000_i128,
        &1000_u32,
    );
    client.set_oracle(&oracle, &admin);
    client.set_oracle_config(&admin, &u64::MAX, &0_i128);

    env.as_contract(&oracle, || {
        AccountingOracle::set_price(
            env.clone(),
            collateral.clone(),
            PRECISION,
            env.ledger().timestamp(),
        );
        AccountingOracle::set_price(
            env.clone(),
            other_collateral.clone(),
            PRECISION,
            env.ledger().timestamp(),
        );
    });

    AccountingSetup {
        env,
        admin,
        contract,
        client,
        pool_id,
        asset,
        collateral,
        other_collateral,
    }
}

fn deposit(s: &AccountingSetup, depositor: &Address, amount: i128) {
    StellarAssetClient::new(&s.env, &s.asset).mint(depositor, &amount);
    s.client.deposit(depositor, &s.pool_id, &amount);
}

fn mint_collateral(s: &AccountingSetup, borrower: &Address, amount: i128) {
    StellarAssetClient::new(&s.env, &s.collateral).mint(borrower, &amount);
}

fn current_claim(s: &AccountingSetup, depositor: &Address) -> i128 {
    s.env.as_contract(&s.contract, || {
        PositionStorage::get_deposit(&s.env, depositor, &s.pool_id)
            .map(|position| PositionStorage::calculate_deposit_balance(&s.env, &position).unwrap())
            .unwrap_or(0)
    })
}

fn advance_time(s: &AccountingSetup, seconds: u64) {
    let mut ledger = s.env.ledger().get();
    ledger.timestamp = ledger.timestamp.checked_add(seconds).unwrap();
    s.env.ledger().set(ledger);
}

fn borrow(s: &AccountingSetup, borrower: &Address, amount: i128, collateral: i128) {
    mint_collateral(s, borrower, collateral);
    s.client
        .borrow(borrower, &s.pool_id, &amount, &s.collateral, &collateral);
}

fn repay_all(s: &AccountingSetup, borrower: &Address) {
    let position = s.client.get_borrow_position(borrower, &s.pool_id);
    let debt = s.env.as_contract(&s.contract, || {
        PositionStorage::calculate_current_debt(&s.env, &position).unwrap()
    });
    StellarAssetClient::new(&s.env, &s.asset).mint(borrower, &debt);
    s.client.repay(borrower, &s.pool_id, &debt);
}

#[test]
fn supply_yield_is_utilization_adjusted_and_full_exit_leaves_reserves() {
    let s = setup_accounting();
    let depositor = Address::generate(&s.env);
    let borrower = Address::generate(&s.env);
    deposit(&s, &depositor, 1_000_000_000);
    borrow(&s, &borrower, 100_000_000, 200_000_000);

    let model = InterestRateModel::default();
    let utilization = PRECISION / 10;
    let borrow_rate = model.calculate_borrow_rate(utilization).unwrap();
    let supply_rate = model
        .calculate_supply_rate(borrow_rate, utilization, PRECISION / 10)
        .unwrap();
    assert_eq!(borrow_rate, 25_000_000_000_000_000);
    assert_eq!(supply_rate, 2_250_000_000_000_000);

    advance_time(&s, SECONDS_PER_YEAR);
    s.client.accrue_interest(&s.pool_id);

    let claim_after_year = current_claim(&s, &depositor);
    let gain = claim_after_year - 1_000_000_000;
    assert!(
        (2_240_000..=2_270_000).contains(&gain),
        "default model at 10% utilization yields about 0.225% annually, got {gain}"
    );
    assert!(
        gain < 25_000_000,
        "yield must not equal the 2.5% borrow rate"
    );
    assert_eq!(s.client.get_total_deposits(&s.pool_id), claim_after_year);
    assert!(s.client.get_reserves(&s.pool_id) > 0);
    assert_eq!(
        s.client.get_available_liquidity(&s.pool_id),
        s.client.get_total_deposits(&s.pool_id) - s.client.get_total_borrows(&s.pool_id)
    );
    let cash = TokenClient::new(&s.env, &s.asset).balance(&s.contract);
    assert_eq!(
        s.client.get_available_liquidity(&s.pool_id),
        cash - s.client.get_reserves(&s.pool_id),
        "available liquidity excludes reserve tokens"
    );

    repay_all(&s, &borrower);
    let final_claim = current_claim(&s, &depositor);
    s.client.withdraw(&depositor, &s.pool_id, &final_claim);
    let reserves = s.client.get_reserves(&s.pool_id);
    assert_eq!(
        TokenClient::new(&s.env, &s.asset).balance(&s.contract),
        reserves,
        "after repayment and full exit, only reserve tokens remain"
    );
}

#[test]
fn first_of_two_depositors_cannot_withdraw_the_other_claim() {
    let s = setup_accounting();
    let first = Address::generate(&s.env);
    let second = Address::generate(&s.env);
    let borrower = Address::generate(&s.env);
    deposit(&s, &first, 500_000_000);
    deposit(&s, &second, 500_000_000);
    borrow(&s, &borrower, 100_000_000, 200_000_000);
    advance_time(&s, SECONDS_PER_YEAR);
    s.client.accrue_interest(&s.pool_id);
    repay_all(&s, &borrower);

    let first_claim = current_claim(&s, &first);
    let second_claim = current_claim(&s, &second);
    s.client.withdraw(&first, &s.pool_id, &first_claim);
    let cash_after_first = TokenClient::new(&s.env, &s.asset).balance(&s.contract);
    assert!(
        cash_after_first >= second_claim + s.client.get_reserves(&s.pool_id),
        "first exit must leave the second claim and reserves intact"
    );

    s.client.withdraw(&second, &s.pool_id, &second_claim);
    let final_cash = TokenClient::new(&s.env, &s.asset).balance(&s.contract);
    let final_reserves = s.client.get_reserves(&s.pool_id);
    assert!(
        final_cash >= final_reserves && final_cash - final_reserves <= 2,
        "only a few stroops of rounding dust may remain"
    );
}

#[test]
fn reserve_withdrawal_is_admin_only_capped_and_emits_an_event() {
    let s = setup_accounting();
    let depositor = Address::generate(&s.env);
    let borrower = Address::generate(&s.env);
    let recipient = Address::generate(&s.env);
    deposit(&s, &depositor, 1_000_000_000);
    borrow(&s, &borrower, 100_000_000, 200_000_000);
    advance_time(&s, SECONDS_PER_YEAR);
    s.client.accrue_interest(&s.pool_id);
    repay_all(&s, &borrower);

    let reserves = s.client.get_reserves(&s.pool_id);
    assert!(reserves > 0);
    let unauthorized = Address::generate(&s.env);
    let unauthorized_result =
        s.client
            .try_withdraw_reserves(&unauthorized, &s.pool_id, &recipient, &1_i128);
    assert!(unauthorized_result.is_err());
    let over_limit = s.client.try_withdraw_reserves(
        &s.admin,
        &s.pool_id,
        &recipient,
        &reserves.checked_add(1).unwrap(),
    );
    assert!(matches!(
        over_limit,
        Err(Ok(ContractError::InsufficientReserves))
    ));

    s.client
        .withdraw_reserves(&s.admin, &s.pool_id, &recipient, &reserves);
    let emitted_events = s
        .env
        .events()
        .all()
        .filter_by_contract(&s.contract)
        .events()
        .len();
    assert_eq!(s.client.get_reserves(&s.pool_id), 0);
    assert_eq!(
        TokenClient::new(&s.env, &s.asset).balance(&recipient),
        reserves
    );
    assert_eq!(emitted_events, 1);
}

#[test]
fn subsequent_borrow_merges_debt_and_collateral_and_checks_combined_health() {
    let s = setup_accounting();
    let depositor = Address::generate(&s.env);
    let borrower = Address::generate(&s.env);
    deposit(&s, &depositor, 1_000_000_000);
    let first = 100_000_000;
    borrow(&s, &borrower, first, 200_000_000);
    mint_collateral(&s, &borrower, 200_000_000);
    let second = s.client.borrow(
        &borrower,
        &s.pool_id,
        &100_000_000_i128,
        &s.collateral,
        &200_000_000_i128,
    );
    assert_eq!(second.principal, 200_000_000);
    assert_eq!(second.collateral_amount, 400_000_000);
    assert_eq!(s.client.get_total_borrows(&s.pool_id), 200_000_000);

    let mismatch = s.client.try_borrow(
        &borrower,
        &s.pool_id,
        &1_000_i128,
        &s.other_collateral,
        &10_000_i128,
    );
    assert!(matches!(
        mismatch,
        Err(Ok(ContractError::CollateralAssetMismatch))
    ));

    let low_health = s.client.try_borrow(
        &borrower,
        &s.pool_id,
        &100_000_000_i128,
        &s.collateral,
        &100_000_000_i128,
    );
    assert!(low_health.is_err());
    assert_eq!(s.client.get_total_borrows(&s.pool_id), 200_000_000);
    assert_eq!(
        s.client
            .get_borrow_position(&borrower, &s.pool_id)
            .collateral_amount,
        400_000_000
    );
}

fn assert_accounting_invariant(s: &AccountingSetup, depositors: &[Address; 2], dust: i128) {
    let claims = depositors.iter().try_fold(0_i128, |sum, depositor| {
        let claim = s.env.as_contract(&s.contract, || {
            PositionStorage::get_deposit(&s.env, depositor, &s.pool_id)
                .map(|position| {
                    PositionStorage::calculate_deposit_balance(&s.env, &position).unwrap()
                })
                .unwrap_or(0)
        });
        sum.checked_add(claim)
    });
    let claims = claims.expect("test claim sum must not overflow");
    let assets = TokenClient::new(&s.env, &s.asset)
        .balance(&s.contract)
        .checked_add(s.client.get_total_borrows(&s.pool_id))
        .expect("test asset sum must not overflow");
    let obligations = claims
        .checked_add(s.client.get_reserves(&s.pool_id))
        .expect("test obligation sum must not overflow");
    assert!(
        obligations <= assets.checked_add(dust).unwrap(),
        "claims and reserves {obligations} exceed cash and debt {assets}"
    );
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(32))]

    #[test]
    fn randomized_lending_operations_preserve_pool_accounting(
        operations in prop::collection::vec((0_u8..5, 1_u16..10_000), 1..40)
    ) {
        let s = setup_accounting();
        let depositors = [Address::generate(&s.env), Address::generate(&s.env)];
        let borrower = Address::generate(&s.env);
        StellarAssetClient::new(&s.env, &s.asset).mint(&borrower, &1_000_000_000_000_i128);
        let collateral = StellarAssetClient::new(&s.env, &s.collateral);
        let dust = 16_i128;

        for (action, value) in operations {
            match action {
                0 => {
                    let index = (value as usize) % depositors.len();
                    deposit(&s, &depositors[index], i128::from(value));
                }
                1 => {
                    let index = (value as usize) % depositors.len();
                    let claim = current_claim(&s, &depositors[index]);
                    let available = s.client.get_available_liquidity(&s.pool_id);
                    let amount = claim.min(available).min(i128::from(value));
                    if amount > 0 {
                        s.client.withdraw(&depositors[index], &s.pool_id, &amount);
                    }
                }
                2 => {
                    let amount = i128::from(value.min(100));
                    let available = s.client.get_available_liquidity(&s.pool_id);
                    if amount <= available {
                        let collateral_amount = amount.checked_mul(2).unwrap();
                        collateral.mint(&borrower, &collateral_amount);
                        s.client.borrow(
                            &borrower,
                            &s.pool_id,
                            &amount,
                            &s.collateral,
                            &collateral_amount,
                        );
                    }
                }
                3 => {
                    if let Ok(Ok(position)) =
                        s.client.try_get_borrow_position(&borrower, &s.pool_id)
                    {
                        let debt = s.env.as_contract(&s.contract, || {
                            PositionStorage::calculate_current_debt(&s.env, &position).unwrap()
                        });
                        let amount = debt.min(i128::from(value));
                        if amount > 0 {
                            s.client.repay(&borrower, &s.pool_id, &amount);
                        }
                    }
                }
                _ => {
                    advance_time(&s, u64::from(value));
                    s.client.accrue_interest(&s.pool_id);
                }
            }
            assert_accounting_invariant(&s, &depositors, dust);
        }
    }
}
