# Contract Deployment & Verification Guide

**Status**: Critical for PR Approval  
**Issue**: Placeholder contract IDs must be replaced with real, verifiable Stellar contract IDs.

---

## Problem Statement

The current codebase contains placeholder contract IDs that are **not real Stellar contracts**:

- `REAL_ESTATE_TOKEN.TESTNET`: `CACDYF3CYMJEJTIVFESQYZTN67GO2R5D5IUABTCUG3HXQSRXCSOROBAN`  
  ❌ Ends with readable text "SOROBAN" (highly unusual for a randomly generated base32 address)
  
- `DEFI_LENDING.TESTNET`: `CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4`  
  ❌ All A's = Stellar zero address (used only for testing/initialization)

These placeholders are **anti-patterns** and must be replaced with:
1. **Real contract IDs** from actual Stellar Testnet deployments
2. **Environment variable configuration** (no hardcoded values in source code)
3. **Verifiable on Stellar Expert** Testnet Explorer

---

## Step 1: Deploy Contracts to Stellar Testnet

### Prerequisites

```bash
# Install Stellar CLI (if not already installed)
brew install stellar/stellar-cli/stellar-cli  # macOS
# or
curl -L https://github.com/stellar/stellar-cli/releases/download/v21.x.y/stellar-linux-amd64.tar.gz | tar xz  # Linux

# Verify installation
stellar --version

# Ensure you have a Stellar account with testnet XLM
stellar keys create my-account  # Creates a new keypair
stellar account fund GXXXXX...  # Fund account from faucet
```

### Build the WASM

```bash
cd apps/contracts

# Install Rust WASM target (if not already done)
rustup target add wasm32-unknown-unknown

# Build both contracts
cargo build --target wasm32-unknown-unknown --release

# Verify WASM files exist
ls -la target/wasm32-unknown-unknown/release/
# Should show: real_estate_defi_contracts.wasm
```

### Deploy Real Estate Token Contract

```bash
cd apps/contracts

# Set your admin address
ADMIN_ADDRESS=$(stellar keys address my-account)
NETWORK=testnet

# Deploy to Stellar Testnet
REAL_ESTATE_TOKEN_CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK)

echo "Real Estate Token Contract ID: $REAL_ESTATE_TOKEN_CONTRACT_ID"
# Example output: CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
# (64 random base32 characters, starts with C)

# Verify the contract was deployed
stellar contract inspect --contract-id $REAL_ESTATE_TOKEN_CONTRACT_ID --network testnet
```

### Deploy DeFi Lending Contract

```bash
# Deploy DeFi Lending contract (same WASM, separate deployment)
DEFI_LENDING_CONTRACT_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/real_estate_defi_contracts.wasm \
  --source-account $ADMIN_ADDRESS \
  --network $NETWORK)

echo "DeFi Lending Contract ID: $DEFI_LENDING_CONTRACT_ID"

# Verify this contract too
stellar contract inspect --contract-id $DEFI_LENDING_CONTRACT_ID --network testnet
```

---

## Step 2: Verify Contracts on Stellar Expert

