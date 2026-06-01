import type { SignableWalletProvider } from "./types";

/**
 * The interface injected by PrivyBridge to wire Privy's hook-based React API
 * into this plain-class provider. This keeps the provider free of React dependencies.
 */
export interface PrivyInterface {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  getAddress: () => string | null;
  signTransaction: (xdr: string, networkPassphrase: string) => Promise<string>;
}

/**
 * Auth-only interface injected as soon as PrivyBridge mounts — before any wallet
 * exists. This allows connect() to trigger login() even when no Stellar wallet
 * has been provisioned yet.
 */
export interface PrivyAuthInterface {
  login: () => void;
  logout: () => Promise<void>;
}

export interface StellarWalletRef {
  id: string;
  address: string;
}

/**
 * React bridge helpers injected by PrivyBridge so connect() can actively
 * provision a Stellar wallet instead of passively waiting on a useEffect.
 */
export interface PrivyBridgeHelpers {
  isAuthenticated: () => boolean;
  waitForAuthenticated: (timeoutMs: number) => Promise<void>;
  cancelAuthWait: () => void;
  getExistingStellarWallet: () => StellarWalletRef | null;
  ensureStellarWallet: () => Promise<StellarWalletRef>;
  wireWallet: (wallet: StellarWalletRef) => void;
}

const CONNECT_TIMEOUT_MS = 60_000;
const INIT_POLL_INTERVAL_MS = 50;
const INIT_TIMEOUT_MS = 15_000;

/**
 * WalletProvider implementation for Privy embedded Stellar wallets.
 */
export class PrivyWalletProvider implements SignableWalletProvider {
  readonly id = "privy";
  readonly name = "Email or Social Login";

  private privyInterface: PrivyInterface | null = null;
  private authInterface: PrivyAuthInterface | null = null;
  private bridgeHelpers: PrivyBridgeHelpers | null = null;
  private currentAddress: string | null = null;

  get isConnected(): boolean {
    return this.currentAddress !== null;
  }

  setAuthInterface(iface: PrivyAuthInterface | null): void {
    this.authInterface = iface;
  }

  setBridgeHelpers(helpers: PrivyBridgeHelpers | null): void {
    this.bridgeHelpers = helpers;
  }

  setPrivyInterface(iface: PrivyInterface | null): void {
    this.privyInterface = iface;
  }

  /** Cancels an in-progress connect (e.g. user closed the wallet modal). */
  cancelConnect(): void {
    this.bridgeHelpers?.cancelAuthWait();
  }

  /** Wait until PrivyBridge has wired auth + helpers (Privy SDK ready). */
  private async waitForInit(timeoutMs = INIT_TIMEOUT_MS): Promise<void> {
    if (this.bridgeHelpers && this.authInterface) return;

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.bridgeHelpers && this.authInterface) return;
      await new Promise((r) => setTimeout(r, INIT_POLL_INTERVAL_MS));
    }

    throw new Error("Privy is still loading. Wait a moment and try again.");
  }

  async connect(): Promise<{ address: string }> {
    await this.waitForInit();

    if (!this.bridgeHelpers) {
      throw new Error("Privy not initialized");
    }

    const helpers = this.bridgeHelpers;

    const existing = helpers.getExistingStellarWallet();
    if (existing) {
      helpers.wireWallet(existing);
      this.currentAddress = existing.address;
      return { address: existing.address };
    }

    if (this.privyInterface) {
      const address = this.privyInterface.getAddress();
      if (address) {
        this.currentAddress = address;
        return { address };
      }
    }

    if (!this.authInterface) {
      throw new Error("Privy not initialized");
    }

    if (!helpers.isAuthenticated()) {
      this.authInterface.login();
      try {
        await helpers.waitForAuthenticated(CONNECT_TIMEOUT_MS);
      } catch {
        throw new Error("Login cancelled or timed out");
      }
    }

    const wallet = await Promise.race([
      helpers.ensureStellarWallet(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Wallet creation timed out")),
          CONNECT_TIMEOUT_MS,
        ),
      ),
    ]);
    helpers.wireWallet(wallet);
    this.currentAddress = wallet.address;
    return { address: wallet.address };
  }

  async disconnect(): Promise<void> {
    if (this.authInterface) {
      await this.authInterface.logout();
    }
    this.currentAddress = null;
    this.privyInterface = null;
  }

  async signTransaction(
    xdr: string,
    networkPassphrase: string,
  ): Promise<string> {
    if (!this.privyInterface) {
      throw new Error("Privy not initialized");
    }
    return this.privyInterface.signTransaction(xdr, networkPassphrase);
  }
}

export const privyProvider = new PrivyWalletProvider();
