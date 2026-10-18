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
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { whitelistRoutes } from '../routes/whitelist';
import { setClientAddressResolverForTesting } from '../middleware/rateLimit';

process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-secret';

/**
 * Header a test uses to declare the client address a request should be limited
 * as. It is read by the resolver installed below, which only exists under the
 * test runner.
 */
const TEST_CLIENT_HEADER = 'x-ratelimit-test-client';

/**
 * Requests driven through `app.handle()` never reach a socket, so the rate
 * limiter (which identifies clients by socket address, or by `x-forwarded-for`
 * only when proxies are trusted) has nothing to key on and declines to count
 * them. The tests that assert real limiting below therefore declare the client
 * address they want.
 *
 * This is not the removed `x-test-bypass-ratelimit` header: nothing here skips
 * the limiter, the requests are counted and limited for real, against the
 * declared address. `setClientAddressResolverForTesting` refuses to install
 * itself unless NODE_ENV is "test", so no deployment can reach this path.
 */
setClientAddressResolverForTesting((context) => context.request.headers.get(TEST_CLIENT_HEADER));

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-default-key-for-dev';

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

beforeEach(() => {
  mockDbStore = [];

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

async function postWhitelistRequest(wallet: string, name = 'Test User', clientAddress?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (clientAddress) {
    headers[TEST_CLIENT_HEADER] = clientAddress;
  }
  return testApp.handle(
    new Request('http://localhost/pilot/whitelist/request', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        walletAddress: wallet,
        fullName: name,
        idType: 'passport',
        idReference: `REF-${Date.now()}`,
      }),
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

  test('rate limit headers are present on request', async () => {
    const wallet = `GD${String(Date.now()).padStart(54, '0')}`;
    const res = await postWhitelistRequest(wallet, 'Header Test', '198.51.100.10');
    expect(res.status).toBe(200);

    const limit = parseInt(res.headers.get('X-RateLimit-Limit') ?? '0');
    const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') ?? '0');
    const reset = parseInt(res.headers.get('X-RateLimit-Reset') ?? '0');

    expect(limit).toBe(10); // default window
    // This client address is used by no other test, so it starts on a full budget.
    expect(remaining).toBe(9);
    expect(reset).toBeGreaterThan(0);
  });

  test('rate limit blocks after exceeding max requests', async () => {
    const statuses: number[] = [];

    // The default budget is 10 requests per 60s for one client.
    for (let i = 0; i < 11; i++) {
      const wallet = `GD${String(i + 300).padStart(54, '0')}`;
      const res = await postWhitelistRequest(wallet, `RL User ${i}`, '198.51.100.11');
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 10)).toEqual(Array.from({ length: 10 }, () => 200));
    expect(statuses[10]).toBe(429);
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

  test('GET /status hides rejectionReason from an unauthenticated caller', async () => {
    mockDbStore.push({
      id: 'rejected_id',
      walletAddress: WALLET_56,
      status: 'rejected',
      rejectionReason: 'Document illegible',
    });

    const res = await testApp.handle(
      new Request(`http://localhost/pilot/whitelist/status/${WALLET_56}`),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.status).toBe('rejected');
    expect(body.rejectionReason).toBeUndefined();
  });

  test('GET /status includes rejectionReason for the wallet owner (Bearer session)', async () => {
    mockDbStore.push({
      id: 'rejected_id',
      walletAddress: WALLET_56,
      status: 'rejected',
      rejectionReason: 'Document illegible',
    });

    const token = jwt.sign({ id: 'user-1', walletAddress: WALLET_56 }, JWT_SECRET);

    const res = await testApp.handle(
      new Request(`http://localhost/pilot/whitelist/status/${WALLET_56}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.rejectionReason).toBe('Document illegible');
  });

  test('GET /status includes rejectionReason for an operator (x-internal-api-key)', async () => {
    mockDbStore.push({
      id: 'rejected_id',
      walletAddress: WALLET_56,
      status: 'rejected',
      rejectionReason: 'Document illegible',
    });

    const res = await testApp.handle(
      new Request(`http://localhost/pilot/whitelist/status/${WALLET_56}`, {
        headers: { 'x-internal-api-key': 'test-secret' },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.rejectionReason).toBe('Document illegible');
  });

  test("GET /status hides rejectionReason from a different wallet's session", async () => {
    mockDbStore.push({
      id: 'rejected_id',
      walletAddress: WALLET_56,
      status: 'rejected',
      rejectionReason: 'Document illegible',
    });

    const token = jwt.sign({ id: 'user-2', walletAddress: WALLET_B }, JWT_SECRET);

    const res = await testApp.handle(
      new Request(`http://localhost/pilot/whitelist/status/${WALLET_56}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.rejectionReason).toBeUndefined();
  });

  test('the removed x-test-bypass-ratelimit header has no effect', async () => {
    const statuses: number[] = [];

    for (let i = 0; i < 11; i++) {
      const res = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-test-bypass-ratelimit': 'true',
            [TEST_CLIENT_HEADER]: '198.51.100.12',
          },
          body: JSON.stringify({
            walletAddress: `GD${String(i + 20).padStart(54, '0')}`,
            fullName: `Bypass User ${i}`,
            idType: 'passport',
            idReference: `BYPASS-${i}`,
          }),
        }),
      );
      statuses.push(res.status);
    }

    // Every request below carried the old bypass header, and the limiter still
    // counted them: the 11th request is over the budget of 10 and is rejected.
    expect(statuses.slice(0, 10)).toEqual(Array.from({ length: 10 }, () => 200));
    expect(statuses[10]).toBe(429);

    const blocked = await postWhitelistRequest(
      `GD${String(400).padStart(54, '0')}`,
      'Blocked User',
      '198.51.100.12',
    );
    const body = (await blocked.json()) as { error?: string; success?: boolean };
    expect(body.error).toBe('RATE_LIMITED');
    expect(body.success).toBe(false);
  });
});
