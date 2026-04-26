import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
} from "@creit.tech/stellar-wallets-kit";

// Singleton instance
let kitInstance: StellarWalletsKit | null = null;

export const initializeWalletKit = (
  network: WalletNetwork = WalletNetwork.TESTNET,
): StellarWalletsKit => {
  if (!kitInstance) {
    kitInstance = new StellarWalletsKit({
      network,
      selectedWalletId: undefined,
      modules: allowAllModules(),
    });
  }
  return kitInstance;
};

export const getWalletKit = (): StellarWalletsKit | null => {
  return kitInstance;
};

export const resetWalletKit = (): void => {
  kitInstance = null;
};
