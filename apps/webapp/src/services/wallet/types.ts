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

/**
 * Optional extension for providers that can produce a signed Soroban
 * authorization entry, as opposed to signing a whole transaction.
 *
 * A multi-party contract invocation (e.g. one requiring both an operator's
 * and an ally's `require_auth()`) needs each party to independently
 * authorize their own entry before the fully-authorized transaction can be
 * assembled and submitted. Signing the outer transaction is not enough: only
 * one party ever ends up sending it, and Soroban's own auth model expects
 * each signer's entry to be signed on its own.
 *
 * Embedded/custodial wallets (Privy, Pollar) do not expose this at all, so
 * they never implement it. A `StellarWalletsKitProvider` session exposes the
 * method for every underlying wallet module, but the module the user
 * actually picked (Freighter, Albedo, xBull, hardware wallets, ...) may
 * still reject the call at sign time if that specific wallet doesn't support
 * it - the kit has no separate "does this session support signAuthEntry"
 * check, so `canSignAuthEntries` below can only report whether signing is
 * worth attempting, not whether the specific connected wallet will accept.
 * Callers must still handle a rejection from `signAuthEntry` itself.
 */
export interface AuthEntrySigningProvider extends SignableWalletProvider {
  /**
   * @param authEntryXdr - Base64 XDR of the `SorobanAuthorizationEntry` to sign.
   * @param signerAddress - Address expected to produce this signature.
   * @param networkPassphrase - Network the entry is being signed for.
   * @returns Base64 XDR of the signed `SorobanAuthorizationEntry`.
   */
  signAuthEntry: (
    authEntryXdr: string,
    signerAddress: string,
    networkPassphrase: string,
  ) => Promise<string>;
}

export function canSignAuthEntries(
  provider: WalletProvider,
): provider is AuthEntrySigningProvider {
  return (
    isSignableWalletProvider(provider) &&
    "signAuthEntry" in provider &&
    typeof provider.signAuthEntry === "function"
  );
}
