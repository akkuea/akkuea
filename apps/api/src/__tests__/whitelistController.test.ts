import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { db } from '../db';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { eq } from 'drizzle-orm';
import { WhitelistController } from '../controllers/WhitelistController';
import { StorageService } from '../services/StorageService';
import { encryptPlaintextField, decryptFieldOrPlaintext } from '../services/FieldEncryption';
import { ApiError } from '../errors/ApiError';

describe('WhitelistController', () => {
  let mockDbStore: any[] = [];

  function extractWalletAddress(obj: any): string | undefined {
    if (obj == null || typeof obj !== 'object') return undefined;
    if (obj.queryChunks && Array.isArray(obj.queryChunks)) {
      for (const chunk of obj.queryChunks) {
        if (chunk?.constructor?.name === 'Param' && typeof chunk.value === 'string') {
          return chunk.value;
        }
      }
    }
    if ('value' in obj && typeof obj.value === 'string') return obj.value;
    return undefined;
  }

  beforeEach(() => {
    mockDbStore = [];

    mock.module('../services/StorageService', () => {
      return {
        StorageService: {
          store: mock(async (buffer: Buffer, userId: string, ext: string, docId?: string) => {
            return {
              storedFileName: `${docId || 'test-id'}${ext}`,
              relativePath: `kyc/${userId}/${docId || 'test-id'}${ext}`,
              extension: ext,
            };
          }),
          getSignedReadUrl: mock(async (path: string) => `http://localhost:3001/storage/${path}?token=test`),
          deleteByRelativePath: mock(async () => {}),
        },
      };
    });

    mock.module('../services/FieldEncryption', () => {
      return {
        encryptPlaintextField: mock((plaintext: string) => JSON.stringify({
          ciphertext: 'encrypted',
          encryptedDek: 'dek',
          iv: 'iv',
          authTag: 'tag',
          version: 1,
        })),
        decryptFieldOrPlaintext: mock((val: string) => val),
      };
    });

    (db as any).query = {
      pilotWhitelistRequests: {
        findFirst: mock(async ({ where }: any) => {
          const walletAddr = extractWalletAddress(where);
          if (walletAddr) {
            return mockDbStore.find((r) => r.walletAddress === walletAddr);
          }
          // For ID-based lookup
          if (where && where.chunks) {
            for (const chunk of where.chunks) {
              if (chunk.value && chunk.value.startsWith('req_')) {
                return mockDbStore.find((r) => r.id === chunk.value);
              }
            }
          }
          return undefined;
        }),
        findMany: mock(async () => mockDbStore),
      },
    };

    (db as any).insert = mock(() => ({
      values: (val: any) => ({
        returning: async () => {
          const inserted = {
            id: `req_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            ...val,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockDbStore.push(inserted);
          return [inserted];
        },
      }),
    }));

    (db as any).update = mock(() => ({
      set: (val: any) => ({
        where: async () => {
          if (mockDbStore.length > 0) {
            Object.assign(mockDbStore[0], val);
          }
        },
      }),
    }));

    (db as any).delete = mock(() => ({
      where: async (whereExpr: any) => {
        const walletAddr = extractWalletAddress(whereExpr);
        if (walletAddr) {
          mockDbStore = mockDbStore.filter((r) => r.walletAddress !== walletAddr);
        }
      },
    }));
  });

  afterEach(() => {
    mock.restore();
    for (const prop of ['query', 'insert', 'update', 'delete']) {
      delete (db as any)[prop];
    }
  });

  describe('request', () => {
    it('creates a new whitelist request with document and encrypted fields', async () => {
      const mockFile = {
        name: 'passport.pdf',
        type: 'application/pdf',
        size: 1024,
        arrayBuffer: async () => new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer,
      };

      const ctx = {
        body: {
          walletAddress: 'GTEST123456789012345678901234567890123456789012345678901234',
          fullName: 'John Doe',
          idType: 'passport',
          idReference: 'A1234567',
          document: mockFile,
        },
      };

      const result = await WhitelistController.request(ctx);

      expect(result.success).toBe(true);
      expect(result.data.walletAddress).toBe(ctx.body.walletAddress);
      expect(result.data.fullName).toBe('John Doe');
      expect(result.data.idReference).toBe('A1234567');
      expect(result.data.documentUrl).toBeDefined();
      expect(result.data.fullNameEncrypted).toBeDefined();
      expect(result.data.idReferenceEncrypted).toBeDefined();
      expect(result.data.status).toBe('pending');
    });

    it('creates request without document', async () => {
      const ctx = {
        body: {
          walletAddress: 'GTEST123456789012345678901234567890123456789012345678901235',
          fullName: 'Jane Smith',
          idType: 'national_id',
          idReference: 'B7654321',
          document: null,
        },
      };

      const result = await WhitelistController.request(ctx);

      expect(result.success).toBe(true);
      expect(result.data.documentUrl).toBeUndefined();
      expect(result.data.fullNameEncrypted).toBeDefined();
      expect(result.data.idReferenceEncrypted).toBeDefined();
    });

    it('throws error for duplicate pending request', async () => {
      mockDbStore.push({
        id: 'existing',
        walletAddress: 'GDUPLICATE1234567890123456789012345678901234567890123456789012',
        status: 'pending',
      });

      const ctx = {
        body: {
          walletAddress: 'GDUPLICATE1234567890123456789012345678901234567890123456789012',
          fullName: 'Test User',
          idType: 'passport',
          idReference: 'C1234567',
          document: null,
        },
      };

      await expect(WhitelistController.request(ctx)).rejects.toThrow('already pending');
    });

    it('allows resubmission after rejection', async () => {
      mockDbStore.push({
        id: 'old_rejected',
        walletAddress: 'GRESUBMIT123456789012345678901234567890123456789012345678901234',
        status: 'rejected',
        fullName: 'Old Name',
        idType: 'passport',
        idReference: 'OLD123',
      });

      const ctx = {
        body: {
          walletAddress: 'GRESUBMIT123456789012345678901234567890123456789012345678901234',
          fullName: 'New Name',
          idType: 'national_id',
          idReference: 'NEW456',
          document: null,
        },
      };

      const result = await WhitelistController.request(ctx);
      expect(result.success).toBe(true);
      expect(result.data.fullName).toBe('New Name');
      expect(result.data.status).toBe('pending');

      const requests = mockDbStore.filter(r => r.walletAddress === ctx.body.walletAddress);
      expect(requests.length).toBe(1);
      expect(requests[0].id).not.toBe('old_rejected');
    });
  });

  describe('getDocumentUrl', () => {
    it('returns signed URL for request with document', async () => {
      mockDbStore.push({
        id: 'req_with_doc',
        walletAddress: 'GDOCDOC123456789012345678901234567890123456789012345678901234',
        documentUrl: 'kyc/GDOCDOC123456789012345678901234567890123456789012345678901234/doc1.pdf',
        status: 'pending',
      });

      const result = await WhitelistController.getDocumentUrl('req_with_doc');
      expect(result.signedUrl).toContain('kyc/GDOCDOC');
      expect(result.fileName).toBe('doc1.pdf');
    });

    it('throws not found for request without document', async () => {
      mockDbStore.push({
        id: 'req_no_doc',
        walletAddress: 'GNODOCDOC123456789012345678901234567890123456789012345678901234',
        documentUrl: null,
        status: 'pending',
      });

      await expect(WhitelistController.getDocumentUrl('req_no_doc')).rejects.toThrow('No document attached');
    });

    it('throws not found for non-existent request', async () => {
      await expect(WhitelistController.getDocumentUrl('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('deleteRequest', () => {
    it('anonymizes rejected request and deletes document', async () => {
      mockDbStore.push({
        id: 'req_to_delete',
        walletAddress: 'GDELETE123456789012345678901234567890123456789012345678901234',
        fullName: 'John Doe',
        idReference: 'A1234567',
        documentUrl: 'kyc/GDELETE123456789012345678901234567890123456789012345678901234/doc1.pdf',
        fullNameEncrypted: 'encrypted',
        idReferenceEncrypted: 'encrypted',
        status: 'rejected',
      });

      const result = await WhitelistController.deleteRequest('req_to_delete');
      expect(result.success).toBe(true);

      const updated = mockDbStore.find(r => r.id === 'req_to_delete');
      expect(updated.fullName).toBe('[REDACTED]');
      expect(updated.idReference).toBe('[REDACTED]');
      expect(updated.fullNameEncrypted).toBeNull();
      expect(updated.idReferenceEncrypted).toBeNull();
      expect(updated.documentUrl).toBeNull();
    });

    it('throws error for approved request', async () => {
      mockDbStore.push({
        id: 'req_approved',
        walletAddress: 'GAPPROVED123456789012345678901234567890123456789012345678901234',
        status: 'approved',
      });

      await expect(WhitelistController.deleteRequest('req_approved')).rejects.toThrow('Cannot delete approved');
    });

    it('throws not found for non-existent request', async () => {
      await expect(WhitelistController.deleteRequest('nonexistent')).rejects.toThrow('not found');
    });
  });
});