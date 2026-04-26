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
    },
  ),
);
