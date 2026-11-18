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
