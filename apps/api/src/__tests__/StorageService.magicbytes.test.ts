/**
 * Unit tests for StorageService.isAllowedFileType - magic-byte (real content) validation.
 *
 * These tests do NOT require a database connection and always run in CI.
 *
 * Magic-byte signatures used:
 *  - PDF:  %PDF  → 0x25 0x50 0x44 0x46
 *  - JPEG: FF D8 FF
 *  - PNG:  89 50 4E 47 0D 0A 1A 0A
 *  - EXE (MZ): 4D 5A
 *  - ZIP (PK): 50 4B 03 04
 *  - GIF:  47 49 46 38
 */
import { describe, it, expect } from 'bun:test';
import { StorageService } from '../services/StorageService';

// ── helpers ────────────────────────────────────────────────────────────────────

/** Minimal valid magic bytes for each allowed type (padded to 16 bytes). */
const PDF_MAGIC = Buffer.from([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
const JPEG_MAGIC = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
]);
const PNG_MAGIC = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

/** Executable / archive magic bytes - must always be rejected. */
const EXE_MAGIC = Buffer.from([
  0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00,
]);
const ZIP_MAGIC = Buffer.from([
  0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
const GIF_MAGIC = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
]);

// ── extension / MIME-only checks (no buffer) ───────────────────────────────────

describe('StorageService.isAllowedFileType - extension/MIME checks', () => {
  it('allows .pdf with application/pdf MIME', async () => {
    const result = await StorageService.isAllowedFileType('doc.pdf', 'application/pdf');
    expect(result.allowed).toBe(true);
  });

  it('allows .jpg with image/jpeg MIME', async () => {
    const result = await StorageService.isAllowedFileType('photo.jpg', 'image/jpeg');
    expect(result.allowed).toBe(true);
  });

  it('allows .jpeg with image/jpeg MIME', async () => {
    const result = await StorageService.isAllowedFileType('photo.jpeg', 'image/jpeg');
    expect(result.allowed).toBe(true);
  });

  it('allows .png with image/png MIME', async () => {
    const result = await StorageService.isAllowedFileType('scan.png', 'image/png');
    expect(result.allowed).toBe(true);
  });

  it('rejects .exe extension regardless of MIME', async () => {
    const result = await StorageService.isAllowedFileType('virus.exe', 'application/x-msdownload');
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/invalid file type/i);
  });

  it('rejects .js extension', async () => {
    const result = await StorageService.isAllowedFileType('script.js', 'text/javascript');
    expect(result.allowed).toBe(false);
  });

  it('rejects valid extension with wrong MIME type', async () => {
    const result = await StorageService.isAllowedFileType('doc.pdf', 'application/x-msdownload');
    expect(result.allowed).toBe(false);
  });
});

// ── magic-byte checks (buffer provided) ───────────────────────────────────────

describe('StorageService.isAllowedFileType - magic-byte validation', () => {
  // ── valid files ──────────────────────────────────────────────────────────────

  it('accepts a real PDF buffer named .pdf', async () => {
    const result = await StorageService.isAllowedFileType(
      'document.pdf',
      'application/pdf',
      PDF_MAGIC,
    );
    expect(result.allowed).toBe(true);
  });

  it('accepts a real JPEG buffer named .jpg', async () => {
    const result = await StorageService.isAllowedFileType('photo.jpg', 'image/jpeg', JPEG_MAGIC);
    expect(result.allowed).toBe(true);
  });

  it('accepts a real PNG buffer named .png', async () => {
    const result = await StorageService.isAllowedFileType('scan.png', 'image/png', PNG_MAGIC);
    expect(result.allowed).toBe(true);
  });

  // ── renamed malicious files (the main attack vector) ─────────────────────────

  it('rejects an EXE file renamed to .pdf', async () => {
    const result = await StorageService.isAllowedFileType(
      'malicious.pdf',
      'application/pdf',
      EXE_MAGIC,
    );
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/invalid file type/i);
  });

  it('rejects a ZIP file renamed to .jpg', async () => {
    const result = await StorageService.isAllowedFileType('archive.jpg', 'image/jpeg', ZIP_MAGIC);
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/invalid file type/i);
  });

  it('rejects a GIF renamed to .png (GIF is not in the allowed set)', async () => {
    const result = await StorageService.isAllowedFileType('image.png', 'image/png', GIF_MAGIC);
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/invalid file type/i);
  });

  it('rejects an EXE renamed to .png', async () => {
    const result = await StorageService.isAllowedFileType('evil.png', 'image/png', EXE_MAGIC);
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/invalid file type/i);
  });

  it('rejects a ZIP renamed to .pdf', async () => {
    const result = await StorageService.isAllowedFileType('fake.pdf', 'application/pdf', ZIP_MAGIC);
    expect(result.allowed).toBe(false);
  });

  // ── edge cases ────────────────────────────────────────────────────────────────

  it('rejects an unrecognised file type (random bytes, large buffer)', async () => {
    const randomBytes = Buffer.alloc(32, 0xab); // no known magic signature
    const result = await StorageService.isAllowedFileType(
      'doc.pdf',
      'application/pdf',
      randomBytes,
    );
    expect(result.allowed).toBe(false);
  });

  it('rejects a tiny buffer that cannot be identified by magic bytes', async () => {
    // Undersized payloads must not bypass magic-byte validation via MIME/extension trust.
    const tinyBuffer = Buffer.from('stub');
    const result = await StorageService.isAllowedFileType('doc.pdf', 'application/pdf', tinyBuffer);
    expect(result.allowed).toBe(false);
    expect(result.error).toMatch(/invalid file type/i);
  });

  it('rejects an empty buffer even with a valid extension and MIME', async () => {
    const result = await StorageService.isAllowedFileType(
      'doc.pdf',
      'application/pdf',
      Buffer.alloc(0),
    );
    expect(result.allowed).toBe(false);
  });

  it('still rejects a bad extension even with a valid PDF buffer', async () => {
    const result = await StorageService.isAllowedFileType(
      'malware.exe',
      'application/pdf',
      PDF_MAGIC,
    );
    expect(result.allowed).toBe(false);
  });
});
