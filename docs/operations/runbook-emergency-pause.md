# Runbook: Emergency Pause and Recovery

**Severity:** Critical
**Audience:** On-call operators with `Admin`, `Pauser`, or `EmergencyGuard` role
**Last updated:** See git log

---

## THE MANDATORY WARNING

```
╔══════════════════════════════════════════════════════════════════════╗
║                          READ BEFORE ACTING                          ║
║                                                                      ║
║  Once emergency_pause is triggered, the contract CANNOT be unpaused  ║
║  for a minimum of 24 HOURS.                                          ║
║                                                                      ║
║  There is NO override. There is NO shortcut. The 24-hour timelock    ║
║  is enforced at the protocol level in roles.rs:4 and cannot be       ║
║  bypassed by any key, any role, or any CLI command.                  ║
║                                                                      ║
║  USE THIS ONLY FOR:                                                  ║
║    - Confirmed active exploit draining funds                         ║
║    - Oracle manipulation producing provably wrong prices             ║
║    - Critical vulnerability with imminent risk of loss               ║
║                                                                      ║
║  DO NOT USE FOR:                                                      ║
║    - Elevated error rates without confirmed fund loss                 ║
║    - Temporary service degradation                                    ║
║    - "Something looks weird" without on-chain evidence               ║
║    - Testing or drills on mainnet                                    ║
╚══════════════════════════════════════════════════════════════════════╝
```

**When in doubt: do not pause. Investigate first.**
The cost of a false positive is 24 hours of complete platform downtime.
The cost of a 5-minute investigation is 5 minutes.

---

## Who can trigger a pause

Source: `apps/contracts/contracts/defi-rwa/src/access/admin.rs:92-97`

| Role | Can call `emergency_pause` |
|---|---|
| `Admin` | Yes |
| `Pauser` | Yes |
| `EmergencyGuard` | Yes |
| `Oracle` | No |
| `Verifier` | No |
| `Liquidator` | No |

Only `Admin` can call `schedule_recovery`, `cancel_recovery`, and `execute_recovery`.

---

## Phase 1 — Immediate Pause

### Prerequisites

```bash
# You need:
# 1. Stellar CLI installed and configured
# 2. The signing key for an Admin, Pauser, or EmergencyGuard account
# 3. The contract ID

export CONTRACT_ID="<REAL_ESTATE_TOKEN_CONTRACT_ID from .env>"
export CALLER_ADDRESS="<your Stellar public key>"
export NETWORK="mainnet"   # or testnet
```

### Execute the pause

```bash
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $CALLER_ADDRESS \
  --network $NETWORK \
  --function emergency_pause \
  -- \
  --caller $CALLER_ADDRESS
```

**Expected output:** Transaction hash. No output means the CLI failed before submitting.

### Verify the pause is active

```bash
# Attempt any user operation — it must fail with "Contract paused"
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $CALLER_ADDRESS \
  --network $NETWORK \
  --function purchase_shares \
  -- \
  --buyer $CALLER_ADDRESS \
  --property_id 0 \
  --amount 1 \
  --payment_token $CALLER_ADDRESS

# Expected error: "Contract paused"
# If the call succeeds, the pause did NOT take effect — check the tx hash for failure reason
```

### Immediately after pausing

1. Record the pause transaction hash.
2. Record the current ledger timestamp (`stellar ledger --network $NETWORK`).
3. Page the incident channel. The platform is now completely down.
4. Confirm: Is this the correct response? If not, you cannot undo this for 24 hours.

---

## Phase 2 — Investigation window (0–24 hours)

While the contract is paused:

- All `purchase_shares`, `deposit`, `borrow`, `repay` calls will fail with `"Contract paused"`.
- Admin operations (`mint_shares`, `create_pool`, `set_oracle`, role management) are **not** blocked by the pause.
- Off-chain API endpoints that do not invoke the contract continue to function (KYC, property reads, user management).

Use this window to:

```bash
# Stream all recent contract events to identify the exploit vector
stellar contract events \
  --contract-id $CONTRACT_ID \
  --network $NETWORK \
  --start-ledger <ledger_before_incident>

# Check current oracle address (was it replaced by an attacker?)
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $CALLER_ADDRESS \
  --network $NETWORK \
  --function get_pool \
  -- \
  --pool_id "<your-pool-id>"

# Check admin is still the legitimate key
# If admin was transferred, the attacker controls recovery — escalate immediately
```

---

## Phase 3 — Recovery (24-hour timelock)

Recovery requires three sequential admin-only transactions.

> Only `Admin` can execute these steps. `Pauser` and `EmergencyGuard` cannot initiate recovery.

### Step 3a — Schedule recovery

This starts the 24-hour clock. It can only be called while the contract is paused.

