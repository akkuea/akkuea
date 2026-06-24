import type { SignableWalletProvider } from "../types";

/**
 * Interface injected by PollarBridge to wire the hook-based @pollar/react API
 * into this plain-class provider.
 */
export interface PollarInterface {
  login: () => void;
  logout: () => void;
  getAddress: () => string;
  isAuthenticated: () => boolean;
  /**
   * Signs the XDR with the connected wallet without submitting.
   * Maps to usePollar().signTx — available for external (non-custodial) wallets.
   *
   * NOTE: Pollar's primary flow is signAndSubmitTx (sign + broadcast in one
   * step). signTx is provided for external wallets only; custodial flows must
   * use signAndSubmitTx instead. PollarProvider.signTransaction delegates to
   * signTx so callers that only need a signed XDR (e.g. multi-sig coordination)
   * get the expected behaviour. Callers that want atomic sign-and-submit should
   * use the usePollar() hook directly.
   */
  signTx: (xdr: string) => Promise<string>;
}

/**
 * WalletProvider implementation for Pollar social/email login.
 * The React bridge (PollarBridge component) injects a PollarInterface
 * instance via setPollarInterface() once the SDK is ready.
 */
export class PollarProvider implements SignableWalletProvider {
  readonly id = "pollar";
  readonly name = "Pollar";

  private pollarInterface: PollarInterface | null = null;

  get isConnected(): boolean {
    return this.pollarInterface?.isAuthenticated() ?? false;
  }

  setPollarInterface(iface: PollarInterface | null): void {
    this.pollarInterface = iface;
  }

  async connect(): Promise<{ address: string }> {
    if (!this.pollarInterface) {
      throw new Error("Pollar SDK not initialized");
    }
    if (!this.pollarInterface.isAuthenticated()) {
      this.pollarInterface.login();
      // login() opens the modal; the caller should re-check isConnected
      // after the user completes the flow.
    }
    return { address: this.pollarInterface.getAddress() };
  }

  async disconnect(): Promise<void> {
    this.pollarInterface?.logout();
  }

  async signTransaction(
    xdr: string,
    networkPassphrase: string,
  ): Promise<string> {
    void networkPassphrase;
    if (!this.pollarInterface) {
      throw new Error("Pollar SDK not initialized");
    }
    const result = await this.pollarInterface.signTx(xdr);
    return result;
  }
}

export const pollarProvider = new PollarProvider();
