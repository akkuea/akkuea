/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Manual verification script for the whitelist hardening changes.
 * Exercises POST /pilot/whitelist/request with rate limiting, resubmission,
 * and validation behavior via Elysia's test handler (no running server needed).
 *
 *   bun test src/tests/whitelist.manual-verification.test.ts
 */
import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import Elysia from 'elysia';
import { db } from '../db';
import { whitelistRoutes } from '../routes/whitelist';
import { StorageService } from '../services/StorageService';

process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-secret';

const TEST_FIELD_ENCRYPTION_KEY = 'dGVzdC1rZXktbWF0ZXJpYWwtdGhhdC1pcy0zMi1ieXRlcy1sb25nLg=='; // 32 bytes base64

// Setup a minimal app for testing routes
import { internalOperationsRoutes } from '../routes/internalOperations';
const testApp = new Elysia().use(whitelistRoutes).use(internalOperationsRoutes);

const WALLET_56 = 'GDK7PZZY4QJ6GZ46X34PXZY2C46Y7PZZY4QJ6GZ46X34PXZY2C46Y7PZ';
const WALLET_B = 'GDC3C4X5R7N2X7CII7SPRD4U6ZLKZKAJZDW6N4Q4QAV3FJ7Q3N7GJ5P6';

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

let mockDbStore: any[] = [];
let originalStore: unknown;
let originalSignedUrl: unknown;
let originalDelete: unknown;

