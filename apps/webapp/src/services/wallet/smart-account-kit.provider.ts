import type { WalletProvider } from "./types";

export interface SmartAccountKitProviderConfig {
  rpcUrl: string;
  networkPassphrase: string;
  accountWasmHash: string;
  webauthnVerifierAddress: string;
  appName?: string;
}

export class SmartAccountKitProvider implements WalletProvider {
  readonly id = "smart-account-kit";
  readonly name = "Smart Account (Passkey)";

  private config: SmartAccountKitProviderConfig;
  // Lazily imported to avoid SSR issues with WebAuthn
  private kit: import("smart-account-kit").SmartAccountKit | null = null;

  constructor(config: SmartAccountKitProviderConfig) {
    this.config = config;
  }

  get isConnected(): boolean {
    return this.kit?.isConnected ?? false;
  }

  private async getKit(): Promise<import("smart-account-kit").SmartAccountKit> {
    if (!this.kit) {
      const { SmartAccountKit } = await import("smart-account-kit");
      this.kit = new SmartAccountKit({
        rpcUrl: this.config.rpcUrl,
        networkPassphrase: this.config.networkPassphrase,
        accountWasmHash: this.config.accountWasmHash,
        webauthnVerifierAddress: this.config.webauthnVerifierAddress,
      });
    }
    return this.kit;
  }

  async connect(): Promise<{ address: string }> {
    const kit = await this.getKit();
    const result = await kit.connectWallet();
    if (!result) throw new Error("Smart account connection returned no result");
    // Smart accounts use a contract address (C...) as the "address"
    return { address: result.contractId };
  }

  async disconnect(): Promise<void> {
    if (this.kit) {
      await this.kit.disconnect();
    }
  }
}
