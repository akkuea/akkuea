# Contract Deployment Guide

This guide covers the complete deployment of the Akkuea smart contracts to Stellar/Soroban networks. Read it fully before executing any command — the order of steps is mandatory.

**Contract source:** `apps/contracts/contracts/defi-rwa/src/lib.rs`
**Output WASM:** `apps/contracts/target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm`
**Runtime:** Stellar Soroban (Rust, not EVM/Solidity)

> **Note on previous documentation:** `docs/contracts/deployment.md` referenced incorrect source paths (`apps/contracts/src/real_estate_token.rs`, `apps/contracts/src/defi_lending.rs`) and a non-existent `scripts/deploy.sh`. Those paths and that script do not exist. This document supersedes that guide.

---

## Architecture overview

Akkuea deploys a **single WASM binary** that contains both the property tokenization and DeFi lending logic. There are not two separate contracts — there is one contract, one contract ID, one deployment.

```
real_estate_defi_contracts.wasm
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
rustup target add wasm32-unknown-unknown

# 2. Stellar CLI (version 21+)
cargo install --locked stellar-cli --features opt

# Verify
stellar --version   # expect: stellar 21.x.x or higher

# 3. A funded Stellar account
# Testnet: use Friendbot
stellar keys generate --network testnet --fund

# Mainnet: import an existing funded key
stellar keys import --name mainnet-deployer
```

---

## Step 1 — Build the WASM binary

```bash
cd akkuea-defi-rwa/apps/contracts

cargo build --target wasm32-unknown-unknown --release
```

Verify the output:

```bash
ls -lh target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm
# Expected: file exists, size typically 100–500 KB
```

If the file is missing, the build failed. Check `cargo build` output for compiler errors.

---

## Step 2 — Deploy the contract

The Soroban CLI `deploy` command uploads the WASM and calls the `__constructor(admin: Address)` in a single atomic transaction. There is no separate `initialize` step.

```bash
# Set your admin address
ADMIN_ADDRESS=$(stellar keys address)   # or specify explicitly

# Deploy to testnet
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  -- \
  --admin $ADMIN_ADDRESS)

echo "Contract ID: $CONTRACT_ID"
# Save this value — it goes into REAL_ESTATE_TOKEN_CONTRACT_ID
```

For mainnet, replace `--network testnet` with `--network mainnet`.

> The `--` separator passes arguments to the constructor (`__constructor`). `$ADMIN_ADDRESS` becomes the on-chain admin. Whoever controls the corresponding secret key controls the entire protocol.

---

## Step 3 — Set the price oracle (MANDATORY before any lending)

> **This step is not optional.** The oracle address must be configured before any `borrow()` call is made. If this step is skipped, every borrow attempt will panic with: `Oracle address not configured` (`oracle.rs:19`).

```bash
# ORACLE_ADDRESS is the Soroban contract ID of a SEP-40 compatible price feed
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  --function set_oracle \
  -- \
  --oracle_address $ORACLE_ADDRESS \
  --caller $ADMIN_ADDRESS
```

Verify the oracle is reachable by checking a known asset price:

```bash
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  --function get_pool \
  -- \
  --pool_id "test"
# If this returns "pool not found" (not a panic), the contract is healthy.
# A panic here signals a deeper initialization problem.
```

