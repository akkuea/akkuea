# Game Contracts Deployment Instructions

Complete guide to deploy the four Akkuea Land game contracts to Stellar testnet.

## Overview

This document covers the actual deployment process for issue #847. All four game contracts have been created and are ready to deploy.

**Contracts Created:**

- ✅ GameLandToken (`game-land-token`)
- ✅ GamePropertyNFT (`game-property-nft`)
- ✅ GameMarketplace (`game-marketplace`)
- ✅ GameEngine (`game-engine`)

**Deployment Order** (dependency-based):

1. GameLandToken (no dependencies)
2. GamePropertyNFT (no dependencies)
3. GameMarketplace (depends on 1 & 2)
4. GameEngine (depends on 1, 2, & 3)

## Prerequisites

Before deployment, ensure you have:

- [ ] **Stellar CLI 21.0.0+** - `stellar --version`
- [ ] **Rust with WASM target** - `rustup target list | grep wasm32`
- [ ] **Stellar testnet account with XLM** - Use [Friendbot](https://laboratory.stellar.org/#account-creator)
- [ ] **Environment variables set:**
  ```bash
  export STELLAR_ADMIN_SECRET_KEY="your_secret_key"
  export STELLAR_ADMIN_PUBLIC_KEY="your_public_key"
  ```
- [ ] **Cargo** - `cargo --version`

### Generate Testnet Account

If you don't have a testnet account:

```bash
# Generate keypair
stellar keys generate --network testnet

# Fund from Friendbot
# Visit: https://laboratory.stellar.org/#account-creator
# Or use: curl "https://friendbot.stellar.org?addr=GXXXXX"
```

## Step 1: Build WASM Artifacts

### Build All Contracts

```bash
cd apps/contracts

# Build release version (takes 2-5 minutes first time)
cargo build --target wasm32-unknown-unknown --release

# Check output
ls -la target/wasm32-unknown-unknown/release/*.wasm
```

**Expected output:**

```
game_land_token.wasm           (XX KB)
game_property_nft.wasm         (XX KB)
game_marketplace.wasm          (XX KB)
game_engine.wasm               (XX KB)
```

### Troubleshooting Build Issues

**On Windows:** Missing MSVC linker?

- See [docs/game/BUILD_CONTRACTS_WINDOWS.md](../docs/game/BUILD_CONTRACTS_WINDOWS.md)
- Install Visual Studio Build Tools
- Reinstall Rust toolchain

**Out of memory?**

```bash
# Build one contract at a time
cargo build --target wasm32-unknown-unknown --release -p game-land-token
cargo build --target wasm32-unknown-unknown --release -p game-property-nft
cargo build --target wasm32-unknown-unknown --release -p game-marketplace
cargo build --target wasm32-unknown-unknown --release -p game-engine
```

## Step 2: Deploy Contracts

### Option A: Automated Deployment (Recommended)

**On Linux/macOS:**

```bash
./scripts/deploy-game-contracts.sh testnet
```

**On Windows (PowerShell):**

```powershell
.\scripts\Deploy-GameContracts.ps1 -Network testnet
```

The script will:

1. Build contracts
2. Deploy in dependency order
3. Initialize each contract
4. Verify with read-only calls
5. Output contract IDs
6. Update configuration file

### Option B: Manual Deployment

If the script doesn't work, deploy manually step-by-step:

#### Deploy GameLandToken

```bash
# Set variables for reuse
export NETWORK=testnet
export ADMIN=$(stellar keys show your-account --public-key)

# Deploy contract
TOKEN_ID=$(stellar contract deploy \
  --network $NETWORK \
  --source your-account \
  --wasm target/wasm32-unknown-unknown/release/game_land_token.wasm)

echo "GameLandToken ID: $TOKEN_ID"

# Initialize with admin
stellar contract invoke \
  --network $NETWORK \
  --source your-account \
  --contract-id $TOKEN_ID \
  --function initialize \
  --arg "$ADMIN"

# Verify
stellar contract invoke \
  --network $NETWORK \
  --source your-account \
  --contract-id $TOKEN_ID \
  --function total_supply
```

#### Deploy GamePropertyNFT

```bash
# Deploy contract
NFT_ID=$(stellar contract deploy \
  --network $NETWORK \
  --source your-account \
  --wasm target/wasm32-unknown-unknown/release/game_property_nft.wasm)

echo "GamePropertyNFT ID: $NFT_ID"

# Initialize: mint all properties to admin/treasury
# Note: Use admin address for both treasury and game_engine (we'll update later)
stellar contract invoke \
  --network $NETWORK \
  --source your-account \
  --contract-id $NFT_ID \
  --function initialize \
  --arg "$ADMIN" \
  --arg "$ADMIN"

# Verify: Check property 0 owner
stellar contract invoke \
  --network $NETWORK \
  --source your-account \
  --contract-id $NFT_ID \
  --function get_owner \
  --arg 0
```

#### Deploy GameMarketplace

```bash
# Deploy contract
MARKETPLACE_ID=$(stellar contract deploy \
  --network $NETWORK \
  --source your-account \
  --wasm target/wasm32-unknown-unknown/release/game_marketplace.wasm)

echo "GameMarketplace ID: $MARKETPLACE_ID"

# Initialize with token and NFT contract IDs
stellar contract invoke \
  --network $NETWORK \
  --source your-account \
  --contract-id $MARKETPLACE_ID \
  --function initialize \
  --arg "$TOKEN_ID" \
  --arg "$NFT_ID"

# Verify
stellar contract invoke \
  --network $NETWORK \
  --source your-account \
  --contract-id $MARKETPLACE_ID \
  --function get_listing \
  --arg 0
```

#### Deploy GameEngine

```bash
# Deploy contract
ENGINE_ID=$(stellar contract deploy \
  --network $NETWORK \
  --source your-account \
  --wasm target/wasm32-unknown-unknown/release/game_engine.wasm)

echo "GameEngine ID: $ENGINE_ID"

# Initialize with all dependencies
stellar contract invoke \
  --network $NETWORK \
  --source your-account \
  --contract-id $ENGINE_ID \
  --function initialize \
  --arg "$ADMIN" \
  --arg "$TOKEN_ID" \
  --arg "$NFT_ID"

# Verify
stellar contract invoke \
  --network $NETWORK \
  --source your-account \
  --contract-id $ENGINE_ID \
  --function get_improvement_cost \
  --arg 0
```

## Step 3: Record Contract IDs

Update [apps/shared/src/contracts/game-contracts.testnet.json](../apps/shared/src/contracts/game-contracts.testnet.json):

```json
{
  "contracts": {
    "game_land_token": {
      "contract_id": "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "verified": true
    },
    "game_property_nft": {
      "contract_id": "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "verified": true
    },
    "game_marketplace": {
      "contract_id": "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "verified": true
    },
    "game_engine": {
      "contract_id": "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
      "verified": true
    }
  }
}
```

## Step 4: Verification

### Verify All Contracts

Each contract should respond to read-only function calls:

```bash
# 1. GameLandToken - Check total supply
stellar contract invoke \
  --network testnet \
  --source your-account \
  --contract-id $TOKEN_ID \
  --function total_supply
# Expected: 0 (no supply initially)

# 2. GamePropertyNFT - Check property 0 owner
stellar contract invoke \
  --network testnet \
  --source your-account \
  --contract-id $NFT_ID \
  --function get_owner \
  --arg 0
# Expected: Returns your admin address

# 3. GameMarketplace - Check non-existent listing
stellar contract invoke \
  --network testnet \
  --source your-account \
  --contract-id $MARKETPLACE_ID \
  --function get_listing \
  --arg 0
# Expected: None or error (listing doesn't exist yet)

# 4. GameEngine - Check improvement cost
stellar contract invoke \
  --network testnet \
  --source your-account \
  --contract-id $ENGINE_ID \
  --function get_improvement_cost \
  --arg 0
# Expected: 200000000 (200 LAND with 7 decimals)
```

### Verification Checklist

- [ ] All four contract IDs start with 'C'
- [ ] All contracts respond to read-only calls
- [ ] Token total_supply = 0
- [ ] Property 0 owner = admin address
- [ ] Marketplace lists can be queried
- [ ] Engine costs are correct (200000000 for level 0→1)
- [ ] No errors in responses
- [ ] Contract IDs saved in game-contracts.testnet.json

## Step 5: Update Environment

Update `.env` with contract IDs:

```bash
# .env
GAME_LAND_TOKEN_CONTRACT_ID=C...
GAME_PROPERTY_NFT_CONTRACT_ID=C...
GAME_MARKETPLACE_CONTRACT_ID=C...
GAME_ENGINE_CONTRACT_ID=C...
```

Update `.env.local` in API and webapp:

```bash
# apps/api/.env.local
GAME_LAND_TOKEN_CONTRACT_ID=C...
GAME_PROPERTY_NFT_CONTRACT_ID=C...
GAME_MARKETPLACE_CONTRACT_ID=C...
GAME_ENGINE_CONTRACT_ID=C...

# apps/webapp/.env.local
NEXT_PUBLIC_GAME_LAND_TOKEN_CONTRACT_ID=C...
NEXT_PUBLIC_GAME_PROPERTY_NFT_CONTRACT_ID=C...
NEXT_PUBLIC_GAME_MARKETPLACE_CONTRACT_ID=C...
NEXT_PUBLIC_GAME_ENGINE_CONTRACT_ID=C...
```

## Step 6: Test Basic Functionality

### Test Faucet

```bash
# Have a player claim 1000 LAND
PLAYER_ADDRESS="GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY"

stellar contract invoke \
  --network testnet \
  --source your-account \
  --contract-id $TOKEN_ID \
  --function faucet \
  --arg "$PLAYER_ADDRESS"

# Verify player balance
stellar contract invoke \
  --network testnet \
  --source your-account \
  --contract-id $TOKEN_ID \
  --function balance_of \
  --arg "$PLAYER_ADDRESS"
# Expected: 10000000000 (1000 LAND = 1000 * 10^7 stroops)
```

### Test Property Ownership

```bash
# Verify property 100 owner
stellar contract invoke \
  --network testnet \
  --source your-account \
  --contract-id $NFT_ID \
  --function get_owner \
  --arg 100
# Expected: admin address
```

### Test Income Calculation

```bash
# Calculate income for property 0 (should be 0 initially)
stellar contract invoke \
  --network testnet \
  --source your-account \
  --contract-id $ENGINE_ID \
  --function get_accrued_income \
  --arg 0 \
  --arg 0 \
  --arg 0
# Expected: 0 (no time has passed since initialization)
```

## Step 7: Commit and Create PR

```bash
# Stage changes
git add -A

# Commit
git commit -m "Deploy game contracts to Stellar testnet - issue #847

- GameLandToken: CXXXXXX
- GamePropertyNFT: CXXXXXX
- GameMarketplace: CXXXXXX
- GameEngine: CXXXXXX

All contracts verified and initialized."

# Push to branch
git push origin feature/deploy-game-contracts

# Create PR
```

## Step 8: Verify CI Workflows

Ensure all CI workflows pass:

- [ ] contracts-ci.yml
- [ ] shared-ci.yml
- [ ] api-ci.yml
- [ ] webapp-ci.yml
- [ ] monorepo-ci.yml

## References

- **Deployment Configuration:** [apps/shared/src/contracts/game-contracts.testnet.json](../apps/shared/src/contracts/game-contracts.testnet.json)
- **Deployment Guide:** [docs/contracts/deployment.md](../docs/contracts/deployment.md)
- **Game Contracts README:** [apps/contracts/GAME_CONTRACTS_README.md](../apps/contracts/GAME_CONTRACTS_README.md)
- **Windows Build Guide:** [docs/game/BUILD_CONTRACTS_WINDOWS.md](../docs/game/BUILD_CONTRACTS_WINDOWS.md)
- **Game Mechanics:** [GAME_MECHANICS_SUMMARY.md](../GAME_MECHANICS_SUMMARY.md)

## Support

If you encounter issues:

1. Check [BUILD_CONTRACTS_WINDOWS.md](../docs/game/BUILD_CONTRACTS_WINDOWS.md) for build problems
2. Review [Soroban docs](https://soroban.stellar.org/)
3. Check contract source: [apps/contracts/contracts/](../apps/contracts/contracts/)
4. Verify environment: `echo $STELLAR_ADMIN_SECRET_KEY`
5. Test Stellar CLI: `stellar account info`
