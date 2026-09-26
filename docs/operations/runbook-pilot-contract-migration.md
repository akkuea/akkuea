# Runbook: Pilot Contract Migration and Recovery

**Severity:** Critical
**Audience:** Platform admin (Akkuea), with the operator and ally available
**Applies to:** `pilot-whitelist`, `pilot-income-token`, `pilot-payout-split`

> **Status: rehearsed end to end on testnet, 2026-09-26.** A throwaway old
> deployment was seeded to model a live pilot (three approved holders, a
> fixed mint, one distributed cycle, one in-flight cycle), then every step
> below was executed against it with a fresh deployer, and the resulting
> transaction hashes were recorded in the "Rehearsal record" table at the
> bottom. The rehearsal surfaced two command-level corrections that are now
> folded into the steps: Step 4b's CLI argument quoting, and Step 5's
> `mark_wound_down` pause gate, which requires unpausing the old
> `pilot-income-token` before marking it and re-pausing afterwards.

---

## Why this exists, instead of an in-place upgrade

The three pilot contracts are deliberately immutable: no WASM-upgrade entry
point exists on any of them. See
[`docs/strategy/decision-log.md`](../strategy/decision-log.md) ("Upgrade
decision") for the full reasoning. In short: a two-signer upgrade mechanism
would roughly double the audit surface of this already large change, and
turns a compromised admin key into a full logic-replacement risk instead of
the smaller, closed set of things a compromised admin key can do today
(pause, mint-correct within existing constraints, attempt and fail a
whitelist-gated transfer). Immutability trades that risk for this procedure:
fixing a contract-level bug means deploying a new contract set and migrating
state to it, deliberately, not patching the running one.

This is also the answer to Known Risk #5 in
[`docs/strategy/product-brief.md`](../strategy/product-brief.md) (no
fund-recovery or unwind logic exists) for the specific case of "the contract
itself needs to be replaced." It does not answer the separate, still-open
question of what happens to already-collected or future funds if the ally
exits mid-cycle; that remains a product/legal question, not a technical one.

**When to use this runbook:**

- A bug in the deployed contract logic needs fixing and cannot be worked
  around operationally.
- The admin key for a contract is unrecoverable (not just compromised; if it
  is merely compromised but the admin still holds it, rotate it instead via
  `runbook-pilot-admin-rotation.md`, which is far cheaper).
- A deliberate, planned upgrade to a new contract version.

**When not to use this runbook:** an incident that pausing and investigating
resolves. Try `runbook-pilot-emergency-pause.md` first. Migration is a
last resort, not a routine operation: it changes contract IDs, which every
client (dashboard, wallet integrations, the operator/ally tooling) must be
updated to point at.

---

## What this procedure does and does not carry over

| State                                       | Carried over                           | How                                                                                                                                 |
| ------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Whitelist approvals                         | Yes                                    | Re-`approve` every still-approved address on the new `pilot-whitelist`                                                              |
| Token holder balances                       | Yes, exactly                           | One `mint_fixed_supply` call on the new `pilot-income-token`, using the old contract's final `holders()` and per-holder `balance()` |
| Wound-down / exit terminal state            | Recorded on the **old** contracts only | The old contracts keep their own terminal record; the new contracts start fresh and unexited                                        |
| Historical evidence records (per cycle)     | Not replayed on-chain                  | Remain permanently readable on the old `pilot-payout-split`; the new deployment is linked to it in `docs/contracts/deployment.md`   |
| Currency preferences per holder             | Not replayed automatically             | Holders must re-set their preference on the new contract via `set_currency_preference` (self-serve, cheap)                          |
| In-flight (unreviewed or unexecuted) cycles | Handled manually, case by case         | Resolve or cancel before migrating; do not carry partial review state across                                                        |

Whitelist approvals are not enumerable on-chain (`pilot-whitelist` stores
only a boolean per address, not a list). Reconstruct the current approved
set from event history, cross-checked against `pilot-income-token`'s
`holders()` (every current token holder must already be approved, since
`mint_fixed_supply` and admin `transfer` both check the whitelist at the
time they ran).

---

## Prerequisites

```bash
export OLD_WHITELIST="<current PILOT_WHITELIST contract ID>"
export OLD_INCOME_TOKEN="<current PILOT_INCOME_TOKEN contract ID>"
export OLD_PAYOUT_SPLIT="<current PILOT_PAYOUT_SPLIT contract ID>"
export ADMIN_ADDRESS="<admin Stellar public key>"
export OPERATOR_ADDRESS="<operator Stellar public key>"
export ALLY_ADDRESS="<ally Stellar public key>"
export NETWORK="testnet"   # rehearse here before ever doing this on mainnet
```

You also need a new deployer identity and the same operator/ally/fee
recipient/USDC/EURC/swap-router addresses used originally, unless the
migration is also deliberately changing one of them (for example, rotating
the platform fee recipient at the same time). If any of those are changing,
decide and record that before Step 3.

---

## Step 1: pause the old contracts

Freeze all state changes before taking a snapshot, so the snapshot is
consistent.

```bash
for CONTRACT_ID in $OLD_WHITELIST $OLD_INCOME_TOKEN $OLD_PAYOUT_SPLIT; do
  stellar contract invoke \
    --id $CONTRACT_ID \
    --source-account $ADMIN_ADDRESS \
    --network $NETWORK \
    -- pause \
    --admin $ADMIN_ADDRESS
done
```

Verify all three report `is_paused` as `true` before continuing.

---

## Step 2: snapshot state from the old contracts

### 2a. Reconstruct the approved whitelist set

```bash
# Every approve/revoke ever emitted, oldest first.
stellar events \
  --id $OLD_WHITELIST \
  --network $NETWORK \
  --start-ledger <ledger_at_deployment>
```

Replay the `approve`/`revoke` events in order to compute the final approved
set (an address is approved unless the most recent event for it is
`revoke`). Cross-check every address in the resulting set with:

```bash
stellar contract invoke \
  --id $OLD_WHITELIST \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- is_approved \
  --address <candidate address>
```

### 2b. Read the final holder set and balances

```bash
stellar contract invoke \
  --id $OLD_INCOME_TOKEN \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- holders

# For each address returned:
stellar contract invoke \
  --id $OLD_INCOME_TOKEN \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- balance \
  --id <holder address>
```

Record the holder list and matching amounts in the same order; this becomes
the `--holders` / `--amounts` arguments to `mint_fixed_supply` on the new
contract in Step 4. Also record:

```bash
stellar contract invoke \
  --id $OLD_INCOME_TOKEN \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- total_supply
```

and confirm it equals the sum of the recorded per-holder balances, as a
sanity check before moving on.

### 2c. Read payout-split state

```bash
stellar contract invoke \
  --id $OLD_PAYOUT_SPLIT \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- exit_status
# If this returns a record, the pilot on this contract is already
# permanently exited. Confirm migration is still the right call before
# proceeding; a fresh deployment for an already-exited relationship may not
# be needed at all.

# For every cycle_id known to the operator (there is no on-chain
# enumeration of cycle IDs):
stellar contract invoke \
  --id $OLD_PAYOUT_SPLIT \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- get_evidence \
  --cycle_id <cycle id>
```

Record each cycle's status. Any cycle not in `Approved` with `distributed =
true` (that is, anything still in flight) must be resolved or explicitly
written off before migrating; do not carry partial review state to the new
contract, since the new contract starts with no evidence records at all.

---

## Step 3: deploy the new contract set

Follow `docs/deployment/deploy-pilot-contracts.md` Steps 1 and 2 exactly,
using a fresh deployer identity if this is a compromise-driven migration
(do not reuse a key you cannot fully trust). This produces three new
contract IDs, in the same mandatory order (`pilot-whitelist`, then
`pilot-income-token`, then `pilot-payout-split`).

```bash
./scripts/deploy-pilot-contracts.sh \
  $NETWORK \
  <new-deployer-identity> \
  $OPERATOR_ADDRESS \
  $ALLY_ADDRESS \
  $PLATFORM_FEE_RECIPIENT \
  $USDC_TOKEN_CONTRACT_ID

export NEW_WHITELIST="<new PILOT_WHITELIST contract ID>"
export NEW_INCOME_TOKEN="<new PILOT_INCOME_TOKEN contract ID>"
export NEW_PAYOUT_SPLIT="<new PILOT_PAYOUT_SPLIT contract ID>"
```

If the bug being migrated away from is in the deployed WASM itself, this is
also the point where the fix lands: build from the corrected source before
running the deploy script.

---

## Step 4: replay state onto the new contracts

### 4a. Re-approve the whitelist

```bash
# For every address in the Step 2a snapshot:
stellar contract invoke \
  --id $NEW_WHITELIST \
  --source-account <new-deployer-identity> \
  --network $NETWORK \
  -- approve \
  --admin $ADMIN_ADDRESS \
  --address <approved address>
```

### 4b. Re-mint the exact holder balances

`mint_fixed_supply` can only be called once per contract, which is exactly
what is needed here: it recreates the old contract's final balances in a
single call.

```bash
stellar contract invoke \
  --id $NEW_INCOME_TOKEN \
  --source-account <new-deployer-identity> \
  --network $NETWORK \
  -- mint_fixed_supply \
  --admin $ADMIN_ADDRESS \
  --holders '["<holder1>","<holder2>", ...]' \
  --amounts '["<amount1>","<amount2>", ...]'
```

The stellar CLI requires i128 vector elements to be passed as quoted
strings inside the JSON array; unquoted numbers fail argument parsing with
`Expected type vector of i128`.

Use the exact holder list and amounts recorded in Step 2b, in the same
order. Verify:

```bash
stellar contract invoke \
  --id $NEW_INCOME_TOKEN \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- total_supply
# Expected: matches the old contract's total_supply from Step 2b
```

### 4c. Payout-split state

`pilot-payout-split`'s `initialize` (run as part of Step 3) already points
the new contract at `$NEW_INCOME_TOKEN` and `$NEW_WHITELIST`. Historical
evidence records are **not** replayed: they remain permanently readable on
`$OLD_PAYOUT_SPLIT`, which stays deployed (paused, not deleted) as the
permanent audit trail for every cycle recorded before the migration.

If any holder had a non-default currency preference (EURC) on the old
contract, they must call `set_currency_preference` again on the new
contract; this is a self-serve, holder-signed call, not something the admin
can or should do on their behalf.

---

## Step 5: close out the old contracts

Mark both old contracts' terminal state, pointing forward to the new
deployment so anyone reading the old contract's history sees where the
pilot continued.

`mark_wound_down` is pause-gated, and Step 1 left every old contract
paused, so the old `pilot-income-token` must be unpaused first, marked,
and then re-paused:

```bash
stellar contract invoke \
  --id $OLD_INCOME_TOKEN \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- unpause \
  --admin $ADMIN_ADDRESS

stellar contract invoke \
  --id $OLD_INCOME_TOKEN \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- mark_wound_down \
  --admin $ADMIN_ADDRESS \
  --reason "Migrated to $NEW_INCOME_TOKEN on $(date -u +%Y-%m-%d)"

stellar contract invoke \
  --id $OLD_INCOME_TOKEN \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- pause \
  --admin $ADMIN_ADDRESS
```

`pilot-payout-split`'s `exit` requires both operator and ally signatures (it
is not admin-gated); coordinate with both before running it, or leave the
old `pilot-payout-split` paused indefinitely if a two-signer exit cannot be
arranged immediately. A paused, un-exited old contract is safe: `pause`
blocks evidence recording, preference changes, and distribution execution.
`exit` itself is deliberately not pause-gated (a terminal marker must stay
recordable on a frozen contract), which the rehearsal confirmed.

```bash
stellar contract invoke \
  --id $OLD_PAYOUT_SPLIT \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- exit \
  --operator $OPERATOR_ADDRESS \
  --ally $ALLY_ADDRESS \
  --reason "Migrated to $NEW_PAYOUT_SPLIT on $(date -u +%Y-%m-%d)"
```

`pilot-whitelist` has no terminal marker; leaving it paused and undeployed
from client configuration is sufficient.

---

## Step 6: unpause the new contracts and update records

The new contracts deploy unpaused by default (`initialize` sets `Paused` to
`false`). Confirm:

```bash
for CONTRACT_ID in $NEW_WHITELIST $NEW_INCOME_TOKEN $NEW_PAYOUT_SPLIT; do
  stellar contract invoke \
    --id $CONTRACT_ID \
    --source-account $ADMIN_ADDRESS \
    --network $NETWORK \
    -- is_paused
  # Expected: false for pilot-payout-split (the only one of the three with
  # is_paused before this change); pilot-whitelist and pilot-income-token
  # now also default to unpaused.
done
```

Update, per `docs/deployment/deploy-pilot-contracts.md` Step 7:

- `apps/shared/src/contracts.testnet.json` (or `.mainnet.json`): new contract
  IDs.
- `docs/contracts/deployment.md`: add the new deployment table, and mark the
  old entries retired with a pointer to the new IDs and the migration date.

Notify investors (off-chain) that the pilot now runs on new contract IDs and
that their wallet/dashboard configuration needs updating if it is not
auto-resolved from the shared config file.

---

## Rehearsal record

Fill this in the first time this procedure is actually run on testnet, and
update it on every subsequent rehearsal.

| Field                                              | Value                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date                                               | 2026-09-26                                                                                                                                                                                                                                                                                                                                                                 |
| Network                                            | testnet                                                                                                                                                                                                                                                                                                                                                                    |
| Old contract IDs                                   | `pilot-whitelist` `CAO6RSVQMC7UIXJZTGFOKB74OVIXE6YF3G526XGFVWO6L3BFOC26Y5X6`, `pilot-income-token` `CDB35QVWWKQPGYRZZNPNHWDSP3WZIWV7IYTRGNQO3AOBAIEJ2MOYHAFC`, `pilot-payout-split` `CBLQAQ5YIPUVYN4NB6HEEWIU47QHTFQKNWKP36XFEKVWFRXMGI4HYTRH`                                                                                                                             |
| New contract IDs                                   | `pilot-whitelist` `CC7MUBUIU7RKEBMLKMS4RLS6FDX2DQKBCJ67ZQVHQTJPDWIFWT43NSI7`, `pilot-income-token` `CCLPIH3UYLJFG2MLFIUMJSGKZOYGNYODPXRSRVTTRVUCS4BL3DPWHYZ5`, `pilot-payout-split` `CASLHM4IOQVD3DSICWUJNWVRBGMVGRUFQI6RILGMLATVEO3WGSJTSV7L`                                                                                                                             |
| Pause transaction hashes (Step 1)                  | whitelist `1d133754164f4344bebf680250f90f3b64fc9b839f8b9ca9e0d8dceb6fe355df`, income-token `16da56c0d96db700ae69f3b665c1f123d9c4786fbd88188a5c0096ae5dcd7bbb`, payout-split `3e00a7693be388f69fcf6098b67c88fb5b56151ac885c514f04c18d8fce315d2`                                                                                                                             |
| Whitelist re-approval transaction hashes (Step 4a) | holder one `f4c02f4be97764dc2065cf00f7fcebfa557b02ae6aa71a044dac8c2ec68b6d9f`, holder two `a1fcda5385fc0f043ed049506c70a155b21370578f44e07d00850a84ff7b9fc9`, holder three `77e03bace560406992ffc2fb50a7935d2d89e59e21e6e37f84c6fb8f25bcb56c`                                                                                                                              |
| `mint_fixed_supply` transaction hash (Step 4b)     | `d3b35496a660cbf9dc2efdfff39d6b5328802187e5d343e6594443458cc69d87`                                                                                                                                                                                                                                                                                                         |
| `mark_wound_down` transaction hash (Step 5)        | `d50166c35b26cf7c674d0aa164321dd6aadc5891d86a03a847b5440dfe04bb30` (preceded by unpause `e19b399806b2a8a4ac47f8355d3f44d2c17ba2c1ee33bc514a3ddeabee184ea3` and followed by re-pause `c0181deb664b7d7348c618043320ac4838e48db021d3afbbc2fb0b38169fe707`)                                                                                                                    |
| `exit` transaction hash (Step 5)                   | `19eb0b1f71714f44c6624abce8f46c162461e09a447a04d9229509587c36007f`                                                                                                                                                                                                                                                                                                         |
| Total elapsed time                                 | roughly 50 minutes of wall-clock time, including the seeded old deployment and every verification read                                                                                                                                                                                                                                                                     |
| Issues found and fixed in this runbook             | `mark_wound_down` is pause-gated, so Step 5 now unpauses the old income token first and re-pauses after marking (first attempt failed with `ContractPaused`); the stellar CLI requires i128 vector elements as quoted strings in Step 4b (unquoted numbers fail parsing); `exit` confirmed not pause-gated, so the pause-then-exit order in Steps 1 and 5 works as written |

---

## See also

- [`docs/operations/runbook-pilot-admin-rotation.md`](runbook-pilot-admin-rotation.md)
- [`docs/operations/runbook-pilot-emergency-pause.md`](runbook-pilot-emergency-pause.md)
- [`docs/strategy/decision-log.md`](../strategy/decision-log.md)
- [`docs/deployment/deploy-pilot-contracts.md`](../deployment/deploy-pilot-contracts.md)
