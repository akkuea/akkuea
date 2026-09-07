import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import type { WalletProvider } from "./types";

export class StellarWalletsKitProvider implements WalletProvider {
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
}
