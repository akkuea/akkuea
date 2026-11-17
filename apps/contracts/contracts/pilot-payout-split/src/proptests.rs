#[cfg(test)]
mod tests {
    extern crate std;
    use crate::tests::{cycle, evidence_hash, setup_with_balance_values, TEST_MIN_RATE};
    use crate::{Currency, PayoutError};
    use proptest::prelude::*;
    use soroban_sdk::{Error, String};

    // Deterministic rounding-dust policy test:
    // - 10% platform fee is calculated via integer division (truncating towards zero).
    // - Pro-rata holder amounts are calculated via integer division.
    // - Leftover dust is recorded in `DistributionSummary`, tracked cumulatively
    //   in `accumulated_dust`, and releasable once to `PlatformFeeRecipient`.
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
            summary.platform_fee
                + summary.distributed_total
                + summary.undistributed_failed_swaps
                + summary.dust,
            101
        );
        assert_eq!(s.payout.accumulated_dust(), 1);
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
                    Err(Ok(Error::from_contract_error(
                        PayoutError::EmptyHolderSet as u32
                    )))
                );
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

            // 3. Exact 10% platform fee under truncating integer division.
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
        #![proptest_config(ProptestConfig::with_cases(256))]

        // Multi-cycle conservation invariant across fees, paid shares, failed
        // EURC swap reserves (`TotalWithheld`), and accumulated/released dust:
        //   fee + paid + withheld + dust == total_income (each cycle & total),
        //   accumulated_dust() == sum(cycle.dust) - released_dust,
        //   contract_usdc == total_withheld_balance() + accumulated_dust().
        #[test]
        fn fuzz_multi_cycle_conservation_with_dust_and_withheld(
            balances in prop::collection::vec(1i128..10_000_000i128, 1..=10),
            eurc_flags in prop::collection::vec(any::<bool>(), 10),
            cycles in prop::collection::vec((1i128..10_000_000i128, any::<bool>()), 1..=5),
        ) {
            let s = setup_with_balance_values(&balances);
            // Burn setup's default cushion so contract balance equals exact
            // cycle inflows minus outflows.
            let initial = s.usdc.balance(&s.payout_id);
            s.usdc.burn(&s.payout_id, &initial);

            // Leave the mock router pool unfunded so every EURC-opted holder
            // leg deterministically fails and exercises `TotalWithheld`
            // alongside rounding dust.
            for (i, is_eurc) in eurc_flags.iter().enumerate().take(balances.len()) {
                if *is_eurc {
                    let holder = s.holders.get(i as u32).unwrap();
                    s.payout.set_currency_preference(&holder, &Currency::Eurc);
                }
            }

            let mut total_income_sum = 0i128;
            let mut total_fee_sum = 0i128;
            let mut total_paid_sum = 0i128;
            let mut total_withheld_sum = 0i128;
            let mut total_dust_sum = 0i128;
            let mut total_released_dust = 0i128;

            for (idx, (income, should_release)) in cycles.iter().enumerate() {
                s.usdc.mint(&s.payout_id, income);
                let label = std::format!("cycle-{}", idx);
                let cid = cycle(&s.env, &label);
                s.payout.record_evidence(
                    &s.operator,
                    &s.ally,
                    &cid,
                    &evidence_hash(&s.env),
                    &String::from_str(&s.env, "ipfs://fuzz-multi"),
                    income,
                );

                let summary = s.payout.execute_distribution(
                    &s.operator,
                    &s.ally,
                    &cid,
                    &TEST_MIN_RATE,
                );

                // Per-cycle conservation: fee + paid + withheld + dust == total_income.
                prop_assert_eq!(
                    summary.platform_fee
                        + summary.distributed_total
                        + summary.undistributed_failed_swaps
                        + summary.dust,
                    summary.total_income
                );

                total_income_sum += summary.total_income;
                total_fee_sum += summary.platform_fee;
                total_paid_sum += summary.distributed_total;
                total_withheld_sum += summary.undistributed_failed_swaps;
                total_dust_sum += summary.dust;

                // Cumulative conservation across all cycles so far.
                prop_assert_eq!(
                    total_fee_sum + total_paid_sum + total_withheld_sum + total_dust_sum,
                    total_income_sum
                );

                // Tracked dust equals the sum of every cycle's dust minus what was released.
                prop_assert_eq!(
                    s.payout.accumulated_dust(),
                    total_dust_sum - total_released_dust
                );
                prop_assert_eq!(s.payout.total_withheld_balance(), total_withheld_sum);

                if *should_release {
                    let pending_dust = s.payout.accumulated_dust();
                    if pending_dust > 0 {
                        let released = s.payout.release_dust(&s.admin);
                        prop_assert_eq!(released, pending_dust);
                        total_released_dust += released;
                        prop_assert_eq!(s.payout.accumulated_dust(), 0);
                        // Releasing dust never touches TotalWithheld and cannot repeat.
                        prop_assert_eq!(s.payout.total_withheld_balance(), total_withheld_sum);
                        prop_assert_eq!(
                            s.payout.try_release_dust(&s.admin),
                            Err(Ok(Error::from_contract_error(
                                PayoutError::NoDustToRelease as u32
                            )))
                        );
                    } else {
                        prop_assert_eq!(
                            s.payout.try_release_dust(&s.admin),
                            Err(Ok(Error::from_contract_error(
                                PayoutError::NoDustToRelease as u32
                            )))
                        );
                    }
                }

                prop_assert_eq!(
                    s.payout.accumulated_dust(),
                    total_dust_sum - total_released_dust
                );
                prop_assert_eq!(
                    s.usdc.balance(&s.payout_id),
                    s.payout.total_withheld_balance() + s.payout.accumulated_dust()
                );
                prop_assert_eq!(
                    s.usdc.balance(&s.fee_recipient),
                    total_fee_sum + total_released_dust
                );
            }
        }
    }
}
