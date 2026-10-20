"use client";

import { useCallback, useEffect, useMemo } from "react";
import { Networks } from "@creit.tech/stellar-wallets-kit";
import { useAuthenticationStore } from "../store/data/slices/authentication.slice";
import { initializeWalletKit, getWalletKit } from "../constant/walletKit";
import {
  canSignAuthEntries,
  isSignableWalletProvider,
  StellarWalletsKitProvider,
  walletRegistry,
} from "@/services/wallet";
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
  const address = useAuthenticationStore((state) => state.address);
  const balance = useAuthenticationStore((state) => state.balance);
  const balanceStatus = useAuthenticationStore((state) => state.balanceStatus);
  const balanceError = useAuthenticationStore((state) => state.balanceError);
  const isConnected = useAuthenticationStore((state) => state.isConnected);
  const isConnecting = useAuthenticationStore((state) => state.isConnecting);
  const isWalletDisconnected = useAuthenticationStore(
    (state) => state.isWalletDisconnected,
  );
  const network = useAuthenticationStore((state) => state.network);
  const selectedWalletId = useAuthenticationStore(
    (state) => state.selectedWalletId,
  );
  const pendingAction = useAuthenticationStore((state) => state.pendingAction);
  const setPendingAction = useAuthenticationStore(
    (state) => state.setPendingAction,
  );
  const setAddress = useAuthenticationStore((state) => state.setAddress);
  const setBalance = useAuthenticationStore((state) => state.setBalance);
  const setBalanceStatus = useAuthenticationStore(
    (state) => state.setBalanceStatus,
  );
  const setBalanceError = useAuthenticationStore(
    (state) => state.setBalanceError,
  );
  const setIsConnected = useAuthenticationStore(
    (state) => state.setIsConnected,
  );
  const setIsConnecting = useAuthenticationStore(
    (state) => state.setIsConnecting,
  );
  const setSelectedWalletId = useAuthenticationStore(
    (state) => state.setSelectedWalletId,
  );
  const setNetwork = useAuthenticationStore((state) => state.setNetwork);
  const triggerReconnectionPrompt = useAuthenticationStore(
    (state) => state.triggerReconnectionPrompt,
  );
  const resetSession = useAuthenticationStore((state) => state.resetSession);
  const reset = useAuthenticationStore((state) => state.reset);
  const clearReconnectionPrompt = useAuthenticationStore(
    (state) => state.clearReconnectionPrompt,
  );

  const store = useMemo(
    () => ({
      address,
      balance,
      balanceStatus,
      balanceError,
      isConnected,
      isConnecting,
      isWalletDisconnected,
      network,
      selectedWalletId,
      pendingAction,
      setPendingAction,
      setAddress,
      setBalance,
      setBalanceStatus,
      setBalanceError,
      setIsConnected,
      setIsConnecting,
      setSelectedWalletId,
      setNetwork,
      triggerReconnectionPrompt,
      resetSession,
      reset,
      clearReconnectionPrompt,
    }),
    [
      address,
      balance,
      balanceStatus,
      balanceError,
      isConnected,
      isConnecting,
      isWalletDisconnected,
      network,
      selectedWalletId,
      pendingAction,
      setPendingAction,
      setAddress,
      setBalance,
      setBalanceStatus,
      setBalanceError,
      setIsConnected,
      setIsConnecting,
      setSelectedWalletId,
      setNetwork,
      triggerReconnectionPrompt,
      resetSession,
      reset,
      clearReconnectionPrompt,
    ],
  );

  useEffect(() => {
    const network =
      store.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;
    initializeWalletKit(network);
  }, [store.network]);

  useEffect(() => {
    const current = useAuthenticationStore.getState();
    if (
      current.selectedWalletId &&
      !walletRegistry.get(current.selectedWalletId)
    ) {
      current.setSelectedWalletId(null);
      current.setIsConnected(false);
    }
    current.setIsConnecting(false);
  }, []);

  /**
   * Passive reconnection check: the Stellar Wallets Kit exposes no
   * onAccountChange/onNetworkChange subscription, so the only way to notice an
   * extension lock, revoked session, or out-of-band network switch is to probe
   * it. We probe on window focus rather than on an interval - cheap, and it
   * naturally fires exactly when a user comes back from the extension popup.
   */
  useEffect(() => {
    const verifyConnection = async () => {
      if (!isConnected) return;

      // Only the raw kit lacks connection events. A registered provider
      // (privy, smart-account-kit) manages its own session state, so skip it.
      const registered = selectedWalletId
        ? walletRegistry.get(selectedWalletId)
        : undefined;
      const usesStellarWalletsKit =
        !registered || registered.id === "stellar-wallets-kit";
      if (!usesStellarWalletsKit) return;

      const kit = getWalletKit();
      if (!kit) return;

      try {
        const [{ address: currentAddress }, { networkPassphrase }] =
          await Promise.all([ket.getAddress(), kit.getNetwork()]);

        const expectedPassphrase =
          network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

        if (
          currentAddress !== address ||
          networkPassphrase !== expectedPassphrase
        ) {
          useAuthenticationStore.getState().triggerReconnectionPrompt();
        }
      } catch {
        useAuthenticationStore.getState().triggerReconnectionPrompt();
      }
    };

    window.addEventListener("focus", verifyConnection);
    return () => window.removeEventListener("focus", verifyConnection);
  }, [isConnected, selectedWalletId, address, network]);

  /**
   * Legacy connect: opens the StellarWalletsKit modal.
   * Kept for backward compatibility with existing onClick={connect} usages.
   */
  const connect = useCallback(async () => {
    const kit = getWalletKit();
    if (!kit) return;

    try {
      store.setIsConnecting(true);

      // Go through the registered kit provider when there is one. Storing the
      // picked module's own id (e.g. "freighter") would not match any registry
      // entry, so signTransaction/signAuthEntry would refuse to run for a
      // session opened here, and the provider's own connected state would
      // never be set.
      const kitProvider = walletRegistry
        .getAll()
        .find((p) => p instanceof StellarWalletsKitProvider);
      let address: string;
      if (kitProvider instanceof StellarWalletsKitProvider) {
        ({ address } = await kitProvider.connect(
          store.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
        ));
        store.setSelectedWalletId(kitProvider.id);
      } else {
        ({ address } = await kit.authModal());
        store.setSelectedWalletId(kit.selectedModule.productId);
      }
      store.setAddress(address);
      store.setIsConnected(true);

      const result = await fetchBalance(address, store.network);
      applyBalanceResult(result, store);
    } catch (error) {
      // authModal() rejects with { code: -1, message: "The user closed the
      // modal." } when the user dismisses the picker without selecting a
      // wallet - that's not a failure, just a no-op like the old onClosed.
      const userClosedModal =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        (error as { message?: unknown }).message ===
          "The user closed the modal.";

      if (!userClosedModal) {
        console.error("Error connecting wallet:", error);
        // Same reasoning as in connectWith(): don't wipe the reconnection
        // banner via a full reset() when the (re)connect attempt itself
        // is what failed.
        store.resetSession();
      }
    } finally {
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
   * Signs a single Soroban authorization entry with the connected wallet.
   *
   * Needed for any multi-party contract invocation (an on-chain action
   * requiring more than one signer's `require_auth()`), where each party
   * must produce their own auth-entry signature before the fully-authorized
   * transaction can be assembled. Signing the whole transaction is not
   * enough for that case: only `signTransaction` covers a single-signer
   * invocation.
   *
   * Throws immediately, without attempting a call, when the connected
   * provider is categorically incapable of this (Privy, Pollar, no wallet
   * connected). A `StellarWalletsKitProvider` session always passes that
   * check, since the kit exposes the method uniformly, but the specific
   * wallet mo
   */
  const signAuthEntry = useCallback(
    async (authEntryXdr: string, networkPassphrase: string) => {
      const provider = walletRegistry.get(store.selectedWalletId ?? "");
      if (!provider || !canSignAuthEntries(provider)) {
        throw new Error(
          "Connected wallet does not support auth-entry signing",
        );
      }

      const attempt = () =>
        provider.signAuthEntry(authEntryXdr, networkPassphrase);

      try {
        return await attempt();
      } catch (error) {
        store.triggerReconnectionPrompt(attempt);
        throw error;
      }
    },
    [store],
  );

  return {
    address,
    balance,
    balanceStatus,
    balanceError,
    isConnected,
    isConnecting,
    isWalletDisconnected,
    network,
    selectedWalletId,
    pendingAction,
    connect,
    connectWith,
    disconnect,
    switchNetwork,
    refreshBalance,
    signTransaction,
    signAuthEntry,
    clearReconnectionPrompt,
  };
};
