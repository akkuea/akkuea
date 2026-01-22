# C1-008: Implement Real Wallet Connection with Stellar Wallets Kit

## Detailed Implementation Guide

## Issue Metadata

| Attribute | Value |
|-----------|-------|
| Issue ID | C1-008 |
| Title | Implement real wallet connection with Stellar Wallets Kit |
| Area | WEBAPP |
| Difficulty | High |
| Labels | frontend, wallet, stellar, high |
| Dependencies | None |
| Estimated Lines | 200-300 |

## Overview

This issue replaces the mock wallet implementation with real Stellar wallet integration using Stellar Wallets Kit. This kit is framework agnostic and provides a unified interface for multiple Stellar wallets including xBull Wallet, Freighter, Albedo, Rabet, WalletConnect, Lobstr, Hana, Hot Wallet, and Klever Wallet.

## Prerequisites

- Understanding of Stellar accounts and assets
- Familiarity with React hooks and Zustand state management
- Node.js/Bun package manager

## Supported Wallets

Stellar Wallets Kit supports the following wallets out of the box:

| Wallet | Description |
|--------|-------------|
| xBull Wallet | Full-featured Stellar wallet |
| Freighter | Popular browser extension |
| Albedo | Web-based Stellar signer |
| Rabet | Browser extension wallet |
| WalletConnect | Cross-platform wallet protocol |
| Lobstr | Mobile and web wallet |
| Hana | Stellar wallet |
| Hot Wallet | Stellar wallet |
| Klever Wallet | Multi-chain wallet |

## Implementation Steps

### Step 1: Install Dependencies

```bash
cd apps/webapp
bun add @creit.tech/stellar-wallets-kit zustand stellar-sdk
```

Or using npm:
```bash
npx jsr add @creit-tech/stellar-wallets-kit
npm install zustand stellar-sdk
```

### Step 2: Create Wallet Kit Configuration

Create `apps/webapp/src/components/auth/constant/walletKit.ts`:

```typescript
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
} from "@creit.tech/stellar-wallets-kit";

/**
 * Initialize Stellar Wallets Kit with all supported modules
 * The kit provides a unified interface for multiple Stellar wallets
 */
export const kit: StellarWalletsKit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  selectedWalletId: FREIGHTER_ID, // Default wallet
  modules: allowAllModules(),
});

/**
 * Network configuration
 */
export const NETWORK_CONFIG = {
  testnet: WalletNetwork.TESTNET,
  mainnet: WalletNetwork.PUBLIC,
};
```

### Step 3: Create Authentication Types

Create `apps/webapp/src/components/auth/store/data/@types/authentication.entity.ts`:

```typescript
/**
 * Authentication state interface
 */
export interface AuthenticationState {
  address: string;
  walletName: string;
  isConnected: boolean;
}

/**
 * Authentication store actions
 */
export interface AuthenticationActions {
  connectWalletStore: (address: string, walletName: string) => void;
  disconnectWalletStore: () => void;
  setAddress: (address: string) => void;
}

/**
 * Complete authentication store type
 */
export type AuthenticationStore = AuthenticationState & AuthenticationActions;
```

### Step 4: Create Authentication Slice

Create `apps/webapp/src/components/auth/store/data/slices/authentication.slice.ts`:

```typescript
import { StateCreator } from "zustand";
import { AuthenticationStore } from "../@types/authentication.entity";

/**
 * Initial authentication state
 */
const initialState = {
  address: "",
  walletName: "",
  isConnected: false,
};

/**
 * Authentication slice for Zustand store
 */
export const createAuthenticationSlice: StateCreator<AuthenticationStore> = (
  set
) => ({
  ...initialState,

  connectWalletStore: (address: string, walletName: string) => {
    set({
      address,
      walletName,
      isConnected: true,
    });
  },

  disconnectWalletStore: () => {
    set({
      address: "",
      walletName: "",
      isConnected: false,
    });
  },

  setAddress: (address: string) => {
    set({ address });
  },
});
```

### Step 5: Create Zustand Store

Create `apps/webapp/src/components/auth/store/data/index.ts`:

```typescript
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createAuthenticationSlice } from "./slices/authentication.slice";
import { AuthenticationStore } from "./@types/authentication.entity";

/**
 * Global authentication store with persistence
 * Stores wallet connection state in localStorage
 */
export const useGlobalAuthenticationStore = create<AuthenticationStore>()(
  persist(
    (...a) => ({
      ...createAuthenticationSlice(...a),
    }),
    {
      name: "akkuea-wallet-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        address: state.address,
        walletName: state.walletName,
        isConnected: state.isConnected,
      }),
    }
  )
);

// Export types
export type { AuthenticationState, AuthenticationActions, AuthenticationStore } from "./@types/authentication.entity";
```

