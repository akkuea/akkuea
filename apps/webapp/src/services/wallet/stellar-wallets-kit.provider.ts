import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import type { AuthEntrySigningProvider } from "./types";

export class StellarWalletsKitProvider implements AuthEntrySigningProvider {
  readonly id = "stellar-wallets-kit";
  readonly name = "Stellar Wallet";

  private initialized = false;
  private _isConnected = false;

  get isConnected(): boolean {
    return this._isConnected;
  }

  private getKit(network: Networks): typeof StellarWalletsKit {
    if (!this.initialized) {
      StellarWalletsKit.init({
        network,
        selectedWalletId: undefined,
        modules: defaultModules(),
      });
      this.initialized = true;
    }
    return StellarWalletsKit;
  }

  async connect(
    network: Networks = Networks.TESTNET,
  ): Promise<{ address: string }> {
    const kit = this.getKit(network);

    try {
      const { address } = await kit.authModal();
      this._isConnected = true;
      return { address };
    } catch (err) {
      this._isConnected = false;
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this._isConnected = false;
  }

  /**
   * Signs a full transaction XDR with the currently selected module.
   *
   * `getKit()` (not `getKit(network)`) is intentional here: this only runs
   * after `connect()` has already initialized the kit with the right
   * network, and re-initializing on every sign call would silently reset
   * `selectedModuleId` to `undefined` between calls.
   */
  async signTransaction(
    xdr: string,
    networkPassphrase: string,
  ): Promise<string> {
    const kit = this.requireInitializedKit();
    const { signedTxXdr } = await kit.signTransaction(xdr, {
      networkPassphrase,
    });
    return signedTxXdr;
  }

  /**
   * Signs a single Soroban authorization entry with the currently selected
   * module.
   *
   * The kit exposes this uniformly regardless of which underlying wallet is
   * selected, but not every wallet module implements it for real - some
   * (Albedo, Lobstr, xBull, hardware wallets, at least as of kit v2.6.0)
   * reject every call with a "does not support signAuthEntry" style error.
   * There is no separate capability check on the kit side, so that rejection
   * is the only way to learn this, and callers must treat it as an expected,
   * user-facing outcome rather than an unexpected failure.
   */
  async signAuthEntry(
    authEntryXdr: string,
    signerAddress: string,
    networkPassphrase: string,
  ): Promise<string> {
    const kit = this.requireInitializedKit();
    const { signedAuthEntry } = await kit.signAuthEntry(authEntryXdr, {
      address: signerAddress,
      networkPassphrase,
    });
    return signedAuthEntry;
  }

  private requireInitializedKit(): typeof StellarWalletsKit {
    if (!this.initialized) {
      throw new Error("Stellar wallet is not connected. Call connect() first.");
    }
    return StellarWalletsKit;
  }
}
