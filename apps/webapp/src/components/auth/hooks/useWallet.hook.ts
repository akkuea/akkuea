"use client";

import { useCallback, useEffect } from "react";
import { WalletNetwork } from "@creit.tech/stellar-wallets-kit";
import { useAuthenticationStore } from "../store/data/slices/authentication.slice";
import { initializeWalletKit, getWalletKit } from "../constant/walletKit";
import { isSignableWalletProvider, walletRegistry } from "@/services/wallet";
import { fetchBalance, type BalanceResult } from "@/lib/stellar";
import type { AuthenticationStore } from "../store/data/@types/authentication.entity";

/**
 * Helper to update balance state from a BalanceResult
 */
function applyBalanceResult(result: BalanceResult, store: AuthenticationStore) {
  switch (result.status) {
    case "ok":
      store.setBalance(result.balance);
      store.setBalanceStatus("ok");
      store.setBalanceError(null);
      break;
    case "not_found":
      store.setBalance(null);
      store.setBalanceStatus("not_found");
      store.setBalanceError(null);
      break;
    case "error":
      store.setBalance(null);
      store.setBalanceStatus("error");
      store.setBalanceError(result.message);
      break;
  }
}

export const useWallet = () => {
  const store = useAuthenticationStore();

  useEffect(() => {
    const network =
      store.network === "mainnet"
        ? WalletNetwork.PUBLIC
        : WalletNetwork.TESTNET;
    initializeWalletKit(network);
  }, [store.network]);

  useEffect(() => {
    if (store.selectedWalletId && !walletRegistry.get(store.selectedWalletId)) {
      store.setSelectedWalletId(null);
      store.setIsConnected(false);
    }
    store.setIsConnecting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Legacy connect: opens the StellarWalletsKit modal.
   * Kept for backward compatibility with existing onClick={connect} usages.
   */
  const connect = useCallback(async () => {
    const kit = getWalletKit();
    if (!kit) return;

    try {
      store.setIsConnecting(true);

      await kit.openModal({
        onWalletSelected: async (option) => {
          try {
            kit.setWallet(option.id);
            store.setSelectedWalletId(option.id);

            const { address } = await kit.getAddress();
            store.setAddress(address);
            store.setIsConnected(true);

            const result = await fetchBalance(address, store.network);
            applyBalanceResult(result, store);
          } catch (error) {
            console.error("Error connecting wallet:", error);
            store.reset();
          } finally {
            store.setIsConnecting(false);
          }
        },
        onClosed: () => {
          store.setIsConnecting(false);
        },
      });
    } catch (error) {
      console.error("Error opening modal:", error);
      store.setIsConnecting(false);
    }
  }, [store]);

  /**
   * Connect using a named provider from the registry.
   * Use this when presenting a provider-selection UI.
   */
  const connectWith = useCallback(
    async (providerId: string) => {
      const provider = walletRegistry.get(providerId);
      if (!provider) throw new Error(`Unknown wallet provider: ${providerId}`);

      store.setIsConnecting(true);
      try {
        const { address } = await provider.connect();
        store.setAddress(address);
        store.setSelectedWalletId(providerId);
        store.setIsConnected(true);

        const result = await fetchBalance(address, store.network);
        applyBalanceResult(result, store);
      } catch (error) {
        console.error("Error connecting wallet:", error);
        store.reset();
        throw error;
      } finally {
        store.setIsConnecting(false);
      }
    },
    [store],
  );

  const disconnect = useCallback(async () => {
    if (store.selectedWalletId) {
      const provider = walletRegistry.get(store.selectedWalletId);
      await provider?.disconnect();
    }
    store.reset();
  }, [store]);

  const switchNetwork = useCallback(
    (network: "testnet" | "mainnet") => {
      store.setNetwork(network);
    },
    [store],
  );

  const refreshBalance = useCallback(async () => {
    if (!store.address) return;
    const result = await fetchBalance(store.address, store.network);
    applyBalanceResult(result, store);
  }, [store]);

  const signTransaction = useCallback(
    async (xdr: string, networkPassphrase: string) => {
      const provider = walletRegistry.get(store.selectedWalletId ?? "");
      if (!provider || !isSignableWalletProvider(provider)) {
        throw new Error(
          "Connected wallet does not support transaction signing",
        );
      }
      return provider.signTransaction(xdr, networkPassphrase);
    },
    [store],
  );

  return {
    address: store.address,
    balance: store.balance,
    balanceStatus: store.balanceStatus,
    balanceError: store.balanceError,
    isConnected: store.isConnected,
    isConnecting: store.isConnecting,
    network: store.network,
    selectedWalletId: store.selectedWalletId,
    providers: walletRegistry.getAll(),
    connect,
    connectWith,
    disconnect,
    switchNetwork,
    refreshBalance,
    signTransaction,
  };
};
