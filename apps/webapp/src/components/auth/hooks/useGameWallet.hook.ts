"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WalletType } from "@pollar/core";
import { usePollar } from "@pollar/react";

type GameWalletNetwork = "testnet" | "mainnet";
type GameWalletAuthStep =
  | "idle"
  | "oauth"
  | "email"
  | "wallet"
  | "success"
  | "error"
  | "creating_session";

type GameWalletLoginInput =
  | { provider: "google" }
  | { provider: "email"; email: string }
  | { provider: "freighter" };

const AUTH_COOKIE_NAME = "akkuea-authenticated";
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const FRIENDLY_AUTH_ERRORS: Record<string, string> = {
  EMAIL_CODE_INVALID: "That code is invalid. Check the email and try again.",
  EMAIL_CODE_EXPIRED: "That code expired. Request a fresh login email.",
  SESSION_CREATE_FAILED:
    "We couldn't finish signing you in. Please try again in a moment.",
  WALLET_CONNECT_FAILED:
    "Freighter couldn't be opened. Confirm the wallet popup and try again.",
  INVALID_EMAIL: "Enter a valid email address.",
  AUTH_CANCELLED: "Sign in was cancelled.",
};

function sanitizeCallbackUrl(value: string | null): string {
  if (!value) return "/dashboard";
  if (value.startsWith("/")) return value;
  return "/dashboard";
}

function writeAuthCookie(isAuthenticated: boolean): void {
  if (typeof document === "undefined") return;

  if (isAuthenticated) {
    document.cookie = `${AUTH_COOKIE_NAME}=1; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; samesite=lax`;
    return;
  }

  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}

function extractBalance(walletBalance: unknown): string {
  if (!walletBalance || typeof walletBalance !== "object") return "0";

  const balanceState = walletBalance as {
    balance?: string;
    balances?: Array<{
      asset?: string;
      asset_code?: string;
      asset_type?: string;
      balance?: string;
    }>;
    value?: string;
  };

  if (typeof balanceState.balance === "string") return balanceState.balance;
  if (typeof balanceState.value === "string") return balanceState.value;

  const balances = balanceState.balances ?? [];
  const landBalance = balances.find((entry) => {
    const asset = `${entry.asset ?? entry.asset_code ?? ""}`.toUpperCase();
    return asset === "LAND";
  });

  if (landBalance?.balance) return landBalance.balance;

  const nativeBalance = balances.find((entry) => entry.asset_type === "native");
  return nativeBalance?.balance ?? balances[0]?.balance ?? "0";
}

function getReadableAuthError(errorCode?: string | null): string | null {
  if (!errorCode) return null;
  return (
    FRIENDLY_AUTH_ERRORS[errorCode] ??
    "We couldn't complete sign in. Please try again."
  );
}

export function useGameWallet() {
  const pollar = usePollar();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [authStep, setAuthStep] = useState<GameWalletAuthStep>("idle");
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const client = pollar.getClient();
    const unsubscribe = client.onAuthStateChange((state) => {
      const step = (state.step ?? "idle") as GameWalletAuthStep;
      setAuthStep(step);

      if (step === "error") {
        setAuthError(
          getReadableAuthError(
            (state as { errorCode?: string | null }).errorCode ?? null,
          ),
        );
      } else if (step === "success" || step === "idle") {
        setAuthError(null);
      }
    });

    return unsubscribe;
  }, [pollar]);

  const isConnected = Boolean(pollar.isAuthenticated);
  const walletAddress = pollar.walletAddress ?? "";
  const walletBalance = extractBalance(pollar.walletBalance);
  const network = (pollar.network ?? "testnet") as GameWalletNetwork;

  useEffect(() => {
    writeAuthCookie(isConnected);
  }, [isConnected, walletAddress]);

  const wallet = useMemo(
    () => ({ address: walletAddress, balance: walletBalance }),
    [walletAddress, walletBalance],
  );

  const connect = useCallback(() => {
    const currentQuery = searchParams?.toString();
    const callbackUrl = encodeURIComponent(
      sanitizeCallbackUrl(
        `${pathname}${currentQuery ? `?${currentQuery}` : ""}`,
      ),
    );
    router.push(`/login?callbackUrl=${callbackUrl}`);
  }, [pathname, router, searchParams]);

  const login = useCallback(
    (input: GameWalletLoginInput) => {
      setAuthError(null);

      if (input.provider === "google") {
        pollar.login({ provider: "google" });
        return;
      }

      if (input.provider === "email") {
        pollar.login({ provider: "email", email: input.email });
        return;
      }

      pollar.login({ provider: "wallet", type: WalletType.FREIGHTER });
    },
    [pollar],
  );

  const logout = useCallback(async () => {
    try {
      await pollar.logout();
    } finally {
      writeAuthCookie(false);
      router.replace("/login");
    }
  }, [pollar, router]);

  const signAndSubmitTx = useCallback(
    async (unsignedXdr: string) => pollar.signAndSubmitTx(unsignedXdr),
    [pollar],
  );

  const refreshBalance = useCallback(async () => {
    await pollar.refreshWalletBalance();
  }, [pollar]);

  const setNetwork = useCallback(
    (nextNetwork: GameWalletNetwork) => pollar.setNetwork(nextNetwork),
    [pollar],
  );

  return {
    wallet,
    address: wallet.address,
    balance: wallet.balance,
    isConnected,
    isConnecting:
      authStep === "oauth" || authStep === "email" || authStep === "wallet",
    isAuthenticating:
      authStep === "oauth" || authStep === "email" || authStep === "wallet",
    authStatus: authStep,
    authError,
    network,
    selectedWalletId: pollar.walletType ?? null,
    login,
    connect,
    logout,
    disconnect: logout,
    signAndSubmitTx,
    refreshBalance,
    setNetwork,
    refreshWalletBalance: refreshBalance,
    openLoginModal: pollar.openLoginModal,
    walletType: pollar.walletType,
  };
}

export type { GameWalletLoginInput };
