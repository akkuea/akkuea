# Deploy Environment Variables

⚠️ **IMPORTANT**: The contract IDs below are **PLACEHOLDERS** and must be replaced with real Soroban contract IDs deployed to Stellar Testnet.

This document tracks the specific environment variable values used for the current deployment. Keep this file updated when deploying to testnet or mainnet.

See [CONTRACT_VERIFICATION.md](./CONTRACT_VERIFICATION.md) for instructions on deploying contracts and obtaining real contract IDs.

## Testnet Values

These values should be updated after deploying contracts to Stellar Testnet:

```env
# Stellar Testnet Network
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

# Smart Contracts — MUST be updated with real deployed contract IDs
# Placeholder values (DO NOT USE):
#   REAL_ESTATE_TOKEN_CONTRACT_ID=CACDYF3CYMJEJTIVFESQYZTN67GO2R5D5IUABTCUG3HXQSRXCSOROBAN (❌ ends with SOROBAN text)
#   DEFI_LENDING_CONTRACT_ID=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4 (❌ all A's = zero address)
#
# Real contract IDs should look like:
#   CAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX (56 random uppercase alphanumeric)
#
# Update these after running: stellar contract deploy ...
REAL_ESTATE_TOKEN_CONTRACT_ID=<YOUR_DEPLOYED_CONTRACT_ID>
DEFI_LENDING_CONTRACT_ID=<YOUR_DEPLOYED_CONTRACT_ID>
```

*Note: For `STELLAR_ADMIN_SECRET` and other sensitive variables, rely on your `.env.local` or a secret manager. They are omitted here for security.*
