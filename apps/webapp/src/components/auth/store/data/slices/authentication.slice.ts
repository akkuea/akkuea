import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AuthenticationStore } from "../@types/authentication.entity";

const initialState = {
  address: null,
  balance: null,
  balanceStatus: null,
  balanceError: null,
  isConnected: false,
  isConnecting: false,
  selectedWalletId: null,
  network: "testnet" as const,
};

export const useAuthenticationStore = create<AuthenticationStore>()(
  persist(
    (set) => ({
      ...initialState,
      setAddress: (address) => set({ address }),
      setBalance: (balance) => set({ balance }),
      setBalanceStatus: (balanceStatus) => set({ balanceStatus }),
      setBalanceError: (balanceError) => set({ balanceError }),
      setIsConnected: (isConnected) => set({ isConnected }),
      setIsConnecting: (isConnecting) => set({ isConnecting }),
      setSelectedWalletId: (walletId) => set({ selectedWalletId: walletId }),
      setNetwork: (network) => set({ network }),
      reset: () => set(initialState),
    }),
    {
      name: "akkuea-wallet-storage",
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as {
          address?: string | null;
          balance?: string | null;
          balanceStatus?: "ok" | "not_found" | "error" | null;
          balanceError?: string | null;
          isConnected?: boolean;
          selectedWalletId?: string | null;
          network?: "testnet" | "mainnet";
        };
        // Migration from version 1: add balanceStatus and balanceError
        if (version < 2) {
          return {
            address: state.address ?? null,
            balance: state.balance ?? null,
            balanceStatus: state.balance ? "ok" : null,
            balanceError: null,
            isConnected: state.isConnected ?? false,
            selectedWalletId: state.selectedWalletId ?? null,
            network: state.network ?? "testnet",
          };
        }
        return {
          address: state.address ?? null,
          balance: state.balance ?? null,
          balanceStatus: state.balanceStatus ?? null,
          balanceError: state.balanceError ?? null,
          isConnected: state.isConnected ?? false,
          selectedWalletId: state.selectedWalletId ?? null,
          network: state.network ?? "testnet",
        };
      },
      // Never persist transient UI state — a stale true leaves Connect stuck loading.
      partialize: (state) => ({
        address: state.address,
        balance: state.balance,
        balanceStatus: state.balanceStatus,
        balanceError: state.balanceError,
        isConnected: state.isConnected,
        selectedWalletId: state.selectedWalletId,
        network: state.network,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setIsConnecting(false);
      },
    },
  ),
);
