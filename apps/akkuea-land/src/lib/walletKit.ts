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

/**
 * The minimal kit surface ensureWalletSelected needs. Structural so tests can
 * pass a plain stub instead of module-mocking the wallets-kit package.
 */
export interface SelectableWalletKit {
  getAddress(): Promise<{ address: string }>;
  openModal(params: {
    onWalletSelected: (option: { id: string }) => void;
    onClosed?: (err: Error) => void;
  }): Promise<void>;
  setWallet(id: string): void;
}

/**
 * Make sure a wallet is selected on the kit, opening the wallet-picker modal
 * if needed. Returns the selected account's address, or null if the user
 * closed the modal without picking a wallet.
 */
export const ensureWalletSelected = async (
  kit: SelectableWalletKit,
): Promise<string | null> => {
  try {
    const { address } = await kit.getAddress();
    return address;
  } catch {
    // No wallet selected yet - fall through to the picker modal.
  }

  const walletId = await new Promise<string | null>((resolve) => {
    void kit.openModal({
      onWalletSelected: (option) => resolve(option.id),
      onClosed: () => resolve(null),
    });
  });
  if (!walletId) return null;

  kit.setWallet(walletId);
  const { address } = await kit.getAddress();
  return address;
};

/**
 * Initialize the kit and make sure a wallet is selected.
 *
 * Returns the kit plus the selected account's address, or null if the user
 * closed the picker without choosing a wallet.
 */
export const connectWalletKit = async (): Promise<{
  kit: StellarWalletsKit;
  address: string;
} | null> => {
  const kit = initializeWalletKit();
  const address = await ensureWalletSelected(kit);
  return address === null ? null : { kit, address };
};

export const resetWalletKit = (): void => {
  kitInstance = null;
};
