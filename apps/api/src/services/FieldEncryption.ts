import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Envelope encryption for field-level PII protection.
 *
 * Uses AES-256-GCM with a data encryption key (DEK) wrapped by a key encryption key (KEK).
 * The KEK is derived from the configured STORAGE_ENCRYPTION_KEY (or a dedicated FIELD_ENCRYPTION_KEY).
 *
 * Each field gets a unique DEK, which is encrypted with the KEK and stored alongside the ciphertext.
 * This enables key rotation by re-wrapping DEKs without re-encrypting the actual data.
 */

export interface EncryptedField {
  ciphertext: string; // base64-encoded
  encryptedDek: string; // base64-encoded DEK wrapped with KEK
  iv: string; // base64-encoded initialization vector
  authTag: string; // base64-encoded authentication tag
  version: number; // key version for rotation
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const CURRENT_VERSION = 1;

function deriveKek(keyMaterial: string): Buffer {
  const salt = Buffer.from('akkuea-field-encryption-salt', 'utf8');
  return scryptSync(keyMaterial, salt, KEY_LENGTH);
}

function getKek(): Buffer {
  const keyMaterial = process.env.FIELD_ENCRYPTION_KEY ?? process.env.STORAGE_ENCRYPTION_KEY;
  if (!keyMaterial) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY or STORAGE_ENCRYPTION_KEY must be set for field-level encryption',
    );
  }
  return deriveKek(keyMaterial);
}

function generateDek(): Buffer {
  return randomBytes(KEY_LENGTH);
}

export function encryptField(plaintext: string): EncryptedField {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty string');
  }

  const kek = getKek();
  const dek = generateDek();
  const iv = randomBytes(IV_LENGTH);

  // Encrypt the plaintext with DEK
  const cipher = createCipheriv(ALGORITHM, dek, iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Wrap the DEK with KEK
  const dekIv = randomBytes(IV_LENGTH);
  const dekCipher = createCipheriv(ALGORITHM, kek, dekIv, { authTagLength: AUTH_TAG_LENGTH });
  const encryptedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
  const dekAuthTag = dekCipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    encryptedDek: Buffer.concat([dekIv, dekAuthTag, encryptedDek]).toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    version: CURRENT_VERSION,
  };
}

export function decryptField(encrypted: EncryptedField): string {
  const kek = getKek();

  // Unwrap the DEK
  const encryptedDekBuffer = Buffer.from(encrypted.encryptedDek, 'base64');
  if (encryptedDekBuffer.length < IV_LENGTH + AUTH_TAG_LENGTH + KEY_LENGTH) {
    throw new Error('Invalid encrypted DEK format');
  }
  const dekIv = encryptedDekBuffer.subarray(0, IV_LENGTH);
  const dekAuthTag = encryptedDekBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const wrappedDek = encryptedDekBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const dekDecipher = createDecipheriv(ALGORITHM, kek, dekIv, { authTagLength: AUTH_TAG_LENGTH });
  dekDecipher.setAuthTag(dekAuthTag);
  const dek = Buffer.concat([dekDecipher.update(wrappedDek), dekDecipher.final()]);

  // Decrypt the plaintext with DEK
  const iv = Buffer.from(encrypted.iv, 'base64');
  const authTag = Buffer.from(encrypted.authTag, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertext, 'base64');

  const decipher = createDecipheriv(ALGORITHM, dek, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return plaintext.toString('utf8');
}

export function isEncryptedField(value: unknown): value is EncryptedField {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ciphertext' in value &&
    'encryptedDek' in value &&
    'iv' in value &&
    'authTag' in value &&
    'version' in value
  );
}

/**
 * Re-encrypt a field with a new KEK (key rotation).
 * This decrypts with the old KEK and re-encrypts with the new KEK.
 * The plaintext data is never re-encrypted, only the DEK is re-wrapped.
 */
export function rotateFieldKey(
  encrypted: EncryptedField,
  oldKeyMaterial: string,
  newKeyMaterial: string,
): EncryptedField {
  const oldKek = scryptSync(oldKeyMaterial, Buffer.from('akkuea-field-encryption-salt', 'utf8'), KEY_LENGTH);
  const newKek = scryptSync(newKeyMaterial, Buffer.from('akkuea-field-encryption-salt', 'utf8'), KEY_LENGTH);

  // Unwrap DEK with old KEK
  const encryptedDekBuffer = Buffer.from(encrypted.encryptedDek, 'base64');
  const dekIv = encryptedDekBuffer.subarray(0, IV_LENGTH);
  const dekAuthTag = encryptedDekBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const wrappedDek = encryptedDekBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const oldDekDecipher = createDecipheriv(ALGORITHM, oldKek, dekIv, { authTagLength: AUTH_TAG_LENGTH });
  oldDekDecipher.setAuthTag(dekAuthTag);
  const dek = Buffer.concat([oldDekDecipher.update(wrappedDek), oldDekDecipher.final()]);

  // Re-wrap DEK with new KEK
  const newDekIv = randomBytes(IV_LENGTH);
  const newDekCipher = createCipheriv(ALGORITHM, newKek, newDekIv, { authTagLength: AUTH_TAG_LENGTH });
  const newEncryptedDek = Buffer.concat([newDekCipher.update(dek), newDekCipher.final()]);
  const newDekAuthTag = newDekCipher.getAuthTag();

  return {
    ...encrypted,
    encryptedDek: Buffer.concat([newDekIv, newDekAuthTag, newEncryptedDek]).toString('base64'),
    version: CURRENT_VERSION,
  };
}

/**
 * Migration helper: encrypt plaintext fields for existing rows.
 * Returns the encrypted field object ready for database storage.
 */
export function encryptPlaintextField(plaintext: string): string {
  return JSON.stringify(encryptField(plaintext));
}

/**
 * Migration helper: decrypt field for reading (handles both encrypted and legacy plaintext).
 */
export function decryptFieldOrPlaintext(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    if (isEncryptedField(parsed)) {
      return decryptField(parsed);
    }
    // Legacy plaintext - return as-is
    return value;
  } catch {
    // Not valid JSON, assume legacy plaintext
    return value;
  }
}