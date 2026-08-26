# Generate Typed Soroban TypeScript Client Bindings for the Pilot Contract Suite

## Context

Every other contract system in this monorepo already has generated, typed TypeScript client bindings in `@akkuea/shared`: the four game contracts live under `apps/shared/src/contracts/game/generated/{engine,land-token,marketplace,property-nft}/`, and `defi-rwa`/DeFindex have `apps/shared/src/contracts/generated/{rwaDefi,defindexVault}.ts`. The three pilot contracts - `pilot-income-token`, `pilot-whitelist`, `pilot-payout-split`, the contracts the actual live product runs on - have none. `apps/api/src/config/contracts.ts` only exposes raw contract-ID getters, and consumers are left to hand-build Soroban invocations against those IDs. This is a real gap on the pilot's own critical path: the in-progress read-only dashboard (#1061 / C6-002) is specified to "read exclusively from Soroban RPC and contract events emitted by the C6-001 contracts," and without typed bindings that team either builds ad hoc raw-XDR calls themselves under feature-delivery pressure, or duplicates this work mid-feature.

## What Needs to Be Done

- Generate TypeScript client bindings for all three pilot contracts using the same tool implied by the existing `game/generated` output (`stellar contract bindings typescript`), against the testnet contract IDs already recorded in `apps/shared/src/contracts.testnet.json` (`PILOT_WHITELIST`, `PILOT_INCOME_TOKEN`, `PILOT_PAYOUT_SPLIT`).
- Place the generated output at `apps/shared/src/contracts/pilot/generated/{income-token,whitelist,payout-split}/`, mirroring the existing `game/` directory structure exactly so the pattern is instantly recognizable to anyone who has worked with the game contracts.
- Add a thin, hand-written wrapper layer over the generated clients if that pattern already exists for the game or defi-rwa clients (check first and reuse it); if no such wrapper convention exists yet, export the generated clients directly and note that decision.
- Add a documented, scripted regeneration path (an `apps/shared` package script) so bindings can be regenerated after a redeploy without undocumented tribal knowledge of the exact CLI invocation.

## Acceptance Criteria

- Three new generated client packages exist under `apps/shared/src/contracts/pilot/generated/`, and `apps/shared` builds with `bun run build` with zero TypeScript errors.
- At least one test (or, if a live network call genuinely cannot run in CI, a clearly documented manual verification transcript in the PR description) proves the generated `pilot-whitelist` client's `is_approved` read against the real testnet contract ID returns a boolean without any manual XDR handling by the caller.
- A regeneration script exists and is documented (in `apps/shared`'s README or `CONTRIBUTING.md`); no generated file is hand-edited after generation.
- The PR description states explicitly whether this issue also migrates `apps/api`'s existing pilot contract-call code (e.g. `WhitelistService`/`StellarService`) to the new generated clients, or leaves that migration as an explicitly named fast-follow - either is acceptable, but it must be a stated decision, not left ambiguous.
- All five required CI workflows pass on the pull request, including `shared-ci.yml`.

## Quality Standard

This is developer-experience infrastructure for the pilot's actual critical path, not a nice-to-have. The generated bindings must be regenerable by a future contributor from documented instructions alone, without asking someone how the game contracts' bindings were originally produced. Treat the pilot contracts with the same rigor already applied to every other contract system in this repository - their absence of typed bindings until now is the anomaly, not the norm.
