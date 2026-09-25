import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import {
  encryptField,
  decryptField,
  encryptPlaintextField,
  decryptFieldOrPlaintext,
  rotateFieldKey,
  isEncryptedField,
} from '../services/FieldEncryption';

const TEST_KEY = 'dGVzdC1rZXktbWF0ZXJpYWwtdGhhdC1pcy0zMi1ieXRlcy1sb25nLg=='; // 32 bytes base64
const OLD_KEY = 'b2xkLWtleS1tYXRlcmlhbC10aGF0LWlzLTMzLWJ5dGVzLWxvbmcu'; // 32 bytes base64
const NEW_KEY = 'bmV3LWtleS1tYXRlcmlhbC10aGF0LWlzLTMzLWJ5dGVzLWxvbmcu'; // 32 bytes base64

describe('FieldEncryption', () => {
  beforeAll(() => {
    process.env.FIELD_ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    delete process.env.FIELD_ENCRYPTION_KEY;
  });

  describe('encryptField / decryptField', () => {
    it('encrypts and decrypts a simple string', () => {
      const plaintext = 'John Doe';
      const encrypted = encryptField(plaintext);
      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypts and decrypts a string with special characters', () => {
      const plaintext = "O'Connor-Smith";
      const encrypted = encryptField(plaintext);
      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('encrypts and decrypts a long string (ID number)', () => {
      const plaintext = 'A123456789012345678901234567890';
      const encrypted = encryptField(plaintext);
      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext for same plaintext (IV randomness)', () => {
      const plaintext = 'John Doe';
      const encrypted1 = encryptField(plaintext);
      const encrypted2 = encryptField(plaintext);
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.encryptedDek).not.toBe(encrypted2.encryptedDek);
      // But both decrypt correctly
      expect(decryptField(encrypted1)).toBe(plaintext);
      expect(decryptField(encrypted2)).toBe(plaintext);
    });

    it('throws on empty string', () => {
      expect(() => encryptField('')).toThrow('Cannot encrypt empty string');
    });

    it('returns correct structure with all required fields', () => {
      const encrypted = encryptField('test');
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('encryptedDek');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('version');
      expect(typeof encrypted.ciphertext).toBe('string');
      expect(typeof encrypted.encryptedDek).toBe('string');
      expect(typeof encrypted.iv).toBe('string');
      expect(typeof encrypted.authTag).toBe('string');
      expect(typeof encrypted.version).toBe('number');
      expect(encrypted.version).toBe(1);
    });
  });

  describe('encryptPlaintextField / decryptFieldOrPlaintext', () => {
    it('encrypts plaintext to JSON string', () => {
      const result = encryptPlaintextField('John Doe');
      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result);
      expect(isEncryptedField(parsed)).toBe(true);
    });

    it('decrypts encrypted JSON string', () => {
      const encrypted = encryptPlaintextField('Jane Smith');
      const decrypted = decryptFieldOrPlaintext(encrypted);
      expect(decrypted).toBe('Jane Smith');
    });

    it('returns plaintext as-is for legacy unencrypted values', () => {
      const legacy = 'Legacy Plaintext';
      const result = decryptFieldOrPlaintext(legacy);
      expect(result).toBe(legacy);
    });

    it('returns null for null/undefined', () => {
      expect(decryptFieldOrPlaintext(null)).toBeNull();
      expect(decryptFieldOrPlaintext(undefined)).toBeNull();
    });

    it('returns empty string for empty string', () => {
      expect(decryptFieldOrPlaintext('')).toBe('');
    });
  });

  describe('rotateFieldKey', () => {
    it('re-wraps DEK with new KEK without changing plaintext', () => {
      const plaintext = 'Rotation Test';
      const encrypted = encryptField(plaintext);

      // Simulate rotation by creating encrypted with old key
      // We'll manually create an encrypted field with old key
      const oldKek = require('node:crypto').scryptSync(
        OLD_KEY,
        Buffer.from('akkuea-field-encryption-salt', 'utf8'),
        32,
      );
      const dek = require('node:crypto').randomBytes(32);
      const iv = require('node:crypto').randomBytes(12);
      const cipher = require('node:crypto').createCipheriv('aes-256-gcm', dek, iv, { authTagLength: 16 });
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const authTag = cipher.getAuthTag();

      const dekIv = require('node:crypto').randomBytes(12);
      const dekCipher = require('node:crypto').createCipheriv('aes-256-gcm', oldKek, dekIv, { authTagLength: 16 });
      const encryptedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
      const dekAuthTag = dekCipher.getAuthTag();

      const oldEncrypted = {
        ciphertext: ciphertext.toString('base64'),
        encryptedDek: Buffer.concat([dekIv, dekAuthTag, encryptedDek]).toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        version: 1,
      };

      // Now rotate to new key
      const rotated = rotateFieldKey(oldEncrypted, OLD_KEY, NEW_KEY);
      expect(rotated.encryptedDek).not.toBe(oldEncrypted.encryptedDek);
      expect(rotated.ciphertext).toBe(oldEncrypted.ciphertext); // Plaintext ciphertext unchanged
      expect(rotated.iv).toBe(oldEncrypted.iv);
      expect(rotated.authTag).toBe(oldEncrypted.authTag);
      expect(rotated.version).toBe(1);
    });
  });

  describe('isEncryptedField', () => {
    it('returns true for valid encrypted field', () => {
      const encrypted = encryptField('test');
      expect(isEncryptedField(encrypted)).toBe(true);
    });

    it('returns false for plain object', () => {
      expect(isEncryptedField({ ciphertext: 'a' })).toBe(false);
      expect(isEncryptedField({ ciphertext: 'a', encryptedDek: 'b', iv: 'c', authTag: 'd' })).toBe(false);
      expect(isEncryptedField('not an object')).toBe(false);
      expect(isEncryptedField(null)).toBe(false);
    });
  });
});