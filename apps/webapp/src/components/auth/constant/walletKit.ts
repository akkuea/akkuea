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

export const resetWalletKit = (): void => {
  initialized = false;
};