### Step 6: Create useWallet Hook

Create `apps/webapp/src/components/auth/hooks/useWallet.hook.ts`:

```typescript
import { ISupportedWallet } from "@creit.tech/stellar-wallets-kit";
import { useGlobalAuthenticationStore } from "../store/data";
import { kit } from "@/components/auth/constant/walletKit";

/**
 * Custom hook for wallet operations
 * Provides connect and disconnect functionality using Stellar Wallets Kit
 */
export const useWallet = () => {
  const { connectWalletStore, disconnectWalletStore } =
    useGlobalAuthenticationStore();

  /**
   * Opens the wallet selection modal and connects to the selected wallet
   */
  const connectWallet = async () => {
    await kit.openModal({
      modalTitle: "Connect to your favorite wallet",
      onWalletSelected: async (option: ISupportedWallet) => {
        kit.setWallet(option.id);

        const { address } = await kit.getAddress();
        const { name } = option;

        connectWalletStore(address, name);
      },
    });
  };

  /**
   * Disconnects the current wallet and clears state
   */
  const disconnectWallet = async () => {
    disconnectWalletStore();
  };

  /**
   * Signs a transaction using the connected wallet
   * @param xdr - Transaction XDR to sign
   * @param networkPassphrase - Network passphrase for the transaction
   * @returns Signed transaction XDR
   */
  const signTransaction = async (
    xdr: string,
    networkPassphrase: string
  ): Promise<string> => {
    const { address } = await kit.getAddress();
    const { signedTxXdr } = await kit.signTransaction(xdr, {
      networkPassphrase,
      address,
    });
    return signedTxXdr;
  };

  /**
   * Gets the current connected address
   * @returns The connected wallet address
   */
  const getAddress = async (): Promise<string> => {
    const { address } = await kit.getAddress();
    return address;
  };

  return {
    handleConnect: connectWallet,
    handleDisconnect: disconnectWallet,
    signTransaction,
    getAddress,
  };
};
```

### Step 7: Create Stellar Service (Optional - for balance fetching)

Create `apps/webapp/src/services/stellar/index.ts`:

```typescript
import { Horizon, Networks } from "stellar-sdk";

/**
 * Horizon server instances
 */
const horizonServers = {
  TESTNET: new Horizon.Server("https://horizon-testnet.stellar.org"),
  PUBLIC: new Horizon.Server("https://horizon.stellar.org"),
};

/**
 * Get Horizon server for network
 */
export function getHorizonServer(network: string): Horizon.Server {
  return network === "PUBLIC" ? horizonServers.PUBLIC : horizonServers.TESTNET;
}

/**
 * Account balance with asset info
 */
export interface AccountBalance {
  asset: string;
  assetCode: string;
  assetIssuer: string | null;
  balance: string;
  limit?: string;
}

/**
 * Fetch account balances from Horizon
 */
export async function fetchAccountBalances(
  publicKey: string,
  network: string = "TESTNET"
): Promise<AccountBalance[]> {
  const server = getHorizonServer(network);

  try {
    const account = await server.loadAccount(publicKey);

    return account.balances.map((balance: any) => {
      if (balance.asset_type === "native") {
        return {
          asset: "XLM",
          assetCode: "XLM",
          assetIssuer: null,
          balance: balance.balance,
        };
      }

      return {
        asset: `${balance.asset_code}:${balance.asset_issuer}`,
        assetCode: balance.asset_code,
        assetIssuer: balance.asset_issuer,
        balance: balance.balance,
        limit: balance.limit,
      };
    });
  } catch (error: any) {
    if (error.response?.status === 404) {
      // Account not found - return empty balances
      return [
        {
          asset: "XLM",
          assetCode: "XLM",
          assetIssuer: null,
          balance: "0",
        },
      ];
    }
    throw error;
  }
}

/**
 * Check if account exists on the network
 */
export async function accountExists(
  publicKey: string,
  network: string = "TESTNET"
): Promise<boolean> {
  const server = getHorizonServer(network);

  try {
    await server.loadAccount(publicKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get network passphrase
 */
export function getNetworkPassphrase(network: string): string {
  return network === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;
}
```

### Step 8: Update Connect Button Component

Update `apps/webapp/src/components/wallet/ConnectButton.tsx`:

