# Runbook: Pilot Emergency Pause

**Severity:** High
**Audience:** Platform admin (Akkuea), for all three pilot contracts
**Applies to:** `pilot-whitelist`, `pilot-income-token`, `pilot-payout-split`
**Contract sources:**

- `apps/contracts/contracts/pilot-whitelist/src/lib.rs`
- `apps/contracts/contracts/pilot-income-token/src/lib.rs`
- `apps/contracts/contracts/pilot-payout-split/src/lib.rs`

---

## This is not `defi-rwa`'s emergency pause

`defi-rwa`'s `emergency_pause` (see
[`docs/operations/runbook-emergency-pause.md`](runbook-emergency-pause.md))
imposes a mandatory 24-hour timelock before recovery. **The pilot contracts
have no timelock.** `pause` and `unpause` are both simple, immediate,
admin-gated calls with no waiting period and no separate recovery step.
Read this runbook, not the `defi-rwa` one, when responding to an incident on
any of the three pilot contracts.

`pause`/`unpause`/`is_paused` shipped on `pilot-payout-split` from an earlier
change. This runbook also covers `pilot-income-token` and `pilot-whitelist`,
which gained the same pattern in this change: before it, a wrongful mint,
balance correction, wind-down marker, or whitelist approval/revocation on
those two contracts had no on-chain circuit breaker at all.

---

## What pausing blocks, per contract

Each contract's pause is independent. Pausing `pilot-payout-split` does not
pause `pilot-income-token` or `pilot-whitelist`, and vice versa. Decide which
contract (or contracts) the incident actually touches before pausing; pausing
all three is the safe default if that is unclear.

### `pilot-whitelist`

| Blocked while paused | Keeps working while paused |
| --------------------- | ---------------------------- |
| `approve`              | `is_approved`                 |
| `revoke`               | `admin`                        |

Rejects with `WhitelistError::ContractPaused` (error code 5).

### `pilot-income-token`

| Blocked while paused | Keeps working while paused |
| --------------------- | ---------------------------- |
| `mint_fixed_supply`    | `balance`                     |
| `transfer`             | `name`, `symbol`, `decimals`  |
| `mark_wound_down`      | `total_supply`, `holders`     |
|                        | `admin`, `wound_down_status`  |

Rejects with `IncomeTokenError::ContractPaused` (error code 16).
`mark_wound_down` is deliberately included even though it is a one-way,
terminal action: pausing is meant to stop every state change while an
incident is under review, and wind-down can still be declared immediately
after an explicit `unpause`.

### `pilot-payout-split`

| Blocked while paused                        | Keeps working while paused              |
| --------------------------------------------- | ------------------------------------------ |
| `record_evidence`, `submit_evidence`          | `get_evidence`, `is_paused`                 |
| `start_review`, `review_evidence`             | `get_currency_preference`, `get_swap_failures` |
| `execute_distribution`                        | `exit_status`, `eurc_swap_path_status`      |
| `set_currency_preference`                     |                                              |

Rejects with `PayoutError::ContractPaused` (error code 4). Note `flag_dispute`
and `exit` are **not** pause-gated on `pilot-payout-split`; that is a
pre-existing property of this contract, unrelated to this change, and out of
scope here.

**Not blocked on any of the three contracts:** `pause`, `unpause`,
`transfer_admin_start`, `transfer_admin_accept`, `transfer_admin_cancel`.
These are the recovery tools; they must keep working while paused.

---

## Phase 1: pause

### Prerequisites

```bash
export CONTRACT_ID="<PILOT_WHITELIST | PILOT_INCOME_TOKEN | PILOT_PAYOUT_SPLIT contract ID>"
export ADMIN_ADDRESS="<admin Stellar public key for that contract>"
export NETWORK="testnet"   # or mainnet, once the pilot is live there
```

### Execute the pause

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- pause \
  --admin $ADMIN_ADDRESS
```

**Expected output:** transaction hash. No output means the CLI failed before
submitting.

### Verify the pause is active

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- is_paused
# Expected: true
```

Confirm a blocked call now fails. For `pilot-whitelist`:

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- approve \
  --admin $ADMIN_ADDRESS \
  --address $ADMIN_ADDRESS
# Expected error: ContractPaused (error code 5)
```

### Immediately after pausing

1. Record the pause transaction hash and the contract ID(s) paused.
2. Record the current ledger timestamp (`stellar ledger --network $NETWORK`).
3. Notify the operator and ally (off-chain): the pilot is temporarily frozen
   for the paused contract(s).
4. If the admin key itself is the suspected compromise, follow
   [`runbook-pilot-admin-rotation.md`](runbook-pilot-admin-rotation.md) next,
   in parallel with the investigation below. Admin transfer works while
   paused.

---

## Phase 2: investigation

While paused, on the affected contract:

```bash
# Stream recent contract events to identify what happened.
stellar events \
  --id $CONTRACT_ID \
  --network $NETWORK \
  --start-ledger <ledger_before_incident>

# Confirm the current admin is still the expected key.
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- admin
# (pilot-payout-split has no `admin` getter; infer from the last
# AdminTransferAcceptedEvent, or attempt an admin-gated call.)

# pilot-payout-split only: confirm the pilot has not also been exited.
stellar contract invoke \
  --id $PILOT_PAYOUT_SPLIT \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- exit_status
```

Use this window to decide: unpause once resolved, or escalate to
[`docs/operations/runbook-pilot-contract-migration.md`](runbook-pilot-contract-migration.md)
if the contract's own admin key is unrecoverable.

---

## Phase 3: unpause

Only the current admin can unpause. There is no timelock: unpause is
available the moment the admin decides the incident is resolved.

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- unpause \
  --admin $ADMIN_ADDRESS
```

Verify:

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- is_paused
# Expected: false
```

---

## Post-incident actions

1. Monitor events on the affected contract(s) for at least one hour after
   unpausing.
2. If the admin key was compromised (not just suspected), rotate it on every
   contract it administers using
   [`runbook-pilot-admin-rotation.md`](runbook-pilot-admin-rotation.md), even
   after unpausing. A key that was compromised once should not remain in use.
3. Write an incident report: what triggered the pause, root cause, timeline,
   which contract(s) were paused, remediation.

---

## Common errors

| Error             | Cause                                    | Fix                                                       |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------ |
| `Unauthorized`      | Caller of `pause`/`unpause` is not the admin | Use the admin key for that specific contract                 |
| `ContractPaused`    | Blocked call attempted while paused        | Expected. Wait for `unpause`, or confirm the pause is warranted |
| `NotInitialized`    | Contract was never initialized             | Confirm the contract ID                                      |

---

## See also

- [`docs/operations/runbook-pilot-admin-rotation.md`](runbook-pilot-admin-rotation.md)
- [`docs/operations/runbook-pilot-contract-migration.md`](runbook-pilot-contract-migration.md)
- [`docs/operations/runbook-emergency-pause.md`](runbook-emergency-pause.md) - the `defi-rwa` equivalent (different contract, 24-hour timelock, do not confuse the two)
- [`docs/strategy/decision-log.md`](../strategy/decision-log.md)
- [`docs/deployment/deploy-pilot-contracts.md`](../deployment/deploy-pilot-contracts.md)
