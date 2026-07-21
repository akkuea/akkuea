export type BalanceStatus = "ok" | "not_found" | "error" | null;

export interface WalletState {
  address: string | null;
  balance: string | null;
  balanceStatus: BalanceStatus;
  balanceError: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  /** True when a previously-connected wallet is found to be unavailable or on the wrong network (e.g. extension locked, session expired, network switched outside the app). */
  isWalletDisconnected: boolean;
  /** The wallet-dependent action that was in flight when the disconnection was detected, if any. Not persisted (functions aren't serializable). */
  pendingAction: (() => Promise<unknown>) | null;
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
  setPendingAction: (action: (() => Promise<unknown>) | null) => void;
  /**
   * Marks the wallet as disconnected. When `action` is provided it is queued
   * as the pending action to resume on a successful reconnect; when omitted,
   * any already-queued pending action is left untouched (a passive focus-probe
   * detection should never clobber an action queued by a failed sign attempt).
   */
  triggerReconnectionPrompt: (action?: () => Promise<unknown>) => void;
  clearReconnectionPrompt: () => void;
  /** Clears the current session (address/balance/connection identity) without touching the reconnection-prompt or pending-action state. Use this on a failed reconnect attempt instead of `reset()`. */
  resetSession: () => void;
  reset: () => void;
}

export type AuthenticationStore = WalletState & WalletActions;
