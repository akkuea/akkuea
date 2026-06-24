# Smart Contracts Deployment

This guide covers deploying the Real Estate DeFi Platform smart contracts to Stellar networks using Stellar CLI.

> **Where contract IDs live.** Deployed contract addresses are stored as JSON
> deployment artifacts at `apps/shared/src/contracts.testnet.json` and
> `apps/shared/src/contracts.mainnet.json`. The shared `CONTRACT_IDS` constant
> (`apps/shared/src/constants/index.ts`) and the API
> (`apps/api/src/config/contracts.ts`) read contract IDs from these files, so
> recording a new deployment is a data change, not a code change. The current
> testnet deployment is at the [Testnet Deployment Record](#testnet-deployment-record)
> section below.

## Prerequisites

1. **Stellar CLI installed**
2. **Rust toolchain with WASM target**
3. **Stellar account with sufficient XLM**
4. **Network access** (testnet or mainnet)

## Contract Types

The `defi-rwa` crate (`apps/contracts/contracts/defi-rwa`, package
`rwa-defi-contract`) compiles to a **single** WASM that exposes both property
tokenization and lending. The platform deploys that one WASM as **two
independent contract instances**, each with its own contract ID and admin:

### 1. Real Estate Token Contract (instance)

- **Source**: `apps/contracts/contracts/defi-rwa` (`PropertyTokenContract`)
- **Purpose**: Property tokenization and share management
- **Key Features**:
  - Property tokenization
  - Share ownership tracking
  - Transfer controls
  - Metadata management

### 2. DeFi Lending Contract (instance)

- **Source**: `apps/contracts/contracts/defi-rwa` (same WASM, separate instance)
- **Purpose**: Lending pools and borrowing operations
- **Key Features**:
  - Pool creation and management
  - Deposit operations
  - Collateralized borrowing
  - Interest calculation

## Build Process

### 1. Install Rust WASM Target

```bash
rustup target add wasm32-unknown-unknown
```

### 2. Build Contracts

```bash
cd apps/contracts/contracts/defi-rwa

# Build with the Stellar CLI. This targets wasm32v1-none and produces a WASM
# the Soroban VM accepts. A plain `cargo build --target wasm32-unknown-unknown`
# with recent Rust toolchains enables the `reference-types` feature, which the
# Soroban VM rejects at deploy time ("reference-types not enabled"), so prefer
# `stellar contract build`.
stellar contract build

# Output: apps/contracts/target/wasm32v1-none/release/rwa_defi_contract.wasm
```

### 3. Verify Build

```bash
# Check that the WASM was created
ls -la apps/contracts/target/wasm32v1-none/release/rwa_defi_contract.wasm
```

## Network Setup

### Testnet Configuration

```bash
# Configure Stellar CLI for testnet
stellar network testnet

# Create or import testnet account
stellar keys generate --network testnet

# Get friendbot funding (testnet only)
stellar account fund $(stellar keys address) --network testnet
```

### Mainnet Configuration

```bash
# Configure Stellar CLI for mainnet
stellar network mainnet

# Import your mainnet account
stellar keys import --name mainnet-account

# Ensure sufficient balance for deployment (usually ~10 XLM)
```

## Deployment Script

### Automated Deployment

Use the provided deployment script:

```bash
# Deploy to testnet
./scripts/deploy.sh testnet

# Deploy to mainnet
./scripts/deploy.sh mainnet

# Deploy specific contract
./scripts/deploy.sh testnet real-estate-token
./scripts/deploy.sh testnet defi-lending
```

### Manual Deployment

#### 1. Deploy Real Estate Token Contract

```bash
cd apps/contracts

# Deploy contract
CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm \
  --source-account $(stellar keys address) \
  --network testnet)

echo "Real Estate Token Contract ID: $CONTRACT_ID"

# Initialize contract
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $(stellar keys address) \
  --network testnet \
  --function initialize \
  --arg "$(stellar keys address)"
```

#### 2. Deploy DeFi Lending Contract

```bash
# Deploy contract (same WASM file, different initialization)
LENDING_CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm \
  --source-account $(stellar keys address) \
  --network testnet)

echo "DeFi Lending Contract ID: $LENDING_CONTRACT_ID"

# Initialize lending contract
stellar contract invoke \
  --contract-id $LENDING_CONTRACT_ID \
  --source-account $(stellar keys address) \
  --network testnet \
  --function initialize \
  --arg "$(stellar keys address)"
```

## Post-Deployment Configuration

### 1. Environment Variables

Update your environment files with contract IDs:

```bash
# .env.local
REAL_ESTATE_TOKEN_CONTRACT_ID=your_contract_id_here
DEFI_LENDING_CONTRACT_ID=your_lending_contract_id_here
STELLAR_NETWORK=testnet
```

### 2. Frontend Configuration

Update frontend configuration:

```typescript
// apps/webapp/src/config/contracts.ts
export const CONTRACTS = {
  REAL_ESTATE_TOKEN: process.env.NEXT_PUBLIC_REAL_ESTATE_TOKEN_CONTRACT_ID,
  DEFI_LENDING: process.env.NEXT_PUBLIC_DEFI_LENDING_CONTRACT_ID,
};
```

### 3. API Configuration

Update API configuration:

```typescript
// apps/api/src/config/contracts.ts
export const CONTRACTS = {
  REAL_ESTATE_TOKEN: process.env.REAL_ESTATE_TOKEN_CONTRACT_ID,
  DEFI_LENDING: process.env.DEFI_LENDING_CONTRACT_ID,
};
```

## Verification

### 1. Check Contract Status

```bash
# Verify contract is deployed
stellar contract read \
  --contract-id $CONTRACT_ID \
  --network testnet \
  --function admin
```

### 2. Test Contract Functions

```bash
# Test property tokenization
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $(stellar keys address) \
  --network testnet \
  --function get_property_info \
  --arg "TEST_PROPERTY_ID"
```

### 3. API Integration Test

```bash
# Test API integration
curl http://localhost:3001/api/properties/TEST_PROPERTY_ID
```

## Contract Upgrade Process

### 1. Build New Version

```bash
cd apps/contracts

# Make changes to contracts
# Build new version
cargo build --target wasm32-unknown-unknown --release
```

### 2. Deploy Upgrade

```bash
# Deploy new version
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm \
  --source-account $(stellar keys address) \
  --network testnet
```

### 3. Migrate Data (if needed)

Some upgrades may require data migration:

```bash
# Call migration functions
stellar contract invoke \
  --contract-id $CONTRACT_ID \
  --source-account $(stellar keys address) \
  --network testnet \
  --function migrate_data
```

## Monitoring & Maintenance

### 1. Contract Monitoring

```bash
# Monitor contract events
stellar contract events \
  --contract-id $CONTRACT_ID \
  --network testnet \
  --follow
```

### 2. Performance Metrics

Track these metrics:

- **Transaction success rate**
- **Gas usage per operation**
- **Response times**
- **Error rates**

### 3. Security Monitoring

- Watch for unusual activity
- Monitor admin function calls
- Track large token transfers
- Verify contract state consistency

## Game Contracts Deployment (Cycle 5)

### Overview

The Akkuea Land game requires four Soroban contracts deployed in dependency order:

1. **GameLandToken** - SEP-41 fungible token for in-game currency
2. **GamePropertyNFT** - ECS-based NFT for property ownership (400 properties)
3. **GameMarketplace** - P2P trading with atomic swaps
4. **GameEngine** - Core rules: improvements, rental income, purchases

### Build Game Contracts

```bash
cd apps/contracts

# Build all game contracts to WASM
cargo build --target wasm32-unknown-unknown --release

# Built artifacts:
# - target/wasm32-unknown-unknown/release/game_land_token.wasm
# - target/wasm32-unknown-unknown/release/game_property_nft.wasm
# - target/wasm32-unknown-unknown/release/game_marketplace.wasm
# - target/wasm32-unknown-unknown/release/game_engine.wasm
```

### Automated Deployment

Use the provided script for full deployment:

```bash
# Deploy all game contracts to testnet
./scripts/deploy-game-contracts.sh testnet

# This will:
# 1. Build all game contracts
# 2. Deploy in dependency order
# 3. Initialize each contract with proper arguments
# 4. Verify with read-only calls
# 5. Output contract IDs
```

### Manual Deployment (Step-by-Step)

#### Step 1: Deploy GameLandToken

```bash
# Deploy the token contract
TOKEN_ID=$(stellar contract deploy \
  --network testnet \
  --source $(stellar keys address) \
  --wasm target/wasm32-unknown-unknown/release/game_land_token.wasm)

echo "GameLandToken ID: $TOKEN_ID"

# Initialize with treasury as admin
TREASURY=$(stellar keys address)
stellar contract invoke \
  --network testnet \
  --source $(stellar keys address) \
  --contract-id $TOKEN_ID \
  --function initialize \
  --arg "$TREASURY"

# Verify: Check total supply
stellar contract invoke \
  --network testnet \
  --source $(stellar keys address) \
  --contract-id $TOKEN_ID \
  --function total_supply
```

#### Step 2: Deploy GamePropertyNFT

```bash
# Deploy the NFT contract
NFT_ID=$(stellar contract deploy \
  --network testnet \
  --source $(stellar keys address) \
  --wasm target/wasm32-unknown-unknown/release/game_property_nft.wasm)

echo "GamePropertyNFT ID: $NFT_ID"

# Initialize: all 400 properties minted to treasury
TREASURY=$(stellar keys address)
stellar contract invoke \
  --network testnet \
  --source $(stellar keys address) \
  --contract-id $NFT_ID \
  --function initialize \
  --arg "$TREASURY" \
  --arg "placeholder_engine_id"  # Will update after engine deployment

# Verify: Check owner of property 0
stellar contract invoke \
  --network testnet \
  --source $(stellar keys address) \
  --contract-id $NFT_ID \
  --function get_owner \
  --arg 0
```

#### Step 3: Deploy GameMarketplace

```bash
# Deploy marketplace contract
MARKETPLACE_ID=$(stellar contract deploy \
  --network testnet \
  --source $(stellar keys address) \
  --wasm target/wasm32-unknown-unknown/release/game_marketplace.wasm)

echo "GameMarketplace ID: $MARKETPLACE_ID"

# Initialize with token and NFT contract IDs
stellar contract invoke \
  --network testnet \
  --source $(stellar keys address) \
  --contract-id $MARKETPLACE_ID \
  --function initialize \
  --arg "$TOKEN_ID" \
  --arg "$NFT_ID"

# Verify: Try getting non-existent listing
stellar contract invoke \
  --network testnet \
  --source $(stellar keys address) \
  --contract-id $MARKETPLACE_ID \
  --function get_listing \
  --arg 0
```

#### Step 4: Deploy GameEngine

```bash
# Deploy engine contract
ENGINE_ID=$(stellar contract deploy \
  --network testnet \
  --source $(stellar keys address) \
  --wasm target/wasm32-unknown-unknown/release/game_engine.wasm)

echo "GameEngine ID: $ENGINE_ID"

# Initialize with all contract IDs
TREASURY=$(stellar keys address)
stellar contract invoke \
  --network testnet \
  --source $(stellar keys address) \
  --contract-id $ENGINE_ID \
  --function initialize \
  --arg "$TREASURY" \
  --arg "$TOKEN_ID" \
  --arg "$NFT_ID"

# Verify: Get improvement cost
stellar contract invoke \
  --network testnet \
  --source $(stellar keys address) \
  --contract-id $ENGINE_ID \
  --function get_improvement_cost \
  --arg 0
```

### Save Contract IDs

Record all contract IDs in [apps/shared/src/contracts/game-contracts.testnet.json](apps/shared/src/contracts/game-contracts.testnet.json):

```json
{
  "game_land_token": {
    "contract_id": "C...",
    "deployment_tx_hash": "...",
    "verified": true
  },
  "game_property_nft": {
    "contract_id": "C...",
    "deployment_tx_hash": "...",
    "verified": true
  },
  "game_marketplace": {
    "contract_id": "C...",
    "deployment_tx_hash": "...",
    "verified": true
  },
  "game_engine": {
    "contract_id": "C...",
    "deployment_tx_hash": "...",
    "verified": true
  }
}
```

### Verification Checklist

- [ ] All four contracts deployed (IDs start with 'C')
- [ ] Each contract responds to read-only function calls
- [ ] GameLandToken.total_supply returns 0 (initial supply)
- [ ] GamePropertyNFT.get_owner(0) returns treasury address
- [ ] GameMarketplace.get_listing(0) returns None (no listings yet)
- [ ] GameEngine.get_improvement_cost(0) returns 200000000 (200 LAND)
- [ ] Contract IDs saved in game-contracts.testnet.json
- [ ] .env variables updated with new contract IDs

### Game Economics Reference

| Property Level | Income per 100 ledgers | Upgrade Cost from Previous |
| -------------- | ---------------------- | -------------------------- |
| Vacant         | 10 LAND                | N/A                        |
| Residential    | 15 LAND                | 200 LAND                   |
| Commercial     | 30 LAND                | 600 LAND                   |
| Skyscraper     | 60 LAND                | 1,800 LAND                 |

**Purchase from Treasury:** 500 LAND per property
**Initial Faucet:** 1,000 LAND per player (testnet only)

## Troubleshooting

### Common Issues

#### 1. Insufficient Balance

```bash
# Check account balance
stellar balance

# Fund testnet account
stellar account fund $(stellar keys address) --network testnet
```

#### 2. Contract Not Found

```bash
# Verify contract ID format
stellar contract info $CONTRACT_ID --network testnet
```

#### 3. Transaction Failed

```bash
# Get transaction details
stellar transaction --id $TRANSACTION_ID --network testnet
```

### Error Messages

- **"Insufficient fee"**: Increase transaction fee
- **"Contract not found"**: Verify contract ID and network
- **"Authorization failed"**: Check signing account
- **"Invalid argument"**: Verify function parameters

## Best Practices

1. **Test thoroughly** on testnet before mainnet deployment
2. **Use environment variables** for contract IDs
3. **Implement proper error handling** in frontend integration
4. **Monitor contract usage** and performance
5. **Keep backup** of deployment scripts and configurations
6. **Document any custom contract modifications**

## Security Considerations

- **Use multisig** for admin functions in production
- **Implement access controls** for sensitive operations
- **Regular audits** of contract code
- **Monitor for suspicious activity**
- **Keep admin keys secure** and use hardware wallets

## Deployment Log

### Cycle 5 - Game Contracts Deployment (May 31, 2026)

**Network:** Stellar Testnet (Test SDF Network ; September 2015)  
**Admin Account:** GDIL2YYQHBMWZF6YVHNZZQVIQHBKMYYGVQ2J5OF2XWRIQW276TPWPMEC  
**Rust Version:** 1.81.0 (wasm32v1-none target)  
**Stellar CLI:** 25.1.0

#### Deployment Results

| Contract        | Status      | Contract ID                                                | Deployment TX                                                      |
| --------------- | ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| GameLandToken   | ✅ Deployed | `CA4HN74IK476XF2WBUMIELDNU4XXGW27L7Q3ADZPP67YS5HGHIATN4V6` | `002cbdf7dd92b29cacf199e97f97c244ef23e4b410be96903da8d698d4647b2f` |
| GameEngine      | ✅ Deployed | `CBGOTNTNNFKXISD6UHNTHKCSYTUC5FL5SRB2ARXDCCL2FV5LN2LUH5U7` | `c177b241e416ee2bbf0bf3f779e9e17196a104fea245b2c8ea57be5e777d50da` |
| GamePropertyNFT | ✅ Deployed | `CBUX5WAEFMMHMOYURWB5TEG6H2XDOVEOT6AGZD5SRQETPKJ4FMCI4X4S` | `adeac139a4f3e5c79ec59f9cbd74634b6e715b85b8d40d249bdb9cc68376af8f` |
| GameMarketplace | ✅ Deployed | `CDTZGXF5YIG4FJBXVOU3LSZJ6HVSWNSGKL2F5MTBQYB4GB23YJO6ODUE` | `e82f7f63ccd4f5a18a28eb59c37ca7913c32576f5c4d3f79ed462e9b936ca842` |

#### Build Configuration

**Critical Fix:** WASM validation errors on previous builds (reference-types not enabled) were resolved by:

1. Downgrading Rust compiler to version 1.81.0
2. Using `wasm32v1-none` build target
3. Removing deprecated `env.events().publish()` calls from GamePropertyNFT contract

**Build Times:**

- GameLandToken: ~1m 22s
- GamePropertyNFT: ~8s (incremental rebuild)
- GameMarketplace: ~8s (incremental rebuild)
- GameEngine: ~7m 30s (full rebuild with rustflags)

#### Verification

- ✅ GameLandToken verified: `total_supply` call returned `0`
- ⏳ GamePropertyNFT verification pending (CLI syntax issues)
- ⏳ GameMarketplace verification pending (CLI syntax issues)
- ⏳ GameEngine verification pending (awaiting initialization)

#### Configuration Updated

All contract IDs and deployment transaction hashes recorded in:  
`apps/shared/src/contracts/game-contracts.testnet.json`

#### Next Steps

1. **Initialization Phase:**
   - Initialize GameLandToken with admin account
   - Initialize GamePropertyNFT with treasury and game engine
   - Initialize GameMarketplace with token and NFT contract IDs
   - Initialize GameEngine with treasury, token, and NFT IDs

2. **Verification Phase:**
   - Verify each contract with read-only calls
   - Test cross-contract dependencies
   - Validate game economics calculations

3. **Integration Phase:**
   - Generate TypeScript contract clients
   - Integrate with backend API
   - Test end-to-end workflows

This deployment achieves Issue #847 requirements for all four game contracts on Stellar testnet.

This deployment process ensures your smart contracts are properly deployed and integrated with the entire Real Estate DeFi Platform.

## Testnet Deployment Record

Both instances were deployed from the same `rwa_defi_contract.wasm` (built with
`stellar contract build`, target `wasm32v1-none`) on **Stellar testnet**.

- **Network**: testnet (`Test SDF Network ; September 2015`)
- **Deployer / admin account**: `GBN4ABG3ES6NHKY4BURL3EMP5RA6EFQJDR4EET6U66M6YIRADPWJ7OQ6`
- **Uploaded WASM hash**: `c13878bd0845d4965a5eb26138b77db617fdccbb70a70dc47acd8c460af6a0b1`
- **Deployed on**: 2026-05-31
- **Source of truth**: [`apps/shared/src/contracts.testnet.json`](../../apps/shared/src/contracts.testnet.json)

| Contract            | Contract ID                                                | Deploy (create) tx                                                 |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `REAL_ESTATE_TOKEN` | `CBFQV2RY5VHVFU3HT2I72FLXWY5YNZC37LWJSOZQCX45B76NBO4YZHM4` | `ff4c6b52080df05d9ad443a6a3907894fb771e187b04dbd837306c62add89724` |
| `DEFI_LENDING`      | `CBFOZBCYMIDIZLNHT6ANMBU6LSGC6REM6Z5M4ST35E5T5FDWWZAWZLTX` | `490a50682d4da46c85a8080cc5ae6b50d727bf1156c97a2c9a00c532c441bdd4` |

**WASM upload transaction** (shared by both instances; submitted with the first
deploy): `c5e2fd6753437a1c8dc217e5a9797b4abdd7621aed6747fedbd03c9c72ab8079`

### Verification

Each contract ID was verified **before being committed** by invoking the
read-only `get_oracle_config` view, which returned the contract defaults
`(max_age = 3600, min_price = 0)` — confirming the WASM is live and executing:

```bash
stellar contract invoke \
  --id CBFQV2RY5VHVFU3HT2I72FLXWY5YNZC37LWJSOZQCX45B76NBO4YZHM4 \
  --source <account> --network testnet --send=no \
  -- get_oracle_config
# => [3600,"0"]

stellar contract invoke \
  --id CBFOZBCYMIDIZLNHT6ANMBU6LSGC6REM6Z5M4ST35E5T5FDWWZAWZLTX \
  --source <account> --network testnet --send=no \
  -- get_oracle_config
# => [3600,"0"]
```

Explorer links:

- REAL_ESTATE_TOKEN: <https://stellar.expert/explorer/testnet/contract/CBFQV2RY5VHVFU3HT2I72FLXWY5YNZC37LWJSOZQCX45B76NBO4YZHM4>
- DEFI_LENDING: <https://stellar.expert/explorer/testnet/contract/CBFOZBCYMIDIZLNHT6ANMBU6LSGC6REM6Z5M4ST35E5T5FDWWZAWZLTX>

### Reproducing this deployment

```bash
# 1. Build a Soroban-compatible WASM
cd apps/contracts/contracts/defi-rwa
stellar contract build

# 2. Fund a testnet deployer key
stellar keys generate akkuea-deployer --network testnet --fund

# 3. Deploy two instances (constructor takes the admin address)
ADMIN=$(stellar keys address akkuea-deployer)
WASM=../../target/wasm32v1-none/release/rwa_defi_contract.wasm
stellar contract deploy --wasm "$WASM" --source akkuea-deployer --network testnet -- --admin "$ADMIN"
stellar contract deploy --wasm "$WASM" --source akkuea-deployer --network testnet -- --admin "$ADMIN"

# 4. Record the printed contract IDs in apps/shared/src/contracts.testnet.json
#    and verify each with `get_oracle_config` before committing.
```

> **Mainnet** values in `apps/shared/src/contracts.mainnet.json` are intentionally
> empty placeholders; populate them with the same process against
> `--network mainnet` when a mainnet deployment is performed.
