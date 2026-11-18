# Pilot-payout-split accepts any cycle id and unbounded strings

| Field           | Value     |
| --------------- | --------- |
| ID              | C9-003    |
| Area            | CONTRACTS |
| Difficulty      | Medium    |
| Dependencies    | C6-001    |
| Estimated Lines | 150-300   |

## Context

`record_evidence` and `submit_evidence` take `cycle_id: String` and store it as the key `DataKey::Evidence(cycle_id)` without looking at it. The dashboard only ever reads cycles named `YYYY-MM`: `enumerateCycles` in `apps/webapp/src/services/pilot/cycles.ts` builds that list and reads each one. A cycle recorded as `2026-3`, `march` or an empty string is stored and can be distributed, and it never appears on any dashboard.

The free-text arguments are also unbounded: `evidence_link`, the `reason` of `review_evidence`, `flag_dispute` and `exit`. Each one is written to contract storage and copied into an event, so a caller can store an arbitrarily large string.

## What Needs to Be Done

- Reject a `cycle_id` that is not exactly `YYYY-MM` with month `01` to `12`, with a new typed error.
- Add maximum lengths for `evidence_link` and for every `reason` argument, as named constants, with a typed error.
- Apply the checks in `record_evidence`, `submit_evidence`, `review_evidence`, `flag_dispute` and `exit`.
- Update the evidence status table in the module doc comment if any cell changes.

## Scope

In scope: input validation in `pilot-payout-split`, new error variants, tests.

Out of scope: changing how cycles are stored, the webapp, `pilot-income-token`.

## Acceptance Criteria

- [ ] `2026-03` is accepted. `2026-3`, `2026-13`, `2026-00`, `26-03`, `2026/03`, an empty string and a 7-character non-digit string are each rejected with the new error.
- [ ] A link or reason at the maximum length is accepted, and one byte longer is rejected.
- [ ] Reading an existing cycle with `get_evidence` is not affected.
- [ ] Every new error variant is asserted in a test.
- [ ] Existing tests are updated to valid cycle ids instead of being deleted.

## How to Verify

```bash
cd apps/contracts
cargo test --lib -p pilot-payout-split
cargo clippy --all-targets --all-features -- -D warnings
```
