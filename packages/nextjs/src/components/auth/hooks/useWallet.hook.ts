import type { ISupportedWallet } from '@creit.tech/stellar-wallets-kit';
import { useGlobalAuthenticationStore } from '../store/data';

let walletKitInstance: any | null = null; // keep a singleton for connect/disconnect

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
        walletKitInstance.setWallet(option.id);
        const { address } = await walletKitInstance.getAddress();
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

  const handleConnect = async () => {
    try {
      await connectWallet();
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  return { handleConnect, handleDisconnect };
};
