import { ApiError } from '../../errors/ApiError';
import { StorageProvider, StorageProviderConfig } from './StorageProvider';
import { LocalStorageProvider } from './LocalStorageProvider';
import { S3CompatibleStorageProvider } from './S3CompatibleStorageProvider';

export type StorageProviderType = 'local' | 's3-compatible';

export interface StorageFactoryConfig {
  provider: StorageProviderType;
  local?: StorageProviderConfig;
  s3?: StorageProviderConfig;
}

class StorageFactory {
  private provider: StorageProvider | null = null;
  private initialized = false;

  async initialize(config: StorageFactoryConfig): Promise<void> {
    switch (config.provider) {
      case 'local': {
        const provider = new LocalStorageProvider(config.local?.baseDir);
        await provider.initialize(config.local ?? {});
        this.provider = provider;
        break;
      }
      case 's3-compatible': {
        const provider = new S3CompatibleStorageProvider(config.s3);
        await provider.initialize(config.s3 ?? {});
        this.provider = provider;
        break;
      }
      default:
        throw new Error(`Unknown storage provider: ${config.provider}`);
    }
    this.initialized = true;
  }

  getProvider(): StorageProvider {
    if (!this.initialized || !this.provider) {
      throw new Error('StorageFactory not initialized. Call initialize() first.');
    }
    return this.provider;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getProviderType(): StorageProviderType | null {
    if (!this.provider) return null;
    return this.provider.name === 'local' ? 'local' : 's3-compatible';
  }
}

export const storageFactory = new StorageFactory();