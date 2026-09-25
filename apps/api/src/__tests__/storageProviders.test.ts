import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { LocalStorageProvider } from '../services/storage/LocalStorageProvider';
import { StorageService } from '../services/StorageService';
import { fileTypeFromBuffer } from 'file-type';

const TEST_BASE_DIR = join(process.cwd(), 'test-storage-temp');
const ENCRYPTION_KEY = randomBytes(32).toString('base64');

// Valid magic bytes for testing
const PDF_MAGIC = Buffer.from([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
const JPEG_MAGIC = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);
const PNG_MAGIC = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

describe('LocalStorageProvider', () => {
  let provider: LocalStorageProvider;

  beforeEach(async () => {
    await rm(TEST_BASE_DIR, { recursive: true, force: true });
    await mkdir(TEST_BASE_DIR, { recursive: true });
    provider = new LocalStorageProvider(TEST_BASE_DIR);
    await provider.initialize({ baseDir: TEST_BASE_DIR, encryptionKey: ENCRYPTION_KEY });
  });

  afterEach(async () => {
    await rm(TEST_BASE_DIR, { recursive: true, force: true });
  });

  it('stores and reads a PDF file with encryption', async () => {
    const buffer = PDF_MAGIC;
    const stored = await provider.store(buffer, 'user123', '.pdf', 'doc1');
    expect(stored.relativePath).toMatch(/^kyc\/user123\/doc1\.pdf$/);

    // Verify file exists on disk
    const readBuffer = await provider.readByRelativePath(stored.relativePath);
    expect(readBuffer).toEqual(buffer);

    // Verify raw file on disk is encrypted (not equal to original)
    const { readFile } = await import('node:fs/promises');
    const rawPath = join(TEST_BASE_DIR, stored.relativePath.replace('kyc/', ''));
    const rawContent = await readFile(rawPath);
    expect(rawContent).not.toEqual(buffer);
    expect(rawContent.length).toBeGreaterThan(buffer.length); // IV + authTag + ciphertext
  });

  it('stores and reads a JPEG file with encryption', async () => {
    const buffer = JPEG_MAGIC;
    const stored = await provider.store(buffer, 'user123', '.jpg');
    const readBuffer = await provider.readByRelativePath(stored.relativePath);
    expect(readBuffer).toEqual(buffer);
  });

  it('stores and reads a PNG file with encryption', async () => {
    const buffer = PNG_MAGIC;
    const stored = await provider.store(buffer, 'user123', '.png');
    const readBuffer = await provider.readByRelativePath(stored.relativePath);
    expect(readBuffer).toEqual(buffer);
  });

  it('rejects invalid file type (EXE)', async () => {
    const exeMagic = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    await expect(provider.store(exeMagic, 'user123', '.pdf'))
      .rejects.toThrow('Invalid file type');
  });

  it('rejects file over 10MB', async () => {
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024, 0x25); // 11MB of % chars
    await expect(provider.store(bigBuffer, 'user123', '.pdf'))
      .rejects.toThrow('File size exceeds 10MB limit');
  });

  it('deletes file by relative path', async () => {
    const stored = await provider.store(PDF_MAGIC, 'user123', '.pdf', 'doc1');
    await provider.deleteByRelativePath(stored.relativePath);
    await expect(provider.readByRelativePath(stored.relativePath))
      .rejects.toThrow('Document file not found');
  });

  it('returns signed read URL', async () => {
    const stored = await provider.store(PDF_MAGIC, 'user123', '.pdf', 'doc1');
    const url = await provider.getSignedReadUrl(stored.relativePath, 3600);
    expect(url).toContain(stored.relativePath);
    expect(url).toContain('token=');
  });

  it('validates health check', async () => {
    const healthy = await provider.isHealthy();
    expect(healthy).toBe(true);
  });

  it('rejects path traversal attempts', async () => {
    const stored = await provider.store(PDF_MAGIC, 'user123', '.pdf');
    // Try to read with path traversal
    await expect(provider.readByRelativePath('../../../etc/passwd'))
      .rejects.toThrow('Invalid document path');
  });
});

describe('StorageService (integration with provider)', () => {
  beforeEach(async () => {
    await rm(TEST_BASE_DIR, { recursive: true, force: true });
    await mkdir(TEST_BASE_DIR, { recursive: true });
    await StorageService.initialize({
      provider: 'local',
      local: { baseDir: TEST_BASE_DIR, encryptionKey: ENCRYPTION_KEY },
    });
  });

  afterEach(async () => {
    await rm(TEST_BASE_DIR, { recursive: true, force: true });
  });

  it('stores and retrieves file through static methods', async () => {
    const stored = await StorageService.store(PDF_MAGIC, 'user456', '.pdf', 'doc1');
    expect(stored.relativePath).toMatch(/^kyc\/user456\/doc1\.pdf$/);

    const readBuffer = await StorageService.readByRelativePath(stored.relativePath);
    expect(readBuffer).toEqual(PDF_MAGIC);
  });

  it('validates file type through static method', async () => {
    const result = await StorageService.isAllowedFileType('test.pdf', 'application/pdf', PDF_MAGIC);
    expect(result.allowed).toBe(true);
  });

  it('rejects invalid file type through static method', async () => {
    const exeMagic = Buffer.from([0x4d, 0x5a]);
    const result = await StorageService.isAllowedFileType('test.pdf', 'application/pdf', exeMagic);
    expect(result.allowed).toBe(false);
  });

  it('validates file size through static method', () => {
    const result = StorageService.isAllowedFileSize(5 * 1024 * 1024);
    expect(result.allowed).toBe(true);

    const result2 = StorageService.isAllowedFileSize(11 * 1024 * 1024);
    expect(result2.allowed).toBe(false);
  });

  it('gets signed URL through static method', async () => {
    const stored = await StorageService.store(PDF_MAGIC, 'user456', '.pdf', 'doc2');
    const url = await StorageService.getSignedReadUrl(stored.relativePath, 1800);
    expect(url).toContain('token=');
  });

  it('returns provider type', () => {
    expect(StorageService.getProviderType()).toBe('local');
  });
});