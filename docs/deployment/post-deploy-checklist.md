# Post-Deployment Checklist (Day 0)

Execute these steps in order immediately after `stellar contract deploy` succeeds. Do not open the platform to users until every step is checked off.

**Prerequisites:**
- Contract deployed, `CONTRACT_ID` in hand
- `.env` file updated with `REAL_ESTATE_TOKEN_CONTRACT_ID`
- API server running (`bun run start`)
- Stellar CLI configured for the target network

```bash
# Set these once for the entire session
export CONTRACT_ID="<your deployed contract ID>"
export ADMIN_ADDRESS="<STELLAR_ADMIN_PUBLIC_KEY>"
export NETWORK="mainnet"   # or testnet
```

---

## Step 1 — Contract liveness check

Verify the contract is deployed and responding before doing anything else.

```bash
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function get_total_shares \
  -- \
  --property_id 0
```

**Expected result:** `0` (no shares exist yet)

**If this fails:**
- `"Contract not found"` — wrong `CONTRACT_ID` or wrong `--network`. Verify both.
- `"Authorization failed"` — `ADMIN_ADDRESS` does not match the key in your Stellar CLI config.
- Any panic — the contract binary has an initialization bug. Re-deploy.

- [ ] `get_total_shares` returns `0` without error

---

## Step 2 — Oracle setup (MANDATORY)

> **Do not skip this step.** Without a configured oracle, every `borrow()` call will panic with `"Oracle address not configured"` (`oracle.rs:19`). The oracle must be set before any lending pool is created or advertised to users.

See `docs/deployment/deploy-contracts.md` — Step 3 for full context.

```bash
# ORACLE_ADDRESS: Soroban contract ID of a SEP-40 compatible price feed
export ORACLE_ADDRESS="<SEP-40 oracle contract ID>"

stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function set_oracle \
  -- \
  --oracle_address $ORACLE_ADDRESS \
  --caller $ADMIN_ADDRESS
```

**Verify the oracle is reachable** — attempt a call that traverses the oracle code path:

```bash
# The simplest oracle-path validation is an attempted borrow simulation.
# Since no pools exist yet, this will return "pool not found" — NOT an oracle panic.
# An oracle panic here means set_oracle was not applied.
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function get_pool \
  -- \
  --pool_id "probe"
# Expected: error "pool not found" (not a panic, not "Oracle address not configured")
```

**Oracle staleness rule:** The oracle must publish price updates at least once per hour. The contract rejects prices older than 3600 seconds (`oracle.rs:34`). Confirm your oracle's update frequency before proceeding.

- [ ] `set_oracle` transaction confirmed
- [ ] Probe call returns `"pool not found"`, not an oracle-related panic
- [ ] Oracle update frequency is confirmed to be < 60 minutes

---

## Step 3 — Role assignments

Assign operational roles before any external activity. The role definitions are in `apps/contracts/contracts/defi-rwa/src/access/roles.rs`.

### 3a — EmergencyGuard role

Assign this to every on-call operator who should be able to trigger an emergency pause without needing the Admin key. The Admin key should be kept offline (hardware wallet or HSM) in production — EmergencyGuard enables rapid incident response without exposing it.

```bash
export ONCALL_OPERATOR_ADDRESS="<Stellar public key of on-call operator>"

stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function grant_emergency_role \
  -- \
  --admin $ADMIN_ADDRESS \
  --target $ONCALL_OPERATOR_ADDRESS
```

Repeat for each on-call operator. Recommended minimum: 2 operators (primary + backup).

**Who should receive EmergencyGuard:**
- Primary on-call engineer
- Secondary on-call engineer (backup)
- NOT: automated bots (the 24h timelock means pause is a human decision)
- NOT: external parties or contractors without incident response training

### 3b — Verify admin identity on-chain

Confirm the correct address was recorded as admin during `__constructor`:

```bash
# There is no get_admin view function — verify indirectly:
# Call an admin-only function with a known NON-admin address.
# It must fail with "Caller not admin".

stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ONCALL_OPERATOR_ADDRESS \
  --network $NETWORK \
  --function set_oracle \
  -- \
  --oracle_address $ORACLE_ADDRESS \
  --caller $ONCALL_OPERATOR_ADDRESS
# Expected: error "Caller not admin"
# If this SUCCEEDS, the EmergencyGuard address was accidentally set as admin — investigate immediately.
```