```typescript
"use client";

import { useWallet } from "@/components/auth/hooks/useWallet.hook";
import { useGlobalAuthenticationStore } from "@/components/auth/store/data";
import { Button } from "@/components/ui/Button";

interface ConnectButtonProps {
  className?: string;
}

/**
 * Wallet connection button component
 * Shows connect/disconnect based on wallet state
 */
export function ConnectButton({ className }: ConnectButtonProps) {
  const { handleConnect, handleDisconnect } = useWallet();
  const { address, isConnected, walletName } = useGlobalAuthenticationStore();

  /**
   * Format address for display (truncated)
   */
  const shortAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : null;

  if (isConnected && address) {
    return (
      <Button variant="outline" className={className} onClick={handleDisconnect}>
        {shortAddress} ({walletName})
      </Button>
    );
  }

  return (
    <Button variant="primary" className={className} onClick={handleConnect}>
      Connect Wallet
    </Button>
  );
}
```

### Step 9: Usage Example in Page

Example usage in `apps/webapp/src/app/page.tsx`:

```typescript
"use client";

import { useWallet } from "@/components/auth/hooks/useWallet.hook";
import { useGlobalAuthenticationStore } from "@/components/auth/store/data";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { handleConnect, handleDisconnect } = useWallet();
  const address = useGlobalAuthenticationStore((state) => state.address);
  const walletName = useGlobalAuthenticationStore((state) => state.walletName);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <header className="mb-8">
        {address ? (
          <Button onClick={handleDisconnect}>
            Disconnect ({walletName})
          </Button>
        ) : (
          <Button onClick={handleConnect}>
            Connect Wallet
          </Button>
        )}
      </header>

      <main className="flex flex-col items-center gap-4">
        {address && (
          <div className="text-center">
            <p className="text-sm text-gray-500">Connected Address:</p>
            <p className="font-mono">{address}</p>
          </div>
        )}
      </main>
    </div>
  );
}
```

## File Structure

```
apps/webapp/src/
├── components/
│   ├── auth/
│   │   ├── constant/
│   │   │   └── walletKit.ts          # Stellar Wallets Kit initialization
│   │   ├── hooks/
│   │   │   └── useWallet.hook.ts     # Custom wallet hook
│   │   └── store/
│   │       └── data/
│   │           ├── @types/
│   │           │   └── authentication.entity.ts  # TypeScript types
│   │           ├── slices/
│   │           │   └── authentication.slice.ts   # Zustand slice
│   │           └── index.ts          # Store exports
│   ├── wallet/
│   │   └── ConnectButton.tsx         # Connect button component
│   └── ui/
│       └── button.tsx                # UI button component
└── services/
    └── stellar/
        └── index.ts                  # Stellar service (balances, etc.)
```

## Testing Guidelines

### Manual Testing Checklist

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Open modal | Click "Connect Wallet" | Modal opens showing available wallets |
| Select wallet | Click on a wallet in modal | Wallet connection initiated |
| Approve connection | Approve in wallet extension | Address shown, modal closes |
| Reject connection | Reject in wallet | Modal closes, no error |
| Disconnect | Click "Disconnect" | State cleared, shows connect button |
| Persistence | Reload page while connected | Stays connected |
| Balance display | After connection | XLM balance shown (if implemented) |
| Sign transaction | Initiate a transaction | Wallet prompts for signature |

### Test Scenarios

```typescript
// Test: Wallet connection
describe("Wallet Connection", () => {
  it("should open wallet modal on connect click", async () => {
    // Verify modal opens with wallet options
  });

  it("should store address after successful connection", async () => {
    // Verify address is stored in Zustand store
  });

  it("should clear state on disconnect", async () => {
    // Verify state is cleared
  });

  it("should persist connection across page reloads", async () => {
    // Verify localStorage persistence
  });
});
```

## Related Resources

| Resource | Link |
|----------|------|
| Stellar Wallets Kit Docs | https://stellarwalletskit.dev |
| Stellar Wallets Kit GitHub | https://github.com/Creit-Tech/Stellar-Wallets-Kit |
| Example Implementation PR | https://github.com/ScaffoldRust/SRust-Basic-Stellar-nextjs-bun/pull/16 |
| Zustand Documentation | https://zustand-demo.pmnd.rs/ |
| Stellar SDK | https://stellar.github.io/js-stellar-sdk/ |
| Horizon API | https://developers.stellar.org/api/horizon |

## Verification Checklist

| Item | Status |
|------|--------|
| Stellar Wallets Kit initialized | |
| Wallet modal opens correctly | |
| Connection flow complete | |
| Zustand store working | |
| Session persistence working | |
| Disconnect working | |
| Transaction signing ready | |
