"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface WalletState {
  address: string | null;
  balance: number;
  isConnecting: boolean;
  isConnected: boolean;
}

interface WalletContextType extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const initialState: WalletState = {
  address: null,
  balance: 0,
  isConnecting: false,
  isConnected: false,
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(initialState);

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, isConnecting: true }));

    // Simulate wallet connection - replace with actual Stellar wallet integration
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock connected state
    setState({
      address: "GBXGQ...7K4M",
      balance: 12450.75,
      isConnecting: false,
      isConnected: true,
    });
  }, []);

  const disconnect = useCallback(() => {
    setState(initialState);
  }, []);

  return (
    <WalletContext.Provider value={{ ...state, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
