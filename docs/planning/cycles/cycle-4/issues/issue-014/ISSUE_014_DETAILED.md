# C4-014: Integrate Pollar as Embedded Wallet SDK

## Issue Metadata

| Attribute       | Value                     |
| --------------- | ------------------------- |
| Issue ID        | C4-014                    |
| Area            | WEBAPP                    |
| Difficulty      | Medium                    |
| Labels          | frontend, stellar, medium |
| Dependencies    | C4-012                    |
| Estimated Lines | 150-250                   |

## Overview

Pollar (pollar.xyz) is an embedded wallet and onboarding SDK for Stellar. It is not a governance platform. Pollar is comparable to Privy on EVM chains: it handles social login (Google, GitHub, email OTP) and Freighter/Albedo passthrough, automatically provisions non-custodial Stellar wallets, and provides a `signAndSubmitTx` API with fee-bump sponsorship so users never need to hold XLM for transaction fees.

This issue adds Pollar as a `WalletProvider` in `apps/webapp` following the modular architecture from C4-012. Users who sign in via Pollar get a Stellar address just like any other provider. No governance page is created.

## Prerequisites

Before writing code, verify the following at `https://docs.pollar.xyz`:

1. The exact npm package names — expected: `@pollar/react`, `@pollar/core`.
2. Whether `usePollar()` exposes `address` directly or through a nested wallet object.
3. The exact shape of the hook return: `{ wallet, login, logout, signAndSubmitTx, loading }` or similar.
4. What error is thrown when a user cancels the login modal.
5. Whether `PollarProvider` is the correct root component name and what props it accepts.

Do not guess at method names. If the API differs from what is documented here, implement it correctly and note the difference in the pull request.

## Installation

```bash
cd apps/webapp
bun add @pollar/react @pollar/core
```

## Environment Variables

Add to `apps/webapp/.env.example`:

```env
# Pollar publishable API key — get one at https://pollar.xyz
# Testnet keys start with pub_testnet_
NEXT_PUBLIC_POLLAR_API_KEY=pub_testnet_your_key_here
```

Obtain a key from the Pollar dashboard. Testnet keys start with `pub_testnet_`. Do not commit secret keys (`sec_testnet_...`) to the repository.

## Design Note: signAndSubmitTx vs signTransaction

The `WalletProvider` interface from C4-012 defines:

```typescript
signTransaction: (xdr: string, networkPassphrase: string) => Promise<string>;
```

This returns a signed XDR string, leaving submission to the caller. Pollar does not expose a bare sign step — `signAndSubmitTx(xdr)` signs and submits atomically with fee-bump sponsorship and returns `void` (or a transaction hash).

Two resolution options:

**Option A — Extend the interface (preferred):** Add an optional `submitTransaction` method to `WalletProvider`. Providers that sign-and-submit natively (Pollar) implement `submitTransaction` instead of `signTransaction`. The app's transaction dispatch logic checks for `submitTransaction` first.

**Option B — Wrap and return original XDR:** Have `signTransaction` call `pollar.signAndSubmitTx` internally, and on success return the original XDR unchanged. This is a lie to the interface but avoids a breaking change to `WalletProvider`. Only acceptable if Option A is too disruptive at the time of implementation.

Document the chosen option in the pull request.

## Provider Implementation

Create `apps/webapp/src/services/wallet/providers/pollar.ts`:

