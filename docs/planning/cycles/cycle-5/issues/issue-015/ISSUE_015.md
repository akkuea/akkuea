# Deploy Game Contracts to Stellar Testnet

## Context

The four game contracts must be deployed to Stellar testnet before typed clients can be generated and before real contract interactions can be tested. This issue covers the full deployment process: building the WASM artifacts, deploying each contract, initializing them in the correct order, and recording the deployment details.

## What Needs to Be Done

Build all four game contract WASM artifacts using `stellar contract build`. Deploy them to Stellar testnet in dependency order: PropertyNFT and LandToken first (they have no dependencies on each other), then GameMarketplace (depends on both), then GameEngine (depends on both). After deploying each contract, call `initialize` with the correct constructor arguments.

Record each contract ID and deployment transaction hash in `apps/shared/src/contracts/game-contracts.testnet.json`. Update `docs/contracts/deployment.md` with a deployment log entry for this cycle.

Verify each contract is live by calling a read-only function against it and confirming a non-error response.

## Acceptance Criteria

- All four contracts are deployed and initialized on Stellar testnet.
- Contract IDs start with `C` and are verified via read-only calls.
- `game-contracts.testnet.json` is committed with all four contract IDs and transaction hashes.
- `docs/contracts/deployment.md` has a new log entry.
- All CI workflows pass on the submitted pull request.

## Quality Standard

Do not commit unverified contract IDs. Every contract must respond correctly to at least one read-only call before its address is recorded. Document the initialization call arguments so the deployment can be reproduced.
