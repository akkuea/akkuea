import { create } from "zustand";
import {
  connectWalletKit,
  getWalletKit,
  resetWalletKit,
} from "@/lib/walletKit";
import {
  fetchLandBalance,
  submitSorobanTx,
  waitForSorobanTx,
  NETWORK_PASSPHRASE,
} from "@/lib/soroban-tx";

interface WalletStore {
  isConnected: boolean;
  address: string | null;
  balance: string | null;
  error: string | null;
  setIsConnected: (connected: boolean) => void;
  setAddress: (address: string | null) => void;
  setBalance: (balance: string | null) => void;
  setError: (error: string | null) => void;
}

export const useWalletStore = create<WalletStore>((set) => ({
  isConnected: false,
  address: null,
  balance: null,
  error: null,
  setIsConnected: (connected) => set({ isConnected: connected }),
  setAddress: (address) => set({ address }),
  setBalance: (balance) => set({ balance }),
  setError: (error) => set({ error }),
}));

export function useGameWallet() {
  const {
    isConnected,
    address,
    balance,
    error,
    setIsConnected,
    setAddress,
    setBalance,
    setError,
  } = useWalletStore();

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
    setBalance(null);
    setError(null);
  };

  /**
   * Fetch the LAND token balance for the connected wallet address.
   * Stores the result in `balance` or sets `error` on failure.
   */
  const fetchBalance = async () => {
    setError(null);
    if (!address) {
      setBalance(null);
      return;
    }
    try {
      const raw = await fetchLandBalance(address);
      setBalance(raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
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
    balance,
    error,
    login,
    logout,
    fetchBalance,
    signAndSubmitTx,
  };
}
