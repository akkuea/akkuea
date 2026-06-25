import { describe, expect, it, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { kycRoutes } from '../routes/kyc';
import { errorHandler } from '../middleware/errorHandler';
import { VALID_UUID, NON_EXISTENT_UUID } from '@real-estate-defi/shared';
import { userRepository } from '../repositories/UserRepository';
import jwt from 'jsonwebtoken';

const skipIfNoDatabase = !process.env.DATABASE_URL;
// Use a unique dummy address for KYC tests to avoid parallel test collisions with webhooks
const TEST_WALLET = 'GAKYCTESTWALLETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const NON_EXISTENT_USER_ID = NON_EXISTENT_UUID;
const NON_EXISTENT_DOC_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-default-key-for-dev';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'test-internal-api-key';
process.env.INTERNAL_API_KEY = INTERNAL_KEY;

function createApp() {
  return new Elysia().use(errorHandler).use(kycRoutes);
}

describe.skipIf(skipIfNoDatabase)('KYC Routes', () => {
  let testUserId = VALID_UUID;
  let testToken = '';

  beforeAll(async () => {
    if (!skipIfNoDatabase) {
      const user = await userRepository.getOrCreateByWallet(TEST_WALLET);
      testUserId = user.id;
      testToken = jwt.sign({ id: testUserId, walletAddress: TEST_WALLET }, JWT_SECRET);
    }
  });
  describe('GET /kyc/status/:userId', () => {
    it.skipIf(skipIfNoDatabase)('returns 404 for non-existent user (authorized)', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/status/${NON_EXISTENT_USER_ID}`, {
          headers: { Authorization: `Bearer ${testToken}` },
        }),
      );
      expect(response.status).toBe(404);
      const body = (await response.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
      };
      expect(body.error).toBe('NOT_FOUND');
      expect(body.message).toContain('User not found');
    });

    it.skipIf(skipIfNoDatabase)('returns 401 when no token is provided', async () => {
      const app = createApp();
      const response = await app.handle(new Request(`http://localhost/kyc/status/${testUserId}`));
      expect(response.status).toBe(401);
    });

    it.skipIf(skipIfNoDatabase)('returns 403 for a valid token for a different user', async () => {
      const app = createApp();
      const otherToken = jwt.sign(
        { id: NON_EXISTENT_USER_ID, walletAddress: 'GOTHER' },
        JWT_SECRET,
      );
      const response = await app.handle(
        new Request(`http://localhost/kyc/status/${testUserId}`, {
          headers: { Authorization: `Bearer ${otherToken}` },
        }),
      );
      expect(response.status).toBe(403);
    });

    it.skipIf(skipIfNoDatabase)('returns status and documents for existing user', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/status/${testUserId}`, {
          headers: { Authorization: `Bearer ${testToken}` },
        }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        status: string;
        documents: unknown[];
      };
      expect(['pending', 'verified', 'rejected']).toContain(body.status);
      expect(Array.isArray(body.documents)).toBe(true);
    });
  });

  describe('POST /kyc/upload', () => {
    it('returns 400 when Content-Type is not multipart', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost/kyc/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-test-bypass-ratelimit': 'true',
            Authorization: `Bearer ${testToken}`,
          },
          body: JSON.stringify({}),
        }),
      );
      expect(response.status).toBe(400);
      const body = (await response.json()) as { message?: string };
      expect(body.message).toContain('multipart');
    });

    it('returns 400 when file is missing', async () => {
      const app = createApp();
      const formData = new FormData();
      formData.set('userId', testUserId);
      formData.set('documentType', 'passport');
      const response = await app.handle(
        new Request('http://localhost/kyc/upload', {
          method: 'POST',
          headers: { 'x-test-bypass-ratelimit': 'true', Authorization: `Bearer ${testToken}` },
          body: formData,
        }),
      );
      expect(response.status).toBe(400);
      const body = (await response.json()) as { message?: string };
      expect(body.message).toContain('file');
    });

    it.skipIf(skipIfNoDatabase)('returns 400 for invalid file type (.exe)', async () => {
      const app = createApp();
      const formData = new FormData();
      formData.set('userId', testUserId);
      formData.set('documentType', 'passport');
      formData.set('file', new File(['fake'], 'virus.exe', { type: 'application/x-msdownload' }));
      const response = await app.handle(
        new Request('http://localhost/kyc/upload', {
          method: 'POST',
          headers: { 'x-test-bypass-ratelimit': 'true', Authorization: `Bearer ${testToken}` },
          body: formData,
        }),
      );
      expect(response.status).toBe(400);
      const body = (await response.json()) as { message?: string };
      expect(body.message?.toLowerCase()).toMatch(/invalid file type|only pdf|jpg|png/);
    });

    it.skipIf(skipIfNoDatabase)('returns 400 for oversized file (over 10MB)', async () => {
      const app = createApp();
      const formData = new FormData();
      formData.set('userId', testUserId);
      formData.set('documentType', 'passport');
      const bigSize = 11 * 1024 * 1024;
      const bigBlob = new Blob([new Uint8Array(bigSize)]);
      formData.set('file', new File([bigBlob], 'large.pdf', { type: 'application/pdf' }));
      const response = await app.handle(
        new Request('http://localhost/kyc/upload', {
          method: 'POST',
          headers: { 'x-test-bypass-ratelimit': 'true', Authorization: `Bearer ${testToken}` },
          body: formData,
        }),
      );
      expect(response.status).toBe(400);
      const body = (await response.json()) as { message?: string };
      expect(body.message?.toLowerCase()).toMatch(/size|10mb|limit/);
    });

    it.skipIf(skipIfNoDatabase)('returns 200 with documentId for valid PDF upload', async () => {
      const app = createApp();
      const formData = new FormData();
      formData.set('userId', testUserId);
      formData.set('documentType', 'passport');
      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
      formData.set('file', new File([pdfContent], 'id.pdf', { type: 'application/pdf' }));
      const response = await app.handle(
        new Request('http://localhost/kyc/upload', {
          method: 'POST',
          headers: { 'x-test-bypass-ratelimit': 'true', Authorization: `Bearer ${testToken}` },
          body: formData,
        }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { documentId?: string; submissionId?: string };
      expect(body.documentId).toBeDefined();
      expect(body.submissionId).toBeDefined();
    });
  });

  describe('GET /kyc/documents/:userId', () => {
    it.skipIf(skipIfNoDatabase)('returns 401 when no token is provided', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/documents/${testUserId}`),
      );
      expect(response.status).toBe(401);
    });

    it.skipIf(skipIfNoDatabase)('returns 403 for a valid token for a different user', async () => {
      const app = createApp();
      const otherToken = jwt.sign(
        { id: NON_EXISTENT_USER_ID, walletAddress: 'GOTHER' },
        JWT_SECRET,
      );
      const response = await app.handle(
        new Request(`http://localhost/kyc/documents/${testUserId}`, {
          headers: { Authorization: `Bearer ${otherToken}` },
        }),
      );
      expect(response.status).toBe(403);
    });

    it.skipIf(skipIfNoDatabase)(
      'returns 404 for non-existent user when the token matches the requested userId',
      async () => {
        const app = createApp();
        const matchingToken = jwt.sign(
          { id: NON_EXISTENT_USER_ID, walletAddress: 'GOTHER' },
          JWT_SECRET,
        );
        const response = await app.handle(
          new Request(`http://localhost/kyc/documents/${NON_EXISTENT_USER_ID}`, {
            headers: { Authorization: `Bearer ${matchingToken}` },
          }),
        );
        expect(response.status).toBe(404);
        const body = (await response.json()) as { error?: string };
        expect(body.error).toBe('NOT_FOUND');
      },
    );
  });

  describe('POST /kyc/verify/:documentId', () => {
    it.skipIf(skipIfNoDatabase)('returns 404 for non-existent document', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/verify/${NON_EXISTENT_DOC_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'internal-api-key': INTERNAL_KEY },
          body: JSON.stringify({ verified: true }),
        }),
      );
      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe('NOT_FOUND');
    });

    it.skipIf(skipIfNoDatabase)('admin can approve document', async () => {
      const app = createApp();

      // 1. Upload a document first
      const formData = new FormData();
      formData.set('userId', testUserId);
      formData.set('documentType', 'passport');
      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      formData.set('file', new File([pdfContent], 'id.pdf', { type: 'application/pdf' }));

      const uploadRes = await app.handle(
        new Request('http://localhost/kyc/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${testToken}` },
          body: formData,
        }),
      );
      if (uploadRes.status !== 200) {
        console.error('KYC UPLOAD FAIL:', uploadRes.status, await uploadRes.json());
      }
      expect(uploadRes.status).toBe(200);
      const uploadBody = (await uploadRes.json()) as { documentId: string };
      const documentId = uploadBody.documentId;

      // 2. Now verify it
      const response = await app.handle(
        new Request(`http://localhost/kyc/verify/${documentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'internal-api-key': INTERNAL_KEY },
          body: JSON.stringify({ verified: true }),
        }),
      );
      if (response.status !== 200) {
        console.error('KYC VERIFY FAIL:', response.status, await response.json());
      }
      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });

    it.skipIf(skipIfNoDatabase)('admin can reject with reason', async () => {
      const app = createApp();

      // 1. Upload a document first
      const formData = new FormData();
      formData.set('userId', testUserId);
      formData.set('documentType', 'id_card');
      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
      formData.set('file', new File([pdfContent], 'id.pdf', { type: 'application/pdf' }));

      const uploadRes = await app.handle(
        new Request('http://localhost/kyc/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${testToken}` },
          body: formData,
        }),
      );
      expect(uploadRes.status).toBe(200);
      const uploadBody = (await uploadRes.json()) as { documentId: string };
      const documentId = uploadBody.documentId;

      // 2. Now reject it
      const response = await app.handle(
        new Request(`http://localhost/kyc/verify/${documentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'internal-api-key': INTERNAL_KEY },
          body: JSON.stringify({ verified: false, notes: 'Document expired' }),
        }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });
  });

  describe('GET /kyc/file/:documentId', () => {
    it.skipIf(skipIfNoDatabase)('returns 404 for non-existent document', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/file/${NON_EXISTENT_DOC_ID}`, {
          headers: { Authorization: `Bearer ${testToken}` },
        }),
      );
      expect(response.status).toBe(404);
    });
  });

  describe('Rate limiting', () => {
    it('returns 429 after exceeding upload rate limit', async () => {
      const app = createApp();
      const formData = new FormData();
      formData.set('userId', testUserId);
      formData.set('documentType', 'passport');
      formData.set('file', new File(['x'], 'x.pdf', { type: 'application/pdf' }));

      let lastStatus = 0;
      for (let i = 0; i < 15; i++) {
        const response = await app.handle(
          new Request('http://localhost/kyc/upload', {
            method: 'POST',
            headers: { Authorization: `Bearer ${testToken}` },
            body: formData,
          }),
        );
        lastStatus = response.status;
        if (response.status === 429) break;
      }
      expect(lastStatus).toBe(429);
    });
  });

  describe('Verify endpoint auth rules', () => {
    it.skipIf(skipIfNoDatabase)('returns 401 when called with a user JWT', async () => {
      const app = createApp();
      const token = jwt.sign({ id: testUserId, walletAddress: TEST_WALLET }, JWT_SECRET);
      const response = await app.handle(
        new Request(`http://localhost/kyc/verify/${NON_EXISTENT_DOC_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ verified: true }),
        }),
      );
      expect(response.status).toBe(401);
    });

    it.skipIf(skipIfNoDatabase)('accepts internal API key', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/verify/${NON_EXISTENT_DOC_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'internal-api-key': INTERNAL_KEY },
          body: JSON.stringify({ verified: true }),
        }),
      );
      // With a missing document this should still reach auth then return 404
      expect([200, 404]).toContain(response.status);
    });
  });
});
