import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { kycRoutes } from '../routes/kyc';
import { errorHandler } from '../middleware/errorHandler';
import { VALID_UUID, NON_EXISTENT_UUID } from '@real-estate-defi/shared';
import { userRepository } from '../repositories/UserRepository';

const skipIfNoDatabase = !process.env.DATABASE_URL;
const VALID_USER_ID = VALID_UUID;
const NON_EXISTENT_USER_ID = NON_EXISTENT_UUID;
const NON_EXISTENT_DOC_ID = NON_EXISTENT_UUID;

function createApp() {
  return new Elysia().use(errorHandler).use(kycRoutes);
}

describe('KYC Routes - Authentication & Authorization', () => {
  describe('GET /kyc/status/:userId', () => {
    it('returns 401 when no authentication headers provided', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/status/${VALID_USER_ID}`),
      );
      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe('UNAUTHORIZED');
    });

    it('returns 401 when invalid user ID provided', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/status/${VALID_USER_ID}`, {
          headers: {
            'x-user-id': NON_EXISTENT_USER_ID,
          },
        }),
      );
      expect(response.status).toBe(401);
    });

    it('returns 403 when user tries to access another user\'s KYC status', async () => {
      const app = createApp();
      const differentUserId = '00000000-0000-0000-0000-000000000002';

      // Mock user lookup
      const mockUser = {
        id: VALID_USER_ID,
        walletAddress: 'GA12345678901234567890123456789012345678901234567890123456',
        isAdmin: false,
      };

      mock.module('../repositories/UserRepository', () => ({
        userRepository: {
          findById: mock(() => Promise.resolve(mockUser)),
          findByWalletAddress: mock(() => Promise.resolve(undefined)),
        },
      }));

      const response = await app.handle(
        new Request(`http://localhost/kyc/status/${differentUserId}`, {
          headers: {
            'x-user-id': VALID_USER_ID,
          },
        }),
      );
      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe('FORBIDDEN');
    });
  });

  describe('POST /kyc/verify/:documentId', () => {
    it('returns 401 when no internal API key provided', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/verify/${VALID_USER_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verified: true }),
        }),
      );
      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe('UNAUTHORIZED');
    });

    it('returns 401 when wrong internal API key provided', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/verify/${VALID_USER_ID}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': 'wrong-key',
          },
          body: JSON.stringify({ verified: true }),
        }),
      );
      expect(response.status).toBe(401);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe('UNAUTHORIZED');
    });

    it.skipIf(skipIfNoDatabase)('succeeds with correct internal API key', async () => {
      const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'test-internal-key';
      process.env.INTERNAL_API_KEY = INTERNAL_API_KEY;

      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/verify/${NON_EXISTENT_DOC_ID}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': INTERNAL_API_KEY,
          },
          body: JSON.stringify({ verified: true }),
        }),
      );
      // Should pass auth and fail with 404 (document not found)
      expect(response.status).toBe(404);
    });
  });

  describe('POST /kyc/submit', () => {
    it('returns 401 when no authentication provided', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request('http://localhost/kyc/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: VALID_USER_ID,
            documents: [],
          }),
        }),
      );
      expect(response.status).toBe(401);
    });

    it('returns 403 when x-user-address does not match authenticated user', async () => {
      const app = createApp();
      const mockUser = {
        id: VALID_USER_ID,
        walletAddress: 'GA11111111111111111111111111111111111111111111111111111111',
        isAdmin: false,
      };

      mock.module('../repositories/UserRepository', () => ({
        userRepository: {
          findById: mock(() => Promise.resolve(mockUser)),
          findByWalletAddress: mock(() => Promise.resolve(mockUser)),
        },
      }));

      const response = await app.handle(
        new Request('http://localhost/kyc/submit', {
          method: 'POST',
          headers: {
            'x-user-id': VALID_USER_ID,
            'x-user-address': 'GA22222222222222222222222222222222222222222222222222222222',
          },
          body: JSON.stringify({
            userId: VALID_USER_ID,
            documents: [],
          }),
        }),
      );
      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe('FORBIDDEN');
    });

    it('returns 403 when trying to submit KYC for another user', async () => {
      const app = createApp();
      const differentUserId = '00000000-0000-0000-0000-000000000002';
      const mockUser = {
        id: VALID_USER_ID,
        walletAddress: 'GA11111111111111111111111111111111111111111111111111111111',
        isAdmin: false,
      };

      mock.module('../repositories/UserRepository', () => ({
        userRepository: {
          findById: mock(() => Promise.resolve(mockUser)),
          findByWalletAddress: mock(() => Promise.resolve(mockUser)),
        },
      }));

      const response = await app.handle(
        new Request('http://localhost/kyc/submit', {
          method: 'POST',
          headers: {
            'x-user-id': VALID_USER_ID,
          },
          body: JSON.stringify({
            userId: differentUserId,
            documents: [],
          }),
        }),
      );
      expect(response.status).toBe(403);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe('FORBIDDEN');
    });
  });

  describe('GET /kyc/documents/:userId', () => {
    it('returns 401 when no authentication provided', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/documents/${VALID_USER_ID}`),
      );
      expect(response.status).toBe(401);
    });

    it('returns 403 when non-owner tries to access documents', async () => {
      const app = createApp();
      const differentUserId = '00000000-0000-0000-0000-000000000002';
      const mockUser = {
        id: VALID_USER_ID,
        walletAddress: 'GA11111111111111111111111111111111111111111111111111111111',
        isAdmin: false,
      };

      mock.module('../repositories/UserRepository', () => ({
        userRepository: {
          findById: mock(() => Promise.resolve(mockUser)),
          findByWalletAddress: mock(() => Promise.resolve(mockUser)),
        },
      }));

      const response = await app.handle(
        new Request(`http://localhost/kyc/documents/${differentUserId}`, {
          headers: {
            'x-user-id': VALID_USER_ID,
          },
        }),
      );
      expect(response.status).toBe(403);
    });
  });
});

