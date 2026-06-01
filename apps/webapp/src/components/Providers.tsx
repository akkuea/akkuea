"use client";

import { type ReactNode, useEffect } from "react";
import { ThemeProvider } from "@/context/ThemeContext";
import {
  walletRegistry,
  StellarWalletsKitProvider,
  SmartAccountKitProvider,
  privyProvider,
} from "@/services/wallet";
import { PrivyWrapper } from "@/components/auth/PrivyWrapper";

walletRegistry.register(new StellarWalletsKitProvider());

if (process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
  walletRegistry.register(privyProvider);
}

if (process.env.NEXT_PUBLIC_SMART_ACCOUNT_RPC_URL) {
  walletRegistry.register(
    new SmartAccountKitProvider({
      rpcUrl: process.env.NEXT_PUBLIC_SMART_ACCOUNT_RPC_URL,
      networkPassphrase:
        process.env.NEXT_PUBLIC_SMART_ACCOUNT_NETWORK_PASSPHRASE ??
        "Test SDF Network ; September 2015",
      accountWasmHash: process.env.NEXT_PUBLIC_SMART_ACCOUNT_WASM_HASH ?? "",
      webauthnVerifierAddress:
        process.env.NEXT_PUBLIC_SMART_ACCOUNT_VERIFIER_ADDRESS ?? "",
      appName: "Akkuea",
    }),
  );
}

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") {
      import("@/mocks").then(({ initMocks }) => {
        initMocks().catch((err) => {
          console.error("[MSW] Failed to start mock service worker:", err);
        });
      });
    }
  }, []);

  return (
    <PrivyWrapper>
      <ThemeProvider>{children}</ThemeProvider>
    </PrivyWrapper>
  );
}
