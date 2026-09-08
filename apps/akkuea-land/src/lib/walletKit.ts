import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";

// StellarWalletsKit v2 exposes a static API (init once, then call the class
// directly), so this module just tracks whether init() has run rather than
// holding an instance.
let initialized = false;

export const initializeWalletKit = (
  network: Networks = Networks.TESTNET,
): typeof StellarWalletsKit => {
  if (!initialized) {
    StellarWalletsKit.init({
      network,
      selectedWalletId: undefined,
      modules: defaultModules(),
    });
    initialized = true;
  }
  return StellarWalletsKit;
};

export const getWalletKit = (): typeof StellarWalletsKit | null => {
  return initialized ? StellarWalletsKit : null;
};

/**
 * The minimal kit surface ensureWalletSelected needs. Structural so tests can
 * pass a plain stub instead of module-mocking the wallets-kit package.
 */
export interface SelectableWalletKit {
  getAddress(): Promise<{ address: string }>;
  authModal(): Promise<{ address: string }>;
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

  try {
    const { address } = await kit.authModal();
    return address;
  } catch {
    // The user closed the picker without choosing a wallet.
    return null;
  }
};

/**
 * Initialize the kit and make sure a wallet is selected.
 *
 * Returns the kit plus the selected account's address, or null if the user
 * closed the picker without choosing a wallet.
 */
export const connectWalletKit = async (): Promise<{
  kit: typeof StellarWalletsKit;
  address: string;
} | null> => {
  const kit = initializeWalletKit();
  const address = await ensureWalletSelected(kit);
  return address === null ? null : { kit, address };
};

export const resetWalletKit = (): void => {
  initialized = false;
};
