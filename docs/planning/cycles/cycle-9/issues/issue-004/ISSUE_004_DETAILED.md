# Pilot-income-token still mints and moves balances after mark_wound_down

| Field           | Value     |
| --------------- | --------- |
| ID              | C9-004    |
| Area            | CONTRACTS |
| Difficulty      | Medium    |
| Dependencies    | C7-002    |
| Estimated Lines | 80-180    |

## Context

`mark_wound_down` in `apps/contracts/contracts/pilot-income-token/src/lib.rs` is documented as "one-way and irreversible". It only stores a record. `mint_fixed_supply` and `transfer` never read it, so after the pilot is permanently wound down the admin can still mint the supply (if it was not minted yet) and still move balances between holders.

The payout-split contract got the matching fix for its own terminal state: after `exit`, every evidence action fails with `ContractExited`. The token is the remaining half.

## What Needs to Be Done

- Add a guard used by `mint_fixed_supply` and `transfer` that fails with a new typed error once a wound-down record exists.
- Keep every read (`balance`, `holders`, `total_supply`, `wound_down_status`) and the admin succession functions working after wind-down.
- Update the doc comments on `mark_wound_down`, `pause` and `require_not_paused` so they describe the final behavior.

## Scope

In scope: `pilot-income-token` guard, error variant, tests.

Out of scope: refund or unwind logic (Known Risk #5 in the product brief stays open), `pilot-payout-split`.

## Acceptance Criteria

- [ ] After `mark_wound_down`, `transfer` fails with the new error and balances and the holder list are unchanged.
- [ ] `mark_wound_down` before the mint makes `mint_fixed_supply` fail with the new error.
- [ ] Reads and `transfer_admin_start` / `transfer_admin_accept` still work after wind-down.
- [ ] The new error variant is asserted in a test, and the proptests in `proptests.rs` still pass.

## How to Verify

```bash
cd apps/contracts
cargo test --lib -p pilot-income-token
cargo clippy --all-targets --all-features -- -D warnings
```

## Files and Locations

| File                                                         | What is there today                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------- |
| `apps/contracts/contracts/pilot-income-token/src/lib.rs:76`  | `mint_fixed_supply`, no wind-down check                          |
| `apps/contracts/contracts/pilot-income-token/src/lib.rs:199` | `transfer`, no wind-down check                                   |
| `apps/contracts/contracts/pilot-income-token/src/lib.rs:238` | `mark_wound_down`                                                |
| `apps/contracts/contracts/pilot-income-token/src/lib.rs:368` | `require_not_paused`, the guard to place the new one next to     |
| `apps/contracts/contracts/pilot-payout-split/src/lib.rs`     | `require_not_exited`, the equivalent guard on the other contract |

## Implementation Steps

1. Append `WoundDown` to `IncomeTokenError`.
2. Add `require_not_wound_down` and call it in `mint_fixed_supply` and `transfer`, after the admin check.
3. Update the doc comments.

## Code Example

```rust
fn require_not_wound_down(env: &Env) {
    if Storage::wound_down_record(env).is_some() {
        panic_with_error!(env, IncomeTokenError::WoundDown);
    }
}
```

## Testing Guidance

- Use the existing setup helpers in the `tests` module (from line 423).
- Assert state is unchanged after the rejected call: balances, `holders()` and `total_supply()`.
