/* eslint-disable @typescript-eslint/no-explicit-any -- mocks Drizzle internals with loosely-typed stand-ins */
import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { whitelistRoutes } from '../routes/whitelist';
import { db } from '../db';
import { StorageService } from '../services/StorageService';

const testApp = new Elysia().use(whitelistRoutes);

const TEST_FIELD_ENCRYPTION_KEY = 'dGVzdC1rZXktbWF0ZXJpYWwtdGhhdC1pcy0zMi1ieXRlcy1sb25nLg=='; // 32 bytes base64

/**
 * Collects every Param value from a Drizzle condition AST. Controller queries
 * are single `eq(column, value)` conditions, so the first Param is the bound
 * value (a request id or a wallet address depending on caller).
 */
function collectParamValues(node: any, out: unknown[] = []): unknown[] {
  if (node == null || typeof node !== 'object') return out;
  for (const chunk of node.queryChunks ?? []) {
    if (chunk?.constructor?.name === 'Param') {
      out.push(chunk.value);
    } else {
      collectParamValues(chunk, out);
    }
  }
  return out;
}

describe('Whitelist Routes', () => {
  let mockDbStore: any[] = [];
  let originalStore: unknown;
  let originalSignedUrl: unknown;
  let originalDelete: unknown;

  beforeEach(() => {
    mockDbStore = [];

    // Real controller + real FieldEncryption (key supplied via env);
    // StorageService statics are stubbed on the class object. NOTE:
    // mock.module() is deliberately avoided here: bun test applies it to the
    // whole process, so a module-level mock would leak into every other test
    // file loaded after this one (see the DLQ route 403 regressions this
    // caused before this file was rewritten).
    process.env.FIELD_ENCRYPTION_KEY = TEST_FIELD_ENCRYPTION_KEY;
    process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-secret';
    originalStore = StorageService.store;
    originalSignedUrl = StorageService.getSignedReadUrl;
    originalDelete = StorageService.deleteByRelativePath;

    StorageService.store = mock(
      async (buffer: Buffer, userId: string, ext: string, docId?: string) => {
        return {
          storedFileName: `${docId || 'test-id'}${ext}`,
          relativePath: `kyc/${userId}/${docId || 'test-id'}${ext}`,
          extension: ext,
        };
      },
    ) as typeof StorageService.store;
    StorageService.getSignedReadUrl = mock(
      async (path: string) => `http://localhost:3001/storage/${path}?token=test`,
    ) as typeof StorageService.getSignedReadUrl;
    StorageService.deleteByRelativePath = mock(
      async () => {},
    ) as typeof StorageService.deleteByRelativePath;

    (db as any).query = {
      pilotWhitelistRequests: {
        findFirst: mock(async ({ where }: any) => {
          const [paramValue] = collectParamValues(where);
          if (paramValue === undefined) return undefined;
          // Callers either look up by request id (getDocumentUrl,
          // deleteRequest) or by wallet address (request, status).
          return (
            mockDbStore.find((r) => r.id === paramValue) ??
            mockDbStore.find((r) => r.walletAddress === paramValue)
          );
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
        where: async (whereExpr: any) => {
          const [paramValue] = collectParamValues(whereExpr);
          const target =
            mockDbStore.find((r) => r.id === paramValue) ??
            mockDbStore.find((r) => r.walletAddress === paramValue);
          if (target) {
            Object.assign(target, val);
          }
        },
      }),
    }));

    (db as any).delete = mock(() => ({
      where: async (whereExpr: any) => {
        const [paramValue] = collectParamValues(whereExpr);
        if (paramValue !== undefined) {
          mockDbStore = mockDbStore.filter((r) => r.walletAddress !== paramValue);
        }
      },
    }));
  });

  afterEach(() => {
    // Restore stubbed statics first so no later file sees a mock, then drop
    // the db Proxy overrides (they persist across files in one bun process).
    StorageService.store = originalStore as typeof StorageService.store;
    StorageService.getSignedReadUrl = originalSignedUrl as typeof StorageService.getSignedReadUrl;
    StorageService.deleteByRelativePath =
      originalDelete as typeof StorageService.deleteByRelativePath;
    delete process.env.FIELD_ENCRYPTION_KEY;
    mock.restore();
    for (const prop of ['query', 'insert', 'update', 'delete']) {
      delete (db as any)[prop];
    }
  });

  describe('POST /pilot/whitelist/request', () => {
    it('accepts multipart form data with document', async () => {
      // 56 chars: the schema caps walletAddress at Stellar key length.
      const walletAddress = 'GTESTWALLET123456789012345678901234567890123456789GAAAA';
      const formData = new FormData();
      formData.append('walletAddress', walletAddress);
      formData.append('fullName', 'John Doe');
      formData.append('idType', 'passport');
      formData.append('idReference', 'A1234567');
      // Create a valid PDF buffer
      const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      formData.append(
        'document',
        new File([pdfBuffer], 'passport.pdf', { type: 'application/pdf' }),
      );

      const response = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/request', {
          method: 'POST',
          headers: { 'x-test-bypass-ratelimit': 'true' },
          body: formData,
        }),
      );

      expect(response.status).toBe(200);
      const result = (await response.json()) as {
        success: boolean;
        data: { walletAddress: string; documentUrl?: string };
      };
      expect(result.success).toBe(true);
      expect(result.data.walletAddress).toBe(walletAddress);
      expect(result.data.documentUrl).toBeDefined();
    });

    it('rejects request without document', async () => {
      const formData = new FormData();
      formData.append(
        'walletAddress',
        'GNODOC12345678901234567890123456789012345678901234567GAAAA',
      );
      formData.append('fullName', 'Jane Doe');
      formData.append('idType', 'national_id');
      formData.append('idReference', 'B7654321');
      // No document appended

      const response = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/request', {
          method: 'POST',
          headers: { 'x-test-bypass-ratelimit': 'true' },
          body: formData,
        }),
      );

      // The multipart schema requires the document file, so Elysia rejects
      // the request with 422 before the controller runs.
      expect(response.status).toBe(422);
    });

    it('rate limits requests', async () => {
      const buildFormData = () => {
        const formData = new FormData();
        formData.append(
          'walletAddress',
          'GRATELIMIT1234567890123456789012345678901234567890123GAA',
        );
        formData.append('fullName', 'Rate Limited');
        formData.append('idType', 'passport');
        formData.append('idReference', 'RL123456');
        const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
        formData.append(
          'document',
          new File([pdfBuffer], 'passport.pdf', { type: 'application/pdf' }),
        );
        return formData;
      };

      // A dedicated source IP keeps this scenario's consumption out of the
      // limiter's shared in-memory bucket (the middleware keys on
      // x-forwarded-for, and the suite-wide store persists across files).
      const headers = { 'x-forwarded-for': '203.0.113.10' };

      let lastStatus = 0;
      for (let i = 0; i < 15; i++) {
        const response = await testApp.handle(
          new Request('http://localhost/pilot/whitelist/request', {
            method: 'POST',
            headers,
            body: buildFormData(),
          }),
        );
        lastStatus = response.status;
        if (response.status === 429) break;
      }
      expect(lastStatus).toBe(429);
    });
  });

  describe('GET /pilot/whitelist/status/:walletAddress', () => {
    it('returns status for existing request', async () => {
      mockDbStore.push({
        id: 'req1',
        walletAddress: 'GSTATUS123456789012345678901234567890123456789012345678901234',
        status: 'pending',
      });

      const response = await testApp.handle(
        new Request(
          'http://localhost/pilot/whitelist/status/GSTATUS123456789012345678901234567890123456789012345678901234',
        ),
      );

      expect(response.status).toBe(200);
      const result = (await response.json()) as {
        success: boolean;
        status: string;
      };
      expect(result.success).toBe(true);
      expect(result.status).toBe('pending');
    });

    it('returns none for non-existent request', async () => {
      const response = await testApp.handle(
        new Request(
          'http://localhost/pilot/whitelist/status/GNONEXISTENT1234567890123456789012345678901234567890123456789012',
        ),
      );

      expect(response.status).toBe(200);
      const result = (await response.json()) as {
        success: boolean;
        status: string;
      };
      expect(result.success).toBe(true);
      expect(result.status).toBe('none');
    });
  });

  describe('GET /pilot/whitelist/pending (operator)', () => {
    it('returns 403 without internal API key', async () => {
      const response = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/pending'),
      );

      expect(response.status).toBe(403);
    });

    it('returns pending requests with internal API key', async () => {
      mockDbStore.push({
        id: 'req1',
        walletAddress: 'GPENDING123456789012345678901234567890123456789012345678901234',
        status: 'pending',
        fullName: 'Pending User',
        idType: 'passport',
        idReference: 'PEND123',
      });

      const response = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/pending', {
          headers: { 'x-internal-api-key': 'test-secret' },
        }),
      );

      expect(response.status).toBe(200);
      const result = (await response.json()) as {
        success: boolean;
        data: unknown[];
      };
      expect(result.success).toBe(true);
      expect(result.data.length).toBe(1);
    });
  });

  describe('GET /pilot/whitelist/document/:requestId (operator)', () => {
    it('returns 403 without internal API key', async () => {
      const response = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/document/req1'),
      );

      expect(response.status).toBe(403);
    });

    it('returns signed URL for request with document', async () => {
      mockDbStore.push({
        id: 'req_with_doc',
        walletAddress: 'GDOCDOC123456789012345678901234567890123456789012345678901234',
        documentUrl: 'kyc/GDOCDOC123456789012345678901234567890123456789012345678901234/doc.pdf',
        status: 'pending',
      });

      const response = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/document/req_with_doc', {
          headers: { 'x-internal-api-key': 'test-secret' },
        }),
      );

      expect(response.status).toBe(200);
      const result = (await response.json()) as {
        signedUrl: string;
        fileName: string;
      };
      expect(result.signedUrl).toBeDefined();
      expect(result.fileName).toBe('doc.pdf');
    });
  });

  describe('DELETE /pilot/whitelist/:requestId (operator)', () => {
    it('returns 403 without internal API key', async () => {
      const response = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/req1', { method: 'DELETE' }),
      );

      expect(response.status).toBe(403);
    });

    it('deletes rejected request', async () => {
      mockDbStore.push({
        id: 'req_to_delete',
        walletAddress: 'GDELETE123456789012345678901234567890123456789012345678901234',
        status: 'rejected',
      });

      const response = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/req_to_delete', {
          method: 'DELETE',
          headers: { 'x-internal-api-key': 'test-secret' },
        }),
      );

      expect(response.status).toBe(200);
      const result = (await response.json()) as { success: boolean };
      expect(result.success).toBe(true);
    });

    it('rejects deletion of approved request', async () => {
      mockDbStore.push({
        id: 'req_approved',
        walletAddress: 'GAPPROVED123456789012345678901234567890123456789012345678901234',
        status: 'approved',
      });

      const response = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/req_approved', {
          method: 'DELETE',
          headers: { 'x-internal-api-key': 'test-secret' },
        }),
      );

      expect(response.status).not.toBe(200);
    });
  });
});