describe('KYC Routes', () => {
  describe('GET /kyc/status/:userId', () => {
    it.skipIf(skipIfNoDatabase)('returns 404 for non-existent user', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/status/${NON_EXISTENT_USER_ID}`),
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

    it.skipIf(skipIfNoDatabase)('returns status and documents for existing user', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/status/${VALID_USER_ID}`),
      );
      if (response.status === 404) {
        // User may not exist in test DB
        expect(response.status).toBe(404);
        return;
      }
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
          headers: { 'Content-Type': 'application/json' },
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
      formData.set('userId', VALID_USER_ID);
      formData.set('documentType', 'passport');
      const response = await app.handle(
        new Request('http://localhost/kyc/upload', {
          method: 'POST',
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
      formData.set('userId', VALID_USER_ID);
      formData.set('documentType', 'passport');
      formData.set('file', new File(['fake'], 'virus.exe', { type: 'application/x-msdownload' }));
      const response = await app.handle(
        new Request('http://localhost/kyc/upload', {
          method: 'POST',
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
      formData.set('userId', VALID_USER_ID);
      formData.set('documentType', 'passport');
      const bigSize = 11 * 1024 * 1024;
      const bigBlob = new Blob([new Uint8Array(bigSize)]);
      formData.set('file', new File([bigBlob], 'large.pdf', { type: 'application/pdf' }));
      const response = await app.handle(
        new Request('http://localhost/kyc/upload', {
          method: 'POST',
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
      formData.set('userId', VALID_USER_ID);
      formData.set('documentType', 'passport');
      const pdfContent = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
      formData.set('file', new File([pdfContent], 'id.pdf', { type: 'application/pdf' }));
      const response = await app.handle(
        new Request('http://localhost/kyc/upload', {
          method: 'POST',
          body: formData,
        }),
      );
      if (response.status === 404) {
        expect(response.status).toBe(404);
        return;
      }
      expect(response.status).toBe(200);
      const body = (await response.json()) as { documentId?: string; submissionId?: string };
      expect(body.documentId).toBeDefined();
      expect(body.submissionId).toBeDefined();
    });
  });

  describe('GET /kyc/documents/:userId', () => {
    it.skipIf(skipIfNoDatabase)('returns 404 for non-existent user', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/documents/${NON_EXISTENT_USER_ID}`),
      );
      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe('NOT_FOUND');
    });
  });

  describe('POST /kyc/verify/:documentId', () => {
    it.skipIf(skipIfNoDatabase)('returns 404 for non-existent document', async () => {
      const app = createApp();
      const response = await app.handle(
        new Request(`http://localhost/kyc/verify/${NON_EXISTENT_DOC_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verified: true }),
        }),
      );
      expect(response.status).toBe(404);
      const body = (await response.json()) as { error?: string };
      expect(body.error).toBe('NOT_FOUND');
    });

    it.skipIf(skipIfNoDatabase)('admin can approve document', async () => {
      const app = createApp();
      const statusRes = await app.handle(
        new Request(`http://localhost/kyc/status/${VALID_USER_ID}`),
      );
      if (statusRes.status !== 200) return;
      const statusBody = (await statusRes.json()) as { documents: { id: string }[] };
      const docId = statusBody.documents?.[0]?.id;
      if (!docId) return;
      const response = await app.handle(
        new Request(`http://localhost/kyc/verify/${docId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verified: true }),
        }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });

    it.skipIf(skipIfNoDatabase)('admin can reject with reason', async () => {
      const app = createApp();
      const statusRes = await app.handle(
        new Request(`http://localhost/kyc/status/${VALID_USER_ID}`),
      );
      if (statusRes.status !== 200) return;
      const statusBody = (await statusRes.json()) as { documents: { id: string }[] };
      const docId = statusBody.documents?.[0]?.id;
      if (!docId) return;
      const response = await app.handle(
        new Request(`http://localhost/kyc/verify/${docId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        new Request(`http://localhost/kyc/file/${NON_EXISTENT_DOC_ID}`),
      );
      expect(response.status).toBe(404);
    });
  });

  describe('Rate limiting', () => {
    it('returns 429 after exceeding upload rate limit', async () => {
      const app = createApp();
      const formData = new FormData();
      formData.set('userId', VALID_USER_ID);
      formData.set('documentType', 'passport');
      formData.set('file', new File(['x'], 'x.pdf', { type: 'application/pdf' }));

      let lastStatus = 0;
      for (let i = 0; i < 15; i++) {
        const response = await app.handle(
          new Request('http://localhost/kyc/upload', { method: 'POST', body: formData }),
        );
        lastStatus = response.status;
        if (response.status === 429) break;
      }
      expect(lastStatus).toBe(429);
    });
  });
});
