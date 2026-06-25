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

This deployment process ensures your smart contracts are properly deployed and integrated with the entire Real Estate DeFi Platform.

## Game Contracts Testnet Deployment Record (2026-06-24)

All four Akkuea Land game contracts were built with `stellar contract build` (target `wasm32v1-none`) and deployed to Stellar testnet. Deployment order: PropertyNFT and LandToken first (no inter-dependencies), then GameMarketplace and GameEngine (both depend on the first two).

- **Network**: testnet (`Test SDF Network ; September 2015`)
- **Deployer / admin account**: `GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M`
- **Deployed on**: 2026-06-24
- **Source of truth**: [`apps/shared/src/contracts/game-contracts.testnet.json`](../../apps/shared/src/contracts/game-contracts.testnet.json)

| Contract             | Contract ID                                                  | Deploy tx                                                          | Init tx                                                            |
| -------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `GAME_PROPERTY_NFT`  | `CCPUVGQAMDUUASHMXB7Z6F6XHCZI2WXOPR7DXEVPJBEGYZVJEABEABLE`  | `2b982bdbc7e29c7f334d35d57f9566d124fd9b30722f551fff23df310d298fc5` | `889d9a0f7da7c543cc6abeb913506eb55b6b31f67177c4d3f2fc18670c81bbb2` |
| `GAME_LAND_TOKEN`    | `CBQBXOWI3YB5SFICLVPYHK2EL3SY3XIZUZA6QZIGGXDKMVXAT74IOR3K`  | `3a7619ea0d637ac60f2d6c43dfac10cc7810c663b3ea65b84f54d7b1f07cbdf7` | `1e3d8961cce31d0d5016705ef1f8aecf78761ef1203136cb41ccc6c08729be53` |
| `GAME_MARKETPLACE`   | `CDKRZTY5PFNA4DHI2GFPSTOAADI2WV7SXYVS4VMTDC6M7IKKIPQJP5A3`  | `a84eabafffc0bf75bb75676c8add0616ff970cda82c75f2ebf439ca14528fbbb` | `4fbaa0df4a51c266fb3258490b202cd962209b04c495264d85096da5ef623560` |
| `GAME_ENGINE`        | `CBTPPGX6LT2EPKR7JD7LLUB23E6HI5EFQRXKV3VQNZ6QWJTJ3EZ76RSH`  | `fc8bcb20360d909ea4fbd7187edadadf3ed25f3aa29810e5b806917318d0cafa` | `33641f100f7c6d23452a417b2d4d16a111554398c69aa5cab969f224a98a7714` |

### Initialization arguments

```bash
# 1. PropertyNFT: initialize(treasury, game_engine)
stellar contract invoke --id CCPUVGQAMDUUASHMXB7Z6F6XHCZI2WXOPR7DXEVPJBEGYZVJEABEABLE \
  --source akkuea-game-deployer --network testnet \
  -- initialize \
  --treasury GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M \
  --game_engine CBTPPGX6LT2EPKR7JD7LLUB23E6HI5EFQRXKV3VQNZ6QWJTJ3EZ76RSH

# 2. LandToken: initialize(treasury, engine, is_testnet)
stellar contract invoke --id CBQBXOWI3YB5SFICLVPYHK2EL3SY3XIZUZA6QZIGGXDKMVXAT74IOR3K \
  --source akkuea-game-deployer --network testnet \
  -- initialize \
  --treasury GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M \
  --engine CBTPPGX6LT2EPKR7JD7LLUB23E6HI5EFQRXKV3VQNZ6QWJTJ3EZ76RSH \
  --is_testnet true

# 3. GameMarketplace: initialize(nft_contract, land_token)
stellar contract invoke --id CDKRZTY5PFNA4DHI2GFPSTOAADI2WV7SXYVS4VMTDC6M7IKKIPQJP5A3 \
  --source akkuea-game-deployer --network testnet \
  -- initialize \
  --nft_contract CCPUVGQAMDUUASHMXB7Z6F6XHCZI2WXOPR7DXEVPJBEGYZVJEABEABLE \
  --land_token CBQBXOWI3YB5SFICLVPYHK2EL3SY3XIZUZA6QZIGGXDKMVXAT74IOR3K

# 4. GameEngine: initialize(nft_contract, token_contract, treasury)
stellar contract invoke --id CBTPPGX6LT2EPKR7JD7LLUB23E6HI5EFQRXKV3VQNZ6QWJTJ3EZ76RSH \
  --source akkuea-game-deployer --network testnet \
  -- initialize \
  --nft_contract CCPUVGQAMDUUASHMXB7Z6F6XHCZI2WXOPR7DXEVPJBEGYZVJEABEABLE \
  --token_contract CBQBXOWI3YB5SFICLVPYHK2EL3SY3XIZUZA6QZIGGXDKMVXAT74IOR3K \
  --treasury GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M
```

### Verification

Each contract ID was verified before being committed by invoking a read-only function:

```bash
# PropertyNFT — get_property(0) returns tile 0 owned by treasury
stellar contract invoke --id CCPUVGQAMDUUASHMXB7Z6F6XHCZI2WXOPR7DXEVPJBEGYZVJEABEABLE \
  --source akkuea-game-deployer --network testnet --send=no \
  -- get_property --property_id 0
# => {"approved":null,"id":0,"last_claimed_ledger":3265536,"level":0,"owner":"GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M","x":0,"y":0}

# LandToken — name() returns token name
stellar contract invoke --id CBQBXOWI3YB5SFICLVPYHK2EL3SY3XIZUZA6QZIGGXDKMVXAT74IOR3K \
  --source akkuea-game-deployer --network testnet --send=no \
  -- name
# => "Akkuea Land Token"

# GameMarketplace — get_all_listings(0,10) returns empty list
stellar contract invoke --id CDKRZTY5PFNA4DHI2GFPSTOAADI2WV7SXYVS4VMTDC6M7IKKIPQJP5A3 \
  --source akkuea-game-deployer --network testnet --send=no \
  -- get_all_listings --offset 0 --limit 10
# => []

# GameEngine — get_accrued_income(0) returns 0 (no epochs elapsed)
stellar contract invoke --id CBTPPGX6LT2EPKR7JD7LLUB23E6HI5EFQRXKV3VQNZ6QWJTJ3EZ76RSH \
  --source akkuea-game-deployer --network testnet --send=no \
  -- get_accrued_income --property_id 0
# => "0"
```

Explorer links:

- GAME_PROPERTY_NFT: <https://stellar.expert/explorer/testnet/contract/CCPUVGQAMDUUASHMXB7Z6F6XHCZI2WXOPR7DXEVPJBEGYZVJEABEABLE>
- GAME_LAND_TOKEN: <https://stellar.expert/explorer/testnet/contract/CBQBXOWI3YB5SFICLVPYHK2EL3SY3XIZUZA6QZIGGXDKMVXAT74IOR3K>
- GAME_MARKETPLACE: <https://stellar.expert/explorer/testnet/contract/CDKRZTY5PFNA4DHI2GFPSTOAADI2WV7SXYVS4VMTDC6M7IKKIPQJP5A3>
- GAME_ENGINE: <https://stellar.expert/explorer/testnet/contract/CBTPPGX6LT2EPKR7JD7LLUB23E6HI5EFQRXKV3VQNZ6QWJTJ3EZ76RSH>

---

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
