# Pilot-payout-split: rounding dust accumulates in the contract with no release path

| Field           | Value          |
| --------------- | -------------- |
| ID              | C9-005         |
| Area            | CONTRACTS      |
| Difficulty      | High           |
| Dependencies    | C6-001, C8-002 |
| Estimated Lines | 200-400        |

## Context

`execute_distribution` computes each holder's share with integer division. What is left over is reported as `dust` in `DistributionSummary` and, per the doc comment on that function, "kept in the contract". No function ever moves it. It is not tracked as a running total either, so the only way to know how much USDC in the contract is dust is to add up every cycle's summary.

The contract already separates reserved funds (`TotalWithheld`) from spendable balance. Dust is the remaining USDC that belongs to nobody on-chain and can never leave.

## What Needs to Be Done

- Decide the dust policy and record it in `docs/strategy/decision-log.md`. Two acceptable options: carry the dust into the next cycle's holder amount, or track it in a running total with an explicit, authorized release to a documented destination.
- Implement the chosen option with checked arithmetic.
- Expose the accumulated, unreleased dust as a read.
- Keep the guarantee that a cycle can never spend funds reserved in `TotalWithheld`.
- Extend `proptests.rs` so the conservation invariant includes dust: fee + paid + withheld + dust equals total income, and the tracked dust equals the sum of every cycle's dust minus what was released.

## Scope

In scope: `pilot-payout-split` accounting, a read, tests and proptests, the decision-log entry, the regenerated client if the interface changes.

Out of scope: recovering overfunded USDC or balances left after `exit` (that is the open exit question, Known Risk #5), the fee percentage.

## Acceptance Criteria

- [ ] After several cycles with non-zero dust, the new read returns the exact expected total.
- [ ] Under the chosen policy the dust leaves the contract or is paid to holders, asserted on exact balances.
- [ ] Dust can never be released twice, and releasing it never touches `TotalWithheld`.
- [ ] The property-based test covers the extended conservation invariant.
- [ ] `cargo fmt --all -- --check` and `cargo clippy -- -D warnings` pass.

## How to Verify

```bash
cd apps/contracts
cargo test --lib -p pilot-payout-split
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
```

## Files and Locations

| File                                                            | What is there today                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/contracts/contracts/pilot-payout-split/src/lib.rs:607`    | Doc comment stating the dust policy                                |
| `apps/contracts/contracts/pilot-payout-split/src/lib.rs:760`    | `let dust = holder_amount - computed_total`                        |
| `apps/contracts/contracts/pilot-payout-split/src/storage.rs:34` | `TotalWithheld`, the model for a running total in instance storage |
| `apps/contracts/contracts/pilot-payout-split/src/lib.rs:1096`   | `claim_withheld`, the model for a guarded release                  |
| `apps/contracts/contracts/pilot-payout-split/src/proptests.rs`  | Conservation properties to extend                                  |

## Implementation Steps

1. Write the decision-log entry: carry forward, or track and release, and to whom.
2. Add a `TotalDust` instance key with checked add and a read entry point.
3. Carry forward: add the tracked dust to `holder_amount` before the pro-rata split and reset it. Release: add an authorized entry point guarded by `ExecutionGuard`.
4. Make the balance check in `execute_distribution` account for the dust total the same way it accounts for `reserved_before`.
5. Extend the proptests.

## Code Example

```rust
let dust_before = Storage::total_dust(&env);
let dust_after = dust_before
    .checked_add(dust)
    .unwrap_or_else(|| panic_with_error!(&env, PayoutError::ArithmeticOverflow));
Storage::set_total_dust(&env, dust_after);
```

## Testing Guidance

- Pick holder balances that do not divide evenly, for example three holders with 1, 1 and 1 of a supply of 3 and a holder amount of 100.
- Assert exact USDC balances of the contract, each holder and the destination after release.
