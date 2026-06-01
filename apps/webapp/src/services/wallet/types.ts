/**
 * Core wallet provider interface.
 * All wallet integrations must implement this contract.
 */
export interface WalletProvider {
  /** Unique identifier for this provider */
  readonly id: string;
  /** Human-readable display name */
  readonly name: string;
  /** Whether this provider is currently connected */
  readonly isConnected: boolean;

  /**
   * Initiate a connection. Implementations may show a modal or
   * trigger a passkey prompt depending on the provider type.
   */
  connect(): Promise<{ address: string }>;

  /** Disconnect and clear any local session state */
  disconnect(): Promise<void>;
}

/** Optional extension for providers that sign Stellar transaction XDR. */
export interface SignableWalletProvider extends WalletProvider {
  signTransaction: (xdr: string, networkPassphrase: string) => Promise<string>;
}

export function isSignableWalletProvider(
  provider: WalletProvider,
): provider is SignableWalletProvider {
  return (
    "signTransaction" in provider &&
    typeof provider.signTransaction === "function"
  );
}
