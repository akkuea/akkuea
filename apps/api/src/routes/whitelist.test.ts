/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import Elysia from 'elysia';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { auditLog } from '../db/schema';
import { stellarService } from '../services/StellarService';
import { whitelistService } from '../services/WhitelistService';
import { whitelistRoutes } from './whitelist';
import { internalOperationsRoutes } from './internalOperations';

const testApp = new Elysia().use(whitelistRoutes).use(internalOperationsRoutes);

process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-secret';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-default-key-for-dev';

const KNOWN_STATUSES = new Set(['pending', 'approved', 'rejected', 'revoked']);

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

describe('Whitelist API Routes and Revocation', () => {
  const mockWallet = Keypair.random().publicKey();
  const operatorWallet = Keypair.random().publicKey();
  const adminKeypair = Keypair.random();
  let mockDbStore: any[] = [];
  let mockAuditStore: any[] = [];

  const prevWhitelistContractId = process.env.PILOT_WHITELIST_CONTRACT_ID;
  const prevAdminPublic = process.env.STELLAR_ADMIN_PUBLIC_KEY;
  const prevAdminSecret = process.env.STELLAR_ADMIN_SECRET;

  beforeEach(() => {
    mockDbStore = [];
    mockAuditStore = [];
    process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-secret';
    process.env.PILOT_WHITELIST_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 7));
    process.env.STELLAR_ADMIN_PUBLIC_KEY = adminKeypair.publicKey();
    process.env.STELLAR_ADMIN_SECRET = adminKeypair.secret();

    spyOn(stellarService, 'submitWhitelistApprove').mockResolvedValue('mock_approve_tx_hash');
    spyOn(stellarService, 'submitWhitelistRevoke').mockResolvedValue('mock_revoke_tx_hash');

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

    (db as any).insert = mock((table: unknown) => ({
      values: (val: any) => ({
        returning: async () => {
          const inserted = {
            id: randomUUID(),
            createdAt: new Date(),
            updatedAt: new Date(),
            reviewedAt: null,
            revokedAt: null,
            rejectionReason: null,
            revocationReason: null,
            ...val,
          };
          if (table === auditLog) {
            mockAuditStore.push(inserted);
          } else {
            mockDbStore.push(inserted);
          }
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
        throw new Error('Historical whitelist rows must not be deleted');
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
  });

  it('records audit entries for approve, reject, and revoke with action, wallet, and reason', async () => {
    const approveId = randomUUID();
    const rejectId = randomUUID();
    const rejectWallet = Keypair.random().publicKey();

    mockDbStore.push(
      {
        id: approveId,
        walletAddress: mockWallet,
        status: 'pending',
        rejectionReason: null,
        revocationReason: null,
        reviewedAt: null,
        revokedAt: null,
      },
      {
        id: rejectId,
        walletAddress: rejectWallet,
        status: 'pending',
        rejectionReason: null,
        revocationReason: null,
        reviewedAt: null,
        revokedAt: null,
      },
    );

    const approveSpy = spyOn(whitelistService, 'approveRequest');
    const approveRes = await testApp.handle(
      new Request(`http://localhost/internal/operations/pilot/whitelist/${approveId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': 'test-secret',
          'x-operator-wallet': operatorWallet,
        },
        body: JSON.stringify({ action: 'approve', reason: 'KYC verified' }),
      }),
    );
    expect(approveRes.status).toBe(200);
    expect(approveSpy).toHaveBeenCalledTimes(1);

    const rejectRes = await testApp.handle(
      new Request(`http://localhost/internal/operations/pilot/whitelist/${rejectId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': 'test-secret',
          'x-operator-wallet': operatorWallet,
        },
        body: JSON.stringify({ action: 'reject', reason: 'Expired passport' }),
      }),
    );
    expect(rejectRes.status).toBe(200);

    const revokeRes = await testApp.handle(
      new Request(`http://localhost/internal/operations/pilot/whitelist/${approveId}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': 'test-secret',
          'x-operator-wallet': operatorWallet,
        },
        body: JSON.stringify({ reason: 'Sanctions screening hit' }),
      }),
    );
    expect(revokeRes.status).toBe(200);
    const revokeBody = (await revokeRes.json()) as any;
    expect(revokeBody.success).toBe(true);
    expect(revokeBody.txHash).toBe('mock_revoke_tx_hash');

    expect(stellarService.submitWhitelistRevoke).toHaveBeenCalledTimes(1);
    const revokedRow = mockDbStore.find((r) => r.id === approveId);
    expect(revokedRow.status).toBe('revoked');
    expect(revokedRow.revocationReason).toBe('Sanctions screening hit');
    expect(revokedRow.revokedAt).toBeInstanceOf(Date);

    expect(mockAuditStore).toHaveLength(3);
    expect(mockAuditStore[0]).toMatchObject({
      actor: operatorWallet,
      action: 'whitelist.approve',
      entityType: 'pilot_whitelist_request',
      entityId: approveId,
      metadata: {
        walletAddress: mockWallet,
        reason: 'KYC verified',
        txHash: 'mock_approve_tx_hash',
      },
    });
    expect(mockAuditStore[1]).toMatchObject({
      actor: operatorWallet,
      action: 'whitelist.reject',
      entityType: 'pilot_whitelist_request',
      entityId: rejectId,
      metadata: {
        walletAddress: rejectWallet,
        reason: 'Expired passport',
      },
    });
    expect(mockAuditStore[2]).toMatchObject({
      actor: operatorWallet,
      action: 'whitelist.revoke',
      entityType: 'pilot_whitelist_request',
      entityId: approveId,
      metadata: {
        walletAddress: mockWallet,
        reason: 'Sanctions screening hit',
        txHash: 'mock_revoke_tx_hash',
      },
    });
  });

  it('keeps row approved and writes no audit entry if the on-chain revoke call fails', async () => {
    const reqId = randomUUID();
    mockDbStore.push({
      id: reqId,
      walletAddress: mockWallet,
      status: 'approved',
      rejectionReason: null,
      revocationReason: null,
      reviewedAt: new Date('2026-02-01T00:00:00.000Z'),
      revokedAt: null,
    });

    spyOn(stellarService, 'submitWhitelistRevoke').mockRejectedValue(
      new Error('Soroban simulation failed'),
    );

    const response = await testApp.handle(
      new Request(`http://localhost/internal/operations/pilot/whitelist/${reqId}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': 'test-secret',
        },
        body: JSON.stringify({ reason: 'Compliance removal' }),
      }),
    );

    expect(response.status).toBe(500);
    expect(mockDbStore[0].status).toBe('approved');
    expect(mockDbStore[0].revocationReason).toBeNull();
    expect(mockDbStore[0].revokedAt).toBeNull();
    expect(mockAuditStore).toHaveLength(0);
  });

  it('returns 4xx when revoking pending, rejected, already revoked, unknown, or reasonless requests', async () => {
    for (const nonRevocableStatus of ['pending', 'rejected', 'revoked'] as const) {
      const reqId = randomUUID();
      mockDbStore.push({
        id: reqId,
        walletAddress: Keypair.random().publicKey(),
        status: nonRevocableStatus,
      });

      const res = await testApp.handle(
        new Request(`http://localhost/internal/operations/pilot/whitelist/${reqId}/revoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': 'test-secret',
          },
          body: JSON.stringify({ reason: 'Attempted invalid revoke' }),
        }),
      );
      expect(res.status).toBe(409);
      const body = (await res.json()) as any;
      expect(body.success).toBe(false);
    }

    const notFoundRes = await testApp.handle(
      new Request(`http://localhost/internal/operations/pilot/whitelist/${randomUUID()}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': 'test-secret',
        },
        body: JSON.stringify({ reason: 'Unknown id' }),
      }),
    );
    expect(notFoundRes.status).toBe(404);

    const approvedId = randomUUID();
    mockDbStore.push({
      id: approvedId,
      walletAddress: mockWallet,
      status: 'approved',
    });

    const blankReasonRes = await testApp.handle(
      new Request(`http://localhost/internal/operations/pilot/whitelist/${approvedId}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': 'test-secret',
        },
        body: JSON.stringify({ reason: '   ' }),
      }),
    );
    expect(blankReasonRes.status).toBe(400);
    expect(stellarService.submitWhitelistRevoke).not.toHaveBeenCalled();
  });

  it('rejects revoke without operator credentials', async () => {
    const reqId = randomUUID();
    mockDbStore.push({
      id: reqId,
      walletAddress: mockWallet,
      status: 'approved',
    });

    const unauthRes = await testApp.handle(
      new Request(`http://localhost/internal/operations/pilot/whitelist/${reqId}/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Unauthorized attempt' }),
      }),
    );
    expect(unauthRes.status).toBe(403);
    expect(stellarService.submitWhitelistRevoke).not.toHaveBeenCalled();
  });

  it('returns revoked status and exposes the reason only to the wallet owner or an operator', async () => {
    const otherWallet = Keypair.random().publicKey();
    mockDbStore.push({
      id: randomUUID(),
      walletAddress: mockWallet,
      status: 'revoked',
      revocationReason: 'Account closed by investor',
    });

    const publicRes = await testApp.handle(
      new Request(`http://localhost/pilot/whitelist/status/${mockWallet}`),
    );
    expect(publicRes.status).toBe(200);
    const publicBody = (await publicRes.json()) as any;
    expect(publicBody.status).toBe('revoked');
    expect(publicBody.reason).toBeUndefined();
    expect(publicBody.revocationReason).toBeUndefined();

    const otherToken = jwt.sign({ id: 'user-other', walletAddress: otherWallet }, JWT_SECRET);
    const otherRes = await testApp.handle(
      new Request(`http://localhost/pilot/whitelist/status/${mockWallet}`, {
        headers: { Authorization: `Bearer ${otherToken}` },
      }),
    );
    const otherBody = (await otherRes.json()) as any;
    expect(otherBody.status).toBe('revoked');
    expect(otherBody.reason).toBeUndefined();
    expect(otherBody.revocationReason).toBeUndefined();

    const ownerToken = jwt.sign({ id: 'user-owner', walletAddress: mockWallet }, JWT_SECRET);
    const ownerRes = await testApp.handle(
      new Request(`http://localhost/pilot/whitelist/status/${mockWallet}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }),
    );
    const ownerBody = (await ownerRes.json()) as any;
    expect(ownerBody.status).toBe('revoked');
    expect(ownerBody.reason).toBe('Account closed by investor');
    expect(ownerBody.revocationReason).toBe('Account closed by investor');

    const operatorRes = await testApp.handle(
      new Request(`http://localhost/pilot/whitelist/status/${mockWallet}`, {
        headers: { 'x-internal-api-key': 'test-secret' },
      }),
    );
    const operatorBody = (await operatorRes.json()) as any;
    expect(operatorBody.status).toBe('revoked');
    expect(operatorBody.reason).toBe('Account closed by investor');
    expect(operatorBody.revocationReason).toBe('Account closed by investor');
  });

  it('allows a revoked wallet to submit a new whitelist request while keeping history', async () => {
    const revokedWallet = Keypair.random().publicKey();
    const revokedId = randomUUID();
    mockDbStore.push({
      id: revokedId,
      walletAddress: revokedWallet,
      status: 'revoked',
      revocationReason: 'Previous cycle ended',
      fullName: 'Previous Application',
      idType: 'passport',
      idReference: 'OLD-REVOKED',
    });

    const response = await testApp.handle(
      new Request('http://localhost/pilot/whitelist/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: revokedWallet,
          fullName: 'Reapplied Investor',
          idType: 'national_id',
          idReference: 'NEW-999',
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('pending');

    const rows = mockDbStore.filter((r) => r.walletAddress === revokedWallet);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe(revokedId);
    expect(rows[0].status).toBe('revoked');
    expect(rows[1].status).toBe('pending');
  });

  it('ships a safe Drizzle migration that applies cleanly on existing rows', () => {
    const migrationSql = readFileSync(
      join(import.meta.dir, '../../drizzle/migrations/0018_pilot_whitelist_revocation.sql'),
      'utf8',
    );
    expect(migrationSql).toContain(
      `ALTER TYPE "public"."pilot_whitelist_status" ADD VALUE IF NOT EXISTS 'revoked'`,
    );
    expect(migrationSql).toContain(`ADD COLUMN IF NOT EXISTS "revocation_reason" text`);
    expect(migrationSql).toContain(
      `ADD COLUMN IF NOT EXISTS "revoked_at" timestamp with time zone`,
    );
    expect(migrationSql).toContain(
      `DROP CONSTRAINT IF EXISTS "pilot_whitelist_requests_wallet_address_unique"`,
    );
    expect(migrationSql).toContain(`WHERE "status" IN ('pending', 'approved')`);
  });
});
