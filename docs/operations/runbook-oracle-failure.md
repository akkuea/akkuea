# Runbook: Oracle Failure and Price Feed Incidents

**Severity:** High — lending operations fully blocked when triggered
**Audience:** On-call operators with `Admin` role
**Related contract source:** `apps/contracts/contracts/defi-rwa/src/lending/oracle.rs`

---

## Symptoms

An oracle incident manifests as one of four panics in the Soroban contract (Issue #729 merged — `oracle.rs` updated):

| Panic message | Location | Meaning |
|---|---|---|
| `"Oracle address not configured"` | `oracle.rs` — `get_oracle_address` | `set_oracle` was never called, or the oracle address was wiped |
| `"Price not available for asset"` | `oracle.rs` — `get_price` | Oracle returned `None` for the requested asset |
| `"Invalid price: price must be positive"` | `oracle.rs` — `get_price` | Oracle returned a zero or negative raw price |
| `"Price data is stale"` | `oracle.rs` — `get_price` | Price timestamp exceeds the configured `max_age` threshold |
| `"Price below minimum threshold"` | `oracle.rs` — `get_price` | Normalized price is below the configured `min_price` floor |

All five panics terminate every `borrow()` call. `deposit()`, `withdraw()`, and `repay()` are **not** affected — existing depositors and borrowers can still exit positions. Only new borrowing is blocked.

> **Issue #729 — merged.** The staleness threshold is now **configurable** via `set_oracle_config(caller, max_age, min_price)`. The default is `DEFAULT_MAX_AGE = 3600` seconds if `set_oracle_config` has not been called. Run `get_oracle_config()` on your deployed contract to confirm the active values before citing any specific threshold in an incident report.

---

## Phase 1 — Triage (first 5 minutes)

### 1. Confirm the panic type

```bash
# Attempt a borrow call to surface the exact error message
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function borrow \
  -- \
  --borrower $ADMIN_ADDRESS \
  --pool_id "<your-pool-id>" \
  --amount 1 \
  --collateral_asset $SOME_ASSET \
  --collateral_amount 1
```

Read the error:
- `"Oracle address not configured"` → go to **Scenario A**
- `"Price not available for asset"` → go to **Scenario B1** (oracle outage)
- `"Invalid price: price must be positive"` → go to **Scenario C** (bad price feed)
- `"Price data is stale"` → go to **Scenario B** (staleness)
- `"Price below minimum threshold"` → go to **Scenario C** (price floor breach)
- Any other error → oracle is not the root cause; check pool status and contract pause state

### 2. Check active guardrail configuration

```bash
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function get_oracle_config
# Returns: (max_age_seconds, min_price_normalized)
# Example: (3600, 0) = default staleness, no price floor active
```

Keep this output in your incident notes — it tells you the exact thresholds the contract is enforcing.

### 2. Check oracle address on-chain

There is no `get_oracle` view function exposed at the contract level. Verify by checking the oracle event history:

```bash
stellar contract events \
  --contract-id $CONTRACT_ID \
  --network $NETWORK \
  --start-ledger <ledger-at-deployment>
# Look for set_oracle invocation events
```

---

## Scenario A — Oracle address not configured

### Cause

`set_oracle` was not called after deployment (Step 3 skipped in `docs/deployment/deploy-contracts.md`), or the oracle address was accidentally overwritten with a zero/invalid address.

### Resolution

Call `set_oracle` with the correct SEP-40 oracle contract ID:

```bash
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function set_oracle \
  -- \
  --oracle_address $ORACLE_ADDRESS \
  --caller $ADMIN_ADDRESS
```

### Verify

```bash
# Retry the borrow probe — it should now fail with a different error
# (e.g., "pool not found" or collateral validation) rather than oracle errors
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function get_pool \
  -- \
  --pool_id "<your-pool-id>"
# Expected: pool object returned (no oracle panic)
```

---

## Scenario B — Price data is stale

### Decision tree

```
Price data is stale
        |
        ├── Is oracle provider experiencing an outage?
        │         |
        │    YES  └─── [B1] Wait and monitor — do not pause unless exploit confirmed
        │         |
        │    NO   └─── Is the oracle address pointing to the correct contract?
        │                     |
        │                YES  └─── [B2] Oracle is publishing but contract disagrees
        │                     |         (clock skew, timestamp format bug)
        │                NO   └─── [B3] Oracle address was changed — possible exploit
        │                          → Escalate immediately, consider emergency pause
```

### B1 — Oracle provider outage (most common case)

1. Confirm the outage with the oracle provider.
2. Monitor the event stream for price publication resumption.
3. No contract action required — once the oracle publishes a fresh price, `borrow()` resumes automatically.
4. If the outage exceeds 2 hours and the protocol has active liquidatable positions, consider calling `emergency_pause` to prevent undercollateralized borrowing from continuing. See `docs/operations/runbook-emergency-pause.md`.

```bash
# Monitor oracle's last published timestamp
# (requires direct call to the SEP-40 oracle contract)
stellar contract invoke \
  --contract-id $ORACLE_ADDRESS \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function lastprice \
  -- \
  --asset "<asset-identifier>"
# Check the `timestamp` field in the response
```

### B2 — Oracle publishing but contract rejects it

Check the raw price data returned by the oracle:

```bash
stellar contract invoke \
  --contract-id $ORACLE_ADDRESS \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function lastprice \
  -- \
  --asset "<asset-identifier>"
```

Compare the `timestamp` field against the current ledger time:

```bash
stellar ledger --network $NETWORK
# current_time - oracle_timestamp must be < staleness_threshold (currently 3600s)
```

If the difference is within threshold but the contract still panics, this indicates a potential clock skew or timestamp normalization bug. Open an incident investigation ticket and monitor for recurrence. Do not pause for this scenario unless fund loss is confirmed.

### B3 — Oracle address changed without authorization

If `set_oracle` events appear in the contract history that were not issued by your admin key, treat this as a **critical security incident**:

1. **Immediately call `emergency_pause`** — do not wait. An attacker controlling the oracle can set arbitrary prices to drain all collateral via liquidation.
2. Follow `docs/operations/runbook-emergency-pause.md` from Phase 1.
3. After pausing, use the 24-hour investigation window to confirm the oracle address change.
4. During recovery, call `set_oracle` to point back to the legitimate oracle before executing recovery.

```bash
# Pause immediately
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function emergency_pause \
  -- \
  --caller $ADMIN_ADDRESS

# Then re-point oracle during investigation window (does not require unpausing)
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function set_oracle \
  -- \
  --oracle_address $LEGITIMATE_ORACLE_ADDRESS \
  --caller $ADMIN_ADDRESS
```

---

## Switching to a backup oracle

If the primary oracle is permanently unavailable, `set_oracle` can be called to point to an alternative SEP-40-compatible price feed without pausing the contract:

```bash
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function set_oracle \
  -- \
  --oracle_address $BACKUP_ORACLE_ADDRESS \
  --caller $ADMIN_ADDRESS
```

After switching, re-apply your guardrail configuration, as the backup oracle may have different update frequency characteristics:

```bash
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function set_oracle_config \
  -- \
  --caller $ADMIN_ADDRESS \
  --max_age <backup-oracle-update-interval-seconds> \
  --min_price 0

# Confirm active config
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function get_oracle_config
```

Verify the backup oracle returns prices with `decimals()` and `lastprice()` responses compatible with the contract's decimal normalization logic (`oracle.rs` — `normalize_price`). A backup oracle with unexpected decimal precision will cause price scaling errors in borrow health factor calculations.

## Adjusting guardrail parameters (non-incident)

To tune `max_age` or `min_price` outside of an incident (e.g., after the oracle provider changes their update frequency):

```bash
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function set_oracle_config \
  -- \
  --caller $ADMIN_ADDRESS \
  --max_age 1800 \
  --min_price 1000000000000000

# Verify
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  --function get_oracle_config
# Expected: (1800, 1000000000000000)
```

`max_age = 0` in the call preserves the current value. `min_price = 0` disables the floor check entirely.

---

## Post-incident actions

1. Document: which scenario occurred, how long borrowing was blocked, whether any liquidatable positions were opened during the outage.
2. If outage lasted more than 30 minutes: review open borrow positions for health factor degradation.
3. Update the oracle provider contact procedures with lessons from the response.
4. Review `get_oracle_config()` output and confirm `max_age` and `min_price` are correctly set for the current oracle provider's update frequency.

---

## Reference

| Item | Source | Notes |
|---|---|---|
| `set_oracle(oracle_address, caller)` | `lib.rs` | Sets SEP-40 oracle address. Admin only |
| `set_oracle_config(caller, max_age, min_price)` | `lib.rs` | Configures staleness threshold and price floor. Admin only. `max_age=0` preserves current value |
| `get_oracle_config()` | `lib.rs` | Returns `(max_age, min_price)` tuple — use to confirm active guardrail values |
| `DEFAULT_MAX_AGE` | `oracle.rs` | `3600` seconds — applied when `set_oracle_config` has never been called |
| `"Oracle address not configured"` | `oracle.rs` — `get_oracle_address` | `set_oracle` not called post-deploy |
| `"Price not available for asset"` | `oracle.rs` — `get_price` | Oracle returned `None` |
| `"Invalid price: price must be positive"` | `oracle.rs` — `get_price` | Raw price ≤ 0 |
| `"Price data is stale"` | `oracle.rs` — `get_price` | Age exceeds `max_age` |
| `"Price below minimum threshold"` | `oracle.rs` — `get_price` | Normalized price < `min_price` |
| Affected operations | All | `borrow()` only — `deposit`, `withdraw`, `repay` unaffected |

---

## See also

- `docs/operations/runbook-emergency-pause.md` — if oracle manipulation confirms active exploit
- `docs/deployment/deploy-contracts.md` — Step 3: oracle setup including `set_oracle_config`
- `docs/deployment/post-deploy-checklist.md` — Step 2: oracle verification at launch
