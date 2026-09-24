# Pilot Contract Day-0 Checklist

Execute these steps in order after the pilot contracts are deployed to mainnet
with `scripts/deploy-pilot-contracts.sh`. Do not admit investors or execute
the first distribution until every item is checked off.

**Gate:** Run `./scripts/mainnet-preflight.sh` before anything else. A non-zero
exit stops everything - fix the reported failures first.

```bash
# From the repo root - requires mainnet env vars to be set
./scripts/mainnet-preflight.sh
```

If the script passes, proceed with the steps below.

---

## Prerequisites

```bash
# Set once for the session
export PILOT_WHITELIST="<contract ID from deploy output>"
export PILOT_INCOME_TOKEN="<contract ID from deploy output>"
export PILOT_PAYOUT_SPLIT="<contract ID from deploy output>"
export ADMIN_ADDRESS="<STELLAR_ADMIN_PUBLIC_KEY>"
export OPERATOR_ADDRESS="<production operator key>"
export ALLY_ADDRESS="<production ally key>"
export NETWORK="mainnet"
```

---

## Step 1 - Preflight gate

```bash
./scripts/mainnet-preflight.sh
```

- [ ] Preflight exits 0 with `PREFLIGHT PASSED`

---

## Step 2 - Contract liveness

```bash
stellar contract invoke \
  --id $PILOT_WHITELIST \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- admin
```

Expected: the admin address you set during `initialize`.

```bash
stellar contract invoke \
  --id $PILOT_PAYOUT_SPLIT \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- is_paused
```

Expected: `false`.

- [ ] `whitelist.admin()` returns `$ADMIN_ADDRESS`
- [ ] `payout.is_paused()` returns `false`

---

## Step 3 - Role verification

Confirm operator and ally addresses on the payout-split contract match your
deployment manifest. A `SignerCollision` error here means you deployed with
the same key for both - redeploy before proceeding.

```bash
stellar contract invoke \
  --id $PILOT_PAYOUT_SPLIT \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- operator

stellar contract invoke \
  --id $PILOT_PAYOUT_SPLIT \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- ally
```

- [ ] `payout.operator()` matches `$OPERATOR_ADDRESS`
- [ ] `payout.ally()` matches `$ALLY_ADDRESS`
- [ ] Operator and ally are distinct keys (contract enforces this, verify visually)

---

## Step 4 - Income token wiring

The income token must read the correct whitelist. Verify indirectly: if
`whitelist_contract()` returns the right address, a mint will gate against
the correct approval list.

```bash
stellar contract invoke \
  --id $PILOT_INCOME_TOKEN \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- whitelist_contract
```

Expected: `$PILOT_WHITELIST`

- [ ] `income_token.whitelist_contract()` matches `$PILOT_WHITELIST`
- [ ] `income_token.total_supply()` returns `0` (no shares minted yet - expected at this stage)

---

## Step 5 - Payout split wiring

```bash
stellar contract invoke \
  --id $PILOT_PAYOUT_SPLIT \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- income_token

stellar contract invoke \
  --id $PILOT_PAYOUT_SPLIT \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- whitelist_contract

stellar contract invoke \
  --id $PILOT_PAYOUT_SPLIT \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- usdc_token
```

- [ ] `payout.income_token()` matches `$PILOT_INCOME_TOKEN`
- [ ] `payout.whitelist_contract()` matches `$PILOT_WHITELIST`
- [ ] `payout.usdc_token()` matches the production USDC SAC contract ID

---

## Step 6 - EURC path status

```bash
stellar contract invoke \
  --id $PILOT_PAYOUT_SPLIT \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK \
  -- eurc_swap_path_status
```

Expected: `stubbed-fast-follow` (EURC support is a fast-follow; USDC-only path
ships first). If the EURC path has been enabled, verify the router address
separately.

- [ ] `eurc_swap_path_status` value is understood and matches the intended state

---

## Step 7 - API integration

```bash
curl https://<api-host>/health
curl https://<api-host>/pilot/whitelist/requests
```

- [ ] `/health` returns HTTP 200
- [ ] `/pilot/whitelist/requests` returns HTTP 200 (empty list is fine)
- [ ] API `STELLAR_NETWORK_PASSPHRASE` env var matches the deployed contracts' network (mainnet)

---

## Step 8 - Deployment artifacts recorded

Update `apps/shared/src/contracts.mainnet.json` with the three contract IDs
and add the deployment entry to `docs/contracts/deployment.md` with:

- Network and passphrase used
- Deployer/admin address
- All three contract IDs
- Deploy and init transaction hashes

- [ ] `contracts.mainnet.json` updated and committed
- [ ] `docs/contracts/deployment.md` entry added

---

## Day-0 completion checklist

```
[ ] 1. Preflight script passes (./scripts/mainnet-preflight.sh exits 0)
[ ] 2. whitelist.admin() = expected admin address
[ ] 3. payout.is_paused() = false
[ ] 4. payout.operator() = expected operator address
[ ] 5. payout.ally() = expected ally address
[ ] 6. Operator and ally are distinct keys
[ ] 7. income_token.whitelist_contract() = PILOT_WHITELIST
[ ] 8. payout.income_token() = PILOT_INCOME_TOKEN
[ ] 9. payout.usdc_token() = production USDC SAC contract ID
[ ] 10. API health endpoint returns 200
[ ] 11. Deployment artifacts committed to contracts.mainnet.json
```

Do not proceed to investor onboarding until all 11 items are checked.

---

## See also

- `scripts/mainnet-preflight.sh` - the automated gate this checklist depends on
- `docs/deployment/deploy-pilot-contracts.md` - full deployment walkthrough
- `docs/deployment/environment-variables.md` - complete env var reference
- `docs/architecture/pilot-threat-model.md` - trust model and risk surface for the pilot