> **Oracle guardrails (Issue #729 — merged):** The contract rejects price data older than `max_age` seconds. The default is **3600 seconds (1 hour)** (`oracle.rs` — `DEFAULT_MAX_AGE`), but this value is now **configurable per deployment** via `set_oracle_config`. After setting the oracle address, call `set_oracle_config` to tune the staleness threshold and optional price floor for your production environment. See `docs/operations/runbook-oracle-failure.md` for incident response.

After `set_oracle`, configure the guardrail parameters:

```bash
# max_age: maximum price age in seconds (0 = keep default 3600)
# min_price: minimum normalized price floor (0 = disabled)
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  --function set_oracle_config \
  -- \
  --caller $ADMIN_ADDRESS \
  --max_age 3600 \
  --min_price 0

# Verify the active guardrail values
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  --function get_oracle_config
# Returns: (max_age, min_price) tuple
```

---

## Step 4 — Create lending pool(s)

Each asset that users can deposit or borrow against requires its own pool. Pools are created by the admin.

```bash
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  --function create_pool \
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

| Parameter | Scale | Example | Meaning |
|---|---|---|---|
| `collateral_factor` | 1e18 = 100% | `750000000000000000` | 75% — borrower can borrow up to 75% of collateral value |
| `liquidation_threshold` | 1e18 = 100% | `800000000000000000` | 80% — position liquidatable when debt/collateral exceeds 80% |
| `liquidation_penalty` | 1e18 = 100% | `100000000000000000` | 10% — liquidator bonus |
| `reserve_factor` | basis points | `100` | 1% of interest goes to protocol reserve |

---

## Step 5 — Grant operational roles

Assign roles to operators before opening the platform to users. Role definitions are in `apps/contracts/contracts/defi-rwa/src/access/roles.rs`.

```bash
# Grant EmergencyGuard role to an on-call operator
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  --function grant_emergency_role \
  -- \
  --admin $ADMIN_ADDRESS \
  --target $OPERATOR_ADDRESS

# To grant Pauser role (not exposed as a standalone function — use grant_role if needed)
# See docs/operations/runbook-role-management.md
```

Available roles: `Admin`, `Pauser`, `Oracle`, `Verifier`, `Liquidator`, `EmergencyGuard`

---

## Step 6 — Configure the API

Update `akkuea-defi-rwa/apps/api/.env`:

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
cd akkuea-defi-rwa/apps/api
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
# 1. Contract exists on-chain
stellar contract info $CONTRACT_ID --network testnet

# 2. Admin is set correctly
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  --function get_balance \
  -- \
  --property_id 0 \
  --owner $ADMIN_ADDRESS
# Returns 0 — confirms contract is responsive

# 3. Oracle is configured (no panic)
# Attempt a read that triggers oracle path — any get_pool call suffices.

# 4. API health
curl http://localhost:3001/health

# 5. Stellar event stream is live
stellar contract events \
  --contract-id $CONTRACT_ID \
  --network testnet \
  --follow
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

## Upgrading a deployed contract

Soroban supports WASM upgrades without changing the contract ID:

```bash
# 1. Build new WASM
cargo build --target wasm32-unknown-unknown --release

# 2. Upload new WASM (get hash)
stellar contract upload \
  --wasm target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm \
  --source-account $ADMIN_ADDRESS \
  --network testnet

# 3. Call upgrade on the deployed contract
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $ADMIN_ADDRESS \
  --network testnet \
  --function upgrade \
  -- \
  --new_wasm_hash $NEW_WASM_HASH
```

> No `migrate_data` function exists in the current codebase. If a future upgrade requires data migration, that function must be added to `lib.rs` before deploying the upgrade.

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `Oracle address not configured` | Step 3 was skipped | Run `set_oracle` before any `borrow()` |
| `Price data is stale` | Oracle hasn't published within `max_age` seconds (default 3600s, configurable via `set_oracle_config`) | See `docs/operations/runbook-oracle-failure.md` |
| `Invalid price: price must be positive` | Oracle returned a zero or negative price | Investigate oracle feed; consider switching to backup oracle |
| `Price below minimum threshold` | Normalized price is below the configured `min_price` floor | Review `set_oracle_config` min_price value or investigate price feed anomaly |
| `pool already exists` | `create_pool` called twice with same `pool_id` | Use a unique `pool_id` per pool |
| `Authorization failed` | Wrong signing key or `--source-account` mismatch | Verify `STELLAR_ADMIN_SECRET` matches `ADMIN_ADDRESS` |
| `Insufficient fee` | Account balance too low | Fund account; testnet: `stellar account fund $ADMIN_ADDRESS --network testnet` |
| `Contract not found` | Wrong `CONTRACT_ID` or wrong `--network` | Verify both match the deployment target |
| `wasm file not found` | Build output missing | Re-run `cargo build` and check for compile errors |
