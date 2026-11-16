/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import Elysia from 'elysia';
import { db } from '../db';
import { stellarService } from '../services/StellarService';
import { whitelistService } from '../services/WhitelistService';
import { whitelistRoutes } from './whitelist';
import { internalOperationsRoutes } from './internalOperations';

const testApp = new Elysia().use(whitelistRoutes).use(internalOperationsRoutes);

process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-secret';

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

function makeBadChecksumPublicKey(validKey: string): string {
  const lastChar = validKey[55]!;
  const replacement = lastChar === 'A' ? 'B' : 'A';
  return `${validKey.slice(0, 55)}${replacement}`;
}

describe('Whitelist API Routes', () => {
  const mockWallet = Keypair.random().publicKey();
  const adminKeypair = Keypair.random();
  let mockDbStore: any[] = [];

  const prevWhitelistContractId = process.env.PILOT_WHITELIST_CONTRACT_ID;
  const prevAdminPublic = process.env.STELLAR_ADMIN_PUBLIC_KEY;
  const prevAdminSecret = process.env.STELLAR_ADMIN_SECRET;

  beforeEach(() => {
    mockDbStore = [];
    process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-secret';
    process.env.PILOT_WHITELIST_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 7));
    process.env.STELLAR_ADMIN_PUBLIC_KEY = adminKeypair.publicKey();
    process.env.STELLAR_ADMIN_SECRET = adminKeypair.secret();

    spyOn(stellarService, 'submitWhitelistApprove').mockResolvedValue('mock_tx_hash');

    (db as any).query = {
      pilotWhitelistRequests: {
        findFirst: mock(async ({ where }: any) => {
          const { idOrWalletStrings, statuses } = parseWhereFilters(where);
          return [...mockDbStore].reverse().find((row) => {
            const matchesIdentifier =
              idOrWalletStrings.length === 0 ||
              idOrWalletStrings.some((val) => row.walletAddress === val || row.id === val);
            const matchesStatus = !statuses || statuses.includes(row.status);
            return matchesIdentifier && matchesStatus;
          });
        }),
        findMany: mock(async ({ where }: any = {}) => {
          const { idOrWalletStrings, statuses } = parseWhereFilters(where);
          return mockDbStore.filter((row) => {
            const matchesIdentifier =
              idOrWalletStrings.length === 0 ||
              idOrWalletStrings.some((val) => row.walletAddress === val || row.id === val);
            const matchesStatus = !statuses || statuses.includes(row.status);
            return matchesIdentifier && matchesStatus;
          });
        }),
      },
    };

    (db as any).insert = mock(() => ({
      values: (val: any) => ({
        returning: async () => {
          const inserted = {
            id: `test_id_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            reviewedAt: null,
            rejectionReason: null,
            ...val,
          };
          mockDbStore.push(inserted);
          return [inserted];
        },
      }),
    }));

    (db as any).update = mock(() => ({
      set: (val: any) => ({
        where: async (whereExpr: any) => {
          const { idOrWalletStrings } = parseWhereFilters(whereExpr);
          const target = mockDbStore.find((row) =>
            idOrWalletStrings.some(
              (idOrWallet) => row.id === idOrWallet || row.walletAddress === idOrWallet,
            ),
          );
          if (target) {
            Object.assign(target, val);
          }
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
    if (prevWhitelistContractId === undefined) {
      delete process.env.PILOT_WHITELIST_CONTRACT_ID;
    } else {
      process.env.PILOT_WHITELIST_CONTRACT_ID = prevWhitelistContractId;
    }
    if (prevAdminPublic === undefined) {
      delete process.env.STELLAR_ADMIN_PUBLIC_KEY;
    } else {
      process.env.STELLAR_ADMIN_PUBLIC_KEY = prevAdminPublic;
    }
    if (prevAdminSecret === undefined) {
      delete process.env.STELLAR_ADMIN_SECRET;
    } else {
      process.env.STELLAR_ADMIN_SECRET = prevAdminSecret;
    }
  });

  it('submits a new whitelist request successfully', async () => {
    const response = await testApp.handle(
      new Request('http://localhost/pilot/whitelist/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: mockWallet,
          fullName: 'Test User',
          idType: 'passport',
          idReference: 'A1234567',
        }),
      }),
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as any;
    expect(result.success).toBe(true);
    expect(result.data.walletAddress).toBe(mockWallet);
    expect(result.data.status).toBe('pending');
    expect(mockDbStore.length).toBe(1);
  });

  it('returns 409 with a readable message when a request is already pending', async () => {
    mockDbStore.push({
      id: 'existing_pending_id',
      walletAddress: mockWallet,
      status: 'pending',
    });

    const response = await testApp.handle(
      new Request('http://localhost/pilot/whitelist/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: mockWallet,
          fullName: 'Test User 2',
          idType: 'national_id',
          idReference: 'B7654321',
        }),
      }),
    );

    expect(response.status).toBe(409);
    const body = (await response.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toBe('CONFLICT');
    expect(body.message).toBe('A whitelist request is already pending for this address');
  });

  it('returns 409 when the wallet address is already approved', async () => {
    mockDbStore.push({
      id: 'approved_id',
      walletAddress: mockWallet,
      status: 'approved',
    });

    const response = await testApp.handle(
      new Request('http://localhost/pilot/whitelist/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: mockWallet,
          fullName: 'Test User',
          idType: 'passport',
          idReference: 'A1234567',
        }),
      }),
    );

    expect(response.status).toBe(409);
    const body = (await response.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toBe('CONFLICT');
    expect(body.message).toBe('This address is already whitelisted');
  });

  it('rejects invalid wallet addresses with 400 in both request and status routes', async () => {
    const badChecksumKey = makeBadChecksumPublicKey(mockWallet);
    const contractAddress = StrKey.encodeContract(Buffer.alloc(32, 1));

    expect(badChecksumKey).toHaveLength(56);
    expect(contractAddress.startsWith('C')).toBe(true);

    for (const invalidWallet of ['not-a-key', badChecksumKey, contractAddress]) {
      const postRes = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: invalidWallet,
            fullName: 'Invalid Key User',
            idType: 'passport',
            idReference: 'A1234567',
          }),
        }),
      );
      expect(postRes.status).toBe(400);
      const postBody = (await postRes.json()) as any;
      expect(postBody.success).toBe(false);
      expect(postBody.message).toContain('Invalid Stellar wallet address');

      const statusRes = await testApp.handle(
        new Request(`http://localhost/pilot/whitelist/status/${invalidWallet}`),
      );
      expect(statusRes.status).toBe(400);
      const statusBody = (await statusRes.json()) as any;
      expect(statusBody.success).toBe(false);
      expect(statusBody.message).toContain('Invalid Stellar wallet address');
    }
  });

  it('preserves rejected records when a wallet submits a new request after rejection', async () => {
    const resubmitWallet = Keypair.random().publicKey();

    mockDbStore.push({
      id: 'old_rejected_id',
      walletAddress: resubmitWallet,
      status: 'rejected',
      rejectionReason: 'Expired passport scan',
      fullName: 'Old Submission',
      idType: 'passport',
      idReference: 'OLD123',
      createdAt: new Date('2026-01-10T00:00:00.000Z'),
    });

    const response = await testApp.handle(
      new Request('http://localhost/pilot/whitelist/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: resubmitWallet,
          fullName: 'New Submission',
          idType: 'national_id',
          idReference: 'NEW456',
        }),
      }),
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as any;
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('pending');
    expect(result.data.fullName).toBe('New Submission');

    const requestsForWallet = mockDbStore.filter((r) => r.walletAddress === resubmitWallet);
    expect(requestsForWallet.length).toBe(2);
    expect(requestsForWallet[0]).toMatchObject({
      id: 'old_rejected_id',
      status: 'rejected',
      rejectionReason: 'Expired passport scan',
    });
    expect(requestsForWallet[1]).toMatchObject({
      status: 'pending',
      fullName: 'New Submission',
    });

    const statusResponse = await testApp.handle(
      new Request(`http://localhost/pilot/whitelist/status/${resubmitWallet}`),
    );
    expect(statusResponse.status).toBe(200);
    const statusBody = (await statusResponse.json()) as any;
    expect(statusBody.status).toBe('pending');
  });

  it('fetches pending requests', async () => {
    mockDbStore.push({
      id: 'pending_id',
      walletAddress: mockWallet,
      status: 'pending',
    });

    const response = await testApp.handle(
      new Request('http://localhost/internal/operations/pilot/whitelist/pending', {
        method: 'GET',
        headers: { 'x-internal-api-key': 'test-secret' },
      }),
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as any;
    expect(result.success).toBe(true);
    expect(result.data.length).toBe(1);
  });

  it('approves a pending request and invokes WhitelistService.approveRequest', async () => {
    mockDbStore.push({
      id: 'req_id_1',
      walletAddress: mockWallet,
      status: 'pending',
    });
    const approveSpy = spyOn(whitelistService, 'approveRequest');

    const response = await testApp.handle(
      new Request('http://localhost/internal/operations/pilot/whitelist/req_id_1/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-api-key': 'test-secret' },
        body: JSON.stringify({ action: 'approve' }),
      }),
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as any;
    expect(result.success).toBe(true);
    expect(result.txHash).toBe('mock_tx_hash');
    expect(approveSpy).toHaveBeenCalledWith('req_id_1');
    expect(mockDbStore[0].status).toBe('approved');
  });

  it('returns 404 when reviewing an unknown request id', async () => {
    const response = await testApp.handle(
      new Request('http://localhost/internal/operations/pilot/whitelist/unknown-id/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-api-key': 'test-secret' },
        body: JSON.stringify({ action: 'approve' }),
      }),
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toBe('NOT_FOUND');
    expect(body.message).toBe('Whitelist request not found');
  });

  it('returns 400 when rejecting without a reason or supplying an invalid action', async () => {
    mockDbStore.push({
      id: 'req_id_2',
      walletAddress: mockWallet,
      status: 'pending',
    });

    const missingReasonRes = await testApp.handle(
      new Request('http://localhost/internal/operations/pilot/whitelist/req_id_2/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-api-key': 'test-secret' },
        body: JSON.stringify({ action: 'reject', reason: '   ' }),
      }),
    );
    expect(missingReasonRes.status).toBe(400);
    const missingReasonBody = (await missingReasonRes.json()) as any;
    expect(missingReasonBody.error).toBe('BAD_REQUEST');
    expect(missingReasonBody.message).toBe('Rejection reason is required');

    const invalidActionRes = await testApp.handle(
      new Request('http://localhost/internal/operations/pilot/whitelist/req_id_2/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-api-key': 'test-secret' },
        body: JSON.stringify({ action: 'hold' }),
      }),
    );
    expect(invalidActionRes.status).toBe(400);
  });

  it('leaves zero eslint-disable comments for no-explicit-any in WhitelistController.ts', () => {
    const controllerSource = readFileSync(
      join(import.meta.dir, '../controllers/WhitelistController.ts'),
      'utf8',
    );
    expect(controllerSource).not.toContain('no-explicit-any');
  });
});
