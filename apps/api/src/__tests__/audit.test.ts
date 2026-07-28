import { describe, expect, it, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { kycRoutes } from '../routes/kyc';
import { adminRoutes } from '../routes/admin';
import { errorHandler } from '../middleware/errorHandler';
import { VALID_UUID } from '@real-estate-defi/shared';
import { userRepository } from '../repositories/UserRepository';
import jwt from 'jsonwebtoken';

const skipIfNoDatabase = !process.env.DATABASE_URL;
const TEST_WALLET = 'GAUDITTESTWALLETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-default-key-for-dev';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || 'test-internal-api-key';
const OPS_CREDENTIAL = process.env.OPERATIONS_BACKEND_CREDENTIAL || 'test-ops-credential';
process.env.INTERNAL_API_KEY = INTERNAL_KEY;
process.env.OPERATIONS_BACKEND_CREDENTIAL = OPS_CREDENTIAL;

function createKycApp() {
  return new Elysia().use(errorHandler).use(kycRoutes);
}

function createAdminApp() {
  return new Elysia().use(errorHandler).use(adminRoutes);
}

describe.skipIf(skipIfNoDatabase)('Audit Log Integration', () => {
  let testUserId = VALID_UUID;
  let testToken = '';

  beforeAll(async () => {
    if (!skipIfNoDatabase) {
      const user = await userRepository.getOrCreateByWallet(TEST_WALLET);
      testUserId = user.id;
      testToken = jwt.sign({ id: testUserId, walletAddress: TEST_WALLET }, JWT_SECRET);
    }
  });

  async function uploadDocument(app: ReturnType<typeof createKycApp>): Promise<string> {
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
      throw new Error(`Upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
    }
    const body = (await uploadRes.json()) as { documentId?: string };
    return body.documentId!;
  }

  describe('KYC verify creates audit row', () => {
    it('should create an audit row when approving a KYC document', async () => {
      const app = createKycApp();
      const documentId = await uploadDocument(app);

      const response = await app.handle(
        new Request(`http://localhost/kyc/verify/${documentId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'internal-api-key': INTERNAL_KEY,
          },
          body: JSON.stringify({ verified: true, actorWallet: TEST_WALLET }),
        }),
      );
      expect(response.status).toBe(200);

      const adminApp = createAdminApp();
      const auditRes = await adminApp.handle(
        new Request('http://localhost/api/v1/admin/audit-log?action=kyc.approve', {
          headers: { 'x-internal-api-key': OPS_CREDENTIAL },
        }),
      );
      expect(auditRes.status).toBe(200);
      const auditBody = (await auditRes.json()) as {
        success?: boolean;
        data?: Array<Record<string, unknown>>;
        pagination?: Record<string, unknown>;
      };
      expect(auditBody.success).toBe(true);
      expect(auditBody.data?.length).toBeGreaterThanOrEqual(1);
      expect(auditBody.data![0]!.action).toBe('kyc.approve');
      expect(auditBody.data![0]!.entityId).toBe(documentId);
      expect(auditBody.data![0]!.actor).toBe(TEST_WALLET);
    });

    it('should create an audit row when rejecting a KYC document', async () => {
      const app = createKycApp();
      const documentId = await uploadDocument(app);

      const response = await app.handle(
        new Request(`http://localhost/kyc/verify/${documentId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'internal-api-key': INTERNAL_KEY,
          },
          body: JSON.stringify({
            verified: false,
            notes: 'Document invalid',
            actorWallet: TEST_WALLET,
          }),
        }),
      );
      expect(response.status).toBe(200);

      const adminApp = createAdminApp();
      const auditRes = await adminApp.handle(
        new Request('http://localhost/api/v1/admin/audit-log?action=kyc.reject', {
          headers: { 'x-internal-api-key': OPS_CREDENTIAL },
        }),
      );
      expect(auditRes.status).toBe(200);
      const auditBody = (await auditRes.json()) as {
        success?: boolean;
        data?: Array<Record<string, unknown>>;
      };
      expect(auditBody.success).toBe(true);
      expect(auditBody.data?.length).toBeGreaterThanOrEqual(1);
      expect(auditBody.data![0]!.action).toBe('kyc.reject');
      expect(auditBody.data![0]!.entityId).toBe(documentId);
    });
  });

  describe('GET /api/v1/admin/audit-log filtering', () => {
    it('should filter by actor', async () => {
      const adminApp = createAdminApp();
      const res = await adminApp.handle(
        new Request(`http://localhost/api/v1/admin/audit-log?actor=${TEST_WALLET}`, {
          headers: { 'x-internal-api-key': OPS_CREDENTIAL },
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success?: boolean;
        data?: Array<{ actor?: string }>;
        pagination?: { total?: number };
      };
      expect(body.success).toBe(true);
      if (body.data && body.data.length > 0) {
        for (const entry of body.data) {
          expect(entry.actor).toBe(TEST_WALLET);
        }
      }
    });

    it('should filter by action', async () => {
      const adminApp = createAdminApp();
      const res = await adminApp.handle(
        new Request('http://localhost/api/v1/admin/audit-log?action=kyc.approve', {
          headers: { 'x-internal-api-key': OPS_CREDENTIAL },
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success?: boolean;
        data?: Array<{ action?: string }>;
      };
      expect(body.success).toBe(true);
      if (body.data && body.data.length > 0) {
        for (const entry of body.data) {
          expect(entry.action).toBe('kyc.approve');
        }
      }
    });

    it('should filter by date range', async () => {
      const adminApp = createAdminApp();
      const res = await adminApp.handle(
        new Request(
          'http://localhost/api/v1/admin/audit-log?startDate=2025-01-01T00:00:00.000Z&endDate=2030-12-31T23:59:59.000Z',
          {
            headers: { 'x-internal-api-key': OPS_CREDENTIAL },
          },
        ),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success?: boolean };
      expect(body.success).toBe(true);
    });

    it('should return validation error for invalid date', async () => {
      const adminApp = createAdminApp();
      const res = await adminApp.handle(
        new Request('http://localhost/api/v1/admin/audit-log?startDate=invalid-date', {
          headers: { 'x-internal-api-key': OPS_CREDENTIAL },
        }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('pagination', () => {
    it('should paginate results', async () => {
      const adminApp = createAdminApp();
      const res = await adminApp.handle(
        new Request('http://localhost/api/v1/admin/audit-log?page=1&limit=2', {
          headers: { 'x-internal-api-key': OPS_CREDENTIAL },
        }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success?: boolean;
        data?: Array<unknown>;
        pagination?: { page?: number; limit?: number; total?: number; totalPages?: number };
      };
      expect(body.success).toBe(true);
      expect(body.pagination!.page).toBe(1);
      expect(body.pagination!.limit).toBe(2);
      expect(typeof body.pagination!.total).toBe('number');
      expect(typeof body.pagination!.totalPages).toBe('number');
    });

    it('should limit to 100 max', async () => {
      const adminApp = createAdminApp();
      const res = await adminApp.handle(
        new Request('http://localhost/api/v1/admin/audit-log?limit=999', {
          headers: { 'x-internal-api-key': OPS_CREDENTIAL },
        }),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('empty results', () => {
    it('should return empty data for non-existent actor filter', async () => {
      const adminApp = createAdminApp();
      const res = await adminApp.handle(
        new Request(
          'http://localhost/api/v1/admin/audit-log?actor=GNONEXISTENTXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          {
            headers: { 'x-internal-api-key': OPS_CREDENTIAL },
          },
        ),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success?: boolean;
        data?: Array<unknown>;
        pagination?: { total?: number };
      };
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(0);
      expect(body.pagination?.total).toBe(0);
    });
  });

  describe('authentication', () => {
    it('should return 403 without internal api key', async () => {
      const adminApp = createAdminApp();
      const res = await adminApp.handle(new Request('http://localhost/api/v1/admin/audit-log'));
      expect(res.status).toBe(403);
    });

    it('should return 403 with wrong internal api key', async () => {
      const adminApp = createAdminApp();
      const res = await adminApp.handle(
        new Request('http://localhost/api/v1/admin/audit-log', {
          headers: { 'x-internal-api-key': 'wrong-key' },
        }),
      );
      expect(res.status).toBe(403);
    });
  });
});
