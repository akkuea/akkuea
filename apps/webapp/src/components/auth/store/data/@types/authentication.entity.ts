export type BalanceStatus = "ok" | "not_found" | "error" | null;

export interface WalletState {
  address: string | null;
  balance: string | null;
  balanceStatus: BalanceStatus;
  balanceError: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  selectedWalletId: string | null;
  network: "testnet" | "mainnet";
}

export interface WalletActions {
  setAddress: (address: string | null) => void;
  setBalance: (balance: string | null) => void;
  setBalanceStatus: (status: BalanceStatus) => void;
  setBalanceError: (error: string | null) => void;
  setIsConnected: (isConnected: boolean) => void;
  setIsConnecting: (isConnecting: boolean) => void;
  setSelectedWalletId: (walletId: string | null) => void;
  setNetwork: (network: "testnet" | "mainnet") => void;
  reset: () => void;
}

export type AuthenticationStore = WalletState & WalletActions;
