# Integrate Quasar for Typed Soroban Contract Invocations

## Context

The platform's Soroban contract interactions are currently handled through direct calls in `apps/api/src/services/StellarService.ts` using the raw `@stellar/stellar-sdk` API. This approach requires manually constructing transaction envelopes, handling simulation, managing fees, and mapping XDR types, which is error-prone and difficult to audit.

Quasar is a typed invocation layer for Soroban contracts that reduces this boilerplate to clean, type-safe function calls. Integrating it through the shared package makes it available to both the API and the webapp, ensuring contract calls are consistent and verifiable regardless of where they originate.

## What Needs to Be Done

Integrate the Quasar library into the project following its documentation at `https://github.com/salazarsebas/Quasar`. Create typed contract client wrappers in `apps/shared/src/` for the deployed contracts. Refactor the existing Soroban calls in `StellarService.ts` to use these wrappers. Ensure the webapp can also call contracts directly through the same typed interface when needed.

## Acceptance Criteria

- Quasar is installed in `apps/shared` or as a shared dependency.
- Typed contract clients exist for the real estate token and DeFi lending contracts.
- The existing Soroban calls in `StellarService.ts` are refactored to use the typed clients.
- All refactored contract calls continue to work correctly on Stellar testnet.
- `bun run type-check` passes across all packages.
- All existing tests pass.
- All CI workflows pass on the submitted pull request.

## Files to Create or Modify

Create contract client files under `apps/shared/src/contracts/`. Modify `apps/api/src/services/StellarService.ts`. Update `apps/shared/src/index.ts` to export the new clients.

## Quality Standard

Read the Quasar documentation fully before writing implementation code. The typed clients must match the actual contract ABI, not an assumed interface. Test each refactored contract call against the Stellar testnet before submitting. All CI workflows must pass and no regressions are acceptable.
