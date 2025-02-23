import { ISupportedWallet } from '@creit.tech/stellar-wallets-kit';
import { useGlobalAuthenticationStore } from '../store/data';
import { kit } from '@/components/auth/constant/walletKit';

export const useWallet = () => {
  const { connectWalletStore, disconnectWalletStore } = useGlobalAuthenticationStore();

  const connectWallet = async () => {
    await kit.openModal({
      modalTitle: 'Connect to your favorite wallet',
      onWalletSelected: async (option: ISupportedWallet) => {
        kit.setWallet(option.id);

        const { address } = await kit.getAddress();
        const { name } = option;

        connectWalletStore(address, name);
      },
    });
  };

  const disconnectWallet = async () => {
    await kit.disconnect();
    disconnectWalletStore();
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
      if (disconnectWallet) {
        await disconnectWallet();
      }
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  return {
    handleConnect,
    handleDisconnect,
  };
};
