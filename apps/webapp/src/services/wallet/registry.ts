import type { WalletProvider } from "./types";

/**
 * Registry of available wallet providers.
 * Providers are registered once at app startup (Providers.tsx) and
 * consumed by hooks/components without knowing the concrete implementations.
 */
class WalletProviderRegistry {
  private providers = new Map<string, WalletProvider>();

  register(provider: WalletProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): WalletProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): WalletProvider[] {
    return Array.from(this.providers.values());
  }
}

export const walletRegistry = new WalletProviderRegistry();
