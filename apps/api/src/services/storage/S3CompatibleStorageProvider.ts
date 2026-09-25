import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

export class S3CompatibleStorageProvider implements StorageProvider {
  readonly name = 's3-compatible';

  private client: S3Client | null = null;
  private bucket: string = '';
  private prefix = 'kyc';
  private initialized = false;
  private encryptionKey: Buffer | null = null;

  constructor(config?: StorageProviderConfig) {
    if (config) {
      this.initialize(config);
    }
  }

  async initialize(config: StorageProviderConfig): Promise<void> {
    const {
      bucket,
      region = 'us-east-1',
      endpoint,
      accessKeyId,
      secretAccessKey,
      encryptionKey,
    } = config;

    if (!bucket) {
      throw new Error('S3 bucket is required');
    }
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('S3 access key ID and secret access key are required');
    }

    this.bucket = bucket;
    this.prefix = config.baseDir ?? 'kyc';

    this.client = new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: !!endpoint,
    });

    if (encryptionKey) {
      this.encryptionKey = Buffer.from(encryptionKey, 'base64');
      if (this.encryptionKey.length !== 32) {
        throw new Error('Encryption key must be 32 bytes (base64-encoded)');
      }
    }

    this.initialized = true;
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.client) {
      throw new Error('S3CompatibleStorageProvider not initialized. Call initialize() first.');
    }
  }

  private encrypt(buffer: Buffer): Buffer {
    if (!this.encryptionKey) return buffer;

    const crypto = require('node:crypto');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
  }

  private decrypt(buffer: Buffer): Buffer {
    if (!this.encryptionKey) return buffer;

    const crypto = require('node:crypto');
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

    const storedFileName = generateStoredFileName(ext, documentId);
    const relativePath = buildRelativePath(this.prefix, userId, storedFileName);
    const key = relativePath;

    const encryptedBuffer = this.encrypt(buffer);

    const contentType = ext === '.pdf'
      ? 'application/pdf'
      : ext === '.png'
        ? 'image/png'
        : 'image/jpeg';

    await this.client!.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: encryptedBuffer,
      ContentType: contentType,
      ServerSideEncryption: this.encryptionKey ? undefined : 'AES256',
    }));

    return {
      storedFileName,
      relativePath: relativePath.replace(/\\/g, '/'),
      extension: ext,
    };
  }

  async readByRelativePath(relativePath: string): Promise<Buffer> {
    this.ensureInitialized();

    const normalized = relativePath.replace(/^kyc[/\\]/, '');
    const key = normalized;

    try {
      const response = await this.client!.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));

      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      const encryptedBuffer = Buffer.concat(chunks);
      return this.decrypt(encryptedBuffer);
    } catch (err) {
      const error = err as Error & { name?: string; $metadata?: { httpStatusCode?: number } };
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        throw ApiError.notFound('Document file not found');
      }
      throw ApiError.internal(`Failed to read document: ${error.message}`);
    }
  }

  async deleteByRelativePath(relativePath: string): Promise<void> {
    this.ensureInitialized();

    const normalized = relativePath.replace(/^kyc[/\\]/, '');
    const key = normalized;

    try {
      await this.client!.send(new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
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
    const key = normalized;

    try {
      await this.client!.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
    } catch (err) {
      const error = err as Error & { name?: string; $metadata?: { httpStatusCode?: number } };
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        throw ApiError.notFound('Document file not found');
      }
      throw ApiError.internal(`Failed to verify document exists: ${error.message}`);
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client!, command, { expiresIn: expiresInSeconds });
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client!.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: 'health-check',
      }));
      return true;
    } catch (err) {
      const error = err as Error & { name?: string; $metadata?: { httpStatusCode?: number } };
      return error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404;
    }
  }
}