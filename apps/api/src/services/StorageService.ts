import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import { ApiError } from '../errors/ApiError';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png']);
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']);

/**
 * Magic-byte signatures for allowed file types.
 * These are the first bytes of the file as they appear on disk,
 * independent of the filename extension or MIME type declared by the client.
 */
const ALLOWED_MAGIC_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

export type StoredFile = {
  storedFileName: string;
  relativePath: string;
  extension: string;
};

/**
 * File storage abstraction for KYC documents.
 * Stores files on local filesystem with unique filenames.
 * Base directory is configurable via KYC_UPLOAD_DIR (default: ./uploads/kyc).
 */
export class StorageService {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir =
      baseDir ?? process.env.KYC_UPLOAD_DIR ?? path.join(process.cwd(), 'uploads', 'kyc');
  }

  /**
   * Validate file extension, MIME type, and actual file content via magic-byte
   * inspection (REQ-006). Allowed: PDF, JPG, PNG only.
   *
   * When `buffer` is supplied the file's real type is detected from its leading
   * bytes using the `file-type` package.  A file whose bytes do not match an
   * allowed type is rejected even if its extension / MIME type look correct —
   * this prevents attackers from bypassing the check by renaming files.
   *
   * The method is async because `fileTypeFromBuffer` returns a Promise.
   */
  static async isAllowedFileType(
    filename: string,
    mimeType?: string,
    buffer?: Buffer,
  ): Promise<{ allowed: boolean; error?: string }> {
    // 1. Extension check (fast, cheap)
    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return { allowed: false, error: 'Invalid file type. Only PDF, JPG, and PNG are allowed.' };
    }

    // 2. Client-supplied MIME type check
    if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
      return { allowed: false, error: 'Invalid file type. Only PDF, JPG, and PNG are allowed.' };
    }

    // 3. Magic-byte inspection — definitive when content is available.
    // When a buffer is supplied we never fall back to extension/MIME alone:
    // undersized or unidentifiable content is rejected (spoofable checks only
    // apply when no buffer is provided, e.g. pure unit-test extension cases).
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
   * Store a file with a unique name under baseDir/userId/.
   * Returns the relative path (for DB fileUrl) and stored filename.
   */
  async store(
    buffer: Buffer,
    userId: string,
    extension: string,
    documentId?: string,
  ): Promise<StoredFile> {
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    if (!ALLOWED_EXTENSIONS.has(ext.toLowerCase())) {
      throw ApiError.badRequest('Invalid file type. Only PDF, JPG, and PNG are allowed.');
    }

    const dir = path.join(this.baseDir, userId);
    await mkdir(dir, { recursive: true });

    const uniqueId = documentId ?? randomUUID();
    const storedFileName = `${uniqueId}${ext}`;
    const fullPath = path.join(dir, storedFileName);
    const relativePath = path.join('kyc', userId, storedFileName);

    await writeFile(fullPath, buffer, { flag: 'w' });

    return {
      storedFileName,
      relativePath: relativePath.replace(/\\/g, '/'),
      extension: ext,
    };
  }

  /**
   * Read file by relative path (e.g. kyc/userId/uuid.pdf).
   * Used when serving document URLs.
   */
  async readByRelativePath(relativePath: string): Promise<Buffer> {
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
    return readFile(fullPath);
  }

  /**
   * Delete file by relative path (e.g. when replacing a document).
   */
  async deleteByRelativePath(relativePath: string): Promise<void> {
    const normalized = relativePath.replace(/^kyc[/\\]/, '');
    const fullPath = path.join(this.baseDir, path.dirname(normalized), path.basename(normalized));

    if (!path.resolve(fullPath).startsWith(path.resolve(this.baseDir))) {
      return;
    }

    const { unlink } = await import('node:fs/promises');
    try {
      await unlink(fullPath);
    } catch {
      // Ignore if file already missing
    }
  }

  getBaseDir(): string {
    return this.baseDir;
  }
}

export const storageService = new StorageService();
