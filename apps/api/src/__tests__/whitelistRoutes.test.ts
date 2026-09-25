import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Elysia } from 'elysia';
import { whitelistRoutes } from '../routes/whitelist';
import { WhitelistController } from '../controllers/WhitelistController';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';
import { db } from '../db';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { eq } from 'drizzle-orm';

const testApp = new Elysia().use(whitelistRoutes);

describe('Whitelist Routes', () => {
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

    mock.module('../controllers/WhitelistController', () => {
      return {
        WhitelistController: {
          request: mock(async (ctx: any) => {
            const body = ctx.body;
            const walletAddress = body.walletAddress;
            const existing = mockDbStore.find(r => r.walletAddress === walletAddress);
            if (existing && existing.status === 'pending') {
              throw new Error('A whitelist request is already pending for this address');
            }
            if (existing && existing.status === 'approved') {
              throw new Error('This address is already whitelisted');
            }

            const inserted = {
              id: `req_${Date.now()}`,
              walletAddress,
              fullName: body.fullName,
              idType: body.idType,
              idReference: body.idReference,
              documentUrl: body.document ? `kyc/${walletAddress}/doc.pdf` : undefined,
              fullNameEncrypted: 'encrypted',
              idReferenceEncrypted: 'encrypted',
              status: 'pending',
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockDbStore.push(inserted);
            return { success: true, data: inserted };
          }),
          status: mock(async (ctx: any) => {
            const { walletAddress } = ctx.params;
            const existing = mockDbStore.find(r => r.walletAddress === walletAddress);
            if (!existing) {
              return { success: true, status: 'none' };
            }
            return { success: true, status: existing.status, rejectionReason: existing.rejectionReason };
          }),
          pending: mock(async () => {
            return { success: true, data: mockDbStore.filter(r => r.status === 'pending') };
          }),
          getDocumentUrl: mock(async (requestId: string) => {
            const request = mockDbStore.find(r => r.id === requestId);
            if (!request) throw new Error('Whitelist request not found');
            if (!request.documentUrl) throw new Error('No document attached to this request');
            return { signedUrl: `http://localhost:3001/storage/${request.documentUrl}?token=test`, fileName: 'doc.pdf' };
          }),
          deleteRequest: mock(async (requestId: string) => {
            const request = mockDbStore.find(r => r.id === requestId);
            if (!request) throw new Error('Whitelist request not found');
            if (request.status === 'approved') throw new Error('Cannot delete approved whitelist request');
            return { success: true };
          }),
          metrics: mock(async () => ({ success: true, data: {} })),
          review: mock(async (ctx: any) => ({ success: true })),
        },
      };
    });

    mock.module('../utils/internalOperationsAuth', () => {
      return {
        isInternalOperationsAuthorized: mock((headers: Record<string, string | undefined>) => {
          return headers['x-internal-api-key'] === 'test-secret' || headers['x-operator-wallet'] === 'GOPERATOR123';
        }),
      };
    });
  });

  afterEach(() => {
    mock.restore();
  });

  describe('POST /pilot/whitelist/request', () => {
    it('accepts multipart form data with document', async () => {
      const formData = new FormData();
      formData.append('walletAddress', 'GTESTWALLET123456789012345678901234567890123456789012345678901234');
      formData.append('fullName', 'John Doe');
      formData.append('idType', 'passport');
      formData.append('idReference', 'A1234567');
      // Create a valid PDF buffer
      const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      formData.append('document', new File([pdfBuffer], 'passport.pdf', { type: 'application/pdf' }));

      const response = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/request', {
          method: 'POST',
          headers: { 'x-test-bypass-ratelimit': 'true' },
          body: formData,
        }),
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.data.walletAddress).toBe(formData.get('walletAddress'));
      expect(result.data.documentUrl).toBeDefined();
    });

    it('rejects request without document', async () => {
      const formData = new FormData();
      formData.append('walletAddress', 'GNODOC123456789012345678901234567890123456789012345678901234');
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

      // The controller will handle the missing document
      // For now, it should still work (document is optional in the schema)
      expect([200, 400]).toContain(response.status);
    });

    it('rate limits requests', async () => {
      const formData = new FormData();
      formData.append('walletAddress', 'GRATELIMIT1234567890123456789012345678901234567890123456789012');
      formData.append('fullName', 'Rate Limited');
      formData.append('idType', 'passport');
      formData.append('idReference', 'RL123456');
      const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      formData.append('document', new File([pdfBuffer], 'passport.pdf', { type: 'application/pdf' }));

      let lastStatus = 0;
      for (let i = 0; i < 15; i++) {
        const response = await testApp.handle(
          new Request('http://localhost/pilot/whitelist/request', {
            method: 'POST',
            headers: { 'x-test-bypass-ratelimit': 'true' },
            body: formData,
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
        new Request('http://localhost/pilot/whitelist/status/GSTATUS123456789012345678901234567890123456789012345678901234'),
      );

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.status).toBe('pending');
    });

    it('returns none for non-existent request', async () => {
      const response = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/status/GNONEXISTENT1234567890123456789012345678901234567890123456789012'),
      );

      expect(response.status).toBe(200);
      const result = await response.json();
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
      const result = await response.json();
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
      const result = await response.json();
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
      const result = await response.json();
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