Visit [Stellar Expert Testnet Explorer](https://stellar.expert/explorer/testnet) and search for each contract ID:

### Real Estate Token Verification

1. Go to: `https://stellar.expert/explorer/testnet/contract/$REAL_ESTATE_TOKEN_CONTRACT_ID`
2. Verify the following appear:
   - ✅ **Ledger entries** showing contract storage
   - ✅ **WASM code hash** matching your compiled binary
   - ✅ **Transactions** showing the deployment transaction
   - ✅ **Admin address** matching your deployment key
   - ✅ **Network**: Testnet (not mainnet)

3. Example of a **real contract ID**:
   ```
   CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   (56 characters, all uppercase alphanumerics, random-looking)
   ```

4. **Red flags** (indicates fake/placeholder):
   - ❌ Repeating patterns (all A's, all same character)
   - ❌ Contains readable English words
   - ❌ Less than 56 characters
   - ❌ No transaction history
   - ❌ No WASM code hash

### DeFi Lending Verification

Repeat the same verification process for the DeFi Lending contract ID.

---

## Step 3: Configure Environment Variables

### Option A: Local Development (.env.local)

1. **API Configuration** (`apps/api/.env.local`):
   ```bash
   REAL_ESTATE_TOKEN_CONTRACT_ID=CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   DEFI_LENDING_CONTRACT_ID=CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
   STELLAR_RPC_URL=https://soroban-testnet.stellar.org
   ```

2. **Webapp Configuration** (`apps/webapp/.env.local`):
   ```bash
   NEXT_PUBLIC_REAL_ESTATE_TOKEN_CONTRACT_ID=CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   NEXT_PUBLIC_DEFI_LENDING_CONTRACT_ID=CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

### Option B: Production (Secrets Manager)

**Never commit `.env` files to version control.**

For production deployments, use a secrets manager:

- **AWS Secrets Manager**
  ```bash
  aws secretsmanager create-secret \
    --name akkuea/contracts \
    --secret-string '{"REAL_ESTATE_TOKEN_CONTRACT_ID":"CAX...","DEFI_LENDING_CONTRACT_ID":"CAX..."}'
  ```

- **HashiCorp Vault**
  ```bash
  vault kv put secret/akkuea/contracts \
    REAL_ESTATE_TOKEN_CONTRACT_ID=CAX... \
    DEFI_LENDING_CONTRACT_ID=CAX...
  ```

- **GCP Secret Manager**
  ```bash
  gcloud secrets create real-estate-contract-id --replication-policy="automatic" \
    --data-file=- <<< "CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  ```

---

## Step 4: Update Configuration Files

### ✅ DO: Load from Environment Variables

**`apps/shared/src/constants/index.ts`** (already fixed):
```typescript
export const CONTRACT_IDS = {
  REAL_ESTATE_TOKEN: {
    TESTNET: process.env.REAL_ESTATE_TOKEN_CONTRACT_ID || "",
    MAINNET: process.env.REAL_ESTATE_TOKEN_CONTRACT_ID_MAINNET || "",
  },
  DEFI_LENDING: {
    TESTNET: process.env.DEFI_LENDING_CONTRACT_ID || "",
    MAINNET: process.env.DEFI_LENDING_CONTRACT_ID_MAINNET || "",
  },
} as const;
```

### ❌ DON'T: Hardcode Placeholder Values

```typescript
// ❌ WRONG - Never do this:
export const CONTRACT_IDS = {
  REAL_ESTATE_TOKEN: {
    TESTNET: "CACDYF3CYMJEJTIVFESQYZTN67GO2R5D5IUABTCUG3HXQSRXCSOROBAN", // Placeholder!
  },
};
```

---

## Step 5: Update .env.example Files

### `apps/api/.env.example`
```bash
REAL_ESTATE_TOKEN_CONTRACT_ID=your_real_estate_token_contract_id
DEFI_LENDING_CONTRACT_ID=your_defi_lending_contract_id
```

### `apps/webapp/.env.example`
```bash
NEXT_PUBLIC_REAL_ESTATE_TOKEN_CONTRACT_ID=your_real_estate_token_contract_id
NEXT_PUBLIC_DEFI_LENDING_CONTRACT_ID=your_defi_lending_contract_id
```

---

## Validation Checklist

Before marking the PR as ready:

- [ ] Contract IDs deployed to Stellar Testnet
- [ ] Each contract ID is **56 uppercase alphanumeric characters** starting with `C`
- [ ] Both contract IDs are **different** from each other
- [ ] Contract IDs are **verifiable on Stellar Expert** with transaction history
- [ ] No placeholder values like `CAAA...` or readable text
- [ ] `REAL_ESTATE_TOKEN_CONTRACT_ID` is in `apps/api/.env.example`
- [ ] `DEFI_LENDING_CONTRACT_ID` is in `apps/api/.env.example`
- [ ] `NEXT_PUBLIC_REAL_ESTATE_TOKEN_CONTRACT_ID` is in `apps/webapp/.env.example`
- [ ] `NEXT_PUBLIC_DEFI_LENDING_CONTRACT_ID` is in `apps/webapp/.env.example`
- [ ] No hardcoded contract IDs in `apps/shared/src/constants/index.ts`
- [ ] Contract IDs are loaded from `process.env` variables
- [ ] `.env` and `.env.local` files are in `.gitignore`

---

## Transaction Hash Validation

Real Stellar transaction hashes:
- ✅ **64-character hex strings**
- ✅ **No `tx_` prefix** (that's for database IDs only)
- ✅ **Format**: `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`

Placeholder values to reject:
- ❌ `tx_1234567890abcdef...` (has prefix)
- ❌ Short hashes like `tx_123`
- ❌ Transaction hashes ending in `...` (truncated)

To find real transaction hashes after deployment:
```bash
# Query Stellar testnet for contract deployment transactions
curl "https://horizon-testnet.stellar.org/accounts/$ADMIN_ADDRESS/transactions" | jq '.records[] | select(.type == "invoke_host_function")'
```

---

## Troubleshooting

### Contract not found on Stellar Expert

**Issue**: Contract ID doesn't appear in explorer

**Solution**:
1. Verify contract ID is spelled correctly (copy-paste, don't type)
2. Confirm you're searching on **Testnet** (not Mainnet)
3. Wait a few seconds — ledger propagation takes time
4. Check deployment transaction status: `stellar account $ADMIN_ADDRESS`

### "Invalid contract ID" errors

**Issue**: API returns error when calling contract

**Solution**:
1. Verify `REAL_ESTATE_TOKEN_CONTRACT_ID` is set in `.env`
2. Run `stellar contract inspect --contract-id $CONTRACT_ID --network testnet`
3. Ensure contract is deployed to the same network you're querying

### `.env` variables not being read

**Issue**: Constants still show empty values

**Solution** (Node.js):
1. Ensure you're running with `NODE_ENV=development` or `NODE_ENV=production`
2. Restart your development server after updating `.env`
3. Check `.gitignore` — `.env` must not be committed
4. Verify variable names match exactly (case-sensitive)

---

## References

- **Stellar CLI Docs**: https://developers.stellar.org/tools/cli
- **Soroban Documentation**: https://developers.stellar.org/docs/reference/soroban-cli
- **Stellar Expert Explorer**: https://stellar.expert/explorer/testnet
- **Deployment Guide**: [deploy-contracts.md](./deploy-contracts.md)
- **Environment Variables**: [environment-variables.md](./environment-variables.md)
