# Assumptions

## Issue #983 — Real `claim_rental` in the Akkuea Land dashboard (2026-07-16)

- **Treasury = deployer identity.** The testnet deploy (`scripts/deploy-game-contracts.sh`) uses a freshly generated, friendbot-funded CLI identity (`game-deployer`) as both deployer and treasury, so the same key that owns all 400 tiles can be imported into Freighter and sign claims in the browser. Testnet-only key, never committed.
- **Mock property ids changed, not the parser.** Dashboard mock ids `prop-1`..`prop-4` were invalid for `propertyIdToU32` (accepts numeric strings or `prop-<row>-<col>`); they were renamed to `prop-0-1`..`prop-0-4` rather than extending the parser, whose behavior is pinned by tests and used by other call sites.
- **Contract IDs live in `.env.local` only.** Per the issue's scope, the deployed game contract IDs are documented in `apps/akkuea-land/.env.example` and `docs/deployment/deploy-game-contracts.md`, not added to `apps/shared/src/contracts.testnet.json`.
- **`waitForSorobanTx` timeout returns `"pending"` and is treated as success** — pre-existing behavior shared with `usePropertyActions`, left unchanged for minimal scope.
- **Dashboard accrual is client-computed** (`computeAccruedIncome` with mock `lastClaimedLedger` values) and can disagree with on-chain accrual; if less than one epoch has passed on-chain, simulation fails with `Error(Contract, #4)` and is surfaced as a friendly per-property failure ("nothing to claim yet"), not a crash.
