import { fileTypeFromBuffer } from 'file-type';
import { ApiError } from '../errors/ApiError';
import { storageFactory, StorageFactoryConfig } from './storage';
import { StoredFile } from './storage/StorageProvider';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']);
const ALLOWED_MAGIC_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

/**
 * File storage abstraction for KYC and whitelist documents.
 * Delegates to a configured storage provider (local or S3-compatible).
 * Encryption at rest is handled by the provider.
 */
export class StorageService {
  private static initialized = false;

  static async initialize(config: StorageFactoryConfig): Promise<void> {
    await storageFactory.initialize(config);
    StorageService.initialized = true;
  }

  private static getProvider() {
    if (!StorageService.initialized) {
      throw new Error('StorageService not initialized. Call StorageService.initialize() at startup.');
    }
    return storageFactory.getProvider();
  }

  /**
   * Validate file extension, MIME type, and actual file content via magic-byte
   * inspection (REQ-006). Allowed: PDF, JPG, PNG only.
   *
   * When `buffer` is supplied the file's real type is detected from its leading
   * bytes using the `file-type` package. A file whose bytes do not match an
   * allowed type is rejected even if its extension / MIME type look correct -
   * this prevents attackers from bypassing the check by renaming files.
   */
  static async isAllowedFileType(
    filename: string,
    mimeType?: string,
    buffer?: Buffer,
  ): Promise<{ allowed: boolean; error?: string }> {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return { allowed: false, error: 'Invalid file type. Only PDF, JPG, and PNG are allowed.' };
    }

    if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
      return { allowed: false, error: 'Invalid file type. Only PDF, JPG, and PNG are allowed.' };
    }

    if (buffer !== undefined) {
      if (buffer.length === 0) {
        return {
          allowed: false,
          error: 'Invalid file type. Only PDF, JPG, and PNG are allowed.',
        };
      }

      const detected = await fileTypeFromBuffer(buffer);

      if (!detected) {
        return {
          allowed: false,
          error: 'Invalid file type. Only PDF, JPG, and PNG are allowed.',
        };
      }

      if (!ALLOWED_MAGIC_MIME_TYPES.has(detected.mime)) {
        return {
          allowed: false,
          error: `Invalid file type. Only PDF, JPG, and PNG are allowed. Detected: ${detected.mime}.`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Validate file size (REQ-007). Max 10MB per file.
   */
  static readonly MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

  static isAllowedFileSize(sizeInBytes: number): { allowed: boolean; error?: string } {
    if (sizeInBytes > StorageService.MAX_FILE_SIZE_BYTES) {
      return {
        allowed: false,
        error: `File size exceeds 10MB limit. Received ${(sizeInBytes / (1024 * 1024)).toFixed(2)}MB.`,
      };
    }
    return { allowed: true };
  }

  /**
   * Store a file with a unique name under the provider's base path.
   * Returns the relative path (for DB fileUrl) and stored filename.
   */
  static async store(
    buffer: Buffer,
    userId: string,
    extension: string,
    documentId?: string,
  ): Promise<StoredFile> {
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    if (!ALLOWED_EXTENSIONS.has(ext.toLowerCase())) {
      throw ApiError.badRequest('Invalid file type. Only PDF, JPG, and PNG are allowed.');
    }

    const provider = StorageService.getProvider();
    return provider.store(buffer, userId, ext, documentId);
  }

  /**
   * Read file by relative path (e.g. kyc/userId/uuid.pdf).
   * Used when serving document URLs.
   */
  static async readByRelativePath(relativePath: string): Promise<Buffer> {
    const provider = StorageService.getProvider();
    return provider.readByRelativePath(relativePath);
  }

  /**
   * Delete file by relative path (e.g. when replacing a document).
   */
  static async deleteByRelativePath(relativePath: string): Promise<void> {
    const provider = StorageService.getProvider();
    return provider.deleteByRelativePath(relativePath);
  }

  /**
   * Get a signed URL for reading a document with expiration.
   */
  static async getSignedReadUrl(
    relativePath: string,
    expiresInSeconds?: number,
  ): Promise<string> {
    const provider = StorageService.getProvider();
    return provider.getSignedReadUrl(relativePath, expiresInSeconds);
  }

  /**
   * Check if the storage provider is healthy.
   */
  static async isHealthy(): Promise<boolean> {
    if (!StorageService.initialized) return false;
    return storageFactory.getProvider().isHealthy();
  }

  /**
   * Get the current provider type ('local' or 's3-compatible').
   */
  static getProviderType(): 'local' | 's3-compatible' | null {
    return storageFactory.getProviderType();
  }
}

export const storageService = StorageService;