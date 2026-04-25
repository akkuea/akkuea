# PR Review Response: Contract Configuration Fixes

**Date**: April 25, 2026  
**Issue**: Placeholder contract IDs and anti-pattern hardcoding  
**Status**: ✅ RESOLVED

---

## Issues Identified in PR Review

### 1. ❌ Contract Addresses Are Fake Placeholders
- `DEFI_LENDING.TESTNET`: `CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4`  
  - All A's in base32 = Stellar zero address (invalid)
- `REAL_ESTATE_TOKEN.TESTNET`: `CACDYF3CYMJEJTIVFESQYZTN67GO2R5D5IUABTCUG3HXQSRXCSOROBAN`  
  - Ends with readable word "SOROBAN" (statistically impossible for random address)

### 2. ❌ Transaction Hashes Are Placeholders
- Format: `tx_1234567890abcdef...`
- Real hashes: 64-character hex strings with no prefix

### 3. ❌ Contract IDs Hardcoded in Source Code
- Anti-pattern: environment-specific values should not be in constants
- Security risk: sensitive values could be exposed

---

## Changes Made

### 1. Updated Contract Constants (`apps/shared/src/constants/index.ts`)

**BEFORE** (❌ Hardcoded placeholders):
```typescript
export const CONTRACT_IDS = {
  REAL_ESTATE_TOKEN: {
    TESTNET: "CACDYF3CYMJEJTIVFESQYZTN67GO2R5D5IUABTCUG3HXQSRXCSOROBAN",
    MAINNET: "",
  },
  DEFI_LENDING: {
    TESTNET: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    MAINNET: "",
  },
};
```

**AFTER** (✅ Environment variable configuration):
```typescript
/**
 * Contract IDs are loaded from environment variables.
 * These values must be obtained from actual Stellar Testnet/Mainnet deployments.
 * See: docs/deployment/deploy-contracts.md
 */
export const CONTRACT_IDS = {
  REAL_ESTATE_TOKEN: {
    TESTNET: process.env.REAL_ESTATE_TOKEN_CONTRACT_ID || "",
    MAINNET: process.env.REAL_ESTATE_TOKEN_CONTRACT_ID_MAINNET || "",
  },
  DEFI_LENDING: {
    TESTNET: process.env.DEFI_LENDING_CONTRACT_ID || "",
    MAINNET: process.env.DEFI_LENDING_CONTRACT_ID_MAINNET || "",
  },
};
```

### 2. Updated API Environment Example (`apps/api/.env.example`)

**ADDED**:
```env
# Soroban / Stellar Configuration — Contracts
# IMPORTANT: These contract IDs must be obtained from actual Stellar deployments.
# They are NOT hardcoded and must be retrieved after deploying contracts.
# See: docs/deployment/deploy-contracts.md
REAL_ESTATE_TOKEN_CONTRACT_ID=your_real_estate_token_contract_id
DEFI_LENDING_CONTRACT_ID=your_defi_lending_contract_id
```

- Added `DEFI_LENDING_CONTRACT_ID` (was missing)
- Added comprehensive comments about deployment process

### 3. Created Webapp Environment Example (`apps/webapp/.env.example`)

**NEW FILE** - Webapp-specific configuration:
```env
NEXT_PUBLIC_REAL_ESTATE_TOKEN_CONTRACT_ID=your_real_estate_token_contract_id
NEXT_PUBLIC_DEFI_LENDING_CONTRACT_ID=your_defi_lending_contract_id
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Updated Environment Variables Documentation (`docs/deployment/environment-variables.md`)

**ADDED**:
- Documentation for `DEFI_LENDING_CONTRACT_ID`
- Warning about placeholder values
- Instructions for verifying contract IDs on Stellar Expert
- Red flags for identifying fake contract IDs

### 5. Updated Deployment Tracking (`docs/deployment/deploy-environment-variables.md`)

**CHANGED**:
- Added clear warnings that current values are placeholders
- Provided instructions for obtaining real contract IDs
- Added examples of what real contract IDs should look like

### 6. Created Comprehensive Deployment Guide (`docs/deployment/CONTRACT_VERIFICATION.md`)

**NEW FILE** - Complete guide covering:
- ✅ Why placeholder IDs are problematic
- ✅ Step-by-step contract deployment to Stellar Testnet
- ✅ How to verify contracts on Stellar Expert
- ✅ Environment variable configuration for local/production
- ✅ Validation checklist
- ✅ Transaction hash format verification
- ✅ Troubleshooting guide

---

## How to Use the Fixed Configuration

### For Developers

1. **Deploy contracts** (see [docs/deployment/CONTRACT_VERIFICATION.md](docs/deployment/CONTRACT_VERIFICATION.md)):
   ```bash
   cd apps/contracts
   cargo build --target wasm32-unknown-unknown --release
   stellar contract deploy --wasm ... --network testnet
   ```

2. **Save real contract IDs** to `.env.local`:
   ```bash
   echo "REAL_ESTATE_TOKEN_CONTRACT_ID=CAXXXXXXXX..." >> apps/api/.env.local
   echo "DEFI_LENDING_CONTRACT_ID=CAXXXXXXXX..." >> apps/api/.env.local
   ```

3. **Verify contracts** on Stellar Expert:
   - Visit: `https://stellar.expert/explorer/testnet/contract/{CONTRACT_ID}`
   - Confirm transaction history and WASM code hash

### For CI/CD Pipelines

1. Load contract IDs from secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
2. Never commit `.env` files to version control
3. Each environment (testnet/mainnet) has separate contract IDs

---

## Verification Checklist

- [x] Contract constants no longer hardcoded
- [x] Contract IDs loaded from `process.env` variables
- [x] `DEFI_LENDING_CONTRACT_ID` added to `.env.example`
- [x] Webapp `.env.example` created
- [x] Environment variable documentation updated
- [x] Comprehensive deployment guide created
- [x] Placeholders clearly marked as invalid
- [x] Real contract ID format documented
- [x] Stellar Expert verification instructions provided
- [x] Troubleshooting guide included

---

## Next Steps for PR Approval

1. **Deploy contracts** to Stellar Testnet using the deployment guide
2. **Capture real contract IDs** from deployment output
3. **Verify on Stellar Expert** that contracts are real and visible
4. **Update .env.local** with real contract IDs
5. **Test the application** to confirm contracts work
6. **Document final contract IDs** in team knowledge base

---

## Files Modified

| File | Changes |
|------|---------|
| `apps/shared/src/constants/index.ts` | Load from env, removed hardcoded values |
| `apps/api/.env.example` | Added `DEFI_LENDING_CONTRACT_ID` with comments |
| `apps/webapp/.env.example` | ✨ NEW - webapp environment config |
| `docs/deployment/environment-variables.md` | Added verification instructions |
| `docs/deployment/deploy-environment-variables.md` | Marked placeholders, added warnings |
| `docs/deployment/CONTRACT_VERIFICATION.md` | ✨ NEW - comprehensive deployment guide |

---

## References

- [Stellar CLI Documentation](https://developers.stellar.org/tools/cli)
- [Soroban Deployment Guide](https://developers.stellar.org/docs/reference/soroban-cli)
- [Stellar Expert Explorer](https://stellar.expert/explorer/testnet)
- [Deployment Configuration](docs/deployment/CONTRACT_VERIFICATION.md)
