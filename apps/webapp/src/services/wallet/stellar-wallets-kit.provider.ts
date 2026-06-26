import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
} from "@creit.tech/stellar-wallets-kit";
import type { WalletProvider } from "./types";

export class StellarWalletsKitProvider implements WalletProvider {
  readonly id = "stellar-wallets-kit";
  readonly name = "Stellar Wallet";

  private kit: StellarWalletsKit | null = null;
  private _isConnected = false;

  get isConnected(): boolean {
    return this._isConnected;
  }

  private getKit(network: WalletNetwork): StellarWalletsKit {
    if (!this.kit) {
      this.kit = new StellarWalletsKit({
        network,
        selectedWalletId: undefined,
        modules: allowAllModules(),
      });
    }
    return this.kit;
  }

  async connect(
    network: WalletNetwork = WalletNetwork.TESTNET,
  ): Promise<{ address: string }> {
    const kit = this.getKit(network);

    return new Promise((resolve, reject) => {
      kit
        .openModal({
          onWalletSelected: async (option) => {
            try {
              kit.setWallet(option.id);
              const { address } = await kit.getAddress();
              this._isConnected = true;
              resolve({ address });
            } catch (err) {
              this._isConnected = false;
              reject(err);
            }
          },
          onClosed: () => {
            if (!this._isConnected) {
              reject(new Error("Wallet selection cancelled"));
            }
          },
        })
        .catch(reject);
    });
  }

  async disconnect(): Promise<void> {
    this._isConnected = false;
    this.kit = null;
  }
}
