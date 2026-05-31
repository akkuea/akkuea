import { create } from "zustand";

interface WalletStore {
  isConnected: boolean;
  address: string | null;
  setIsConnected: (connected: boolean) => void;
  setAddress: (address: string | null) => void;
}

const DEFAULT_ADDRESS = "GDVIEWER1234567890123456789012345678901234567890123456";

export const useWalletStore = create<WalletStore>((set) => ({
  isConnected: true, // Default to true for the sandbox environment
  address: DEFAULT_ADDRESS,
  setIsConnected: (connected) => set({ isConnected: connected }),
  setAddress: (address) => set({ address }),
}));

export function useGameWallet() {
  const { isConnected, address, setIsConnected, setAddress } = useWalletStore();

  const login = () => {
    setIsConnected(true);
    setAddress(DEFAULT_ADDRESS);
  };

  const logout = () => {
    setIsConnected(false);
    setAddress(null);
  };

  const signAndSubmitTx = async (xdr: string) => {
    // Simulate transaction submission delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("Simulating transaction submission for XDR:", xdr);
  };

  return {
    isConnected,
    address,
    login,
    logout,
    signAndSubmitTx,
  };
}
