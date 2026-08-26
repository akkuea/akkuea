# C7-003: Property-Based and Fuzz Testing for the Payout-Split Fee and Pro-Rata Distribution Math

## Issue Metadata

| Attribute       | Value                                                     |
| --------------- | --------------------------------------------------------- |
| Issue ID        | C7-003                                                    |
| Area            | CONTRACT                                                  |
| Difficulty      | High                                                      |
| Labels          | smart-contract, contracts, soroban, test, high            |
| Dependencies    | C6-001                                                    |
| Estimated Lines | 300-500 (proptest harness, invariants, fixed regressions) |

**Description**

Introduce property-based/fuzz testing for `pilot-payout-split`'s fee calculation and pro-rata distribution logic, going beyond the fixed-case unit tests already in `#[cfg(test)] mod tests` (setup via `setup()` / `setup_with_balance_values()`, around lines 380-430 and the `budget_check_execute_distribution_for_ten_holders` test near line 754).

**Requirements and context**

- Check first whether `apps/contracts` already has a `proptest` (or `arbitrary`/`quickcheck`) dependency anywhere in the workspace (e.g. in `defi-rwa`) before introducing a new one, to keep the toolchain consistent across contracts.
- `setup_with_balance_values(&[i128])` already exists and is exactly the seam a property test needs: generate arbitrary `Vec<i128>` balance sets (bounded to a realistic holder-count range and to `i128` values that don't themselves overflow the fee/percentage math) and run them through the same setup helper.
- The five invariants named in the professional issue file map directly to assertions against the existing `execute_distribution` return values / resulting token balances, the same shape already used in `happy_path_distributes_fee_and_uneven_holder_amounts_exactly`.
- Rounding-dust policy: read the current implementation's integer-division behavior for the 10%/90% split precisely (does the fee round down and the remainder absorb the difference, or the reverse?) before writing the deterministic test - document what the code actually does today, not what would be ideal, unless a genuine bug is found.

**Suggested execution**

1. `git checkout -b feature/pilot-payout-split-property-tests`
2. Confirm or add `proptest` as a `[dev-dependencies]` entry in `pilot-payout-split/Cargo.toml`.
3. Write a `proptest!` block generating holder counts and balance vectors, feeding them through `setup_with_balance_values`, and asserting the five invariants.
4. Add the deterministic rounding-dust test and its doc comment on `execute_distribution`.
5. Run the suite locally with an elevated case count first (e.g. `PROPTEST_CASES=10000`) to surface any latent issue before committing the CI-default case count.
6. If a failure is found, use `proptest`'s shrinking output to derive a minimal fixed regression test, add it permanently to `mod tests`, and fix the underlying bug.
7. Document the chosen case count and the tested holder-count/balance-skew ranges in the PR description.

**Test and commit**

- [ ] All unit and property tests pass (`cargo test`)
- [ ] Property suite runs with a stated minimum case count in CI
- [ ] Any bug found during fuzzing is fixed and has a permanent fixed-case regression test
- [ ] `cargo clippy -- -D warnings` clean
- [ ] Rounding-dust policy documented in a doc comment and covered by a dedicated test

Example commit:
`git commit -m "test(contracts): add property-based fuzz testing for payout-split distribution math"`

**Guidelines**

- Do not weaken any existing fixed-case test to make room for the new property tests; both must coexist.
- Keep generated input ranges realistic (bounded holder counts, no synthetic `i128::MAX` values that would never occur given this pilot's actual scale) so failures found are genuine, not artifacts of testing an unrealistic domain - but do push meaningfully past the 5/10-holder cases already hand-written.
