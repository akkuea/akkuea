# Contract Deployment Guide

This guide covers the complete deployment of the Akkuea smart contracts to Stellar/Soroban networks. Read it fully before executing any command - the order of steps is mandatory.

**Contract source:** `apps/contracts/contracts/defi-rwa/src/lib.rs`
**Output WASM:** `apps/contracts/target/wasm32v1-none/release/rwa_defi_contract.wasm`
**Runtime:** Stellar Soroban (Rust, not EVM/Solidity)

> **Automated deployment:** `scripts/deploy.sh` (run as `bun run deploy:contracts`) performs Steps 1, 2, 3, and 5 of this guide in one command, including the mandatory oracle setup. Read this guide fully anyway: it explains what each step is for, and Step 4 (pools) and Step 6 (API configuration) are always manual.

> **Note on previous documentation:** `docs/contracts/deployment.md` referenced incorrect source paths (`apps/contracts/src/real_estate_token.rs`, `apps/contracts/src/defi_lending.rs`) and a non-existent `scripts/deploy.sh`. Those paths and that script do not exist. This document supersedes that guide.

---

## Architecture overview

Akkuea deploys a **single WASM binary** that contains both the property tokenization and DeFi lending logic. There are not two separate contracts - there is one contract, one contract ID, one deployment.

```
rwa_defi_contract.wasm
└── PropertyTokenContract (lib.rs)
    ├── Share management  (mint_shares, burn_shares, transfer_shares)
    ├── Property purchases (purchase_shares)
    ├── Lending pools      (create_pool, deposit, borrow, repay)
    ├── Access control     (roles, admin transfer)
    └── Emergency controls (pause, schedule_recovery, execute_recovery)
```

---

## Prerequisites

```bash
# 1. Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32v1-none

# 2. Stellar CLI (version 28+)
cargo install --locked stellar-cli

# Verify
stellar --version   # expect: stellar 28.x.x or higher

# 3. A funded Stellar account
# Testnet: use Friendbot (the identity name is required)
stellar keys generate testnet-deployer --network testnet --fund

# Mainnet: add an existing funded key as an identity
# (the CLI prompts for the secret key with --secret-key)
stellar keys add mainnet-deployer --secret-key
```

---

## Step 1 - Build the WASM binary

```bash
cd apps/contracts

stellar contract build
```

This is the repo's canonical build path (see `scripts/build.sh`); do not build with a plain `cargo build --target wasm32-unknown-unknown`, which on recent toolchains emits reference-types sections the Soroban VM rejects.

Verify the output:

```bash
ls -lh target/wasm32v1-none/release/rwa_defi_contract.wasm
# Expected: file exists, size typically around 50 KB
```

If the file is missing, the build failed. Check the `stellar contract build` output for compiler errors.

---

## Step 2 - Deploy the contract

The Soroban CLI `deploy` command uploads the WASM and calls the `__constructor(admin: Address)` in a single atomic transaction. There is no separate `initialize` step.

```bash
# Set your admin address (identity name required; from Prerequisites)
ADMIN_ADDRESS=$(stellar keys address testnet-deployer)

# Deploy to testnet
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/rwa_defi_contract.wasm \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  -- \
  --admin $ADMIN_ADDRESS)

echo "Contract ID: $CONTRACT_ID"
# Save this value - it goes into REAL_ESTATE_TOKEN_CONTRACT_ID
```

For mainnet, replace `--network testnet` with `--network mainnet` and use your imported mainnet identity.

> The `--` separator passes arguments to the constructor (`__constructor`). `$ADMIN_ADDRESS` becomes the on-chain admin. Whoever controls the corresponding secret key controls the entire protocol.

---

## Step 3 - Set the price oracle (MANDATORY before any lending)

> **This step is not optional.** The oracle address must be configured before any `borrow()` call is made. If this step is skipped, every borrow attempt will panic with: `Oracle address not configured` (`oracle.rs:19`).

