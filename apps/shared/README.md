# @akkuea/shared

Shared types, validation, Stellar SDK helpers, contract-ID resolution, and test factories for the Akkuea monorepo. Imported identically by all three TypeScript workspaces (`apps/webapp`, `apps/api`, `apps/akkuea-land`).

## Generating Soroban TypeScript Bindings

Contract client bindings are generated using `stellar contract bindings typescript` against deployed contract IDs from `contracts.testnet.json` (or `contracts.mainnet.json`). The generated output is post-processed to follow the project's quality standards (inlined into single files, `import type` for type-only imports, `globalThis` polyfill guard, `override` on deploy/options, local `Timepoint`/`Duration` aliases).

### Pilot contracts

```bash
cd apps/shared
bun run generate:pilot-bindings
```

This regenerates the typed clients for all three pilot contracts:

| Contract | Wrapper module | Generated source |
|----------|---------------|-----------------|
| `pilot-whitelist` | `src/contracts/pilot/whitelist.ts` | `src/contracts/pilot/generated/whitelist/` |
| `pilot-income-token` | `src/contracts/pilot/income-token.ts` | `src/contracts/pilot/generated/income-token/` |
| `pilot-payout-split` | `src/contracts/pilot/payout-split.ts` | `src/contracts/pilot/generated/payout-split/` |

After regeneration:

1. Run `bun run type-check` to verify no type errors.
2. Run `bun run format` to fix formatting.
3. Run `bun test` to confirm existing tests still pass.

### Game contracts

Game contract bindings (`game-property-nft`, `game-land-token`, `game-engine`, `game-marketplace`) follow the same pattern under `src/contracts/game/`.

## Re-adding contract IDs

After a redeploy, update the appropriate JSON file:

- Testnet: `apps/shared/src/contracts.testnet.json`
- Mainnet: `apps/shared/src/contracts.mainnet.json`
- Game contracts (testnet): `apps/shared/src/contracts/game-contracts.testnet.json`

Then regenerate bindings as described above.
