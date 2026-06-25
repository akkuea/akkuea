# C4-012: Integrate smart-account-kit as a Modular Wallet Provider

## Issue Metadata

| Attribute       | Value                   |
| --------------- | ----------------------- |
| Issue ID        | C4-012                  |
| Area            | WEBAPP                  |
| Difficulty      | High                    |
| Labels          | frontend, stellar, high |
| Dependencies    | None                    |
| Estimated Lines | 250-400                 |

## Overview

This issue has two parts: designing a modular wallet provider architecture and implementing `smart-account-kit` within it. The architecture is designed so that Privy (C4-013) and Pollar (C4-014) can be added as additional providers in subsequent issues without modifying the core.

## Prerequisites

Before writing code, read the `smart-account-kit` repository at `https://github.com/kalepail/smart-account-kit` to understand its API. Specifically understand: how it initializes, what it requires from the host application, how it signs transactions, and what its connection lifecycle looks like. This reading is not optional; the interface design depends on it.

## Provider Interface Design

Create `apps/webapp/src/services/wallet/types.ts`:

```typescript
export interface WalletAccount {
  address: string;
  displayName?: string;
  isSmartAccount?: boolean;
}

export interface WalletProvider {
  id: string;
  name: string;
  description: string;
  isAvailable: () => boolean;
  connect: () => Promise<WalletAccount>;
  disconnect: () => Promise<void>;
  signTransaction: (xdr: string, networkPassphrase: string) => Promise<string>;
  getAccount: () => WalletAccount | null;
}
```

The `id` field is a stable string that identifies the provider (e.g., `'stellar-wallets-kit'`, `'smart-account-kit'`, `'privy'`). The `isAvailable` method returns whether the provider can be used in the current environment (some providers require browser extensions; others work everywhere).

## Provider Registry

Create `apps/webapp/src/services/wallet/registry.ts`:

```typescript
import type { WalletProvider } from "./types";

const providers: Map<string, WalletProvider> = new Map();

export function registerProvider(provider: WalletProvider) {
  providers.set(provider.id, provider);
}

export function getProvider(id: string): WalletProvider | undefined {
  return providers.get(id);
}

export function getAvailableProviders(): WalletProvider[] {
  return Array.from(providers.values()).filter((p) => p.isAvailable());
}
```

## stellar-wallets-kit Provider

Create `apps/webapp/src/services/wallet/providers/stellarWalletsKit.ts` that wraps the existing `@creit.tech/stellar-wallets-kit` integration and makes it conform to `WalletProvider`. The implementation logic already exists in `apps/webapp/src/components/auth/hooks/useWallet.hook.ts`; this step refactors it into the new interface.

## smart-account-kit Provider

Create `apps/webapp/src/services/wallet/providers/smartAccount.ts`:

```typescript
import type { WalletProvider, WalletAccount } from "../types";

let connectedAccount: WalletAccount | null = null;

export const smartAccountProvider: WalletProvider = {
  id: "smart-account-kit",
  name: "Smart Account",
  description: "Programmable Stellar account with multi-sig and session keys",
  isAvailable: () => true,

  connect: async () => {
    // Initialize smart-account-kit here
    // Follow the kit's documentation for the initialization flow
    // Return a WalletAccount with the connected address
    throw new Error("Implement using smart-account-kit API");
  },

  disconnect: async () => {
    connectedAccount = null;
  },

  signTransaction: async (xdr, networkPassphrase) => {
    // Use smart-account-kit's signing method
    throw new Error("Implement using smart-account-kit API");
  },

  getAccount: () => connectedAccount,
};
```

The comment stubs are intentional: the actual implementation depends on the `smart-account-kit` API you read in the prerequisite step. Do not guess at the API.

## Wallet Context Refactor

Update `apps/webapp/src/components/auth/hooks/useWallet.hook.ts` to consume the provider registry instead of directly using `stellar-wallets-kit`. The hook should expose the currently active provider's account and delegate signing to it.

## Login UI

The wallet connection modal or flow should list available providers from `getAvailableProviders()` and allow the user to select one. Each provider's `name` and `description` fields populate the UI. This replaces any hardcoded wallet list that currently exists.

## Provider Registration

In `apps/webapp/src/components/Providers.tsx`, register the providers at application startup:

```typescript
import { registerProvider } from "@/services/wallet/registry";
import { stellarWalletsKitProvider } from "@/services/wallet/providers/stellarWalletsKit";
import { smartAccountProvider } from "@/services/wallet/providers/smartAccount";

registerProvider(stellarWalletsKitProvider);
registerProvider(smartAccountProvider);
```

## Definition of Done

- `WalletProvider` interface is defined and documented.
- Provider registry is implemented.
- `stellar-wallets-kit` is wrapped as a conforming provider.
- `smart-account-kit` is implemented as a conforming provider.
- Login UI uses the provider registry.
- All existing wallet tests pass.
- All CI workflows pass on the pull request.
