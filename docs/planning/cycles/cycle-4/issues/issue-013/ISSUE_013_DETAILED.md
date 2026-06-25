# C4-013: Integrate Privy for Embedded Stellar Wallet Login

## Issue Metadata

| Attribute       | Value                   |
| --------------- | ----------------------- |
| Issue ID        | C4-013                  |
| Area            | WEBAPP                  |
| Difficulty      | High                    |
| Labels          | frontend, stellar, high |
| Dependencies    | C4-012                  |
| Estimated Lines | 150-250                 |

## Overview

Privy allows users to authenticate with email, Google, or other social providers and automatically provisions an embedded wallet. For Stellar, this means a user can onboard with just an email address and have a working Stellar keypair managed by Privy's secure enclave, without installing any browser extension.

## Prerequisites

Before starting, verify Privy's current Stellar support status at `https://docs.privy.io`. Privy has added Stellar wallet support and the key questions to confirm are:

- Is Stellar available as an embedded wallet chain?
- Does the Privy SDK expose a `signTransaction` method for Stellar XDR?
- What is the npm package name: `@privy-io/react-auth`, `@privy-io/server-auth`, or a Stellar-specific variant?

If Stellar support is limited or in beta, document the current state in the pull request and implement what is available. Do not implement workarounds that compromise the security model.

## Installation

```bash
cd apps/webapp
bun add @privy-io/react-auth
```

## Environment Variables

Add to `apps/webapp/.env.example`:

```
# Privy application ID from the Privy dashboard
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
```

Obtain a Privy app ID from `https://dashboard.privy.io`. Configure the app to support Stellar as a wallet chain in the Privy dashboard settings.

## Provider Implementation

Create `apps/webapp/src/services/wallet/providers/privy.ts`. The implementation wraps Privy's SDK in the `WalletProvider` interface:

```typescript
import type { WalletProvider, WalletAccount } from "../types";

// Privy provides hooks that must be called inside a React context.
// This provider acts as a bridge between the hook layer and the registry.
// The actual Privy state comes from the PrivyProvider component.

let privyInterface: {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  getAddress: () => string | null;
  signTransaction: (xdr: string) => Promise<string>;
} | null = null;

export function setPrivyInterface(iface: typeof privyInterface) {
  privyInterface = iface;
}

export const privyProvider: WalletProvider = {
  id: "privy",
  name: "Email or Social Login",
  description: "Sign in with email, Google, or Apple. No wallet required.",
  isAvailable: () => typeof window !== "undefined",

  connect: async () => {
    if (!privyInterface) throw new Error("Privy not initialized");
    await privyInterface.connect();
    const address = privyInterface.getAddress();
    if (!address) throw new Error("Privy connection did not return an address");
    return {
      address,
      displayName: address.slice(0, 6) + "..." + address.slice(-4),
    };
  },

  disconnect: async () => {
    await privyInterface?.disconnect();
  },

  signTransaction: async (xdr, networkPassphrase) => {
    if (!privyInterface) throw new Error("Privy not initialized");
    return privyInterface.signTransaction(xdr);
  },

  getAccount: () => {
    const address = privyInterface?.getAddress();
    return address ? { address } : null;
  },
};
```

## PrivyProvider Wrapper Component

Privy's React SDK requires a `PrivyProvider` component at the root of the app. Create `apps/webapp/src/components/auth/PrivyWrapper.tsx` that wraps the children with `PrivyProvider` and wires the Privy hooks to the provider interface via `setPrivyInterface`.

```typescript
'use client';

import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect } from 'react';
import { setPrivyInterface } from '@/services/wallet/providers/privy';

function PrivyBridge({ children }: { children: React.ReactNode }) {
  const { login, logout, authenticated } = usePrivy();
  const { wallets } = useWallets();

  useEffect(() => {
    const stellarWallet = wallets.find((w) => w.walletClientType === 'privy' /* adjust per Privy Stellar docs */);

    setPrivyInterface({
      connect: login,
      disconnect: logout,
      getAddress: () => stellarWallet?.address ?? null,
      signTransaction: async (xdr) => {
        if (!stellarWallet) throw new Error('No Stellar wallet');
        // Use Privy's signTransaction for Stellar XDR - verify the exact method in docs
        return stellarWallet.sign(xdr);
      },
    });
  }, [wallets, login, logout]);

  return <>{children}</>;
}

export function PrivyWrapper({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!} config={{ appearance: { theme: 'dark' } }}>
      <PrivyBridge>{children}</PrivyBridge>
    </PrivyProvider>
  );
}
```

Add `PrivyWrapper` to `apps/webapp/src/components/Providers.tsx` and register the `privyProvider` in the registry.

## Important Notes

The `signTransaction` implementation above uses a placeholder. The actual Privy Stellar signing API must be verified from the current documentation. Do not guess at method names. If the API differs, implement it correctly and update the type signature if needed.

## Definition of Done

- Privy SDK is installed and the `PrivyProvider` wraps the app.
- `privyProvider` conforms to the `WalletProvider` interface.
- Users can connect with email or social login via Privy.
- The connected address is a valid Stellar address.
- Transaction signing works for Stellar XDR.
- The provider appears in the login UI.
- Environment variables are documented in `.env.example`.
- All CI workflows pass on the pull request.
