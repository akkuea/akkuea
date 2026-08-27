# Pilot Contract Deployment Guide

This guide covers deployment of the Cycle 6 pilot contract set:
`pilot-whitelist`, `pilot-income-token`, and `pilot-payout-split`.

**Contract sources:**

- `apps/contracts/contracts/pilot-whitelist/src/lib.rs`
- `apps/contracts/contracts/pilot-income-token/src/lib.rs`
- `apps/contracts/contracts/pilot-payout-split/src/lib.rs`

**Output WASM files:**

- `apps/contracts/target/wasm32v1-none/release/pilot_whitelist.wasm`
- `apps/contracts/target/wasm32v1-none/release/pilot_income_token.wasm`
- `apps/contracts/target/wasm32v1-none/release/pilot_payout_split.wasm`

**Runtime:** Stellar Soroban.

---

## Architecture Overview

The pilot is intentionally independent from `defi-rwa`.

```text
pilot-whitelist
  stores approved/not-approved investor addresses

pilot-income-token
  mints a fixed, non-transferable income-participation supply
  reads pilot-whitelist at mint time

pilot-payout-split
  stores monthly evidence hash/link records
  requires operator + ally auth to approve income cycles
  distributes USDC: 10% platform fee, 90% pro-rata to token holders
  reads pilot-income-token and pilot-whitelist at payout time
  one-way exit state (operator + ally): permanently blocks evidence
  recording and distribution; exit_status() exposes reason and timestamp
```

The pilot also carries a terminal wind-down marker on `pilot-income-token`
(`mark_wound_down`, admin-only, one-way; `wound_down_status()` to read it),
mirroring the payout-split exit state so either contract can be read
independently for a consistent picture. No fund-recovery or unwind logic
exists in either contract; that question remains open (Known Risk #5 in the
product brief).

The deployment order is mandatory:

```text
pilot-whitelist
  |
  v
pilot-income-token
  |
  v
pilot-payout-split
```

---

## Prerequisites

```bash
rustup target add wasm32v1-none
stellar --version
```

For testnet, have one funded deployer identity:

```bash
stellar keys generate pilot-deployer --network testnet --fund
stellar keys address pilot-deployer
```

You also need:

- Operator public address.
- Ally public address. It must be distinct from the operator address.
- Platform fee recipient public address.
- USDC SAC contract ID for the target network.

Never commit secret keys or `.env` files.

---

## Step 1 - Build

```bash
cd apps/contracts
stellar contract build
```

Verify the three WASM outputs exist:

```bash
ls -lh target/wasm32v1-none/release/pilot_whitelist.wasm
ls -lh target/wasm32v1-none/release/pilot_income_token.wasm
ls -lh target/wasm32v1-none/release/pilot_payout_split.wasm
```

---

## Step 2 - Deploy And Initialize

Use the helper script from the repository root:

```bash
./scripts/deploy-pilot-contracts.sh \
  testnet \
  pilot-deployer \
  $OPERATOR_ADDRESS \
  $ALLY_ADDRESS \
  $PLATFORM_FEE_RECIPIENT \
  $USDC_TOKEN_CONTRACT_ID
```

The script:

1. Builds with `stellar contract build`.
2. Deploys all three WASMs.
3. Initializes `pilot-whitelist` with the deployer as admin.
4. Initializes `pilot-income-token` with the whitelist contract ID.
5. Initializes `pilot-payout-split` with admin, operator, ally, fee recipient, income token, whitelist, and USDC contract IDs.

---

## Step 3 - Verify Contract Health

Check the whitelist admin:

```bash
stellar contract invoke \
  --id $PILOT_WHITELIST \
  --source-account pilot-deployer \
  --network testnet \
  -- admin
```

Check token metadata:

```bash
stellar contract invoke \
  --id $PILOT_INCOME_TOKEN \
  --source-account pilot-deployer \
  --network testnet \
  -- name

stellar contract invoke \
  --id $PILOT_INCOME_TOKEN \
  --source-account pilot-deployer \
  --network testnet \
  -- total_supply
```

Check payout state:

```bash
stellar contract invoke \
  --id $PILOT_PAYOUT_SPLIT \
  --source-account pilot-deployer \
  --network testnet \
  -- is_paused

stellar contract invoke \
  --id $PILOT_PAYOUT_SPLIT \
  --source-account pilot-deployer \
  --network testnet \
  -- eurc_swap_path_status
```

