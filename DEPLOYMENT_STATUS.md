# Game Contracts Deployment Summary

**Date:** May 29, 2026  
**Network:** Stellar Testnet  
**Status:** Partial Deployment (2 of 4 contracts deployed)

## Deployed Contracts

### 1. GameLandToken ✅

- **Contract ID:** `CA4HN74IK476XF2WBUMIELDNU4XXGW27L7Q3ADZPP67YS5HGHIATN4V6`
- **Deployment TX:** `002cbdf7dd92b29cacf199e97f97c244ef23e4b410be96903da8d698d4647b2f`
- **Status:** Deployed & Initialized
- **Function:** SEP-41 fungible token for in-game currency (LAND)
- **Explorer:** https://stellar.expert/explorer/testnet/tx/002cbdf7dd92b29cacf199e97f97c244ef23e4b410be96903da8d698d4647b2f

### 2. GameEngine ✅

- **Contract ID:** `CBGOTNTNNFKXISD6UHNTHKCSYTUC5FL5SRB2ARXDCCL2FV5LN2LUH5U7`
- **Deployment TX:** `c177b241e416ee2bbf0bf3f779e9e17196a104fea245b2c8ea57be5e777d50da`
- **Status:** Deployed (Not initialized yet)
- **Function:** Core game rules (improvements, rental income, treasury purchases)
- **Explorer:** https://stellar.expert/explorer/testnet/tx/c177b241e416ee2bbf0bf3f779e9e17196a104fea245b2c8ea57be5e777d50da

## Failed Deployments (WASM Validation Error)

### GamePropertyNFT ❌

- **Error:** `reference-types not enabled: zero byte expected` (offset: 9174)
- **Cause:** WASM bytecode incompatibility with testnet validator
- **Status:** Needs fix

### GameMarketplace ❌

- **Error:** `reference-types not enabled: zero byte expected` (offset: 8730)
- **Cause:** WASM bytecode incompatibility with testnet validator
- **Status:** Needs fix

## Next Steps

1. **Debug WASM validation errors** - Both NFT and Marketplace contracts have reference-types issues
2. **Possible causes:**
   - Missing feature flags in Cargo.toml
   - Dependency version mismatch
   - Soroban SDK version incompatibility
3. **Once fixed:**
   - Rebuild contracts
   - Deploy NFT contract
   - Deploy Marketplace contract
   - Initialize all 4 contracts with proper inter-contract dependencies
   - Verify all contracts on testnet

## Admin Credentials

- **Public Key:** GDIL2YYQHBMWZF6YVHNZZQVIQHBKMYYGVQ2J5OF2XWRIQW276TPWPMEC
- **Secret Key:** (stored in `.env`)

## Files Updated

- `apps/shared/src/contracts/game-contracts.testnet.json` - Updated with deployed contract IDs
