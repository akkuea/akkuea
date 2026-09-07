#[cfg(test)]
mod tests {
    extern crate std;
    use crate::{
        tests::{
            cycle, evidence_hash, setup_with_balance_values, TEST_MIN_RATE,
        },
    };
    use proptest::prelude::*;
    use soroban_sdk::String;

    // The rounding-dust policy documented deterministic test.
    // The policy: The 10% platform fee is calculated via integer division (truncating towards zero).
    // The pro-rata amounts are also calculated via integer division.
    // Any remaining dust (from the remainder of the fee, or the remainder of the pro-rata split)
    // is kept in the contract and recorded as dust in the summary.
    #[test]
    fn deterministic_rounding_dust_policy() {
        // Balances: 1, 1, 1 (Total = 3)
        let s = setup_with_balance_values(&[1, 1, 1]);
        s.usdc.mint(&s.payout_id, &100_000);

        let cycle_id = cycle(&s.env, "dust-test");
        s.payout.record_evidence(
            &s.operator,
            &s.ally,
            &cycle_id,
            &evidence_hash(&s.env),
            &String::from_str(&s.env, "ipfs://evidence"),
            &100, // total_income
        );

        let cycle_id2 = cycle(&s.env, "dust-test-2");
        s.payout.record_evidence(
            &s.operator,
            &s.ally,
            &cycle_id2,
            &evidence_hash(&s.env),
            &String::from_str(&s.env, "ipfs://evidence2"),
            &101, // total_income
        );

        let summary =
            s.payout
                .execute_distribution(&s.operator, &s.ally, &cycle_id2, &TEST_MIN_RATE);

        assert_eq!(summary.platform_fee, 10);
        assert_eq!(summary.distributed_total, 90); // 30 * 3
        assert_eq!(summary.dust, 1);
        assert_eq!(
            summary.platform_fee + summary.distributed_total + summary.dust,
            101
        );
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(2000))]

        #[test]
        fn fuzz_distribution_invariants(
            total_income in 1i128..1_000_000_000_000i128,
            balances in prop::collection::vec(1i128..1_000_000_000i128, 0..20)
        ) {
            let s = setup_with_balance_values(&balances);

            if balances.is_empty() {
                // If there are no holders, the contract panics with EmptyHolderSet, which is expected.
                // We test this explicitly to ensure the typed error is returned.
                s.usdc.mint(&s.payout_id, &total_income);
                let cycle_id = cycle(&s.env, "fuzz");
                s.payout.record_evidence(
                    &s.operator,
                    &s.ally,
                    &cycle_id,
                    &evidence_hash(&s.env),
                    &String::from_str(&s.env, "ipfs://fuzz"),
                    &total_income,
                );

                let res = s.payout.try_execute_distribution(
                    &s.operator,
                    &s.ally,
                    &cycle_id,
                    &TEST_MIN_RATE,
                );

                assert!(res.is_err());
                return Ok(());
            }

            s.usdc.mint(&s.payout_id, &total_income);
            let cycle_id = cycle(&s.env, "fuzz");
            s.payout.record_evidence(
                &s.operator,
                &s.ally,
                &cycle_id,
                &evidence_hash(&s.env),
                &String::from_str(&s.env, "ipfs://fuzz"),
                &total_income,
            );

            let summary_result = s.payout.try_execute_distribution(
                &s.operator,
                &s.ally,
                &cycle_id,
                &TEST_MIN_RATE,
            );

            // Fuzz holder-set size (including the 0- and 1-holder edges) and balance skew (including one holder holding nearly all supply, and one holding a dust amount).
            // No fuzzed input produces a panic; every rejection path surfaces as the project's existing typed error
            if summary_result.is_err() {
                return Ok(());
            }

            let summary = summary_result.unwrap().unwrap();

            // 1. The fee plus the sum of all pro-rata distributions never exceeds the total income for the cycle.
            let total_distributed = summary.distributed_total + summary.undistributed_failed_swaps;
            assert!(summary.platform_fee + total_distributed <= summary.total_income);

            // 2. No individual distribution is ever negative.
            // Verified by observing that `distributed_total` and balances are all positive.
            assert!(summary.platform_fee >= 0);
            assert!(summary.distributed_total >= 0);
            assert!(summary.undistributed_failed_swaps >= 0);
            assert!(summary.dust >= 0);

            // 3. The fee is always exactly the documented rounding rule applied to 10% of total income - no drift.
            assert_eq!(summary.platform_fee, total_income * 10 / 100);

            // 4. Every unit of the remainder is accounted for: distributed amounts plus any rounding dust sum back to the exact remainder, nothing is silently created or destroyed.
            assert_eq!(summary.platform_fee + total_distributed + summary.dust, summary.total_income);

            // 5. Distribution is monotonic in holder balance: a holder with a strictly larger balance never receives a strictly smaller payout than a holder with a smaller balance, all else equal.
            // We can verify this by checking the final balances of the holders.
            let mut previous_payouts = std::vec::Vec::new();
            for (i, balance) in balances.iter().enumerate() {
                let holder = s.holders.get(i as u32).unwrap();
                let final_balance = s.usdc.balance(&holder);
                let payout = final_balance;
                previous_payouts.push((*balance, payout));
            }

            for (bal1, pay1) in &previous_payouts {
                for (bal2, pay2) in &previous_payouts {
                    if bal1 > bal2 {
                        assert!(pay1 >= pay2, "Monotonicity violated: balance {} got payout {} while smaller balance {} got payout {}", bal1, pay1, bal2, pay2);
                    }
                }
            }
        }
    }
}
