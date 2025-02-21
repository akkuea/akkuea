export interface AuthenticationStore {
  address: string;
  name: string;

  connectWalletStore: (address: string, name: string) => void;
  disconnectWalletStore: () => void;
}