```bash
# ORACLE_ADDRESS is the Soroban contract ID of a SEP-40 compatible price feed
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  -- \
  set_oracle \
  --oracle_address $ORACLE_ADDRESS \
  --caller $ADMIN_ADDRESS
```

Verify the deployment is responsive by reading back the oracle guardrails:

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  --send=no \
  -- \
  get_oracle_config
# Expected: [3600, "0"] on a fresh deployment (the contract defaults), or
# whatever you set in the next block.
```

Do not use `get_pool` as a health check here: on a contract with no pools yet it traps with `UnreachableCodeReached` rather than returning a "not found" value, which is expected behavior, not a deployment failure.

> **Oracle guardrails (Issue #729 - merged):** The contract rejects price data older than `max_age` seconds. The default is **3600 seconds (1 hour)** (`oracle.rs` - `DEFAULT_MAX_AGE`), but this value is now **configurable per deployment** via `set_oracle_config`. After setting the oracle address, call `set_oracle_config` to tune the staleness threshold and optional price floor for your production environment. See `docs/operations/runbook-oracle-failure.md` for incident response.

After `set_oracle`, configure the guardrail parameters:

```bash
# max_age: maximum price age in seconds (0 = keep default 3600)
# min_price: minimum normalized price floor (0 = disabled)
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  -- \
  set_oracle_config \
  --caller $ADMIN_ADDRESS \
  --max_age 3600 \
  --min_price 0

# Verify the active guardrail values
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  --send=no \
  -- \
  get_oracle_config
# Returns: [max_age, min_price]
```

---

## Step 4 - Create lending pool(s)

Each asset that users can deposit or borrow against requires its own pool. Pools are created by the admin.

```bash
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  -- \
  create_pool \
  -- \
  --admin $ADMIN_ADDRESS \
  --pool_id "xlm-pool-v1" \
  --name "XLM Lending Pool" \
  --asset "XLM" \
  --asset_address $XLM_TOKEN_ADDRESS \
  --collateral_factor 750000000000000000 \
  --liquidation_threshold 800000000000000000 \
  --liquidation_penalty 100000000000000000 \
  --reserve_factor 100
```

Parameter notes:

| Parameter               | Scale        | Example              | Meaning                                                      |
| ----------------------- | ------------ | -------------------- | ------------------------------------------------------------ |
| `collateral_factor`     | 1e18 = 100%  | `750000000000000000` | 75% - borrower can borrow up to 75% of collateral value      |
| `liquidation_threshold` | 1e18 = 100%  | `800000000000000000` | 80% - position liquidatable when debt/collateral exceeds 80% |
| `liquidation_penalty`   | 1e18 = 100%  | `100000000000000000` | 10% - liquidator bonus                                       |
| `reserve_factor`        | basis points | `100`                | 1% of interest goes to protocol reserve                      |

---

## Step 5 - Grant operational roles

Assign roles to operators before opening the platform to users. Role definitions are in `apps/contracts/contracts/defi-rwa/src/access/roles.rs`.

```bash
# Grant EmergencyGuard role to an on-call operator
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  -- \
  grant_emergency_role \
  -- \
  --admin $ADMIN_ADDRESS \
  --target $OPERATOR_ADDRESS

# To grant Pauser role (not exposed as a standalone function - use grant_role if needed)
# See docs/operations/runbook-role-management.md
```

Available roles: `Admin`, `Pauser`, `Oracle`, `Verifier`, `Liquidator`, `EmergencyGuard`

---

## Step 6 - Configure the API

Update `apps/api/.env`:

```bash
REAL_ESTATE_TOKEN_CONTRACT_ID=<value from Step 2>
STELLAR_ADMIN_PUBLIC_KEY=<deployer public key>
STELLAR_ADMIN_SECRET=<deployer secret key>   # see security warning in environment-variables.md
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015   # testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
```

Restart the API:

```bash
cd apps/api
bun run start
```

Verify connectivity:

```bash
curl http://localhost:3001/health
# Expected: {"status":"ok", ...}
```

---

## Post-deployment verification checklist

```bash
# 1. Contract exists on-chain and exposes the expected interface
stellar contract info interface --contract-id $CONTRACT_ID --network testnet

