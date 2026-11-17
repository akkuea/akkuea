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
import { Keypair } from '@stellar/stellar-sdk';
import { errorHandler } from '../middleware/errorHandler';

process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-secret';

/**
 * Header a test uses to declare the client address a request should be limited
 * as. It is read by the resolver installed below, which only exists under the
 * test runner.
 */
const TEST_CLIENT_HEADER = 'x-ratelimit-test-client';

setClientAddressResolverForTesting((context) => context.request.headers.get(TEST_CLIENT_HEADER));

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-default-key-for-dev';

// Setup a minimal app for testing routes
import { internalOperationsRoutes } from '../routes/internalOperations';
const testApp = new Elysia().use(errorHandler).use(whitelistRoutes).use(internalOperationsRoutes);

const WALLET_56 = Keypair.random().publicKey();
const WALLET_B = Keypair.random().publicKey();

function extractParams(obj: any): any[] {
  const params: any[] = [];
  function walk(o: any) {
    if (!o || typeof o !== 'object') return;
    if (o.constructor?.name === 'Param') {
      params.push(o.value);
      return;
    }
    if (Array.isArray(o)) {
      for (const item of o) walk(item);
      return;
    }
    if (o.queryChunks) {
      walk(o.queryChunks);
    }
  }
  walk(obj);
  return params;
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
      findFirst: mock(async ({ where, orderBy }: any) => {
        const params = extractParams(where);
        let results = [...mockDbStore];

        const idParam = params.find(
          (p) => typeof p === 'string' && mockDbStore.some((r) => r.id === p),
        );
        if (idParam) {
          return mockDbStore.find((r) => r.id === idParam);
        }

        const walletParam = params.find((p) => typeof p === 'string' && p.startsWith('G'));
        if (walletParam) {
          results = results.filter((r) => r.walletAddress === walletParam);
          const statusParams = params.filter((p) =>
            ['pending', 'approved', 'rejected'].includes(p),
          );
          if (statusParams.length > 0) {
            results = results.filter((r) => statusParams.includes(r.status));
          }
        }

        if (orderBy) {
          results.sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          });
        }

        return results[0];
      }),
      findMany: mock(async () => mockDbStore),
    },
  };

  (db as any).insert = mock(() => ({
    values: (val: any) => ({
      returning: async () => {
        const inserted = {
          id: `test_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
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
    where: async () => {
      // Deletions no longer occur on resubmission
    },
  }));
});

afterEach(() => {
  mock.restore();
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
        idReference: 'ID-12345',
      }),
    }),
  );
}

describe('Whitelist manual verification', () => {
  test('POST /request returns 200 with status pending', async () => {
    const wallet = Keypair.random().publicKey();
    const res = await postWhitelistRequest(wallet);
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('pending');
    expect(body.data.walletAddress).toBe(wallet);
  });

  test('rate limit headers are present on request', async () => {
    const wallet = Keypair.random().publicKey();
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
      const wallet = Keypair.random().publicKey();
      const res = await postWhitelistRequest(wallet, `RL User ${i}`, '198.51.100.11');
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 10)).toEqual(Array.from({ length: 10 }, () => 200));
    expect(statuses[10]).toBe(429);
  });

  test('duplicate pending request returns error', async () => {
    const wallet = Keypair.random().publicKey();
    mockDbStore.push({
      id: 'existing',
      walletAddress: wallet,
      status: 'pending',
      createdAt: new Date(),
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
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    const res = await postWhitelistRequest(WALLET_B, 'New Submission');
    expect(res.status).toBe(200);

    const body = (await res.json()) as any;
    expect(body.data.status).toBe('pending');
    expect(body.data.fullName).toBe('New Submission');

    const forWallet = mockDbStore.filter((r) => r.walletAddress === WALLET_B);
    expect(forWallet.length).toBe(2);
    expect(forWallet.some((r) => r.id === 'old_rejected')).toBe(true);
    expect(forWallet.some((r) => r.id !== 'old_rejected' && r.status === 'pending')).toBe(true);
  });

  test('blocked when already approved', async () => {
    const wallet = Keypair.random().publicKey();
    mockDbStore.push({
      id: 'approved',
      walletAddress: wallet,
      status: 'approved',
      createdAt: new Date(),
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
      createdAt: new Date(),
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
      createdAt: new Date(),
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
      createdAt: new Date(),
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
      createdAt: new Date(),
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
      const wallet = Keypair.random().publicKey();
      const res = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-test-bypass-ratelimit': 'true',
            [TEST_CLIENT_HEADER]: '198.51.100.12',
          },
          body: JSON.stringify({
            walletAddress: wallet,
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
      Keypair.random().publicKey(),
      'Blocked User',
      '198.51.100.12',
    );
    const body = (await blocked.json()) as { error?: string; success?: boolean };
    expect(body.error).toBe('RATE_LIMITED');
    expect(body.success).toBe(false);
  });
});
