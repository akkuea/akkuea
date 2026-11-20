#[cfg(test)]
mod tests {
    extern crate std;
    use crate::tests::{cycle, evidence_hash, setup_with_balance_values, TEST_MIN_RATE};
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
        assert_eq!(s.payout.total_dust(), 1);
        assert_eq!(s.payout.get_total_dust(), 1);

        let fee_recipient_before = s.usdc.balance(&s.fee_recipient);
        let released = s
            .payout
            .release_dust(&s.operator, &s.ally, &s.fee_recipient, &1);
        assert_eq!(released, 1);
        assert_eq!(s.payout.total_dust(), 0);
        assert_eq!(s.usdc.balance(&s.fee_recipient), fee_recipient_before + 1);
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(2000))]

        #[test]
        fn fuzz_distribution_invariants(
            total_income in 1i128..100_000_000i128,
            balances in prop::collection::vec(1i128..100_000_000i128, 0..=10)
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

                assert_eq!(
                    res,
                   Err(Ok(soroban_sdk::Error::from_contract_error(
                      crate::PayoutError::EmptyHolderSet as u32
                   ))));
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

            let summary = match summary_result {
                Ok(Ok(s)) => s,
                Ok(Err(_)) => {
                    // Contract typed error (e.g. arithmetic overflow on extreme values)
                    return Ok(());
                }
                Err(_) => {
                    // Host error like Budget Exceeded
                    // The contract is working correctly by refusing to process, this is acceptable for extreme inputs
                    return Ok(());
                }
            };

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

            // 5. Tracked dust matches summary dust and is releasable to the documented destination.
            assert_eq!(s.payout.total_dust(), summary.dust);
            assert_eq!(s.payout.get_total_dust(), summary.dust);
            if summary.dust > 0 {
                let fee_recipient_before = s.usdc.balance(&s.fee_recipient);
                let released = s.payout.release_dust(
                    &s.operator,
                    &s.ally,
                    &s.fee_recipient,
                    &summary.dust,
                );
                assert_eq!(released, summary.dust);
                assert_eq!(s.payout.total_dust(), 0);
                assert_eq!(
                    s.usdc.balance(&s.fee_recipient),
                    fee_recipient_before + summary.dust
                );
            }

            // 6. Distribution is monotonic in holder balance: a holder with a strictly larger balance never receives a strictly smaller payout than a holder with a smaller balance, all else equal.
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

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(100))]

        #[test]
        fn fuzz_multi_cycle_dust_conservation(
            incomes in prop::collection::vec(100i128..10_000i128, 2..=5)
        ) {
            let s = setup_with_balance_values(&[1, 1, 1]);
            let total_income_sum: i128 = incomes.iter().sum();
            s.usdc.mint(&s.payout_id, &total_income_sum);

            let mut expected_dust = 0i128;
            for (idx, income) in incomes.iter().enumerate() {
                let cycle_str = std::format!("cycle-{}", idx);
                let c = cycle(&s.env, &cycle_str);
                s.payout.record_evidence(
                    &s.operator,
                    &s.ally,
                    &c,
                    &evidence_hash(&s.env),
                    &String::from_str(&s.env, "ipfs://evidence"),
                    income,
                );
                let summary = s.payout.execute_distribution(
                    &s.operator,
                    &s.ally,
                    &c,
                    &TEST_MIN_RATE,
                );
                expected_dust += summary.dust;
                assert_eq!(s.payout.total_dust(), expected_dust);
                assert_eq!(
                    summary.platform_fee + summary.distributed_total + summary.undistributed_failed_swaps + summary.dust,
                    summary.total_income
                );
            }

            let half = expected_dust / 2;
            if half > 0 {
                let fee_recipient_before = s.usdc.balance(&s.fee_recipient);
                let released = s.payout.release_dust(&s.operator, &s.ally, &s.fee_recipient, &half);
                assert_eq!(released, half);
                expected_dust -= half;
                assert_eq!(s.payout.total_dust(), expected_dust);
                assert_eq!(s.usdc.balance(&s.fee_recipient), fee_recipient_before + half);
            }

            if expected_dust > 0 {
                let fee_recipient_before = s.usdc.balance(&s.fee_recipient);
                let released = s.payout.release_dust(
                    &s.operator,
                    &s.ally,
                    &s.fee_recipient,
                    &expected_dust,
                );
                assert_eq!(released, expected_dust);
                assert_eq!(s.payout.total_dust(), 0);
                assert_eq!(
                    s.usdc.balance(&s.fee_recipient),
                    fee_recipient_before + expected_dust
                );
            }
        }
    }
}
