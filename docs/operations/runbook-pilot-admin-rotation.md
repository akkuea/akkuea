# Runbook: Pilot Admin Rotation

**Audience:** Platform admin (Akkuea)
**Applies to:** `pilot-whitelist`, `pilot-income-token`, `pilot-payout-split`
**Required key:** the current admin's Stellar secret key, for each contract
**Contract sources:**

- `apps/contracts/contracts/pilot-whitelist/src/lib.rs`
- `apps/contracts/contracts/pilot-income-token/src/lib.rs`
- `apps/contracts/contracts/pilot-payout-split/src/lib.rs`

---

## Why this exists

Before this change, each of the three pilot contracts stored a single admin
address at `initialize` and compared every privileged call against it, with
no way to rotate, transfer, or recover it. If that key was lost or
compromised, every privileged function on that contract (minting, whitelist
approvals, pause/unpause, `mark_wound_down`) became permanently uncallable or
permanently hijacked. This is Known Risk #7 in
[`docs/strategy/product-brief.md`](../strategy/product-brief.md).

Each contract now carries its own independent two-step admin transfer,
following the same pattern already built for `defi-rwa`
(`docs/operations/runbook-role-management.md`). **The three pilot admin roles
are separate on-chain facts.** Rotating admin on `pilot-payout-split` does
not change the admin on `pilot-income-token` or `pilot-whitelist`, and vice
versa. If the same key holds admin on all three (the typical deployment,
per `docs/deployment/deploy-pilot-contracts.md`), rotate all three when that
key is replaced.

See [`docs/strategy/decision-log.md`](../strategy/decision-log.md) ("Pilot
contract admin safety and recoverability") for why admin transfer on
`pilot-payout-split` is gated by the admin alone, not by the operator+ally
two-signer model used for evidence and distribution.

---

## Two-step procedure (identical shape on all three contracts)

Admin transfer is irreversible only once the new admin accepts. Until then,
the current admin retains full control and can cancel at any time.

### Step 1: start transfer (current admin)

```bash
export CONTRACT_ID="<PILOT_WHITELIST | PILOT_INCOME_TOKEN | PILOT_PAYOUT_SPLIT contract ID>"
export ADMIN_ADDRESS="<current admin Stellar public key>"
export NEW_ADMIN_ADDRESS="<new admin Stellar public key>"
export NETWORK="testnet"   # or mainnet, once the pilot is live there

stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- transfer_admin_start \
  --caller $ADMIN_ADDRESS \
  --new_admin $NEW_ADMIN_ADDRESS
```

Verify the pending transfer is recorded:

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- pending_admin
```

**Expected:** returns `$NEW_ADMIN_ADDRESS`. The current admin keeps full
control of the contract at this point; nothing has changed yet for
`require_admin`-gated calls.

### Step 2: accept transfer (new admin, own key)

The new admin must sign this with their own key. This is the only step that
actually moves admin.

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $NEW_ADMIN_ADDRESS \
  --network $NETWORK \
  -- transfer_admin_accept \
  --new_admin $NEW_ADMIN_ADDRESS
```

**Immediately after this call:**

- The old admin loses every privilege on this contract. Any call it makes to
  an admin-gated function (`pause`, `unpause`, `transfer_admin_start`,
  `transfer_admin_cancel`, and the contract-specific admin functions below)
  now fails with `Unauthorized`.
- The new admin has full control.
- `pending_admin` returns nothing (no transfer in progress).

Verify:

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $NEW_ADMIN_ADDRESS \
  --network $NETWORK \
  -- pending_admin
# Expected: no value

# pilot-whitelist and pilot-payout-split expose `admin` directly:
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $NEW_ADMIN_ADDRESS \
  --network $NETWORK \
  -- admin
# Expected: $NEW_ADMIN_ADDRESS

# pilot-income-token also exposes `admin`; verify the same way.
```

> `pilot-payout-split` does not expose a public `admin` getter as of this
> change. Confirm the rotation there by observing that an admin-gated call
> (for example `pause`) now succeeds with the new admin's key and fails with
> the old one's, or by reading the `adminacc` (`AdminTransferAcceptedEvent`)
> event emitted by `transfer_admin_accept`.

### Cancel (current admin, any time before Step 2)

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- transfer_admin_cancel \
  --caller $ADMIN_ADDRESS
```

Clears `pending_admin`. Use this if the new admin's key is not yet confirmed
ready, or the rotation is called off.

---

## Rotating admin on all three pilot contracts together

Run the two-step procedure independently against each contract ID. There is
no cross-contract dependency in the transfer itself, but do them in the same
order the contracts were deployed (`pilot-whitelist`, then
`pilot-income-token`, then `pilot-payout-split`; see
`docs/deployment/deploy-pilot-contracts.md`) so a partially completed
rotation is easy to reason about if it is interrupted.

```bash
for CONTRACT_ID in $PILOT_WHITELIST $PILOT_INCOME_TOKEN $PILOT_PAYOUT_SPLIT; do
  stellar contract invoke \
    --id $CONTRACT_ID \
    --source-account $ADMIN_ADDRESS \
    --network $NETWORK \
    -- transfer_admin_start \
    --caller $ADMIN_ADDRESS \
    --new_admin $NEW_ADMIN_ADDRESS
done
```

Then have the new admin accept on each contract ID in turn with Step 2.

---

## Admin transfer works while a contract is paused

`transfer_admin_start`, `transfer_admin_accept`, and `transfer_admin_cancel`
are deliberately **not** blocked by `pause` on any of the three contracts.
If a compromise is suspected, pause the affected contract first
(`docs/operations/runbook-pilot-emergency-pause.md`), then rotate admin. Do
not wait for an unpause to rotate a suspected-compromised key.

---

## Common errors

| Error                        | Cause                                                              | Fix                                                                 |
| ----------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `Unauthorized`                | Caller of `transfer_admin_start`/`transfer_admin_cancel` is not the current admin | Use the current admin's key                                          |
| `NotPendingAdmin`              | `transfer_admin_accept` called by an address that is not the pending admin, or no transfer is in progress | Confirm `pending_admin` first, and that the accepting key matches it |
| `NotInitialized`               | Contract was never initialized                                     | Confirm the contract ID and that `initialize` ran                    |

---

## Operational security rules

- Rotate admin immediately if the admin key is suspected compromised. Do not
  wait for confirmation of active misuse; `transfer_admin_start` costs
  nothing to run and pausing the affected contract first is the safer
  default.
- Confirm the new admin's key is under the new key holder's control (a
  signed test transaction, not just a public key handed over verbally)
  before calling `transfer_admin_accept`.
- After a completed rotation, revoke any server-side or CI access the old
  admin key had, the same way `docs/operations/runbook-role-management.md`
  recommends for `defi-rwa`.

---

## See also

- [`docs/operations/runbook-pilot-emergency-pause.md`](runbook-pilot-emergency-pause.md)
- [`docs/operations/runbook-pilot-contract-migration.md`](runbook-pilot-contract-migration.md)
- [`docs/operations/runbook-role-management.md`](runbook-role-management.md) - the `defi-rwa` equivalent
- [`docs/strategy/decision-log.md`](../strategy/decision-log.md) - why admin transfer is single-role on `pilot-payout-split`
- [`docs/deployment/deploy-pilot-contracts.md`](../deployment/deploy-pilot-contracts.md)
