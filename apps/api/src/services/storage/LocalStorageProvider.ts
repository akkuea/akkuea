import { mkdir, writeFile, readFile, access, unlink } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { ApiError } from '../../errors/ApiError';
import {
  StorageProvider,
  StoredFile,
  StorageProviderConfig,
  validateFileType,
  isAllowedFileSize,
  generateStoredFileName,
  buildRelativePath,
  getFileExtension,
} from './StorageProvider';

export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';

  private baseDir: string;
  private initialized = false;
  private encryptionKey: Buffer | null = null;

  constructor(baseDir?: string) {
    if (baseDir) {
      this.baseDir = baseDir;
    } else {
      this.baseDir = path.join(process.cwd(), 'uploads', 'kyc');
    }
  }

  async initialize(config: StorageProviderConfig): Promise<void> {
    this.baseDir = config.baseDir ?? this.baseDir;
    await mkdir(this.baseDir, { recursive: true });

    if (config.encryptionKey) {
      this.encryptionKey = Buffer.from(config.encryptionKey, 'base64');
      if (this.encryptionKey.length !== 32) {
        throw new Error('Encryption key must be 32 bytes (base64-encoded)');
      }
    }

    this.initialized = true;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('LocalStorageProvider not initialized. Call initialize() first.');
    }
  }

  private encrypt(buffer: Buffer): Buffer {
    if (!this.encryptionKey) return buffer;

    const crypto = await import('node:crypto');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
  }

  private decrypt(buffer: Buffer): Buffer {
    if (!this.encryptionKey) return buffer;

    const crypto = await import('node:crypto');
    if (buffer.length < 16 + 16) {
      throw new Error('Invalid encrypted buffer: too short');
    }
    const iv = buffer.subarray(0, 16);
    const authTag = buffer.subarray(16, 32);
    const encrypted = buffer.subarray(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  async store(
    buffer: Buffer,
    userId: string,
    extension: string,
    documentId?: string,
  ): Promise<StoredFile> {
    this.ensureInitialized();

    const ext = getFileExtension(extension);
    if (!isAllowedExtension(ext)) {
      throw ApiError.badRequest('Invalid file type. Only PDF, JPG, and PNG are allowed.');
    }

    const sizeCheck = isAllowedFileSize(buffer.length);
    if (!sizeCheck.allowed) {
      throw ApiError.badRequest(sizeCheck.error!);
    }

    const typeCheck = await validateFileType(
      `file${ext}`,
      undefined,
      buffer,
      fileTypeFromBuffer,
    );
    if (!typeCheck.allowed) {
      throw ApiError.badRequest(typeCheck.error!);
    }

    const dir = path.join(this.baseDir, userId);
    await mkdir(dir, { recursive: true });

    const storedFileName = generateStoredFileName(ext, documentId);
    const fullPath = path.join(dir, storedFileName);
    const relativePath = buildRelativePath('kyc', userId, storedFileName);

    const encryptedBuffer = this.encrypt(buffer);
    await writeFile(fullPath, encryptedBuffer, { flag: 'w' });

    return {
      storedFileName,
      relativePath: relativePath.replace(/\\/g, '/'),
      extension: ext,
    };
  }

  async readByRelativePath(relativePath: string): Promise<Buffer> {
    this.ensureInitialized();

    const normalized = relativePath.replace(/^kyc[/\\]/, '');
    const fullPath = path.join(this.baseDir, path.dirname(normalized), path.basename(normalized));

    if (!path.resolve(fullPath).startsWith(path.resolve(this.baseDir))) {
      throw ApiError.badRequest('Invalid document path');
    }

    try {
      await access(fullPath, constants.F_OK);
    } catch {
      throw ApiError.notFound('Document file not found');
    }

    const encryptedBuffer = await readFile(fullPath);
    return this.decrypt(encryptedBuffer);
  }

  async deleteByRelativePath(relativePath: string): Promise<void> {
    this.ensureInitialized();

    const normalized = relativePath.replace(/^kyc[/\\]/, '');
    const fullPath = path.join(this.baseDir, path.dirname(normalized), path.basename(normalized));

    if (!path.resolve(fullPath).startsWith(path.resolve(this.baseDir))) {
      return;
    }

    try {
      await unlink(fullPath);
    } catch {
      // Ignore if file already missing
    }
  }

  async getSignedReadUrl(
    relativePath: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    this.ensureInitialized();

    const normalized = relativePath.replace(/^kyc[/\\]/, '');
    const fullPath = path.join(this.baseDir, path.dirname(normalized), path.basename(normalized));

    if (!path.resolve(fullPath).startsWith(path.resolve(this.baseDir))) {
      throw ApiError.badRequest('Invalid document path');
    }

    try {
      await access(fullPath, constants.F_OK);
    } catch {
      throw ApiError.notFound('Document file not found');
    }

    const baseUrl = process.env.STORAGE_LOCAL_BASE_URL ?? 'http://localhost:3001';
    const token = Buffer.from(`${relativePath}:${Date.now() + expiresInSeconds * 1000}`).toString('base64url');
    return `${baseUrl}/storage/local/${relativePath}?token=${token}`;
  }

  async isHealthy(): Promise<boolean> {
    try {
      await access(this.baseDir, constants.F_OK | constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  getBaseDir(): string {
    return this.baseDir;
  }
}