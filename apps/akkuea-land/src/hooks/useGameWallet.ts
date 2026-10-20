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
import { assertTxConfirmed } from "@/lib/tx-confirmation";

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
    await fetchBalance(wallet.address);
  };

  const logout = () => {
    resetWalletKit();
    setIsConnected(false);
    setAddress(null);
    setBalance(null);
    setError(null);
  };

  /**
   * Fetch the on-chain LAND token balance for the connected wallet address
   * (or `target`, used right after connecting before the store re-renders).
   * Stores the balance in whole LAND in `balance` or sets `error` on failure.
   */
  const fetchBalance = async (target: string | null = address) => {
    setError(null);
    if (!target) {
      setBalance(null);
      return;
    }
    try {
      setBalance(await fetchLandBalance(target));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  };

  /**
   * Sign a built XDR with the connected wallet, submit it to the Soroban RPC,
   * and wait for on-chain confirmation, then refresh the LAND balance so the
   * header reflects claims and purchases. Throws on signing failure,
   * submission error, on-chain failure, or when the transaction is not
   * confirmed within the polling window (TxNotConfirmedError).
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
    assertTxConfirmed(await waitForSorobanTx(txHash), txHash);
    await fetchBalance(address);
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
