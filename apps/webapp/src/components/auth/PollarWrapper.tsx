"use client";

import React, { useEffect } from "react";
import { PollarProvider as PollarSDKProvider, usePollar } from "@pollar/react";
import { pollarProvider } from "@/services/wallet/providers/pollar";

function PollarBridge() {
  const { walletAddress, isAuthenticated, login, logout, signTx } = usePollar();

  useEffect(() => {
    pollarProvider.setPollarInterface({
      login: () => login({ provider: "google" }),
      logout,
      getAddress: () => walletAddress,
      isAuthenticated: () => isAuthenticated,
      signTx: async (xdr: string) => {
        const outcome = await signTx(xdr);
        if (outcome.status !== "signed") {
          throw new Error(
            `Pollar signTx failed: ${outcome.details ?? outcome.status}`,
          );
        }
        return outcome.signedXdr;
      },
    });

    return () => {
      pollarProvider.setPollarInterface(null);
    };
  }, [walletAddress, isAuthenticated, login, logout, signTx]);

  return null;
}

export function PollarWrapper({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_POLLAR_KEY;

  if (!apiKey) return <>{children}</>;

  return (
    <PollarSDKProvider client={{ apiKey }}>
      <PollarBridge />
      {children}
    </PollarSDKProvider>
  );
}
