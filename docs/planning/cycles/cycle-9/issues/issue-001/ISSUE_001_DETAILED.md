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

## Files and Locations

| File                                                            | What is there today                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/contracts/contracts/pilot-payout-split/src/lib.rs:309`    | `initialize`, the only writer of `Operator`, `Ally` and `PlatformFeeRecipient` |
| `apps/contracts/contracts/pilot-payout-split/src/lib.rs:1156`   | `transfer_admin_start`, the two-step pattern to mirror                         |
| `apps/contracts/contracts/pilot-payout-split/src/lib.rs:1289`   | `require_operator` and, at 1297, `require_ally`                                |
| `apps/contracts/contracts/pilot-payout-split/src/storage.rs:35` | `PendingAdmin` key and its helpers (lines 170 to 180)                          |
| `docs/operations/runbook-pilot-admin-rotation.md`               | Runbook to use as the model for the new one                                    |

## Implementation Steps

1. Record the authority decision in `docs/strategy/decision-log.md` before writing code.
2. Add `PendingOperator` and `PendingAlly` keys with `pending`, `set` and `clear` helpers next to the `PendingAdmin` ones.
3. Add start, accept and cancel entry points for operator and ally, and a setter for the fee recipient.
4. Check `SignerCollision` on accept, against the role that is not changing.
5. Add events in `events.rs` and error variants in `errors.rs`, appended at the end so existing codes keep their numbers.
6. Regenerate the bindings and write the runbook.

## Code Example

```rust
pub fn transfer_operator_accept(env: Env, new_operator: Address) {
    extend_instance(&env);
    new_operator.require_auth();
    Self::require_not_exited(&env);

    if Storage::pending_operator(&env) != Some(new_operator.clone()) {
        panic_with_error!(&env, PayoutError::NotPendingOperator);
    }
    let ally = Storage::address(&env, &DataKey::Ally)
        .unwrap_or_else(|| panic_with_error!(&env, PayoutError::NotInitialized));
    if ally == new_operator {
        panic_with_error!(&env, PayoutError::SignerCollision);
    }
    Storage::set_address(&env, &DataKey::Operator, &new_operator);
    Storage::clear_pending_operator(&env);
}
```

## Testing Guidance

- Follow the admin-succession tests already in the `tests` module (from line 1319).
- Assert the old key fails with `Unauthorized` on each gated entry point, not only on one.
- Assert the fee recipient change with exact USDC balances after `execute_distribution`.
