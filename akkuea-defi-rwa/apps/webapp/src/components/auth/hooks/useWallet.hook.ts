"use client";

import { useCallback, useEffect } from "react";
import { WalletNetwork } from "@creit.tech/stellar-wallets-kit";
import { useAuthenticationStore } from "../store/data/slices/authentication.slice";
import { initializeWalletKit, getWalletKit } from "../constant/walletKit";

export const useWallet = () => {
  const store = useAuthenticationStore();

  useEffect(() => {
    // Inicializar kit en mount
    const network =
      store.network === "mainnet"
        ? WalletNetwork.PUBLIC
        : WalletNetwork.TESTNET;
    initializeWalletKit(network);
  }, [store.network]);

  const connect = useCallback(async () => {
    const kit = getWalletKit();
    if (!kit) return;

    try {
      store.setIsConnecting(true);

      // Abrir modal de selección
      await kit.openModal({
        onWalletSelected: async (option) => {
          try {
            kit.setWallet(option.id);
            store.setSelectedWalletId(option.id);

            // Obtener dirección
            const { address } = await kit.getAddress();
            store.setAddress(address);
            store.setIsConnected(true);

            // TODO: Fetch balance usando stellar-sdk
            // const balance = await fetchBalance(address);
            // store.setBalance(balance);
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

  const disconnect = useCallback(() => {
    store.reset();
  }, [store]);

  const switchNetwork = useCallback(
    (network: "testnet" | "mainnet") => {
      store.setNetwork(network);
      // Kit se reinicializará en el useEffect
    },
    [store],
  );

  return {
    address: store.address,
    balance: store.balance,
    isConnected: store.isConnected,
    isConnecting: store.isConnecting,
    network: store.network,
    selectedWalletId: store.selectedWalletId,
    connect,
    disconnect,
    switchNetwork,
  };
};
