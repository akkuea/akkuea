"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import {
  privyProvider,
  type StellarWalletRef,
} from "@/services/wallet/privy.provider";

interface LinkedAccountLike {
  type: string;
  id?: string | null;
  address?: string;
  chainType?: string;
  chain_type?: string;
}

function getWalletChainType(account: LinkedAccountLike): string | undefined {
  return account.chainType ?? account.chain_type;
}

function findStellarWalletInUser(
  linkedAccounts: LinkedAccountLike[] | undefined,
): StellarWalletRef | null {
  if (!linkedAccounts) return null;

  const account = linkedAccounts.find(
    (a) => a.type === "wallet" && getWalletChainType(a) === "stellar",
  );
  if (!account?.id || !account.address) return null;

  return { id: account.id, address: account.address };
}

async function ensureStellarWallet(
  getAccessToken: () => Promise<string | null>,
): Promise<StellarWalletRef> {
  let accessToken: string | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    accessToken = await getAccessToken();
    if (accessToken) break;
    await new Promise((r) => setTimeout(r, 300));
  }

  if (!accessToken) {
    throw new Error("Not authenticated with Privy");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch("/api/privy/create-wallet", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err.error ?? `Wallet creation failed: ${res.status}`);
    }

    return res.json();
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Wallet creation timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function signStellarTransaction(
  getAccessToken: () => Promise<string | null>,
  walletId: string,
  address: string,
  txXdr: string,
  networkPassphrase: string,
): Promise<string> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error("Not authenticated with Privy");
  }

  const res = await fetch("/api/privy/sign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ walletId, address, txXdr, networkPassphrase }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? `Signing failed: ${res.status}`);
  }

  const { signedXdr } = await res.json();
  return signedXdr;
}

type AuthWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

function PrivyBridge() {
  const { login, logout, authenticated, ready, getAccessToken, user } =
    usePrivy();
  const authWaiters = useRef<AuthWaiter[]>([]);
  const privyStateRef = useRef({
    login,
    logout,
    authenticated,
    ready,
    getAccessToken,
    user,
  });

  useLayoutEffect(() => {
    privyStateRef.current = {
      login,
      logout,
      authenticated,
      ready,
      getAccessToken,
      user,
    };
  });

  const cancelAuthWait = useCallback(() => {
    for (const waiter of authWaiters.current) {
      clearTimeout(waiter.timeoutId);
      waiter.reject(new Error("Connect cancelled"));
    }
    authWaiters.current = [];
  }, []);

  const wireStellarWallet = useCallback((wallet: StellarWalletRef) => {
    const { login, logout, getAccessToken } = privyStateRef.current;
    privyProvider.setPrivyInterface({
      connect: () => Promise.resolve(login()),
      disconnect: logout,
      getAddress: () => wallet.address,
      signTransaction: (txXdr, networkPassphrase) =>
        signStellarTransaction(
          getAccessToken,
          wallet.id,
          wallet.address,
          txXdr,
          networkPassphrase,
        ),
    });
  }, []);

  // Resolve any connect() calls waiting for authentication
  useEffect(() => {
    if (!authenticated || authWaiters.current.length === 0) return;

    for (const waiter of authWaiters.current) {
      clearTimeout(waiter.timeoutId);
      waiter.resolve();
    }
    authWaiters.current = [];
  }, [authenticated]);

  // Auth interface is stable — reads latest login/logout via ref
  useLayoutEffect(() => {
    privyProvider.setAuthInterface({
      login: () => privyStateRef.current.login(),
      logout: () => privyStateRef.current.logout(),
    });

    return () => {
      privyProvider.setAuthInterface(null);
    };
  }, []);

  // Bridge helpers are registered once when Privy is ready and kept stable
  // (reads dynamic state via ref so OAuth callbacks don't tear down the bridge).
  useLayoutEffect(() => {
    if (!ready) return;

    privyProvider.setBridgeHelpers({
      isAuthenticated: () => privyStateRef.current.authenticated,
      waitForAuthenticated: (timeoutMs: number) =>
        new Promise<void>((resolve, reject) => {
          if (privyStateRef.current.authenticated) {
            resolve();
            return;
          }

          const timeoutId = setTimeout(() => {
            authWaiters.current = authWaiters.current.filter(
              (w) => w.timeoutId !== timeoutId,
            );
            reject(new Error("Login cancelled or timed out"));
          }, timeoutMs);

          authWaiters.current.push({ resolve, reject, timeoutId });
        }),
      cancelAuthWait,
      getExistingStellarWallet: () =>
        findStellarWalletInUser(privyStateRef.current.user?.linkedAccounts),
      ensureStellarWallet: () =>
        ensureStellarWallet(privyStateRef.current.getAccessToken),
      wireWallet: wireStellarWallet,
    });

    return () => {
      privyProvider.setBridgeHelpers(null);
    };
  }, [ready, cancelAuthWait, wireStellarWallet]);

  // Prefetch: wire returning users' existing Stellar wallet on load
  useEffect(() => {
    if (!ready || !authenticated) {
      privyProvider.setPrivyInterface(null);
      return;
    }
    const existing = findStellarWalletInUser(user?.linkedAccounts);
    if (existing) {
      wireStellarWallet(existing);
    }
  }, [ready, authenticated, user, wireStellarWallet]);

  return null;
}

export function PrivyWrapper({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
      }}
    >
      <PrivyBridge />
      {children}
    </PrivyProvider>
  );
}
