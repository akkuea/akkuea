extern crate std;

use crate::{PilotIncomeToken, PilotIncomeTokenClient};
use pilot_whitelist::{PilotWhitelist, PilotWhitelistClient};
use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String, Vec};

const POOL_SIZE: usize = 4;

fn sum_over_holders(token: &PilotIncomeTokenClient) -> i128 {
    let mut sum = 0i128;
    for holder in token.holders().iter() {
        sum += token.balance(&holder);
    }
    sum
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(256))]

    // The payout split pays `holder_amount * balance / total_supply`, so any
    // sequence of mint and correction transfers must keep the balances
    // summing exactly to the supply. Transfers are drawn freely, including
    // overdraws, self-transfers and non-positive amounts, and only the ones
    // the contract accepts change state.
    #[test]
    fn balances_always_sum_to_total_supply(
        mint_amounts in prop::collection::vec(1i128..1_000_000i128, 1..=POOL_SIZE),
        transfers in prop::collection::vec(
            (0..POOL_SIZE, 0..POOL_SIZE, -10i128..2_000_000i128),
            0..20,
        ),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let whitelist_admin = Address::generate(&env);

        let whitelist_id = env.register(PilotWhitelist, ());
        let whitelist = PilotWhitelistClient::new(&env, &whitelist_id);
        whitelist.initialize(&whitelist_admin);

        let token_id = env.register(PilotIncomeToken, ());
        let token = PilotIncomeTokenClient::new(&env, &token_id);
        token.initialize(
            &admin,
            &whitelist_id,
            &String::from_str(&env, "Akkuea Pilot Income"),
            &String::from_str(&env, "AKIN"),
            &7,
        );

        let mut pool: std::vec::Vec<Address> = std::vec::Vec::new();
        for _ in 0..POOL_SIZE {
            let holder = Address::generate(&env);
            whitelist.approve(&whitelist_admin, &holder);
            pool.push(holder);
        }

        let mut holders = Vec::new(&env);
        let mut amounts = Vec::new(&env);
        for (i, amount) in mint_amounts.iter().enumerate() {
            holders.push_back(pool[i].clone());
            amounts.push_back(*amount);
        }
        token.mint_fixed_supply(&admin, &holders, &amounts);

        let total_supply = token.total_supply();
        prop_assert_eq!(total_supply, mint_amounts.iter().sum::<i128>());
        prop_assert_eq!(sum_over_holders(&token), total_supply);

        for (from, to, amount) in transfers {
            let _ = token.try_transfer(&admin, &pool[from], &pool[to], &amount);

            prop_assert_eq!(token.total_supply(), total_supply);
            prop_assert_eq!(sum_over_holders(&token), total_supply);
            for holder in &pool {
                prop_assert!(token.balance(holder) >= 0);
            }
        }
    }
}
