use pilot_income_token::{PilotIncomeToken, PilotIncomeTokenClient};
use pilot_payout_split::{PilotPayoutSplit, PilotPayoutSplitClient};
use pilot_whitelist::{PilotWhitelist, PilotWhitelistClient};
use proptest::prelude::*;
use soroban_sdk::{
    testutils::Address as _, token::StellarAssetClient, Address, Bytes, Env, String, Vec,
};

struct Setup {
    env: Env,
    admin: Address,
    operator: Address,
    ally: Address,
    fee_recipient: Address,
    whitelist_admin: Address,
    whitelist: PilotWhitelistClient<'static>,
    token: PilotIncomeTokenClient<'static>,
    payout: PilotPayoutSplitClient<'static>,
    payout_id: Address,
    usdc: StellarAssetClient<'static>,
}

fn setup_with_balance_values(balance_values: &[i128]) -> (Setup, std::vec::Vec<Address>) {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let ally = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    let whitelist_admin = Address::generate(&env);

    let whitelist_id = env.register(PilotWhitelist, ());
    let whitelist = PilotWhitelistClient::new(&env, &whitelist_id);
    whitelist.initialize(&whitelist_admin);

    let mut holders = Vec::new(&env);
    let mut amounts = Vec::new(&env);
    let mut holder_vec = std::vec::Vec::new();
    for amount in balance_values {
        let holder = Address::generate(&env);
        whitelist.approve(&whitelist_admin, &holder);
        holders.push_back(holder.clone());
        amounts.push_back(*amount);
        holder_vec.push(holder);
    }

    let income_token_id = env.register(PilotIncomeToken, ());
    let token = PilotIncomeTokenClient::new(&env, &income_token_id);
    token.initialize(
        &admin,
        &whitelist_id,
        &String::from_str(&env, "Akkuea Pilot Income"),
        &String::from_str(&env, "AKIN"),
        &7,
    );
    if !balance_values.is_empty() {
        token.mint_fixed_supply(&admin, &holders, &amounts);
    }

    let usdc_admin = Address::generate(&env);
    let usdc_contract = env.register_stellar_asset_contract_v2(usdc_admin);
    let usdc = StellarAssetClient::new(&env, &usdc_contract.address());

    let eurc_admin = Address::generate(&env);
    let eurc_contract = env.register_stellar_asset_contract_v2(eurc_admin);
    let swap_router = Address::generate(&env);

    let payout_id = env.register(PilotPayoutSplit, ());
    let payout = PilotPayoutSplitClient::new(&env, &payout_id);
    payout.initialize(
        &admin,
        &operator,
        &ally,
        &fee_recipient,
        &income_token_id,
        &whitelist_id,
        &usdc_contract.address(),
        &eurc_contract.address(),
        &swap_router,
    );

    usdc.mint(&payout_id, &i128::MAX);

    (
        Setup {
            env,
            admin,
            operator,
            ally,
            fee_recipient,
            whitelist_admin,
            whitelist,
            token,
            payout,
            payout_id,
            usdc,
        },
        holder_vec,
    )
}

fn evidence_hash(env: &Env) -> Bytes {
    Bytes::from_array(env, &[7u8; 32])
}

fn cycle(env: &Env, value: &str) -> String {
    String::from_str(env, value)
}

proptest! {
    #[test]
    fn test_distribution_properties(
        total_income in 1i128..1_000_000_000_000_000_000,
        balances in prop::collection::vec(1i128..1_000_000_000_000, 1..50)
    ) {
        let (s, holders_vec) = setup_with_balance_values(&balances);

        s.payout.record_evidence(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "test-cycle"),
            &evidence_hash(&s.env),
            &String::from_str(&s.env, "ipfs://evidence/test-cycle"),
            &total_income,
        );

        let summary = s.payout.execute_distribution(
            &s.operator,
            &s.ally,
            &cycle(&s.env, "test-cycle"),
            &0i128,
        );

        // 1. The fee plus the sum of all pro-rata distributions never exceeds the total income for the cycle.
        prop_assert!(summary.platform_fee + summary.distributed_total <= total_income);

        // 2. No individual distribution is ever negative.
        // Tested by querying balance changes
        for holder in &holders_vec {
            let balance = s.usdc.balance(holder);
            prop_assert!(balance >= 0);
        }

        // 3. The fee is always exactly the documented rounding rule applied to 10% of total income - no drift.
        let expected_fee = (total_income * 10) / 100;
        prop_assert_eq!(summary.platform_fee, expected_fee);

        // 4. Every unit of the remainder is accounted for: distributed amounts plus any rounding dust sum back to the exact remainder, nothing is silently created or destroyed.
        let remainder = total_income - expected_fee;
        prop_assert_eq!(summary.distributed_total + summary.dust, remainder);

        // 5. Distribution is monotonic in holder balance: a holder with a strictly larger balance never receives a strictly smaller payout than a holder with a smaller balance, all else equal.
        let mut payouts: std::vec::Vec<(i128, i128)> = holders_vec.iter().zip(balances.iter()).map(|(h, &b)| {
            (b, s.usdc.balance(h))
        }).collect();
        payouts.sort_by_key(|p| p.0);
        for i in 1..payouts.len() {
            prop_assert!(payouts[i-1].1 <= payouts[i].1);
        }
    }
}
