# Runbook: Role Management

**Audience:** Platform admin
**Required key:** `STELLAR_ADMIN_SECRET` (Admin role on-chain)
**Contract source:** `apps/contracts/contracts/defi-rwa/src/access/roles.rs`, `lib.rs:614-624`

---

## Role definitions

All roles are defined in `apps/contracts/contracts/defi-rwa/src/access/roles.rs:8-21`.

| Role | On-chain constant | Capabilities |
|---|---|---|
| `Admin` | `Role::Admin` | All operations. Set at deployment, transferred via two-step procedure |
| `Pauser` | `Role::Pauser` | Call `emergency_pause`, `pause`, `unpause` |
| `EmergencyGuard` | `Role::EmergencyGuard` | Call `emergency_pause` only |
| `Oracle` | `Role::Oracle` | Reserved — not enforced in current contract functions |
| `Verifier` | `Role::Verifier` | Reserved — not enforced in current contract functions |
| `Liquidator` | `Role::Liquidator` | Reserved — not enforced in current contract functions |

> **Note:** Only `Admin` and `EmergencyGuard` have callable contract functions exposed in the current `lib.rs`. `Pauser`, `Oracle`, `Verifier`, and `Liquidator` are defined in the roles enum and stored correctly by `RoleStorage`, but no public contract functions specifically gate on them today (as of the current `lib.rs`). Assign them for future use when those functions are implemented.

---

## Granting the EmergencyGuard role

`EmergencyGuard` is the only non-admin role with a dedicated grant function exposed at the contract level (`lib.rs:614`).

```bash
export CONTRACT_ID="<REAL_ESTATE_TOKEN_CONTRACT_ID>"
export ADMIN_ADDRESS="<STELLAR_ADMIN_PUBLIC_KEY>"
export TARGET_ADDRESS="<operator Stellar public key>"
export NETWORK="mainnet"   # or testnet

stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function grant_emergency_role \
  -- \
  --admin $ADMIN_ADDRESS \
  --target $TARGET_ADDRESS
```

**Expected:** Transaction confirmed. The operator can now call `emergency_pause`.

### Verify the grant

```bash
# Attempt emergency_pause with the operator key — if it succeeds, the role is active.
# WARNING: Only run this on testnet. On mainnet this pauses the contract for 24 hours.
# On testnet:
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $TARGET_ADDRESS \
  --network testnet \
  --function emergency_pause \
  -- \
  --caller $TARGET_ADDRESS
# Expected: transaction succeeds (contract is now paused on testnet)
# Then schedule_recovery + execute_recovery to clean up the testnet state
```

---

## Revoking the EmergencyGuard role

```bash
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function revoke_emergency_role \
  -- \
  --admin $ADMIN_ADDRESS \
  --target $TARGET_ADDRESS
```

Run this immediately when an operator leaves the on-call rotation or their key is suspected compromised.

---

## Transferring admin (two-step procedure)

Admin transfer is irreversible until the new admin accepts. The two-step design (`admin.rs:46-75`) prevents accidental lockout.

### Step 1 — Start transfer (current admin initiates)

```bash
export NEW_ADMIN_ADDRESS="<new admin Stellar public key>"

stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function transfer_admin_start \
  -- \
  --caller $ADMIN_ADDRESS \
  --new_admin $NEW_ADMIN_ADDRESS
```

After this call, `new_admin` is recorded as pending. The current admin retains full control until Step 2.

### Step 2 — Accept transfer (new admin confirms)

The new admin must sign this transaction with their own key:

```bash
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $NEW_ADMIN_ADDRESS \
  --network $NETWORK \
  --function transfer_admin_accept \
  -- \
  --new_admin $NEW_ADMIN_ADDRESS
```

After this call:
- Old admin role is revoked.
- New admin role is granted.
- Pending admin record is cleared.

### Cancel transfer (if needed before Step 2)

The current admin can abort at any point before `transfer_admin_accept` is called:

```bash
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function transfer_admin_cancel \
  -- \
  --caller $ADMIN_ADDRESS
```

---

## Recommended role assignments at launch

| Role | Assign to | Notes |
|---|---|---|
| `Admin` | Hardware wallet or multisig account | Keep offline. Used only for pool creation, oracle setup, role management |
| `EmergencyGuard` | Primary on-call engineer | Can pause without exposing Admin key |
| `EmergencyGuard` | Secondary on-call engineer | Backup pauser |
| `Pauser` | Not assigned at launch | Only assign if a dedicated pause-only operator is required |

---

## Operational security rules

- The Admin key should never be stored in `.env` on a live server longer than needed for a specific operation. After each admin operation, rotate or revoke server-side access.
- EmergencyGuard holders should use a dedicated key — not their personal development key — to limit blast radius if the key is compromised.
- When an on-call engineer rotates off, immediately revoke their EmergencyGuard role and grant it to the incoming engineer before the rotation completes.
- Never grant EmergencyGuard to automated systems. The 24-hour pause consequence means this must be a human decision.

---

## See also

- `docs/operations/runbook-emergency-pause.md` — what EmergencyGuard holders can and cannot do
- `docs/deployment/deploy-contracts.md` — Step 5: initial role grants at deployment
- `docs/deployment/post-deploy-checklist.md` — Step 3: Day 0 role assignment verification
