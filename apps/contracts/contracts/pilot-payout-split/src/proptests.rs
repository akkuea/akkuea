#[cfg(test)]
mod tests {
    extern crate std;
    use crate::tests::{cycle, evidence_hash, fund_pool, setup_with_balance_values, TEST_MIN_RATE};
    use crate::Currency;
    use proptest::prelude::*;
    use soroban_sdk::String;

    // Deterministic test for the recorded rounding-dust policy:
    // - 10% platform fee is calculated via integer division (truncating towards zero).
    // - Pro-rata holder shares are calculated via integer division.
    // - Any remainder from the pro-rata split is recorded in `summary.dust`,
    //   accumulated in `accumulated_dust()`, and released once to `platform_fee_recipient`
    //   via `release_dust`.
    #[test]
    fn deterministic_rounding_dust_policy() {
        let s = setup_with_balance_values(&[1, 1, 1]);
        s.usdc.mint(&s.payout_id, &100_000);

        let cycle_id = cycle(&s.env, "2026-01");
        s.payout.record_evidence(
            &s.operator,
            &s.ally,
            &cycle_id,
            &evidence_hash(&s.env),
            &String::from_str(&s.env, "https://example.org/evidence/1"),
            &100,
        );
        let summary1 =
            s.payout
                .execute_distribution(&s.operator, &s.ally, &cycle_id, &TEST_MIN_RATE);
        assert_eq!(summary1.platform_fee, 10);
        assert_eq!(summary1.distributed_total, 90);
        assert_eq!(summary1.dust, 0);
        assert_eq!(s.payout.accumulated_dust(), 0);

        let cycle_id2 = cycle(&s.env, "2026-02");
        s.payout.record_evidence(
            &s.operator,
            &s.ally,
            &cycle_id2,
            &evidence_hash(&s.env),
            &String::from_str(&s.env, "https://example.org/evidence/2"),
            &101,
        );

        let summary2 =
            s.payout
                .execute_distribution(&s.operator, &s.ally, &cycle_id2, &TEST_MIN_RATE);

        assert_eq!(summary2.platform_fee, 10);
        assert_eq!(summary2.distributed_total, 90);
        assert_eq!(summary2.dust, 1);
        assert_eq!(
            summary2.platform_fee
                + summary2.distributed_total
                + summary2.undistributed_failed_swaps
                + summary2.dust,
            101
        );
        assert_eq!(s.payout.accumulated_dust(), 1);

        let fee_before = s.usdc.balance(&s.fee_recipient);
        let released = s.payout.release_dust(&s.admin);
        assert_eq!(released, 1);
        assert_eq!(s.payout.accumulated_dust(), 0);
        assert_eq!(s.usdc.balance(&s.fee_recipient), fee_before + 1);
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
                s.usdc.mint(&s.payout_id, &total_income);
                let cycle_id = cycle(&s.env, "2026-01");
                s.payout.record_evidence(
                    &s.operator,
                    &s.ally,
                    &cycle_id,
                    &evidence_hash(&s.env),
                    &String::from_str(&s.env, "https://example.org/fuzz"),
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
                    )))
                );
                return Ok(());
            }

            s.usdc.mint(&s.payout_id, &total_income);
            let cycle_id = cycle(&s.env, "2026-01");
            s.payout.record_evidence(
                &s.operator,
                &s.ally,
                &cycle_id,
                &evidence_hash(&s.env),
                &String::from_str(&s.env, "https://example.org/fuzz"),
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
                Ok(Err(_)) => return Ok(()),
                Err(_) => return Ok(()),
            };

            // 1. Conservation: fee + paid + withheld + dust == total_income.
            assert_eq!(
                summary.platform_fee
                    + summary.distributed_total
                    + summary.undistributed_failed_swaps
                    + summary.dust,
                summary.total_income
            );
            assert_eq!(s.payout.accumulated_dust(), summary.dust);

            // 2. Non-negativity of all components.
            assert!(summary.platform_fee >= 0);
            assert!(summary.distributed_total >= 0);
            assert!(summary.undistributed_failed_swaps >= 0);
            assert!(summary.dust >= 0);

            // 3. Exact 10% platform fee truncated towards zero.
            assert_eq!(summary.platform_fee, total_income * 10 / 100);

            // 4. Monotonicity in holder balance.
            let mut previous_payouts = std::vec::Vec::new();
            for (i, balance) in balances.iter().enumerate() {
                let holder = s.holders.get(i as u32).unwrap();
                let final_balance = s.usdc.balance(&holder);
                previous_payouts.push((*balance, final_balance));
            }

            for (bal1, pay1) in &previous_payouts {
                for (bal2, pay2) in &previous_payouts {
                    if bal1 > bal2 {
                        assert!(
                            pay1 >= pay2,
                            "Monotonicity violated: balance {} got payout {} while smaller balance {} got payout {}",
                            bal1,
                            pay1,
                            bal2,
                            pay2
                        );
                    }
                }
            }
        }
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(64))]

        #[test]
        fn fuzz_multi_cycle_dust_and_withheld_conservation(
            incomes in prop::collection::vec(1i128..10_000_000i128, 1..=4),
            balances in prop::collection::vec(1i128..10_000_000i128, 1..=6),
            fail_first_holder_eurc in any::<bool>(),
            release_after_index in 0usize..5usize,
        ) {
            let s = setup_with_balance_values(&balances);
            // Start with zero initial buffer so contract USDC balance tracks exact obligations.
            let pre_funded = s.usdc.balance(&s.payout_id);
            s.usdc.burn(&s.payout_id, &pre_funded);

            if fail_first_holder_eurc {
                // Empty router reserves force the EURC swap leg to fail cleanly and reserve
                // the first holder's share in `TotalWithheld`.
                fund_pool(&s, 0, 0);
                let first_holder = s.holders.get(0).unwrap();
                s.payout.set_currency_preference(&first_holder, &Currency::Eurc);
            }

            let mut cumulative_dust = 0i128;
            let mut released_dust = 0i128;
            let mut cumulative_withheld = 0i128;
            let mut cumulative_fees = 0i128;

            for (idx, income) in incomes.iter().enumerate() {
                s.usdc.mint(&s.payout_id, income);
                let label = std::format!("2026-{:02}", idx + 1);
                let cycle_id = cycle(&s.env, &label);
                s.payout.record_evidence(
                    &s.operator,
                    &s.ally,
                    &cycle_id,
                    &evidence_hash(&s.env),
                    &String::from_str(&s.env, "https://example.org/multi"),
                    income,
                );

                let summary = s.payout.execute_distribution(
                    &s.operator,
                    &s.ally,
                    &cycle_id,
                    &TEST_MIN_RATE,
                );

                // Per-cycle conservation invariant: fee + paid + withheld + dust == total_income.
                prop_assert_eq!(
                    summary.platform_fee
                        + summary.distributed_total
                        + summary.undistributed_failed_swaps
                        + summary.dust,
                    summary.total_income
                );

                cumulative_dust += summary.dust;
                cumulative_withheld += summary.undistributed_failed_swaps;
                cumulative_fees += summary.platform_fee;

                prop_assert_eq!(s.payout.accumulated_dust(), cumulative_dust - released_dust);
                prop_assert_eq!(s.payout.total_withheld_balance(), cumulative_withheld);

                if idx == release_after_index && s.payout.accumulated_dust() > 0 {
                    let withheld_before = s.payout.total_withheld_balance();
                    let released = s.payout.release_dust(&s.admin);
                    released_dust += released;
                    prop_assert_eq!(s.payout.accumulated_dust(), 0);
                    prop_assert_eq!(s.payout.total_withheld_balance(), withheld_before);
                }

                // Tracked dust always equals sum(cycle dust) - released, and contract balance
                // equals TotalWithheld + AccumulatedDust.
                prop_assert_eq!(s.payout.accumulated_dust(), cumulative_dust - released_dust);
                prop_assert_eq!(
                    s.usdc.balance(&s.payout_id),
                    s.payout.total_withheld_balance() + s.payout.accumulated_dust()
                );
                prop_assert_eq!(
                    s.usdc.balance(&s.fee_recipient),
                    cumulative_fees + released_dust
                );
            }
        }
    }
}