Expected:

- `is_paused` returns `false`.
- `eurc_swap_path_status` returns `stubbed-fast-follow`.

---

## Step 4 - Approve Investors And Mint Fixed Supply

Approve each investor on the whitelist:

```bash
stellar contract invoke \
  --id $PILOT_WHITELIST \
  --source-account pilot-deployer \
  --network testnet \
  -- approve \
  --admin $ADMIN_ADDRESS \
  --address $INVESTOR_ADDRESS
```

Mint once to the approved holder set:

```bash
stellar contract invoke \
  --id $PILOT_INCOME_TOKEN \
  --source-account pilot-deployer \
  --network testnet \
  -- mint_fixed_supply \
  --admin $ADMIN_ADDRESS \
  --holders '["G...","G...","G...","G...","G..."]' \
  --amounts '[100,250,400,750,1500]'
```

The mint is one-time only. If a mistake is made, redeploy for testnet or use the admin-only correction transfer according to the operational decision for that test cycle.

---

## Step 5 - Record Evidence

Both the operator and ally must authorize `record_evidence`. In production, construct and sign a Soroban transaction with both required signers.

```bash
stellar contract invoke \
  --id $PILOT_PAYOUT_SPLIT \
  --source-account pilot-deployer \
  --network testnet \
  -- record_evidence \
  --operator $OPERATOR_ADDRESS \
  --ally $ALLY_ADDRESS \
  --cycle_id "2026-08" \
  --evidence_hash <32-byte-hash> \
  --evidence_link "ipfs://..." \
  --total_income 10000000
```

The contract stores only the hash and link, never the underlying file.

---

## Step 6 - Fund And Execute Distribution

Fund the payout-split contract with at least `total_income` USDC before execution.

Then execute:

```bash
stellar contract invoke \
  --id $PILOT_PAYOUT_SPLIT \
  --source-account pilot-deployer \
  --network testnet \
  -- execute_distribution \
  --cycle_id "2026-08"
```

The contract:

- Sends 10% to `platform_fee_recipient`.
- Sends 90% pro-rata to current income token holders.
- Rejects any holder no longer approved in the whitelist.
- Marks the cycle distributed so it cannot execute twice.

Integer pro-rata dust remains in the payout contract and is reported in the returned `DistributionSummary`.

The checked invocation-budget test covers `execute_distribution` with 10 holders. Larger holder sets should be tested before mainnet if the pilot cap increases.

---

## Step 7 - Record Deployment Artifacts

Update `apps/shared/src/contracts.testnet.json`:

```json
{
  "contracts": {
    "PILOT_WHITELIST": "C...",
    "PILOT_INCOME_TOKEN": "C...",
    "PILOT_PAYOUT_SPLIT": "C..."
  }
}
```

Also add the deployment table to `docs/contracts/deployment.md` with:

- Network and passphrase.
- Deployer/admin account.
- Contract IDs.
- Deploy/init transaction hashes when available.
- Stellar Expert links.

---

## Troubleshooting

| Error                       | Cause                                   | Fix                                                                         |
| --------------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| `InvalidEvidenceHash`       | Evidence hash is not exactly 32 bytes   | Hash the retained evidence file with a 32-byte digest and submit that value |
| `ZeroAmount`                | `total_income` is zero or negative      | Submit a positive USDC amount                                               |
| `CycleAlreadyRecorded`      | Evidence already exists for the cycle   | Use a new cycle ID or redeploy in testnet                                   |
| `CycleAlreadyDistributed`   | Distribution was already executed       | Do not retry the same cycle                                                 |
| `RecipientNotApproved`      | A token holder is no longer whitelisted | Resolve the whitelist status before payout                                  |
| `InsufficientPayoutBalance` | Payout contract lacks USDC              | Fund the payout contract with at least `total_income`                       |
| `ContractPaused`            | Admin paused the payout contract        | Investigate and unpause only after the incident is resolved                 |
| `SignerCollision`           | Operator and ally are the same address  | Re-initialize a fresh deployment with distinct signer addresses             |
| `Authorization failed`      | Operator and ally did not both sign     | Rebuild the transaction with both required Soroban auth entries             |
