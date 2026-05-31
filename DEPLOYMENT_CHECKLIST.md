# Deployment Checklist - Issue #847

Quick reference checklist for deploying game contracts to Stellar testnet.

## Pre-Deployment Setup

### Prerequisites

- [ ] Stellar CLI 21.0.0+ installed
- [ ] Rust with WASM target installed (`rustup target add wasm32-unknown-unknown`)
- [ ] Testnet account with XLM balance
- [ ] Windows: Visual Studio Build Tools installed (if on Windows)
- [ ] All four contracts built to WASM

### Environment Setup

- [ ] `.env` file created with `STELLAR_ADMIN_SECRET_KEY` and `STELLAR_ADMIN_PUBLIC_KEY`
- [ ] Stellar account funded via Friendbot
- [ ] Network set to testnet: `stellar network testnet`

## Building Contracts

### Build Phase

- [ ] Navigate to `apps/contracts`: `cd apps/contracts`
- [ ] Build all contracts: `cargo build --target wasm32-unknown-unknown --release`
- [ ] Verify WASM artifacts exist in `target/wasm32-unknown-unknown/release/`:
  - [ ] `game_land_token.wasm`
  - [ ] `game_property_nft.wasm`
  - [ ] `game_marketplace.wasm`
  - [ ] `game_engine.wasm`

### Troubleshooting Build

- [ ] If build fails on Windows: Follow `docs/game/BUILD_CONTRACTS_WINDOWS.md`
- [ ] If MSVC linker error: Install Visual Studio Build Tools
- [ ] If out of memory: Build one contract at a time with `-p flag`

## Deployment

### Automated Deployment (Recommended)

- [ ] **Linux/macOS:** `./scripts/deploy-game-contracts.sh testnet`
- [ ] **Windows (PowerShell):** `.\scripts\Deploy-GameContracts.ps1 -Network testnet`
- [ ] Script should output 4 contract IDs starting with 'C'

### Manual Deployment (Fallback)

- [ ] Deploy GameLandToken and record ID
- [ ] Deploy GamePropertyNFT and record ID
- [ ] Deploy GameMarketplace with token + NFT IDs and record ID
- [ ] Deploy GameEngine with all IDs and record ID
- [ ] Initialize each contract with proper arguments

## Post-Deployment Verification

### Contract Responses

- [ ] GameLandToken `total_supply()` returns 0
- [ ] GamePropertyNFT `get_owner(0)` returns admin address
- [ ] GameMarketplace `get_listing(0)` returns no listing
- [ ] GameEngine `get_improvement_cost(0)` returns 200000000 (200 LAND)

### Functionality Tests

- [ ] Faucet claim works: Can claim 1,000 LAND
- [ ] Balance query works: Balance matches after faucet
- [ ] Property ownership query works: Can check any property owner
- [ ] Income calculation works: Can calculate accrued income

### Configuration Updates

- [ ] Contract IDs recorded in `apps/shared/src/contracts/game-contracts.testnet.json`
- [ ] `.env` updated with all 4 contract IDs:
  - [ ] `GAME_LAND_TOKEN_CONTRACT_ID`
  - [ ] `GAME_PROPERTY_NFT_CONTRACT_ID`
  - [ ] `GAME_MARKETPLACE_CONTRACT_ID`
  - [ ] `GAME_ENGINE_CONTRACT_ID`
- [ ] `.env.local` in `apps/api/` updated with contract IDs
- [ ] `.env.local` in `apps/webapp/` updated with `NEXT_PUBLIC_*` versions

## Documentation Updates

### Deployment Log

- [ ] Add entry to `docs/contracts/deployment.md` with:
  - Deployment date
  - Network (testnet)
  - All 4 contract IDs
  - Deployment method used
  - Verification results

### Status Documentation

- [ ] Update `GAME_CONTRACTS_DEPLOYMENT_SUMMARY.md` with actual contract IDs
- [ ] Add deployment timestamps
- [ ] Document any issues encountered and solutions

## CI/CD Verification

### Workflow Checks

- [ ] `contracts-ci.yml` passes (cargo fmt, clippy, build)
- [ ] `shared-ci.yml` passes (TypeScript, lint)
- [ ] `api-ci.yml` passes (TypeScript, API tests)
- [ ] `webapp-ci.yml` passes (TypeScript, build)
- [ ] `monorepo-ci.yml` passes (workspace consistency)

### Build Verification

- [ ] All CI workflows pass on PR
- [ ] No new errors or warnings introduced
- [ ] WASM binary size acceptable (≤1 MB per contract)

## PR Submission

### Commit Preparation

- [ ] All files staged: `git add -A`
- [ ] Commit message includes:
  - Issue number (#847)
  - All 4 contract IDs
  - Verification status
  - Network deployed to (testnet)

### PR Details

- [ ] PR title: `Deploy game contracts to Stellar testnet (#847)`
- [ ] PR description includes:
  - Deployment summary
  - Contract IDs with C prefix
  - Verification results
  - Links to contracts in GitHub
  - Links to deployment documentation

### Code Review Items

- [ ] Contract source code reviewed
- [ ] Deployment scripts reviewed
- [ ] Documentation is clear and complete
- [ ] All CI workflows pass
- [ ] No security issues identified

## Post-Merge Deployment

### Final Verification

- [ ] Contract IDs are in main branch
- [ ] Contracts remain live on testnet
- [ ] All tests pass in main
- [ ] Documentation is accurate

### Next Steps

- [ ] Generate typed clients with Quasar
- [ ] Update frontend to use contract IDs
- [ ] Update API to use contract IDs
- [ ] Test game mechanics end-to-end
- [ ] Open issue for main branch update

## Rollback Procedure (If Needed)

- [ ] Document any issues found
- [ ] Revert contract ID changes if critical bug
- [ ] Fix contracts and redeploy
- [ ] Update documentation with issues and fixes
- [ ] Resubmit PR

## Game Constants Reference

Quick reference for testing:

| Item              | Value                   |
| ----------------- | ----------------------- |
| Grid Size         | 20×20 (400 properties)  |
| Base Income       | 10 LAND per 100 ledgers |
| Property Purchase | 500 LAND from treasury  |
| Faucet            | 1,000 LAND per player   |
| Token Decimals    | 7                       |
| Improvement Costs | 200, 600, 1800 LAND     |

## Support Resources

- [Deployment Instructions](docs/game/DEPLOYMENT_INSTRUCTIONS.md)
- [Windows Build Guide](docs/game/BUILD_CONTRACTS_WINDOWS.md)
- [Contract README](apps/contracts/GAME_CONTRACTS_README.md)
- [Game Mechanics](GAME_MECHANICS_SUMMARY.md)
- [Soroban Docs](https://soroban.stellar.org/)

---

**Checklist Version:** 1.0
**Last Updated:** 2026-05-27
**Status:** Ready for Deployment