```bash
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function schedule_recovery \
  -- \
  --caller $ADMIN_ADDRESS
```

The contract stores:
- `scheduled_by`: your admin address
- `scheduled_at`: current ledger timestamp
- `earliest_execution`: `scheduled_at + 86400` (seconds)

Record the response. Calculate when recovery can execute:

```bash
# Get current ledger time
stellar ledger --network $NETWORK
# Add 86400 seconds (24 hours) to get earliest_execution timestamp
# Convert: date -d @<earliest_execution_timestamp>
```

**Common errors:**
- `"Contract not paused"` — the contract is not actually paused; verify Phase 1 succeeded.
- `"Recovery already scheduled"` — a prior schedule_recovery already ran; proceed to Step 3c.
- `"Caller not admin"` — you are not using the Admin key; Pauser/EmergencyGuard cannot recover.

### Step 3b — Optional: Cancel recovery

If the incident was resolved during the investigation window and you decide recovery is unsafe or premature, cancel before executing.

```bash
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function cancel_recovery \
  -- \
  --caller $ADMIN_ADDRESS
```

After cancellation, the contract remains paused indefinitely. You must call `schedule_recovery` again to restart the 24-hour clock.

### Step 3c — Execute recovery (after 24 hours)

Only callable after `earliest_execution` timestamp has passed.

```bash
# Verify the timelock has expired before calling
stellar ledger --network $NETWORK
# current_time must be >= earliest_execution

stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function execute_recovery \
  -- \
  --caller $ADMIN_ADDRESS
```

**What this does** (source: `access/emergency.rs:53-67`):
1. Validates `scheduled_by` is present (not cancelled).
2. Validates `current_time >= earliest_execution`. If not: `panic!("Timelock not expired")`.
3. Removes `RoleKey::Paused` from contract storage — contract is live again.
4. Removes `RoleKey::PendingRecovery` — cleanup.
5. Emits `EmergencyEvents::recovery_executed`.

**Common errors:**
- `"No recovery scheduled"` — Step 3a was not executed, or Step 3b cancelled it.
- `"Timelock not expired"` — 24 hours have not passed since `schedule_recovery`; check `earliest_execution`.
- `"Caller not admin"` — wrong signing key.

### Verify the contract is live

```bash
# This should now succeed (not panic with "Contract paused")
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $CALLER_ADDRESS \
  --network $NETWORK \
  --function get_total_shares \
  -- \
  --property_id 0
```

---

## Full recovery timeline

```
T+0:00    emergency_pause called
          └── Contract frozen. All user operations fail.
          └── Start investigation.

T+0:xx    Root cause identified and confirmed mitigated.

T+0:xx    schedule_recovery called (Admin only)
          └── Timelock starts. earliest_execution = T + 24h.
          └── Recovery CANNOT be executed before this point.

T+0:xx    Optional: cancel_recovery if situation changes.

T+24:00   execute_recovery becomes callable.

T+24:xx   execute_recovery called.
          └── Contract unpaused. Users can interact again.
          └── Monitor events closely for 1 hour post-recovery.
```

---

## Post-recovery actions

1. **Verify event stream** — monitor for anomalous activity for at least 1 hour.
2. **Rotate admin key** — if compromise is suspected, use the two-step `transfer_admin_start → transfer_admin_accept` flow.
3. **Re-verify oracle** — confirm the oracle address still points to the legitimate price feed.
4. **Incident report** — document: what triggered the pause, root cause, timeline, remediation.

---

## Reference: contract functions and source locations

| Function | Source | Required role |
|---|---|---|
| `emergency_pause(caller)` | `lib.rs:592` | Admin, Pauser, or EmergencyGuard |
| `schedule_recovery(caller)` | `lib.rs:599` / `emergency.rs:15` | Admin only |
| `cancel_recovery(caller)` | `lib.rs:604` / `emergency.rs:41` | Admin only |
| `execute_recovery(caller)` | `lib.rs:609` / `emergency.rs:53` | Admin only |
| `TIMELOCK_DURATION` | `roles.rs:4` | 86,400 seconds (24 hours) — confirmed final |

> **Note:** Issue #729 (Oracle & Price Guardrails) has been merged. Its scope was limited to oracle consumer logic (`oracle.rs`) and the new `set_oracle_config` / `get_oracle_config` functions. The emergency timelock (`TIMELOCK_DURATION = 86_400`) was **not modified** by that PR and remains 24 hours as a fixed constant.

---

## See also

- `docs/operations/runbook-oracle-failure.md` — oracle-specific incident
- `docs/operations/runbook-role-management.md` — granting/revoking EmergencyGuard
- `docs/operations/runbook-dividends-placeholder.md` — future dividend/cashflow operations (Issue #722)
- `docs/deployment/deploy-contracts.md` — admin key setup
