# C4-015: Integrate Quasar for Typed Soroban Contract Invocations

## Issue Metadata

| Attribute       | Value                          |
| --------------- | ------------------------------ |
| Issue ID        | C4-015                         |
| Area            | SHARED                         |
| Difficulty      | High                           |
| Labels          | shared, stellar, backend, high |
| Dependencies    | None                           |
| Estimated Lines | 200-350                        |

## Overview

The current contract invocation code in `apps/api/src/services/StellarService.ts` manually constructs Soroban transactions. Quasar replaces this with a typed, declarative client generated from the contract ABI. This issue covers the integration, the typed client creation, and the refactor of existing calls.

## Prerequisites

Read the Quasar repository at `https://github.com/salazarsebas/Quasar` before starting. Understand:

- How Quasar generates or defines typed clients for a Soroban contract.
- What inputs it needs: the contract ID, the network passphrase, a server URL, and a source keypair or signer.
- Whether Quasar is a CLI tool that generates code, an SDK you instantiate at runtime, or both.
- The exact npm package name and installation method.

## Installation

Based on the Quasar documentation, install it in the shared package since both the API and the webapp will use the typed clients:

```bash
cd apps/shared
bun add quasar  # adjust package name per actual documentation
```

## Contract Client Structure

Create the directory `apps/shared/src/contracts/` with the following files:

```
apps/shared/src/contracts/
  realEstateToken.ts
  defiLending.ts
  index.ts
```

Each file defines a factory function that accepts connection parameters and returns a typed client. The client methods correspond directly to the contract's public functions.

Example structure for the real estate token contract:

```typescript
// apps/shared/src/contracts/realEstateToken.ts
import type { SorobanClient } from "quasar"; // adjust per actual API

export interface RealEstateTokenClient {
  mint: (params: { to: string; shares: bigint }) => Promise<void>;
  transfer: (params: {
    from: string;
    to: string;
    shares: bigint;
  }) => Promise<void>;
  balanceOf: (params: { address: string }) => Promise<bigint>;
  totalShares: () => Promise<bigint>;
}

export function createRealEstateTokenClient(params: {
  contractId: string;
  networkPassphrase: string;
  rpcUrl: string;
  signer?: (xdr: string) => Promise<string>;
}): RealEstateTokenClient {
  // Initialize using Quasar's client factory
  // Follow Quasar's actual API from the documentation
  throw new Error("Implement using Quasar API");
}
```

The function signatures above are illustrative. The actual method names and parameter shapes must match the contracts in `apps/contracts/contracts/defi-rwa/src/`.

## Reviewing the Existing Contract Calls

Before refactoring, read `apps/api/src/services/StellarService.ts` and list every contract method it calls. These are the methods that the typed client must cover. Common calls to look for:

- Token minting after property tokenization
- Share transfer on investment
- Balance queries
- Lending pool deposit and withdrawal
- Borrow and repayment

## Refactoring StellarService.ts

After the typed clients are created, refactor `StellarService.ts` to use them instead of raw XDR construction. The refactored version should:

1. Instantiate the typed clients using the contract IDs from environment variables.
2. Call client methods instead of manually building transactions.
3. Remain backward compatible: the public interface of `StellarService` should not change, only its internal implementation.

## Export from Shared Index

Add the new clients to `apps/shared/src/index.ts`:

```typescript
export { createRealEstateTokenClient } from "./contracts/realEstateToken";
export { createDefiLendingClient } from "./contracts/defiLending";
export type { RealEstateTokenClient, DefiLendingClient } from "./contracts";
```

## Testing

For each refactored contract call, add or update a test in `apps/api/src/tests/` that verifies the call is made with the correct parameters. Tests for Soroban calls should mock the network layer and assert on the XDR or method invocations, not on live network responses.

## Definition of Done

- Quasar is installed and the typed clients are defined.
- Clients exist for both the real estate token and DeFi lending contracts.
- `StellarService.ts` uses the typed clients for all contract interactions.
- Typed clients are exported from `apps/shared/src/index.ts`.
- All existing tests pass.
- `bun run type-check` passes across all packages.
- All CI workflows pass on the pull request.
