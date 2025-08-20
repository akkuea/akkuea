import type { ISupportedWallet, StellarWalletsKit } from '@creit.tech/stellar-wallets-kit';
import { useGlobalAuthenticationStore } from '../store/data';

let walletKitInstance: StellarWalletsKit | null = null;

export const useWallet = () => {
  const { connectWalletStore, disconnectWalletStore } = useGlobalAuthenticationStore();

  const connectWallet = async () => {
    const walletLib = await import('@creit.tech/stellar-wallets-kit');
    if (!walletKitInstance) {
      walletKitInstance = new walletLib.StellarWalletsKit({
        network: walletLib.WalletNetwork.TESTNET,
        selectedWalletId: walletLib.FREIGHTER_ID,
        modules: walletLib.allowAllModules(),
      });
    }

    await walletKitInstance.openModal({
      modalTitle: 'Connect to your favorite wallet',
      onWalletSelected: async (option: ISupportedWallet) => {
        walletKitInstance!.setWallet(option.id);
        const { address } = await walletKitInstance!.getAddress();
        const { name } = option;
        connectWalletStore(address, name);
      },
    });
  };

  const disconnectWallet = async () => {
    try {
      await walletKitInstance?.disconnect?.();
    } finally {
      disconnectWalletStore();
    }
  };

  return {
    handleConnect: connectWallet,
    handleDisconnect: disconnectWallet,
  };
};
