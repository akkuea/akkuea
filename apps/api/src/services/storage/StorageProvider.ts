import { randomUUID } from 'node:crypto';

export type StoredFile = {
  storedFileName: string;
  relativePath: string;
  extension: string;
};

export type StorageProviderConfig = {
  baseDir?: string;
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  encryptionKey?: string;
};

export interface StorageProvider {
  readonly name: string;

  initialize(config: StorageProviderConfig): Promise<void>;

  store(
    buffer: Buffer,
    userId: string,
    extension: string,
    documentId?: string,
  ): Promise<StoredFile>;

  readByRelativePath(relativePath: string): Promise<Buffer>;

  deleteByRelativePath(relativePath: string): Promise<void>;

  getSignedReadUrl(
    relativePath: string,
    expiresInSeconds?: number,
  ): Promise<string>;

  isHealthy(): Promise<boolean>;
}

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);
const ALLOWED_MAGIC_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

export function getFileExtension(filename: string): string {
  return filename.includes('.')
    ? filename.slice(filename.lastIndexOf('.'))
    : '.pdf';
}

export function isAllowedExtension(ext: string): boolean {
  return ALLOWED_EXTENSIONS.has(ext.toLowerCase());
}

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_MIME_TYPES.has(mimeType);
}

export async function validateFileType(
  filename: string,
  mimeType: string | undefined,
  buffer: Buffer,
  fileTypeFromBuffer: (buffer: Buffer) => Promise<{ mime: string } | undefined>,
): Promise<{ allowed: boolean; error?: string }> {
  const ext = getFileExtension(filename).toLowerCase();
  if (!isAllowedExtension(ext)) {
    return { allowed: false, error: 'Invalid file type. Only PDF, JPG, and PNG are allowed.' };
  }

  if (mimeType && !isAllowedMimeType(mimeType)) {
    return { allowed: false, error: 'Invalid file type. Only PDF, JPG, and PNG are allowed.' };
  }

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

  return { allowed: true };
}

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export function isAllowedFileSize(sizeInBytes: number): { allowed: boolean; error?: string } {
  if (sizeInBytes > MAX_FILE_SIZE_BYTES) {
    return {
      allowed: false,
      error: `File size exceeds 10MB limit. Received ${(sizeInBytes / (1024 * 1024)).toFixed(2)}MB.`,
    };
  }
  return { allowed: true };
}

export function generateStoredFileName(
  extension: string,
  documentId?: string,
): string {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  const uniqueId = documentId ?? randomUUID();
  return `${uniqueId}${ext}`;
}

export function buildRelativePath(
  prefix: string,
  userId: string,
  storedFileName: string,
): string {
  return `${prefix}/${userId}/${storedFileName}`;
}