beforeEach(() => {
  mockDbStore = [];

  // Stub StorageService statics on the class object rather than via
  // mock.module(): bun test applies mock.module() to the whole process,
  // which would leak into every other test file loaded after this one.
  originalStore = StorageService.store;
  originalSignedUrl = StorageService.getSignedReadUrl;
  originalDelete = StorageService.deleteByRelativePath;

  process.env.FIELD_ENCRYPTION_KEY = TEST_FIELD_ENCRYPTION_KEY;

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

  // Mock whitelist service (re-apply after each mock.restore)
  mock.module('../services/WhitelistService', () => {
    return {
      whitelistService: {
        approveRequest: mock(() => Promise.resolve('mock_tx_hash')),
        rejectRequest: mock(() => Promise.resolve()),
      },
    };
  });

  (db as any).query = {
    pilotWhitelistRequests: {
      findFirst: mock(async ({ where }: any) => {
        const walletAddr = extractWalletAddress(where);
        if (walletAddr) return mockDbStore.find((r) => r.walletAddress === walletAddr);
        return undefined;
      }),
      findMany: mock(async () => mockDbStore),
    },
  };

  (db as any).insert = mock(() => ({
    values: (val: any) => ({
      returning: async () => {
        const inserted = {
          id: `test_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          ...val,
        };
        mockDbStore.push(inserted);
        return [inserted];
      },
    }),
  }));

  (db as any).update = mock(() => ({
    set: (val: any) => ({
      where: async () => {
        if (mockDbStore.length > 0) Object.assign(mockDbStore[0], val);
      },
    }),
  }));

  (db as any).delete = mock(() => ({
    where: async (whereExpr: any) => {
      const walletAddr = extractWalletAddress(whereExpr);
      if (walletAddr) mockDbStore = mockDbStore.filter((r) => r.walletAddress !== walletAddr);
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
  // Direct property assignment on the db Proxy mutates _dbTarget, which
  // persists across test files in the same bun process. mock.restore()
  // only undoes mock() calls, not these mutations, so delete them
  // unconditionally: beforeEach always re-populates all four from scratch,
  // so there's no prior legitimate state to preserve.
  for (const prop of ['query', 'insert', 'update', 'delete']) {
    delete (db as any)[prop];
  }
});

/**
 * Builds a multipart POST body. The route requires a document file
 * (requestMultipartSchema in routes/whitelist.ts), so JSON bodies would be
 * rejected with 422 before reaching the controller.
 */
function buildMultipartBody(wallet: string, name: string): FormData {
  const formData = new FormData();
  formData.append('walletAddress', wallet);
  formData.append('fullName', name);
  formData.append('idType', 'passport');
  formData.append('idReference', `REF-${Date.now()}`);
  const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
  formData.append('document', new File([pdfBuffer], 'passport.pdf', { type: 'application/pdf' }));
  return formData;
}

async function postWhitelistRequest(wallet: string, name = 'Test User', bypassRateLimit = true) {
  const headers: Record<string, string> = {};
  if (bypassRateLimit) {
    headers['x-test-bypass-ratelimit'] = 'true';
  }
  return testApp.handle(
    new Request('http://localhost/pilot/whitelist/request', {
      method: 'POST',
      headers,
      body: buildMultipartBody(wallet, name),
    }),
  );
}

describe('Whitelist manual verification', () => {
  test('POST /request returns 200 with status pending', async () => {
    const wallet = `GD${String(Date.now()).padStart(54, '0')}`;
    const res = await postWhitelistRequest(wallet);
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('pending');
    expect(body.data.walletAddress).toBe(wallet);
  });

  test('rate limit headers are present on request (no bypass)', async () => {
    const wallet = `GD${String(Date.now()).padStart(54, '0')}`;
    const res = await postWhitelistRequest(wallet, 'Header Test', false);
    expect(res.status).toBe(200);

    const limit = parseInt(res.headers.get('X-RateLimit-Limit') ?? '0');
    const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') ?? '0');
    const reset = parseInt(res.headers.get('X-RateLimit-Reset') ?? '0');

    expect(limit).toBe(10); // default window
    expect(remaining).toBeGreaterThanOrEqual(0);
    expect(remaining).toBeLessThan(limit);
    expect(reset).toBeGreaterThan(0);
  });

  test('rate limit blocks after exceeding max requests', async () => {
    // Send requests rapidly without bypass until we hit 429
    let hitRateLimit = false;
    let rateLimitBody: any = null;
    for (let i = 0; i < 20; i++) {
      const wallet = `GD${String(i + 300).padStart(54, '0')}`;
      const res = await postWhitelistRequest(wallet, `RL User ${i}`, false);
      if (res.status === 429) {
        hitRateLimit = true;
        rateLimitBody = await res.json();
        break;
      }
    }

    // The rate limiter should have kicked in (shared store may have consumed
    // some quota from earlier tests, but 20 attempts is more than enough)
    expect(hitRateLimit).toBe(true);
    expect(rateLimitBody).not.toBeNull();
    expect(rateLimitBody.error).toBe('RATE_LIMITED');
    expect(rateLimitBody.success).toBe(false);
  });

  test('duplicate pending request returns error', async () => {
    const wallet = `GD${String(Date.now()).padStart(54, '0')}`;
    mockDbStore.push({
      id: 'existing',
      walletAddress: wallet,
      status: 'pending',
    });

    const res = await postWhitelistRequest(wallet);
    expect(res.status).not.toBe(200);
  });

  test('resubmission after rejection creates new pending request', async () => {
    mockDbStore.push({
      id: 'old_rejected',
      walletAddress: WALLET_B,
      status: 'rejected',
      fullName: 'Old',
      idType: 'passport',
      idReference: 'OLD',
    });

    const res = await postWhitelistRequest(WALLET_B, 'New Submission');
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.data.status).toBe('pending');
    expect(body.data.fullName).toBe('New Submission');

    const forWallet = mockDbStore.filter((r) => r.walletAddress === WALLET_B);
    expect(forWallet.length).toBe(1);
    expect(forWallet[0].id).not.toBe('old_rejected');
  });

  test('blocked when already approved', async () => {
    const wallet = `GD${String(Date.now()).padStart(54, '0')}`;
    mockDbStore.push({
      id: 'approved',
      walletAddress: wallet,
      status: 'approved',
    });

    const res = await postWhitelistRequest(wallet);
    expect(res.status).not.toBe(200);
  });

  test('GET /status returns none for unknown wallet', async () => {
    const res = await testApp.handle(
      new Request(`http://localhost/pilot/whitelist/status/${WALLET_56}`),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe('none');
  });
  test('rateLimit bypass header works for testing', async () => {
    // Send 12 requests with bypass header - all should succeed
    const responses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/request', {
          method: 'POST',
          headers: {
            'x-test-bypass-ratelimit': 'true',
          },
          body: buildMultipartBody(`GD${String(i + 20).padStart(54, '0')}`, `Bypass User ${i}`),
        }),
      );
      responses.push(res.status);
    }

    // All should be 200 (rate limit bypassed)
    expect(responses.every((s) => s === 200)).toBe(true);
  });
});
