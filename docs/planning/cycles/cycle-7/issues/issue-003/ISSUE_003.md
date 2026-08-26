# Property-Based and Fuzz Testing for the Payout-Split Fee and Pro-Rata Distribution Math

## Context

`pilot-payout-split`'s fee-and-distribution math is the code that decides exactly how much of a real investor's money they receive every month: a flat 10% platform fee, then the remainder split pro-rata across the holder set. Today it is verified only against a small number of hand-picked cases - a 5-holder set with uneven balances, and a 10-holder budget-check case (`budget_check_execute_distribution_for_ten_holders`). There is no property-based or fuzz testing anywhere in the three pilot contracts (`pilot-income-token`, `pilot-whitelist`, `pilot-payout-split` all list only `soroban-sdk` as a dependency, no `proptest` or equivalent). The issue that originally built this contract (C6-001) called it, in its own words, "the highest-stakes code in the repository."

## What Needs to Be Done

- Add property-based testing (`proptest` or the equivalent already favored elsewhere in this Rust workspace, if any) as a dev-dependency of `pilot-payout-split`.
- Write property tests asserting invariants that must hold for any valid input, not just the existing fixed cases:
  - The fee plus the sum of all pro-rata distributions never exceeds the total income for the cycle.
  - No individual distribution is ever negative.
  - The fee is always exactly the documented rounding rule applied to 10% of total income - no drift.
  - Every unit of the remainder is accounted for: distributed amounts plus any rounding dust sum back to the exact remainder, nothing is silently created or destroyed.
  - Distribution is monotonic in holder balance: a holder with a strictly larger balance never receives a strictly smaller payout than a holder with a smaller balance, all else equal.
- Fuzz holder-set size (including the 0- and 1-holder edges) and balance skew (including one holder holding nearly all supply, and one holding a dust amount), informed by the ceiling already established in the existing budget-check test.
- Explicitly determine and document the current rounding-dust policy (where does integer-division remainder go today?) with a dedicated deterministic test, not left to be inferred from fuzz output alone.
- Fix any invariant violation the fuzzing surfaces as part of this issue - the point is closing the gap, not just measuring it.

## Acceptance Criteria

- A property-test suite runs as part of `cargo test` and CI, executing a documented minimum number of generated cases per property (state the number in the PR description).
- All invariants listed above pass across the tested holder-count and balance-skew range; any violation found during development of this issue is fixed, not deferred.
- The rounding-dust policy is documented in a doc comment on `execute_distribution` and covered by its own deterministic (non-fuzzed) test.
- No fuzzed input produces a panic; every rejection path surfaces as the project's existing typed error, verified by at least one fuzz-derived regression test added as a fixed case.
- `cargo fmt --all -- --check` and `cargo clippy -- -D warnings` pass with zero warnings.
- All five required CI workflows pass on the pull request.

## Quality Standard

This is a verification issue for the contract this project itself has already flagged as the highest-stakes code in the repository. A property test that never fails because it only exercises the same small cases the existing unit tests already cover is not a real addition; the fuzzed input ranges must genuinely explore beyond what a human would think to hand-write. If the fuzzing surfaces a real bug, fixing it is part of this issue's acceptance criteria, not a follow-up.
