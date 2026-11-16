/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Manual verification script for the whitelist hardening changes.
 * Exercises POST /pilot/whitelist/request with rate limiting, resubmission,
 * and validation behavior via Elysia's test handler (no running server needed).
 *
 *   bun test src/tests/whitelist.manual-verification.test.ts
 */
import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { Keypair } from '@stellar/stellar-sdk';
import Elysia from 'elysia';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { whitelistRoutes } from '../routes/whitelist';
import { setClientAddressResolverForTesting } from '../middleware/rateLimit';
import { internalOperationsRoutes } from '../routes/internalOperations';

process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-secret';

const TEST_CLIENT_HEADER = 'x-ratelimit-test-client';

setClientAddressResolverForTesting((context) => context.request.headers.get(TEST_CLIENT_HEADER));

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-default-key-for-dev';

const testApp = new Elysia().use(whitelistRoutes).use(internalOperationsRoutes);

const WALLET_56 = Keypair.random().publicKey();
const WALLET_B = Keypair.random().publicKey();
const KNOWN_STATUSES = new Set(['pending', 'approved', 'rejected']);

function collectSqlParams(node: unknown, out: unknown[] = []): unknown[] {
  if (node == null || typeof node !== 'object') return out;
  const record = node as Record<string, unknown>;
  if (node.constructor?.name === 'Param' && 'value' in record) {
    out.push(record.value);
    return out;
  }
  if (Array.isArray(record.queryChunks)) {
    for (const chunk of record.queryChunks) {
      collectSqlParams(chunk, out);
    }
  }
  return out;
}

function parseWhereFilters(where: unknown): {
  idOrWalletStrings: string[];
  statuses: string[] | null;
} {
  const params = collectSqlParams(where);
  const idOrWalletStrings: string[] = [];
  const statuses: string[] = [];

  for (const param of params) {
    if (Array.isArray(param)) {
      for (const item of param) {
        if (typeof item === 'string' && KNOWN_STATUSES.has(item)) {
          statuses.push(item);
        }
      }
    } else if (typeof param === 'string') {
      if (KNOWN_STATUSES.has(param)) {
        statuses.push(param);
      } else {
        idOrWalletStrings.push(param);
      }
    }
  }

  return {
    idOrWalletStrings,
    statuses: statuses.length > 0 ? statuses : null,
  };
}

let mockDbStore: any[] = [];

beforeEach(() => {
  mockDbStore = [];

  (db as any).query = {
    pilotWhitelistRequests: {
      findFirst: mock(async ({ where }: any) => {
        const { idOrWalletStrings, statuses } = parseWhereFilters(where);
        return [...mockDbStore].reverse().find((r) => {
          const matchesId =
            idOrWalletStrings.length === 0 ||
            idOrWalletStrings.some((val) => r.walletAddress === val || r.id === val);
          const matchesStatus = !statuses || statuses.includes(r.status);
          return matchesId && matchesStatus;
        });
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
    where: async () => {
      throw new Error('Rejected history rows must not be deleted');
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
        idReference: `REF-${Date.now()}`,
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

    expect(limit).toBe(10);
    expect(remaining).toBe(9);
    expect(reset).toBeGreaterThan(0);
  });

  test('rate limit blocks after exceeding max requests', async () => {
    const statuses: number[] = [];

    for (let i = 0; i < 11; i++) {
      const wallet = Keypair.random().publicKey();
      const res = await postWhitelistRequest(wallet, `RL User ${i}`, '198.51.100.11');
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 10)).toEqual(Array.from({ length: 10 }, () => 200));
    expect(statuses[10]).toBe(429);
  });

  test('duplicate pending request returns 409 conflict', async () => {
    const wallet = Keypair.random().publicKey();
    mockDbStore.push({
      id: 'existing',
      walletAddress: wallet,
      status: 'pending',
    });

    const res = await postWhitelistRequest(wallet);
    expect(res.status).toBe(409);
  });

  test('resubmission after rejection creates new pending request while preserving rejected row', async () => {
    mockDbStore.push({
      id: 'old_rejected',
      walletAddress: WALLET_B,
      status: 'rejected',
      rejectionReason: 'Expired document',
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
    expect(forWallet.length).toBe(2);
    expect(forWallet[0].id).toBe('old_rejected');
    expect(forWallet[0].status).toBe('rejected');
    expect(forWallet[1].status).toBe('pending');
  });

  test('blocked with 409 when already approved', async () => {
    const wallet = Keypair.random().publicKey();
    mockDbStore.push({
      id: 'approved',
      walletAddress: wallet,
      status: 'approved',
    });

    const res = await postWhitelistRequest(wallet);
    expect(res.status).toBe(409);
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
            walletAddress: Keypair.random().publicKey(),
            fullName: `Bypass User ${i}`,
            idType: 'passport',
            idReference: `BYPASS-${i}`,
          }),
        }),
      );
      statuses.push(res.status);
    }

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
