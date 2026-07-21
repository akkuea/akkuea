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
   * Passive reconnection check: the Stellar Wallets Kit (v1.9.5) exposes no
   * onAccountChange/onNetworkChange subscription, so the only way to notice an
   * extension lock, revoked session, or out-of-band network switch is to probe
   * it. We probe on window focus rather than on an interval — cheap, and it
   * naturally fires exactly when a user comes back from the extension popup.
   */
  useEffect(() => {
    const verifyConnection = async () => {
      if (!store.isConnected) return;

      // Only the raw kit lacks connection events. A registered provider
      // (privy, smart-account-kit) manages its own session state, so skip it.
      const registered = store.selectedWalletId
        ? walletRegistry.get(store.selectedWalletId)
        : undefined;
      const usesStellarWalletsKit =
        !registered || registered.id === "stellar-wallets-kit";
      if (!usesStellarWalletsKit) return;

      const kit = getWalletKit();
      if (!kit) return;

      try {
        const [{ address }, { networkPassphrase }] = await Promise.all([
          kit.getAddress(),
          kit.getNetwork(),
        ]);

        const expectedPassphrase =
          store.network === "mainnet"
            ? WalletNetwork.PUBLIC
            : WalletNetwork.TESTNET;

        if (
          address !== store.address ||
          networkPassphrase !== expectedPassphrase
        ) {
          store.triggerReconnectionPrompt();
        }
      } catch {
        store.triggerReconnectionPrompt();
      }
    };

    window.addEventListener("focus", verifyConnection);
    return () => window.removeEventListener("focus", verifyConnection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.isConnected, store.selectedWalletId, store.address, store.network]);

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
            // Same reasoning as connectWith(): don't wipe the reconnection
            // banner via a full reset() when the (re)connect attempt itself
            // is what failed.
            store.resetSession();
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
        // A partial reset only: a failed (re)connect attempt must not wipe
        // isWalletDisconnected/pendingAction, or the reconnection banner the
        // user is trying to act on would vanish along with the session.
        store.resetSession();
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

      const attempt = () => provider.signTransaction(xdr, networkPassphrase);

      try {
        return await attempt();
      } catch (error) {
        // The kit doesn't distinguish "user rejected" from "wallet gone" in
        // its error shape, but either way the session can no longer sign, so
        // surface the reconnection prompt instead of letting this fail silently
        // on the next unrelated action. Queue the same call as the pending
        // action so a successful reconnect can resume it automatically.
        store.triggerReconnectionPrompt(attempt);
        throw error;
      }
    },
    [store],
  );

  /**
   * Re-invokes whichever connect path established the current session
   * (registry provider vs. legacy raw-kit connect) using the id already saved
   * in the store. Note: for the Stellar Wallets Kit this still opens its
   * selection modal — the kit has no headless "resume session" API.
   */
  const reconnect = useCallback(async () => {
    const provider = store.selectedWalletId
      ? walletRegistry.get(store.selectedWalletId)
      : undefined;

    if (provider) {
      await connectWith(provider.id);
    } else {
      await connect();
    }

    // The legacy connect() path resolves even when the user closes the
    // wallet-selection modal without picking a wallet (onClosed doesn't
    // reject). Read fresh state rather than the stale `store` closure to
    // confirm a session actually came back before dismissing the prompt —
    // otherwise a cancelled reconnect would silently hide its own banner.
    const { isConnected, address, pendingAction } =
      useAuthenticationStore.getState();
    if (!isConnected || !address) return;

    store.clearReconnectionPrompt();

    if (pendingAction) {
      try {
        await pendingAction();
      } catch (error) {
        console.error("Error resuming pending action after reconnect:", error);
        store.triggerReconnectionPrompt(pendingAction);
      }
    }
  }, [store, connect, connectWith]);

  return {
    address: store.address,
    balance: store.balance,
    balanceStatus: store.balanceStatus,
    balanceError: store.balanceError,
    isConnected: store.isConnected,
    isConnecting: store.isConnecting,
    isWalletDisconnected: store.isWalletDisconnected,
    network: store.network,
    selectedWalletId: store.selectedWalletId,
    providers: walletRegistry.getAll(),
    connect,
    connectWith,
    disconnect,
    reconnect,
    dismissReconnectionPrompt: store.clearReconnectionPrompt,
    switchNetwork,
    refreshBalance,
    signTransaction,
  };
};