```typescript
import type { WalletProvider, WalletAccount } from "../types";

// Pollar's hooks must run inside a React context.
// This provider is a bridge — actual state comes from PollarWrapper.
let pollarInterface: {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  getAddress: () => string | null;
  signAndSubmitTx: (xdr: string) => Promise<void>;
} | null = null;

export function setPollarInterface(iface: typeof pollarInterface) {
  pollarInterface = iface;
}

export const pollarProvider: WalletProvider = {
  id: "pollar",
  name: "Google, GitHub, or Email",
  description: "Sign in with a social account. No wallet extension required.",
  isAvailable: () => typeof window !== "undefined",

  connect: async () => {
    if (!pollarInterface) throw new Error("Pollar not initialized");
    await pollarInterface.connect();
    const address = pollarInterface.getAddress();
    if (!address)
      throw new Error("Pollar login did not return a Stellar address");
    return {
      address,
      displayName: address.slice(0, 6) + "..." + address.slice(-4),
    };
  },

  disconnect: async () => {
    await pollarInterface?.disconnect();
  },

  signTransaction: async (xdr, _networkPassphrase) => {
    if (!pollarInterface) throw new Error("Pollar not initialized");
    // Pollar signs and submits atomically. See Design Note above.
    // If Option A is chosen, this method should throw and callers use submitTransaction instead.
    // If Option B is chosen, call signAndSubmitTx and return the original xdr.
    await pollarInterface.signAndSubmitTx(xdr);
    return xdr;
  },

  getAccount: () => {
    const address = pollarInterface?.getAddress();
    return address ? { address } : null;
  },
};
```

## PollarWrapper Component

Pollar's React SDK requires a `PollarProvider` component at the app root. Create `apps/webapp/src/components/auth/PollarWrapper.tsx`:

```typescript
'use client';

import { PollarProvider, usePollar } from '@pollar/react';
import { useEffect } from 'react';
import { setPollarInterface } from '@/services/wallet/providers/pollar';

function PollarBridge({ children }: { children: React.ReactNode }) {
  const { wallet, login, logout, signAndSubmitTx, loading } = usePollar();

  useEffect(() => {
    setPollarInterface({
      connect: login,
      disconnect: logout,
      getAddress: () => wallet?.address ?? null,
      signAndSubmitTx: async (xdr) => {
        if (!wallet) throw new Error('Pollar: no wallet connected');
        await signAndSubmitTx(xdr);
      },
    });
  }, [wallet, login, logout, signAndSubmitTx]);

  return <>{children}</>;
}

export function PollarWrapper({ children }: { children: React.ReactNode }) {
  return (
    <PollarProvider apiKey={process.env.NEXT_PUBLIC_POLLAR_API_KEY!}>
      <PollarBridge>{children}</PollarBridge>
    </PollarProvider>
  );
}
```

The `usePollar` hook shape above must be verified against the current Pollar documentation. If the hook returns a different structure, adjust accordingly and document the change.

## Provider Registration

In `apps/webapp/src/components/Providers.tsx`, add `PollarWrapper` and register the provider:

```typescript
import { PollarWrapper } from "@/components/auth/PollarWrapper";
import { registerProvider } from "@/services/wallet/registry";
import { pollarProvider } from "@/services/wallet/providers/pollar";

registerProvider(pollarProvider);

// In the component tree:
// <PollarWrapper>
//   <ExistingProviders />
// </PollarWrapper>
```

## Login UI

The login modal already renders providers from `getAvailableProviders()`. Because `pollarProvider.isAvailable()` returns `true` in all browser environments, it will appear automatically. The `name` field ("Google, GitHub, or Email") and `description` field populate the UI without additional changes to the modal.

If the login modal shows a provider icon, add a Pollar logo asset to `apps/webapp/public/providers/pollar.svg`.

## Definition of Done

- `@pollar/react` and `@pollar/core` are installed.
- `PollarWrapper` wraps the app and wires `usePollar` to `setPollarInterface`.
- `pollarProvider` conforms to the `WalletProvider` interface from C4-012.
- Users can sign in via Google, GitHub, or email OTP through Pollar.
- The connected address is a valid Stellar G-address.
- The `signAndSubmitTx` vs `signTransaction` mismatch is resolved and documented in the pull request.
- All existing providers (stellar-wallets-kit, smart-account-kit, Privy) continue to work.
- `NEXT_PUBLIC_POLLAR_API_KEY` is added to `.env.example` with a comment.
- All CI workflows pass on the pull request.
