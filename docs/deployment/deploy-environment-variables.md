# Deploy Environment Variables

This document tracks the specific environment variable values used for the current deployment. Keep this file updated when deploying to testnet or mainnet.

## Testnet Values

These are the assigned values for the latest smart contract deployment to Testnet:

```env
# Stellar Testnet Network
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

# Smart Contracts
REAL_ESTATE_TOKEN_CONTRACT_ID=CACDYF3CYMJEJTIVFESQYZTN67GO2R5D5IUABTCUG3HXQSRXCSOROBAN
DEFI_LENDING_CONTRACT_ID=CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4
```

*Note: For `STELLAR_ADMIN_SECRET` and other sensitive variables, rely on your `.env.local` or a secret manager. They are omitted here for security.*
