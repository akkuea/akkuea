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
    oracle: Address,
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
        AccountingOracle::set_price(
            env.clone(),
            asset.clone(),
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
        oracle,
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

fn set_collateral_price(s: &AccountingSetup, price: i128) {
    s.env.as_contract(&s.oracle, || {
        AccountingOracle::set_price(
            s.env.clone(),
            s.collateral.clone(),
            price,
            s.env.ledger().timestamp(),
        );
    });
}

/// Fund the pool reserves with real tokens so cash and books stay in step.
fn fund_reserves(s: &AccountingSetup, amount: i128) {
    StellarAssetClient::new(&s.env, &s.asset).mint(&s.contract, &amount);
    s.env.as_contract(&s.contract, || {
        PoolStorage::add_reserves(&s.env, &s.pool_id, amount).unwrap();
    });
}

fn bad_debt_events(s: &AccountingSetup) -> std::vec::Vec<BadDebtWrittenOffEvent> {
    use soroban_sdk::{symbol_short, xdr, TryFromVal, Val};
    s.env
        .events()
        .all()
        .filter_by_contract(&s.contract)
        .events()
        .iter()
        .filter_map(|event| {
            let xdr::ContractEventBody::V0(body) = &event.body;
            let topic = Val::try_from_val(&s.env, body.topics.first()?).ok()?;
            let topic = Symbol::try_from_val(&s.env, &topic).ok()?;
            if topic != symbol_short!("bad_debt") {
                return None;
            }
            let data = Val::try_from_val(&s.env, &body.data).ok()?;
            BadDebtWrittenOffEvent::try_from_val(&s.env, &data).ok()
        })
        .collect()
}

/// Borrow 100 against 200 collateral at 1.0, then crash the collateral to 0.10
/// and liquidate. The 50% close factor caps the request at 50, but 200
/// collateral at 0.10 is only worth 20, so all of it is seized and the
/// liquidator pays floor(20 / 1.05) = 19.047619. The other 80.952381 of debt is
/// no longer backed and is written off.
fn crash_and_liquidate(
    s: &AccountingSetup,
    borrower: &Address,
) -> (i128, i128, std::vec::Vec<BadDebtWrittenOffEvent>) {
    let liquidator = Address::generate(&s.env);
    borrow(s, borrower, 100_000_000, 200_000_000);
    set_collateral_price(s, PRECISION / 10);
    StellarAssetClient::new(&s.env, &s.asset).mint(&liquidator, &100_000_000);
    s.client
        .liquidate(&liquidator, &s.pool_id, borrower, &100_000_000_i128);
    let events = bad_debt_events(s);
    let paid = 100_000_000 - TokenClient::new(&s.env, &s.asset).balance(&liquidator);
    let seized = TokenClient::new(&s.env, &s.collateral).balance(&liquidator);
    (paid, seized, events)
}

#[test]
fn bad_debt_is_covered_by_reserves_first() {
    let s = setup_accounting();
    let first = Address::generate(&s.env);
    let second = Address::generate(&s.env);
    let borrower = Address::generate(&s.env);
    deposit(&s, &first, 600_000_000);
    deposit(&s, &second, 400_000_000);
    fund_reserves(&s, 100_000_000);

    let (paid, seized, events) = crash_and_liquidate(&s, &borrower);
    assert_eq!(seized, 200_000_000);
    assert_eq!(paid, 19_047_619);

    assert_eq!(
        events,
        std::vec![BadDebtWrittenOffEvent {
            pool_id: s.pool_id.clone(),
            borrower: borrower.clone(),
            amount: 80_952_381,
            covered_by_reserves: 80_952_381,
            socialized: 0,
        }]
    );
    assert!(s
        .client
        .try_get_borrow_position(&borrower, &s.pool_id)
        .is_err());
    assert_eq!(s.client.get_total_borrows(&s.pool_id), 0);
    assert_eq!(s.client.get_reserves(&s.pool_id), 19_047_619);
    assert_eq!(s.client.get_total_deposits(&s.pool_id), 1_000_000_000);
    assert_eq!(current_claim(&s, &first), 600_000_000);
    assert_eq!(current_claim(&s, &second), 400_000_000);

    s.client.withdraw(&first, &s.pool_id, &600_000_000);
    s.client.withdraw(&second, &s.pool_id, &400_000_000);
    assert_eq!(
        TokenClient::new(&s.env, &s.asset).balance(&s.contract),
        s.client.get_reserves(&s.pool_id),
        "only the reserves left after the write-off remain"
    );
}

#[test]
fn bad_debt_beyond_reserves_is_shared_by_depositors() {
    let s = setup_accounting();
    let first = Address::generate(&s.env);
    let second = Address::generate(&s.env);
    let borrower = Address::generate(&s.env);
    deposit(&s, &first, 600_000_000);
    deposit(&s, &second, 400_000_000);
    fund_reserves(&s, 30_000_000);

    let (paid, _, events) = crash_and_liquidate(&s, &borrower);
    assert_eq!(paid, 19_047_619);

    // 80.952381 of bad debt: 30 from reserves, 50.952381 from depositors
    assert_eq!(
        events,
        std::vec![BadDebtWrittenOffEvent {
            pool_id: s.pool_id.clone(),
            borrower: borrower.clone(),
            amount: 80_952_381,
            covered_by_reserves: 30_000_000,
            socialized: 50_952_381,
        }]
    );
    assert_eq!(s.client.get_total_borrows(&s.pool_id), 0);
    assert_eq!(s.client.get_reserves(&s.pool_id), 0);
    assert_eq!(s.client.get_total_deposits(&s.pool_id), 949_047_619);

    // Each claim shrinks by the same ratio, rounded down
    let first_claim = current_claim(&s, &first);
    let second_claim = current_claim(&s, &second);
    assert_eq!(first_claim, 569_428_571);
    assert_eq!(second_claim, 379_619_047);
    assert!(first_claim + second_claim <= s.client.get_total_deposits(&s.pool_id));

    // The books match the tokens held, and both depositors can exit in full
    let cash = TokenClient::new(&s.env, &s.asset).balance(&s.contract);
    assert_eq!(
        cash,
        s.client.get_total_deposits(&s.pool_id) + s.client.get_reserves(&s.pool_id)
            - s.client.get_total_borrows(&s.pool_id)
    );
    s.client.withdraw(&second, &s.pool_id, &second_claim);
    s.client.withdraw(&first, &s.pool_id, &first_claim);
    let final_cash = TokenClient::new(&s.env, &s.asset).balance(&s.contract);
    assert!(
        (0..=2).contains(&final_cash),
        "only rounding dust may remain, got {final_cash}"
    );
}

#[test]
fn dust_position_is_closed_without_changing_the_close_factor() {
    let s = setup_accounting();
    let depositor = Address::generate(&s.env);
    let borrower = Address::generate(&s.env);
    let liquidator = Address::generate(&s.env);
    deposit(&s, &depositor, 1_000_000_000);

    // 8 units of debt sit below the default 10 unit minimum position debt
    borrow(&s, &borrower, 8_000_000, 16_000_000);
    set_collateral_price(&s, 6 * PRECISION / 10);
    StellarAssetClient::new(&s.env, &s.asset).mint(&liquidator, &8_000_000);

    let closed = s
        .client
        .liquidate(&liquidator, &s.pool_id, &borrower, &8_000_000_i128);
    assert!(bad_debt_events(&s).is_empty());
    assert_eq!(closed.principal, 0);
    assert!(s
        .client
        .try_get_borrow_position(&borrower, &s.pool_id)
        .is_err());
    assert_eq!(s.client.get_total_borrows(&s.pool_id), 0);
    // (8 + 0.4 penalty) / 0.6 = 14 collateral seized, 2 returned to the borrower
    let collateral = TokenClient::new(&s.env, &s.collateral);
    assert_eq!(collateral.balance(&liquidator), 14_000_000);
    assert_eq!(collateral.balance(&borrower), 2_000_000);
}

#[test]
fn min_position_debt_is_admin_configurable() {
    let s = setup_accounting();
    let depositor = Address::generate(&s.env);
    let borrower = Address::generate(&s.env);
    let liquidator = Address::generate(&s.env);
    deposit(&s, &depositor, 1_000_000_000);
    assert_eq!(
        s.client.get_min_position_debt(&s.pool_id),
        DEFAULT_MIN_POSITION_DEBT
    );

    let outsider = Address::generate(&s.env);
    assert!(s
        .client
        .try_set_min_position_debt(&outsider, &s.pool_id, &0_i128)
        .is_err());
    s.client
        .set_min_position_debt(&s.admin, &s.pool_id, &0_i128);
    assert_eq!(s.client.get_min_position_debt(&s.pool_id), 0);

    // With no minimum the close factor applies again: only half is covered
    borrow(&s, &borrower, 8_000_000, 16_000_000);
    set_collateral_price(&s, 6 * PRECISION / 10);
    StellarAssetClient::new(&s.env, &s.asset).mint(&liquidator, &8_000_000);
    let partial = s
        .client
        .liquidate(&liquidator, &s.pool_id, &borrower, &8_000_000_i128);
    assert_eq!(partial.principal, 4_000_000);
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

// ─── Pool asset pricing and token decimals (issue #1417) ─────────────────────

fn set_price(s: &AccountingSetup, asset: &Address, price: i128) {
    s.env.as_contract(&s.oracle, || {
        AccountingOracle::set_price(
            s.env.clone(),
            asset.clone(),
            price,
            s.env.ledger().timestamp(),
        );
    });
}

#[test]
fn pool_asset_priced_above_one_limits_the_borrow_by_value() {
    let s = setup_accounting();
    let depositor = Address::generate(&s.env);
    let borrower = Address::generate(&s.env);
    deposit(&s, &depositor, 10_000_000_000);
    set_price(&s, &s.asset, 50 * PRECISION);
    set_price(&s, &s.collateral, PRECISION / 10);

    // 1000 collateral at 0.10 is worth 100. With the 1.5 minimum health factor
    // and an 80% liquidation threshold, debt may be worth at most 53.33, which
    // is 1.0666666 tokens of a pool asset priced at 50.
    let collateral = 10_000_000_000_i128;
    mint_collateral(&s, &borrower, collateral);

    let issue_example = s.client.try_borrow(
        &borrower,
        &s.pool_id,
        &530_000_000_i128,
        &s.collateral,
        &collateral,
    );
    assert!(
        issue_example.is_err(),
        "53 tokens worth 2650 must be rejected"
    );

    let one_above_limit = s.client.try_borrow(
        &borrower,
        &s.pool_id,
        &10_666_667_i128,
        &s.collateral,
        &collateral,
    );
    assert!(one_above_limit.is_err());

    let at_limit = s.client.borrow(
        &borrower,
        &s.pool_id,
        &10_666_666_i128,
        &s.collateral,
        &collateral,
    );
    assert_eq!(at_limit.principal, 10_666_666);
    let health = s.client.get_health_factor(&borrower, &s.pool_id);
    assert!(health >= 3 * PRECISION / 2);
}

#[test]
fn pool_asset_priced_below_one_allows_the_borrow_its_value_supports() {
    let s = setup_accounting();
    let depositor = Address::generate(&s.env);
    let borrower = Address::generate(&s.env);
    deposit(&s, &depositor, 10_000_000_000);
    set_price(&s, &s.asset, PRECISION / 2);

    // 200 collateral at 1.0 is worth 200. 150 tokens at 0.5 are worth 75, so
    // the health factor is 200 * 0.8 / 75 = 2.13. Treating the pool asset as
    // 1.0 would have rejected this borrow (200 * 0.8 / 150 = 1.07).
    let position = {
        mint_collateral(&s, &borrower, 2_000_000_000);
        s.client.borrow(
            &borrower,
            &s.pool_id,
            &1_500_000_000_i128,
            &s.collateral,
            &2_000_000_000_i128,
        )
    };
    assert_eq!(position.principal, 1_500_000_000);
    assert_eq!(
        s.client.get_health_factor(&borrower, &s.pool_id),
        2_133_333_333_333_333_333
    );
}

#[test]
fn liquidation_seizes_the_repaid_value_plus_penalty_in_collateral_units() {
    let s = setup_accounting();
    let depositor = Address::generate(&s.env);
    let borrower = Address::generate(&s.env);
    let liquidator = Address::generate(&s.env);
    deposit(&s, &depositor, 10_000_000_000);
    set_price(&s, &s.asset, 2 * PRECISION);

    // 50 tokens at 2.0 (value 100) against 250 collateral at 1.0 (value 250)
    borrow(&s, &borrower, 500_000_000, 2_500_000_000);

    // Collateral drops to 0.40: value 100, health factor 100 * 0.8 / 100 = 0.8
    set_price(&s, &s.collateral, 4 * PRECISION / 10);
    assert_eq!(
        s.client.get_health_factor(&borrower, &s.pool_id),
        8 * PRECISION / 10
    );

    // The 50% close factor allows 25 tokens: value 50, plus 5% penalty = 52.5,
    // which is 131.25 collateral at 0.40.
    StellarAssetClient::new(&s.env, &s.asset).mint(&liquidator, &250_000_000);
    let remaining = s
        .client
        .liquidate(&liquidator, &s.pool_id, &borrower, &250_000_000_i128);
    assert_eq!(remaining.principal, 250_000_000);
    assert_eq!(remaining.collateral_amount, 2_500_000_000 - 1_312_500_000);
    assert_eq!(
        TokenClient::new(&s.env, &s.collateral).balance(&liquidator),
        1_312_500_000
    );
}

#[test]
fn missing_or_stale_pool_asset_price_rejects_borrow_and_liquidate() {
    let s = setup_accounting();
    let depositor = Address::generate(&s.env);
    let borrower = Address::generate(&s.env);
    let liquidator = Address::generate(&s.env);
    deposit(&s, &depositor, 10_000_000_000);
    borrow(&s, &borrower, 100_000_000, 200_000_000);
    StellarAssetClient::new(&s.env, &s.asset).mint(&liquidator, &100_000_000);

    // Stale: only the collateral price is refreshed after an hour passes
    s.client.set_oracle_config(&s.admin, &3_600_u64, &0_i128);
    advance_time(&s, 3_601);
    set_price(&s, &s.collateral, PRECISION / 10);
    mint_collateral(&s, &borrower, 200_000_000);
    let stale_borrow = s.client.try_borrow(
        &borrower,
        &s.pool_id,
        &1_i128,
        &s.collateral,
        &200_000_000_i128,
    );
    assert!(matches!(stale_borrow, Err(Ok(ContractError::StalePrice))));
    let stale_liquidation =
        s.client
            .try_liquidate(&liquidator, &s.pool_id, &borrower, &50_000_000_i128);
    assert!(matches!(
        stale_liquidation,
        Err(Ok(ContractError::StalePrice))
    ));
    assert!(matches!(
        s.client.try_get_health_factor(&borrower, &s.pool_id),
        Err(Ok(ContractError::StalePrice))
    ));

    // Missing: a fresh oracle that only knows the collateral price
    let bare_oracle = s.env.register(AccountingOracle, ());
    s.client.set_oracle(&bare_oracle, &s.admin);
    s.env.as_contract(&bare_oracle, || {
        AccountingOracle::set_price(
            s.env.clone(),
            s.collateral.clone(),
            PRECISION / 10,
            s.env.ledger().timestamp(),
        );
    });
    let missing_borrow = s.client.try_borrow(
        &borrower,
        &s.pool_id,
        &1_i128,
        &s.collateral,
        &200_000_000_i128,
    );
    assert!(matches!(
        missing_borrow,
        Err(Ok(ContractError::PriceNotAvailable))
    ));
    let missing_liquidation =
        s.client
            .try_liquidate(&liquidator, &s.pool_id, &borrower, &50_000_000_i128);
    assert!(matches!(
        missing_liquidation,
        Err(Ok(ContractError::PriceNotAvailable))
    ));
}

#[test]
fn pools_created_before_stored_decimals_keep_working() {
    let s = setup_accounting();
    let depositor = Address::generate(&s.env);
    let borrower = Address::generate(&s.env);
    deposit(&s, &depositor, 1_000_000_000);

    // Simulate a pool created before the decimals were stored on it
    let key = LendingKey::PoolAssetDecimals(s.pool_id.clone());
    s.env.as_contract(&s.contract, || {
        s.env.storage().persistent().remove(&key);
    });

    borrow(&s, &borrower, 100_000_000, 200_000_000);
    assert_eq!(
        s.client
            .get_borrow_position(&borrower, &s.pool_id)
            .principal,
        100_000_000
    );
    let stored: Option<u32> = s
        .env
        .as_contract(&s.contract, || s.env.storage().persistent().get(&key));
    assert_eq!(stored, Some(7), "decimals are read and stored on first use");
}

/// Minimal token with configurable decimals, to express the same position
/// with tokens that do not use the Stellar default of 7.
#[contract]
struct DecimalsToken;

#[contractimpl]
impl DecimalsToken {
    pub fn __constructor(env: Env, decimals: u32) {
        env.storage()
            .instance()
            .set(&Symbol::new(&env, "decimals"), &decimals);
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&Symbol::new(&env, "decimals"))
            .unwrap()
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        env.storage().persistent().get(&id).unwrap_or(0)
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let balance = Self::balance(env.clone(), to.clone());
        env.storage()
            .persistent()
            .set(&to, &balance.checked_add(amount).unwrap());
    }

    pub fn transfer(env: Env, from: Address, to: soroban_sdk::MuxedAddress, amount: i128) {
        from.require_auth();
        let to = to.address();
        let from_balance = Self::balance(env.clone(), from.clone());
        env.storage()
            .persistent()
            .set(&from, &from_balance.checked_sub(amount).unwrap());
        Self::mint(env, to, amount);
    }
}

/// Health factor and seized collateral, in whole-token units scaled to 7
/// decimals, for the same economic position expressed with tokens of the
/// given decimals.
fn liquidation_outcome(pool_decimals: u32, collateral_decimals: u32) -> (i128, i128, i128) {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract = env.register(PropertyTokenContract, (&admin,));
    let client = PropertyTokenContractClient::new(&env, &contract);
    let oracle = env.register(AccountingOracle, ());
    let asset = env.register(DecimalsToken, (pool_decimals,));
    let collateral = env.register(DecimalsToken, (collateral_decimals,));
    let asset_token = DecimalsTokenClient::new(&env, &asset);
    let collateral_token = DecimalsTokenClient::new(&env, &collateral);
    let pool_id = String::from_str(&env, "DECIMALS-POOL");
    let pool_unit = 10_i128.pow(pool_decimals);
    let collateral_unit = 10_i128.pow(collateral_decimals);

    client.create_pool(
        &admin,
        &pool_id,
        &String::from_str(&env, "Decimals Pool"),
        &String::from_str(&env, "TKN"),
        &asset,
        &750_000_000_000_000_000_i128,
        &800_000_000_000_000_000_i128,
        &50_000_000_000_000_000_i128,
        &500_000_000_000_000_000_i128,
        &1000_u32,
    );
    client.set_oracle(&oracle, &admin);
    client.set_oracle_config(&admin, &u64::MAX, &0_i128);
    let set = |asset: &Address, price: i128| {
        env.as_contract(&oracle, || {
            AccountingOracle::set_price(
                env.clone(),
                asset.clone(),
                price,
                env.ledger().timestamp(),
            );
        });
    };
    set(&asset, 2 * PRECISION);
    set(&collateral, PRECISION);

    let depositor = Address::generate(&env);
    let borrower = Address::generate(&env);
    let liquidator = Address::generate(&env);
    asset_token.mint(&depositor, &(1_000 * pool_unit));
    client.deposit(&depositor, &pool_id, &(1_000 * pool_unit));

    // 50 tokens at 2.0 against 250 collateral at 1.0, then collateral at 0.40
    collateral_token.mint(&borrower, &(250 * collateral_unit));
    client.borrow(
        &borrower,
        &pool_id,
        &(50 * pool_unit),
        &collateral,
        &(250 * collateral_unit),
    );
    set(&collateral, 4 * PRECISION / 10);
    let health = client.get_health_factor(&borrower, &pool_id);

    asset_token.mint(&liquidator, &(25 * pool_unit));
    let remaining = client.liquidate(&liquidator, &pool_id, &borrower, &(25 * pool_unit));
    let to_seven = |amount: i128, decimals: u32| amount * 10_i128.pow(7 - decimals);
    (
        health,
        to_seven(collateral_token.balance(&liquidator), collateral_decimals),
        to_seven(remaining.principal, pool_decimals),
    )
}

#[test]
fn results_do_not_depend_on_token_decimals() {
    let expected = (8 * PRECISION / 10, 1_312_500_000, 250_000_000);
    assert_eq!(liquidation_outcome(7, 7), expected);
    assert_eq!(liquidation_outcome(6, 7), expected);
    assert_eq!(liquidation_outcome(7, 6), expected);
    assert_eq!(liquidation_outcome(6, 6), expected);
}