# 2. Admin is set correctly
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  --send=no \
  -- \
  get_balance \
  --property_id 0 \
  --owner $ADMIN_ADDRESS
# Returns 0 - confirms contract is responsive

# 3. Oracle is configured
stellar contract invoke \
  --id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  --send=no \
  -- \
  get_oracle_config
# Returns the configured [max_age, min_price]

# 4. API health
curl http://localhost:3001/health

# 5. Stellar event stream is live
stellar events \
  --id $CONTRACT_ID \
  --network testnet
```

---

## Deployment order dependency map

```
[1] Build WASM
      |
      v
[2] stellar contract deploy  ──────>  CONTRACT_ID
      |
      v
[3] set_oracle  ◄─── REQUIRED before any borrow()
      |
      v
[4] create_pool(s)  ◄─── One per asset
      |
      v
[5] grant_emergency_role  ◄─── Before going live
      |
      v
[6] Update .env + restart API
```

Skipping or reordering Steps 3–5 will result in panics or insecure deployments.

---

## Replacing a deployed contract

The `defi-rwa` contract has **no upgrade entry point**: once deployed, its WASM is immutable on-chain. Fixing a contract-level bug or changing its logic means deploying a new contract and pointing clients at the new ID, deliberately.

1. Build the corrected WASM (Step 1) and deploy it with constructor arguments (Step 2). This produces a new `CONTRACT_ID`.
2. Redo the post-deployment configuration on the new contract: `set_oracle` and `set_oracle_config` (Step 3), pool creation (Step 4), and role grants (Step 5).
3. Update `apps/api/.env` and every client configuration to the new `CONTRACT_ID` (Step 6), and keep the old contract ID documented as retired in `docs/contracts/deployment.md`.

State does not carry over automatically: shares, pools, and positions live in the old contract's storage. Whether and how to migrate existing positions is a product and legal decision to make before deploying, not something this guide can decide. For the pilot's contracts, the full operational procedure is [`docs/operations/runbook-pilot-contract-migration.md`](../operations/runbook-pilot-contract-migration.md), rehearsed on testnet.

---

## Troubleshooting

| Error                                   | Cause                                                                                                  | Fix                                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `Oracle address not configured`         | Step 3 was skipped                                                                                     | Run `set_oracle` before any `borrow()`                                                                           |
| `Price data is stale`                   | Oracle hasn't published within `max_age` seconds (default 3600s, configurable via `set_oracle_config`) | See `docs/operations/runbook-oracle-failure.md`                                                                  |
| `Invalid price: price must be positive` | Oracle returned a zero or negative price                                                               | Investigate oracle feed; consider switching to backup oracle                                                     |
| `Price below minimum threshold`         | Normalized price is below the configured `min_price` floor                                             | Review `set_oracle_config` min_price value or investigate price feed anomaly                                     |
| `pool already exists`                   | `create_pool` called twice with same `pool_id`                                                         | Use a unique `pool_id` per pool                                                                                  |
| `Authorization failed`                  | Wrong signing key or `--source-account` mismatch                                                       | Verify the identity backing `--source-account` holds the key for `$ADMIN_ADDRESS`                                |
| `Insufficient fee`                      | Account balance too low                                                                                | Fund the account; on testnet regenerate with `stellar keys generate <name> --network testnet --fund`             |
| `Contract not found`                    | Wrong `CONTRACT_ID` or wrong `--network`                                                               | Verify both match the deployment target                                                                          |
| `wasm file not found`                   | Build output missing                                                                                   | Re-run `stellar contract build` and check for compile errors                                                     |
| `UnreachableCodeReached` on `get_pool`  | The contract has no pools yet; `get_pool` traps instead of returning a not-found value                 | Expected on a fresh deployment. Create a pool first, or use `get_balance` / `get_oracle_config` as health checks |