- [ ] EmergencyGuard granted to primary on-call operator
- [ ] EmergencyGuard granted to secondary on-call operator
- [ ] Non-admin call to admin-only function correctly rejected

---

## Step 4 — Create the first lending pool

A pool must exist before users can deposit or borrow. Pools are permanent — there is no delete operation. Choose `pool_id` values carefully; they cannot be reused.

```bash
# Example: XLM lending pool
export POOL_ID="xlm-v1"
export XLM_TOKEN_ADDRESS="<Stellar contract ID for the XLM token on Soroban>"

stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function create_pool \
  -- \
  --admin $ADMIN_ADDRESS \
  --pool_id "$POOL_ID" \
  --name "XLM Lending Pool" \
  --asset "XLM" \
  --asset_address $XLM_TOKEN_ADDRESS \
  --collateral_factor 750000000000000000 \
  --liquidation_threshold 800000000000000000 \
  --liquidation_penalty 100000000000000000 \
  --reserve_factor 100
```

Parameter reference (all rate values use 1e18 = 100%):

| Parameter | Value used | Meaning |
|---|---|---|
| `collateral_factor` | `750000000000000000` | 75%: borrowers can access 75% of collateral value |
| `liquidation_threshold` | `800000000000000000` | 80%: position becomes liquidatable at 80% LTV |
| `liquidation_penalty` | `100000000000000000` | 10%: liquidator bonus on seized collateral |
| `reserve_factor` | `100` | 1% (basis points): protocol fee on interest earned |

**Verify the pool was created:**

```bash
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function get_pool \
  -- \
  --pool_id "$POOL_ID"
# Expected: pool object with is_active: true
```

- [ ] Pool created successfully
- [ ] `get_pool` returns pool with `is_active: true`
- [ ] Pool parameters match intended risk parameters

---

## Step 5 — API integration verification

```bash
# 1. API health endpoint
curl http://localhost:3001/health
# Expected: HTTP 200 with {"status":"ok"} or similar

# 2. Properties endpoint (verifies DB connection)
curl http://localhost:3001/api/properties
# Expected: HTTP 200 with paginated result (empty array is fine)

# 3. KYC status endpoint (verifies DB schema is migrated)
curl http://localhost:3001/kyc/status/00000000-0000-0000-0000-000000000000
# Expected: HTTP 404 "User not found" (not a 500, which would indicate DB issue)
```

- [ ] `/health` returns HTTP 200
- [ ] `/api/properties` returns HTTP 200
- [ ] `/kyc/status/...` returns HTTP 404 (not 500)

---

## Step 6 — Stellar event stream confirmation

Verify on-chain events are being emitted correctly. You should see at least the events from the oracle setup and pool creation steps above.

```bash
stellar contract events \
  --contract-id $CONTRACT_ID \
  --network $NETWORK \
  --start-ledger 1
# Expected: events for pool creation visible in the stream
```

- [ ] Event stream is active and shows pool creation event

---

## Day 0 completion checklist

```
[ ] 1. Contract liveness — get_total_shares returns 0
[ ] 2. Oracle configured — set_oracle confirmed, probe call clean
[ ] 3. Oracle update frequency verified (< 60 min interval)
[ ] 4. EmergencyGuard assigned to primary on-call
[ ] 5. EmergencyGuard assigned to secondary on-call
[ ] 6. Admin identity verified on-chain
[ ] 7. Lending pool created and verified active
[ ] 8. API health check passing
[ ] 9. DB endpoints returning correct status codes
[ ] 10. Event stream confirmed active
```

Do not proceed to user onboarding until all 10 items are checked.

---

## See also

- `docs/deployment/deploy-contracts.md` — full deployment procedure with constructor details
- `docs/deployment/environment-variables.md` — complete `.env` reference
- `docs/operations/runbook-emergency-pause.md` — brief the on-call operators on this before going live
