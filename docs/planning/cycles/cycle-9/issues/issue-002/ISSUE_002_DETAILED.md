# Pilot-payout-split exposes none of its configuration as reads

| Field           | Value     |
| --------------- | --------- |
| ID              | C9-002    |
| Area            | CONTRACTS |
| Difficulty      | Medium    |
| Dependencies    | C6-001    |
| Estimated Lines | 120-220   |

## Context

`pilot-income-token` and `pilot-whitelist` both expose `admin()`. `pilot-payout-split` exposes no getter for its admin, operator, ally, platform fee recipient, income token or whitelist. The only configuration read is `eurc_swap_path_status()`.

The webapp works around this in `apps/webapp/src/services/pilot/config.ts`: `pilotAllyAddress()` reads `NEXT_PUBLIC_PILOT_ALLY_ADDRESS` and its error message says "pilot-payout-split has no get_ally method". An investor also has no on-chain way to check who the operator is or where the 10% fee goes, which the product brief says must be "visible on-chain".

## What Needs to Be Done

- Add a read-only `config()` entry point that returns one struct with admin, operator, ally, platform fee recipient, income token, whitelist, USDC token, EURC token and swap router.
- Return a typed `NotInitialized` error before `initialize`.
- Keep `eurc_swap_path_status()` working, or reimplement it on top of the new read.
- Regenerate the typed client and export the new type from `apps/shared/src/contracts/pilot/`.

## Scope

In scope: `pilot-payout-split` read path, tests, regenerated client.

Out of scope: removing `NEXT_PUBLIC_PILOT_ALLY_ADDRESS` from the webapp (later cycle), any write path.

## Acceptance Criteria

- [ ] `config()` returns exactly the nine addresses passed to `initialize`, asserted field by field.
- [ ] `config()` fails with `NotInitialized` on an uninitialized contract.
- [ ] `config()` works while the contract is paused and after `exit`.
- [ ] After an admin transfer is accepted, `config().admin` is the new admin.
- [ ] `apps/shared/tests/pilotClients.test.ts` covers the new method on the generated client.

## How to Verify

```bash
cd apps/contracts && cargo test --lib -p pilot-payout-split
cd ../shared && bun test
```

## Files and Locations

| File                                                           | What is there today                                  |
| -------------------------------------------------------------- | ---------------------------------------------------- |
| `apps/contracts/contracts/pilot-payout-split/src/lib.rs:1260`  | `eurc_swap_path_status`, the only configuration read |
| `apps/contracts/contracts/pilot-payout-split/src/storage.rs:8` | `DataKey` with the nine address keys                 |
| `apps/webapp/src/services/pilot/config.ts:135`                 | `pilotAllyAddress()`, the environment workaround     |
| `apps/shared/tests/pilotClients.test.ts`                       | Tests for the generated clients                      |

## Implementation Steps

1. Add a `PayoutConfig` `#[contracttype]` struct with the nine addresses.
2. Add `config(env) -> PayoutConfig` that reads each key and fails with `NotInitialized` when any is missing.
3. Reimplement `eurc_swap_path_status` on top of the same reads, or leave it untouched.
4. Regenerate the bindings and export the type from `apps/shared/src/contracts/pilot/payout-split.ts`.

## Code Example

```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayoutConfig {
    pub admin: Address,
    pub operator: Address,
    pub ally: Address,
    pub platform_fee_recipient: Address,
    pub income_token: Address,
    pub whitelist: Address,
    pub usdc_token: Address,
    pub eurc_token: Address,
    pub swap_router: Address,
}
```

## Testing Guidance

- One test per state: uninitialized, initialized, paused, exited, after admin transfer.
- Compare each field to the value passed to `initialize`, not only that the call succeeds.
