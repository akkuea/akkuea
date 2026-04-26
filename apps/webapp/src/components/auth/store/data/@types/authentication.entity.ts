export interface WalletState {
  address: string | null;
  balance: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  selectedWalletId: string | null;
  network: "testnet" | "mainnet";
}

export interface WalletActions {
  setAddress: (address: string | null) => void;
  setBalance: (balance: string | null) => void;
  setIsConnected: (isConnected: boolean) => void;
  setIsConnecting: (isConnecting: boolean) => void;
  setSelectedWalletId: (walletId: string | null) => void;
  setNetwork: (network: "testnet" | "mainnet") => void;
  reset: () => void;
}

export type AuthenticationStore = WalletState & WalletActions;
