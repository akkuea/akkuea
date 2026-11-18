# Pilot-payout-split: the operator, the ally and the fee recipient can never be rotated

| Field           | Value          |
| --------------- | -------------- |
| ID              | C9-001         |
| Area            | CONTRACTS      |
| Difficulty      | High           |
| Dependencies    | C6-001, C8-003 |
| Estimated Lines | 250-450        |

## Context

`pilot-payout-split` stores `Operator`, `Ally` and `PlatformFeeRecipient` once, in `initialize` (`apps/contracts/contracts/pilot-payout-split/src/lib.rs`), and no function ever writes them again. C8-003 added two-step succession for the admin only.

`record_evidence`, `execute_distribution` and `exit` all require the operator and the ally to sign. If either key is lost or compromised, no cycle can ever be distributed again and the contract cannot even be exited. If the fee recipient account is closed or compromised, every distribution keeps paying it.

## What Needs to Be Done

- Add a way to replace the operator, the ally and the platform fee recipient.
- Decide who authorizes each change and record it in `docs/strategy/decision-log.md`. The decision must answer: can the admin alone replace a lost operator key, and must the ally consent to its own replacement when its key still works.
- Use a two-step start and accept flow for operator and ally, the same shape as `transfer_admin_start` and `transfer_admin_accept`, so a mistyped address cannot lock the contract.
- Keep the `operator != ally` invariant (`SignerCollision`) on every change.
- Emit an event for every start, accept and cancel.
- Add `docs/operations/runbook-pilot-role-rotation.md`.
- Regenerate the typed client in `apps/shared/src/contracts/pilot/generated/`.

## Scope

In scope: `pilot-payout-split` storage, entry points, events, errors, tests, the runbook, the decision-log entry, the regenerated client.

Out of scope: any webapp screen for rotation, changes to `pilot-income-token` or `pilot-whitelist`, admin succession (already done in C8-003).

## Acceptance Criteria

- [ ] A replaced operator can no longer call `record_evidence`, `start_review`, `review_evidence`, `execute_distribution` or `exit`, and the new one can.
- [ ] A replaced ally can no longer co-sign, and the new one can.
- [ ] After the fee recipient changes, the next `execute_distribution` pays the fee to the new address, asserted on exact balances.
- [ ] A rotation that would make operator and ally the same address fails with `SignerCollision`.
- [ ] A pending rotation can be cancelled, and an address that is not the pending one cannot accept it.
- [ ] Rotation works while the contract is paused and is rejected after `exit`.
- [ ] Every new error variant is asserted in a test.

## How to Verify

```bash
cd apps/contracts
cargo test --lib -p pilot-payout-split
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo build --target wasm32v1-none --release
```
