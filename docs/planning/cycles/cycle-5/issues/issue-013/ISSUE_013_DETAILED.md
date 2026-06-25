# C5-013: Generate Typed Soroban Clients for Game Contracts

## Issue Metadata

| Attribute       | Value                                                 |
| --------------- | ----------------------------------------------------- |
| Issue ID        | C5-013                                                |
| Area            | SHARED                                                |
| Difficulty      | Trivial                                               |
| Labels          | shared, trivial                                       |
| Dependencies    | C5-003, C5-004, C5-005, C5-006                        |
| Estimated Lines | 30-60 (hand-written); generated files are not counted |

## Generation Steps

This issue depends on C5-015 (testnet deployment) to have real contract IDs. Run the Quasar generator after deployment:

```bash
cd apps/shared

# Generate typed client for each contract
quasar generate \
  --wasm apps/contracts/target/wasm32v1-none/release/game_property_nft.wasm \
  --contract-id $GAME_NFT_CONTRACT_ID \
  --network testnet \
  --out src/contracts/game/propertyNft.ts

quasar generate \
  --wasm apps/contracts/target/wasm32v1-none/release/game_land_token.wasm \
  --contract-id $GAME_TOKEN_CONTRACT_ID \
  --network testnet \
  --out src/contracts/game/landToken.ts

quasar generate \
  --wasm apps/contracts/target/wasm32v1-none/release/game_marketplace.wasm \
  --contract-id $GAME_MARKETPLACE_CONTRACT_ID \
  --network testnet \
  --out src/contracts/game/marketplace.ts

quasar generate \
  --wasm apps/contracts/target/wasm32v1-none/release/game_engine.wasm \
  --contract-id $GAME_ENGINE_CONTRACT_ID \
  --network testnet \
  --out src/contracts/game/engine.ts
```

Follow the exact Quasar CLI usage established in C4-015. If the flag names differ, use the correct ones from that issue.

## File Layout After Generation

```
apps/shared/src/contracts/game/
  propertyNft.ts
  landToken.ts
  marketplace.ts
  engine.ts
  index.ts        ← barrel export for all four clients
```

## Barrel Export

Create `apps/shared/src/contracts/game/index.ts`:

```typescript
export * from "./propertyNft";
export * from "./landToken";
export * from "./marketplace";
export * from "./engine";
```

And re-export from `apps/shared/src/contracts/index.ts`:

```typescript
export * from "./game";
```

## Updating akkuea-land

Replace the placeholder `buildXXXXdr` functions across the action hooks in `apps/akkuea-land/src/hooks/` with real calls to the generated clients. Concretely:

- `usePropertyActions.ts`: `buildBuyXdr`, `buildImproveXdr`, `buildListXdr`, `buildClaimXdr`
- `ClaimLandStep.tsx`: faucet call via `LandTokenClient.faucet()`
- `ClaimPropertyStep.tsx`: starter claim via `GameEngineClient.claim_starter()`

This completes the connection between `pollar.signAndSubmitTx` and the on-chain contracts.

## Definition of Done

- Generated clients for all four game contracts are committed to the repo.
- Clients are exported from the shared package.
- `bun run type-check` passes in `apps/shared` and `apps/webapp`.
- All CI workflows pass on the pull request.
