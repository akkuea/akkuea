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

process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-secret';

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
});

async function postWhitelistRequest(wallet: string, name = 'Test User', bypassRateLimit = true) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (bypassRateLimit) {
    headers['x-test-bypass-ratelimit'] = 'true';
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

    const body = await res.json();
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

    const body = await res.json();
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
    const body = await res.json();
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
            'Content-Type': 'application/json',
            'x-test-bypass-ratelimit': 'true',
          },
          body: JSON.stringify({
            walletAddress: `GD${String(i + 20).padStart(54, '0')}`,
            fullName: `Bypass User ${i}`,
            idType: 'passport',
            idReference: `BYPASS-${i}`,
          }),
        }),
      );
      responses.push(res.status);
    }

    // All should be 200 (rate limit bypassed)
    expect(responses.every((s) => s === 200)).toBe(true);
  });
});
