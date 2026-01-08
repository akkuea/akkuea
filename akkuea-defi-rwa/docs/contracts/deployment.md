# Smart Contracts Deployment

This guide covers deploying the Real Estate DeFi Platform smart contracts to Stellar networks using Stellar CLI.

## Prerequisites

1. **Stellar CLI installed**
2. **Rust toolchain with WASM target**
3. **Stellar account with sufficient XLM**
4. **Network access** (testnet or mainnet)

## Contract Types

The platform includes two main contracts:

### 1. Real Estate Token Contract
- **File**: `apps/contracts/src/real_estate_token.rs`
- **Purpose**: Property tokenization and share management
- **Key Features**:
  - Property tokenization
  - Share ownership tracking
  - Transfer controls
  - Metadata management

### 2. DeFi Lending Contract
- **File**: `apps/contracts/src/defi_lending.rs`
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
cd apps/contracts

# Build release version
cargo build --target wasm32-unknown-unknown --release

# Output will be in target/wasm32-unknown-unknown/release/
```

### 3. Verify Build
```bash
# Check if WASM files were created
ls -la target/wasm32-unknown-unknown/release/

# You should see files like:
# real_estate_defi_contracts.wasm
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