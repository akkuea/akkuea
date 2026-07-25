import { create } from "zustand";
import {
  connectWalletKit,
  getWalletKit,
  resetWalletKit,
} from "@/lib/walletKit";
import {
  submitSorobanTx,
  waitForSorobanTx,
  NETWORK_PASSPHRASE,
} from "@/lib/soroban-tx";

interface WalletStore {
  isConnected: boolean;
  address: string | null;
  setIsConnected: (connected: boolean) => void;
  setAddress: (address: string | null) => void;
}

export const useWalletStore = create<WalletStore>((set) => ({
  isConnected: false,
  address: null,
  setIsConnected: (connected) => set({ isConnected: connected }),
  setAddress: (address) => set({ address }),
}));

export function useGameWallet() {
  const { isConnected, address, setIsConnected, setAddress } = useWalletStore();

  /**
   * Opens the Stellar wallet picker (Freighter, etc.) and connects the
   * selected account. Leaves state untouched if the user closes the picker
   * without choosing a wallet.
   */
  const login = async () => {
    const wallet = await connectWalletKit();
    if (!wallet) return;
    setIsConnected(true);
    setAddress(wallet.address);
  };

  const logout = () => {
    resetWalletKit();
    setIsConnected(false);
    setAddress(null);
  };

  /**
   * Sign a built XDR with the connected wallet, submit it to the Soroban RPC,
   * and wait for on-chain confirmation. Throws on signing failure, submission
   * error, or on-chain failure.
   */
  const signAndSubmitTx = async (xdr: string): Promise<void> => {
    const kit = getWalletKit();
    if (!kit) throw new Error("Stellar Wallet Kit is not initialized.");
    if (!address) throw new Error("Wallet not connected.");

    const { signedTxXdr } = await kit.signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
      address,
    });

    const txHash = await submitSorobanTx(signedTxXdr);
    await waitForSorobanTx(txHash);
  };

  return {
    isConnected,
    address,
    login,
    logout,
    signAndSubmitTx,
  };
}
