# Runbook: Pilot Role Rotation (`operator`, `ally`, `platform_fee_recipient`)

**Audience:** Platform admin (Akkuea), pilot operator (Akkuea), and ally (real estate partner)
**Applies to:** `pilot-payout-split`
**Required keys:** current `admin` Stellar secret key, plus `new_operator` or `new_ally` secret key for two-step acceptance
**Contract source:**

- `apps/contracts/contracts/pilot-payout-split/src/lib.rs`

---

## Why this exists

`pilot-payout-split` gates `record_evidence`, `execute_distribution`, and `exit`
on joint `operator` + `ally` signatures, and gates `start_review` and
`review_evidence` on `operator`. Previously `Operator`, `Ally`, and
`PlatformFeeRecipient` were written once in `initialize` with no rotation path:
a lost or compromised `operator` or `ally` key permanently froze distributions
and prevented `exit`, while a closed or compromised fee account continued
receiving the 10% platform fee on every cycle.

`pilot-payout-split` now provides:

- Two-step `operator` rotation (`transfer_operator_start`,
  `transfer_operator_accept`, `transfer_operator_cancel`, `pending_operator`)
- Two-step `ally` rotation (`transfer_ally_start`, `transfer_ally_accept`,
  `transfer_ally_cancel`, `pending_ally`)
- Single-step `platform_fee_recipient` update (`set_platform_fee_recipient`)

See [`docs/strategy/decision-log.md`](../strategy/decision-log.md) for the
recorded authorization model, including why `admin` alone initiates operator and
ally transfers on chain and how ally consent is handled when the outgoing key
still works.

---

## Preconditions and invariants

1. **Contract must not have exited.** Once `exit` has succeeded, all role
   rotation functions fail with `ContractExited` (`22`).
2. **Pause does not block rotation.** All rotation functions remain callable
   while `is_paused` is `true`. If a compromise is suspected, pause first
   (`docs/operations/runbook-pilot-emergency-pause.md`) and rotate while paused.
3. **Two-signer separation (`SignerCollision`, `17`).** `operator` and `ally`
   can never be the same address. Both `*_start` and `*_accept` reject any
   rotation that would make `operator == ally`.
4. **Written ally consent for routine ally rotation.** When the existing ally
   key still works and the ally relationship is active, obtain written
   confirmation from the ally naming `$NEW_ALLY_ADDRESS` before `admin` calls
   `transfer_ally_start`, then have the ally sign `transfer_ally_accept` with
   the new key.

---

## Rotating `operator` (two-step)

### Step 1: start transfer (current admin)

```bash
export CONTRACT_ID="<PILOT_PAYOUT_SPLIT contract ID>"
export ADMIN_ADDRESS="<current admin Stellar public key>"
export NEW_OPERATOR_ADDRESS="<new operator Stellar public key>"
export NETWORK="testnet"   # or mainnet, once the pilot is live there

stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- transfer_operator_start \
  --caller $ADMIN_ADDRESS \
  --new_operator $NEW_OPERATOR_ADDRESS
```

Verify the pending operator is recorded (`opstart` event emitted):

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- pending_operator
# Expected: $NEW_OPERATOR_ADDRESS
```

### Step 2: accept transfer (new operator, own key)

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $NEW_OPERATOR_ADDRESS \
  --network $NETWORK \
  -- transfer_operator_accept \
  --new_operator $NEW_OPERATOR_ADDRESS
```

Immediately after `transfer_operator_accept` succeeds (`opacc` event emitted):

- The old operator key fails with `Unauthorized` (`3`) on `record_evidence`,
  `start_review`, `review_evidence`, `flag_dispute`, `execute_distribution`, and
  `exit`.
- `$NEW_OPERATOR_ADDRESS` holds full operator authority.
- `pending_operator` returns no value.

### Cancel pending operator transfer (current admin, before Step 2)

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- transfer_operator_cancel \
  --caller $ADMIN_ADDRESS
```

---

## Rotating `ally` (two-step)

### Step 1: start transfer (current admin)

```bash
export CONTRACT_ID="<PILOT_PAYOUT_SPLIT contract ID>"
export ADMIN_ADDRESS="<current admin Stellar public key>"
export NEW_ALLY_ADDRESS="<new ally Stellar public key>"
export NETWORK="testnet"

stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- transfer_ally_start \
  --caller $ADMIN_ADDRESS \
  --new_ally $NEW_ALLY_ADDRESS
```

Verify the pending ally is recorded (`allysta` event emitted):

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- pending_ally
# Expected: $NEW_ALLY_ADDRESS
```

### Step 2: accept transfer (new ally, own key)

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $NEW_ALLY_ADDRESS \
  --network $NETWORK \
  -- transfer_ally_accept \
  --new_ally $NEW_ALLY_ADDRESS
```

Immediately after `transfer_ally_accept` succeeds (`allyacc` event emitted):

- The old ally key fails with `Unauthorized` (`3`) on `submit_evidence`,
  `record_evidence`, `execute_distribution`, and `exit`.
- `$NEW_ALLY_ADDRESS` holds full ally authority.
- `pending_ally` returns no value.
- Remember to update `NEXT_PUBLIC_PILOT_ALLY_ADDRESS` in webapp deployment
  configuration until on-chain config reads replace that environment variable.

### Cancel pending ally transfer (current admin, before Step 2)

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- transfer_ally_cancel \
  --caller $ADMIN_ADDRESS
```

---

## Updating `platform_fee_recipient` (single-step, admin)

Verify beforehand that `$NEW_FEE_RECIPIENT_ADDRESS` has an active USDC trustline
on the target network so `execute_distribution` transfers do not fail when
paying the 10% platform fee.

```bash
export CONTRACT_ID="<PILOT_PAYOUT_SPLIT contract ID>"
export ADMIN_ADDRESS="<current admin Stellar public key>"
export NEW_FEE_RECIPIENT_ADDRESS="<new fee recipient Stellar public key>"
export NETWORK="testnet"

stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- set_platform_fee_recipient \
  --caller $ADMIN_ADDRESS \
  --new_recipient $NEW_FEE_RECIPIENT_ADDRESS
```

`set_platform_fee_recipient` emits `feerec` (`PlatformFeeRecipientUpdatedEvent`)
and takes effect on the very next `execute_distribution` call.

---

## Common errors

| Error                | Code | Cause                                                                                     | Fix                                                                      |
| -------------------- | ---- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `Unauthorized`       | `3`  | Caller of `*_start`, `*_cancel`, or `set_platform_fee_recipient` is not the current admin | Sign with the current `admin` key                                        |
| `SignerCollision`    | `17` | `new_operator` equals current `ally`, or `new_ally` equals current `operator`             | Use distinct addresses for `operator` and `ally`                         |
| `ContractExited`     | `22` | `exit` was already called on this contract                                                | Terminal state; deploy a new pilot instance if a new relationship begins |
| `NotPendingOperator` | `32` | `transfer_operator_accept` called by an address other than `pending_operator` (or none)   | Check `pending_operator` and sign with the exact pending address         |
| `NotPendingAlly`     | `33` | `transfer_ally_accept` called by an address other than `pending_ally` (or none)           | Check `pending_ally` and sign with the exact pending address             |

---

## See also

- [`docs/operations/runbook-pilot-admin-rotation.md`](runbook-pilot-admin-rotation.md)
- [`docs/operations/runbook-pilot-emergency-pause.md`](runbook-pilot-emergency-pause.md)
- [`docs/operations/runbook-pilot-contract-migration.md`](runbook-pilot-contract-migration.md)
- [`docs/strategy/decision-log.md`](../strategy/decision-log.md)
