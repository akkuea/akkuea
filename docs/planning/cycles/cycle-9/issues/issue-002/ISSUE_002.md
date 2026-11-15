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
