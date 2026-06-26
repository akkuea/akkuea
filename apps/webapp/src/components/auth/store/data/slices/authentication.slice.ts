import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AuthenticationStore } from "../@types/authentication.entity";

const initialState = {
  address: null,
  balance: null,
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
      setIsConnected: (isConnected) => set({ isConnected }),
      setIsConnecting: (isConnecting) => set({ isConnecting }),
      setSelectedWalletId: (walletId) => set({ selectedWalletId: walletId }),
      setNetwork: (network) => set({ network }),
      reset: () => set(initialState),
    }),
    {
      name: "akkuea-wallet-storage",
      version: 1,
      migrate: (persisted) => {
        const state = persisted as {
          address?: string | null;
          balance?: string | null;
          isConnected?: boolean;
          selectedWalletId?: string | null;
          network?: "testnet" | "mainnet";
        };
        return {
          address: state.address ?? null,
          balance: state.balance ?? null,
          isConnected: state.isConnected ?? false,
          selectedWalletId: state.selectedWalletId ?? null,
          network: state.network ?? "testnet",
        };
      },
      // Never persist transient UI state — a stale true leaves Connect stuck loading.
      partialize: (state) => ({
        address: state.address,
        balance: state.balance,
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
