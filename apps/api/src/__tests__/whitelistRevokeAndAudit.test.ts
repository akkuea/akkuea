import { afterAll, afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { Keypair } from '@stellar/stellar-sdk';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import postgres from 'postgres';
import { getPilotWhitelistContractId } from '../config/contracts';
import { db } from '../db';
import { auditLog } from '../db/schema/auditLog';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { ApiError } from '../errors/ApiError';
import { errorHandler } from '../middleware/errorHandler';
import { internalOperationsRoutes } from '../routes/internalOperations';
import { whitelistRoutes } from '../routes/whitelist';
import { AuditService } from '../services/AuditService';
import { stellarService } from '../services/StellarService';
import { WhitelistService, type WhitelistChainGateway } from '../services/WhitelistService';

const OPS_SECRET = 'test-ops-revoke-secret';
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-default-key-for-dev';
const TEST_CONTRACT_ID = 'CAAXGP7LTPV4A57B3JW67E32X3X653D3L6276C233V4X3Z6X246Y3A7Q';
const ADMIN_WALLET = Keypair.random().publicKey();
const ADMIN_SECRET = Keypair.random().secret();
const OPERATOR_WALLET = Keypair.random().publicKey();

function randomWallet(): string {
  return Keypair.random().publicKey();
}

describe('WhitelistService unit behavior (revoke + audit)', () => {
  const savedContract = process.env.PILOT_WHITELIST_CONTRACT_ID;
  const savedPub = process.env.STELLAR_ADMIN_PUBLIC_KEY;
  const savedSec = process.env.STELLAR_ADMIN_SECRET;

  beforeEach(() => {
    process.env.PILOT_WHITELIST_CONTRACT_ID = TEST_CONTRACT_ID;
    process.env.STELLAR_ADMIN_PUBLIC_KEY = ADMIN_WALLET;
    process.env.STELLAR_ADMIN_SECRET = ADMIN_SECRET;
  });

  afterEach(() => {
    mock.restore();
    for (const prop of ['query', 'update']) {
      delete (db as unknown as Record<string, unknown>)[prop];
    }
    if (savedContract === undefined) delete process.env.PILOT_WHITELIST_CONTRACT_ID;
    else process.env.PILOT_WHITELIST_CONTRACT_ID = savedContract;
    if (savedPub === undefined) delete process.env.STELLAR_ADMIN_PUBLIC_KEY;
    else process.env.STELLAR_ADMIN_PUBLIC_KEY = savedPub;
    if (savedSec === undefined) delete process.env.STELLAR_ADMIN_SECRET;
    else process.env.STELLAR_ADMIN_SECRET = savedSec;
  });

  function installInMemoryRequest(initial: {
    id: string;
    walletAddress: string;
    status: 'pending' | 'approved' | 'rejected' | 'revoked';
    rejectionReason?: string | null;
    revocationReason?: string | null;
    reviewedAt?: Date | null;
    revokedAt?: Date | null;
  }) {
    const row = {
      fullName: 'Unit Investor',
      idType: 'passport' as const,
      idReference: 'ID-1',
      rejectionReason: null,
      revocationReason: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      reviewedAt: null,
      revokedAt: null,
      ...initial,
    };

    const updateCalls: Array<Record<string, unknown>> = [];
    (db as unknown as Record<string, unknown>).query = {
      pilotWhitelistRequests: {
        findFirst: mock(async () => row),
      },
    };
    (db as unknown as Record<string, unknown>).update = mock(() => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          updateCalls.push(values);
          Object.assign(row, values);
        },
      }),
    }));

    return { row, updateCalls };
  }

  it('calls the contract once, updates row to revoked with reason and timestamp, and writes an audit entry', async () => {
    const walletAddress = randomWallet();
    const requestId = '550e8400-e29b-41d4-a716-446655440000';
    const reviewedAt = new Date('2026-01-02T00:00:00.000Z');
    const { row } = installInMemoryRequest({
      id: requestId,
      walletAddress,
      status: 'approved',
      reviewedAt,
    });

    const logAction = mock(async () => {});
    const chain: WhitelistChainGateway = {
      submitWhitelistApprove: mock(async () => 'approve-tx'),
      submitWhitelistRevoke: mock(async () => 'revoke-tx-123'),
    };

    const service = new WhitelistService({ logAction } as unknown as AuditService, chain);
    const txHash = await service.revokeRequest(requestId, 'Investor requested removal', {
      actorWallet: OPERATOR_WALLET,
    });

    expect(txHash).toBe('revoke-tx-123');
    expect(chain.submitWhitelistRevoke).toHaveBeenCalledTimes(1);
    expect(chain.submitWhitelistRevoke).toHaveBeenCalledWith(
      getPilotWhitelistContractId(),
      ADMIN_WALLET,
      ADMIN_SECRET,
      walletAddress,
    );
    expect(row.status).toBe('revoked');
    expect(row.revocationReason).toBe('Investor requested removal');
    expect(row.revokedAt).toBeInstanceOf(Date);
    expect(row.reviewedAt).toEqual(reviewedAt);

    expect(logAction).toHaveBeenCalledTimes(1);
    expect(logAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: OPERATOR_WALLET,
        action: 'whitelist.revoke',
        entityType: 'pilot_whitelist_request',
        entityId: requestId,
        metadata: {
          walletAddress,
          reason: 'Investor requested removal',
          txHash: 'revoke-tx-123',
        },
      }),
    );
  });

  it('leaves the row approved and writes no audit entry when the on-chain revoke call fails', async () => {
    const walletAddress = randomWallet();
    const requestId = '550e8400-e29b-41d4-a716-446655440001';
    const { row, updateCalls } = installInMemoryRequest({
      id: requestId,
      walletAddress,
      status: 'approved',
    });

    const logAction = mock(async () => {});
    const chain: WhitelistChainGateway = {
      submitWhitelistApprove: mock(async () => 'approve-tx'),
      submitWhitelistRevoke: mock(async () => {
        throw new Error('ContractPaused');
      }),
    };

    const service = new WhitelistService({ logAction } as unknown as AuditService, chain);
    await expect(service.revokeRequest(requestId, 'Compliance hold')).rejects.toThrow(
      'ContractPaused',
    );

    expect(updateCalls).toHaveLength(0);
    expect(row.status).toBe('approved');
    expect(row.revocationReason).toBeNull();
    expect(row.revokedAt).toBeNull();
    expect(logAction).not.toHaveBeenCalled();
  });

  it('returns a 4xx ApiError when revoking a pending, rejected, or already revoked request', async () => {
    const logAction = mock(async () => {});
    const chain: WhitelistChainGateway = {
      submitWhitelistApprove: mock(async () => 'approve-tx'),
      submitWhitelistRevoke: mock(async () => 'revoke-tx'),
    };
    const service = new WhitelistService({ logAction } as unknown as AuditService, chain);

    for (const nonApprovedStatus of ['pending', 'rejected', 'revoked'] as const) {
      installInMemoryRequest({
        id: '550e8400-e29b-41d4-a716-446655440002',
        walletAddress: randomWallet(),
        status: nonApprovedStatus,
      });

      let caught: unknown;
      try {
        await service.revokeRequest('550e8400-e29b-41d4-a716-446655440002', 'Duplicate action');
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(ApiError);
      const apiErr = caught as ApiError;
      expect(apiErr.statusCode).toBeGreaterThanOrEqual(400);
      expect(apiErr.statusCode).toBeLessThan(500);
    }

    expect(chain.submitWhitelistRevoke).not.toHaveBeenCalled();
    expect(logAction).not.toHaveBeenCalled();
  });
});

const skipIfNoDatabase = !process.env.DATABASE_URL;

describe.skipIf(skipIfNoDatabase)(
  'Whitelist revoke, status privacy, resubmission, audit log, and migration (Postgres)',
  () => {
    const createdRequestIds: string[] = [];
    const createdWallets: string[] = [];

    const savedOps = process.env.OPERATIONS_BACKEND_CREDENTIAL;
    const savedContract = process.env.PILOT_WHITELIST_CONTRACT_ID;
    const savedPub = process.env.STELLAR_ADMIN_PUBLIC_KEY;
    const savedSec = process.env.STELLAR_ADMIN_SECRET;

    let originalSubmitApprove: typeof stellarService.submitWhitelistApprove;
    let originalSubmitRevoke: typeof stellarService.submitWhitelistRevoke;

    beforeEach(() => {
      process.env.OPERATIONS_BACKEND_CREDENTIAL = OPS_SECRET;
      process.env.PILOT_WHITELIST_CONTRACT_ID = TEST_CONTRACT_ID;
      process.env.STELLAR_ADMIN_PUBLIC_KEY = ADMIN_WALLET;
      process.env.STELLAR_ADMIN_SECRET = ADMIN_SECRET;
      originalSubmitApprove = stellarService.submitWhitelistApprove;
      originalSubmitRevoke = stellarService.submitWhitelistRevoke;
    });

    afterEach(() => {
      stellarService.submitWhitelistApprove = originalSubmitApprove;
      stellarService.submitWhitelistRevoke = originalSubmitRevoke;

      if (savedOps === undefined) delete process.env.OPERATIONS_BACKEND_CREDENTIAL;
      else process.env.OPERATIONS_BACKEND_CREDENTIAL = savedOps;
      if (savedContract === undefined) delete process.env.PILOT_WHITELIST_CONTRACT_ID;
      else process.env.PILOT_WHITELIST_CONTRACT_ID = savedContract;
      if (savedPub === undefined) delete process.env.STELLAR_ADMIN_PUBLIC_KEY;
      else process.env.STELLAR_ADMIN_PUBLIC_KEY = savedPub;
      if (savedSec === undefined) delete process.env.STELLAR_ADMIN_SECRET;
      else process.env.STELLAR_ADMIN_SECRET = savedSec;
    });

    afterAll(async () => {
      for (const wallet of createdWallets) {
        try {
          await db
            .delete(pilotWhitelistRequests)
            .where(eq(pilotWhitelistRequests.walletAddress, wallet));
        } catch {
          // ignore cleanup failure
        }
      }
      for (const id of createdRequestIds) {
        try {
          await db.delete(auditLog).where(eq(auditLog.entityId, id));
        } catch {
          // ignore cleanup failure
        }
      }
    });

    function buildApp() {
      return new Elysia().use(errorHandler).use(whitelistRoutes).use(internalOperationsRoutes);
    }

    it('records audit entries for approve, reject, and revoke, enforces status privacy, and allows resubmission', async () => {
      const app = buildApp();

      const approveMock = mock(async () => 'chain-approve-tx-hash');
      const revokeMock = mock(async () => 'chain-revoke-tx-hash');
      stellarService.submitWhitelistApprove = approveMock;
      stellarService.submitWhitelistRevoke = revokeMock;

      // 1. Submit request A -> approve -> revoke
      const walletA = randomWallet();
      createdWallets.push(walletA);

      const submitResA = await app.handle(
        new Request('http://localhost/pilot/whitelist/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: walletA,
            fullName: 'Investor Alpha',
            idType: 'passport',
            idReference: 'PASS-ALPHA',
          }),
        }),
      );
      expect(submitResA.status).toBe(200);
      const submitBodyA = (await submitResA.json()) as { data: { id: string } };
      const requestIdA = submitBodyA.data.id;
      createdRequestIds.push(requestIdA);

      // Revoking while still pending must return 4xx and never hit chain
      const prematureRevoke = await app.handle(
        new Request(`http://localhost/internal/operations/pilot/whitelist/${requestIdA}/revoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': OPS_SECRET,
          },
          body: JSON.stringify({ reason: 'Too early' }),
        }),
      );
      expect(prematureRevoke.status).toBe(409);
      expect(revokeMock).not.toHaveBeenCalled();

      // Approve request A
      const approveRes = await app.handle(
        new Request(`http://localhost/internal/operations/pilot/whitelist/${requestIdA}/review`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': OPS_SECRET,
            'x-operator-wallet': OPERATOR_WALLET,
          },
          body: JSON.stringify({ action: 'approve', reason: 'Documents verified' }),
        }),
      );
      expect(approveRes.status).toBe(200);
      expect(approveMock).toHaveBeenCalledTimes(1);

      // Simulate on-chain failure on revoke: row must stay approved and error must be returned
      stellarService.submitWhitelistRevoke = mock(async () => {
        throw new Error('Soroban simulation failed: ContractPaused');
      });
      const failedRevokeRes = await app.handle(
        new Request(`http://localhost/internal/operations/pilot/whitelist/${requestIdA}/revoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': OPS_SECRET,
            'x-operator-wallet': OPERATOR_WALLET,
          },
          body: JSON.stringify({ reason: 'Compliance revocation' }),
        }),
      );
      expect(failedRevokeRes.status).toBe(502);
      const failedRevokeBody = (await failedRevokeRes.json()) as { message: string };
      expect(failedRevokeBody.message).toContain('ContractPaused');

      const [stillApproved] = await db
        .select()
        .from(pilotWhitelistRequests)
        .where(eq(pilotWhitelistRequests.id, requestIdA));
      expect(stillApproved?.status).toBe('approved');
      expect(stillApproved?.revocationReason).toBeNull();
      expect(stillApproved?.revokedAt).toBeNull();

      // Restore working chain mock and revoke request A
      stellarService.submitWhitelistRevoke = revokeMock;
      const revokeRes = await app.handle(
        new Request(`http://localhost/internal/operations/pilot/whitelist/${requestIdA}/revoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': OPS_SECRET,
            'x-operator-wallet': OPERATOR_WALLET,
          },
          body: JSON.stringify({ reason: 'Sanctions screening match' }),
        }),
      );
      expect(revokeRes.status).toBe(200);
      const revokeBody = (await revokeRes.json()) as { success: boolean; txHash: string };
      expect(revokeBody).toEqual({ success: true, txHash: 'chain-revoke-tx-hash' });
      expect(revokeMock).toHaveBeenCalledTimes(1);

      const [revokedRow] = await db
        .select()
        .from(pilotWhitelistRequests)
        .where(eq(pilotWhitelistRequests.id, requestIdA));
      expect(revokedRow?.status).toBe('revoked');
      expect(revokedRow?.revocationReason).toBe('Sanctions screening match');
      expect(revokedRow?.revokedAt).toBeInstanceOf(Date);
      expect(revokedRow?.reviewedAt).toBeInstanceOf(Date);

      // Revoking an already revoked request must return 4xx, not 500
      const doubleRevokeRes = await app.handle(
        new Request(`http://localhost/internal/operations/pilot/whitelist/${requestIdA}/revoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': OPS_SECRET,
          },
          body: JSON.stringify({ reason: 'Duplicate revoke' }),
        }),
      );
      expect(doubleRevokeRes.status).toBe(409);
      expect(revokeMock).toHaveBeenCalledTimes(1);

      // Status endpoint: unauthenticated caller sees status=revoked without reason
      const publicStatusRes = await app.handle(
        new Request(`http://localhost/pilot/whitelist/status/${walletA}`),
      );
      expect(publicStatusRes.status).toBe(200);
      const publicStatus = (await publicStatusRes.json()) as Record<string, unknown>;
      expect(publicStatus.status).toBe('revoked');
      expect(publicStatus.revocationReason).toBeUndefined();
      expect(publicStatus.rejectionReason).toBeUndefined();

      // Status endpoint: another wallet's JWT also does not see revocationReason
      const otherToken = jwt.sign({ id: 'other-user', walletAddress: randomWallet() }, JWT_SECRET);
      const otherStatusRes = await app.handle(
        new Request(`http://localhost/pilot/whitelist/status/${walletA}`, {
          headers: { Authorization: `Bearer ${otherToken}` },
        }),
      );
      const otherStatus = (await otherStatusRes.json()) as Record<string, unknown>;
      expect(otherStatus.status).toBe('revoked');
      expect(otherStatus.revocationReason).toBeUndefined();

      // Status endpoint: owner JWT sees revocationReason
      const ownerToken = jwt.sign({ id: 'owner-user', walletAddress: walletA }, JWT_SECRET);
      const ownerStatusRes = await app.handle(
        new Request(`http://localhost/pilot/whitelist/status/${walletA}`, {
          headers: { Authorization: `Bearer ${ownerToken}` },
        }),
      );
      const ownerStatus = (await ownerStatusRes.json()) as Record<string, unknown>;
      expect(ownerStatus.status).toBe('revoked');
      expect(ownerStatus.revocationReason).toBe('Sanctions screening match');

      // Status endpoint: operator credential sees revocationReason
      const operatorStatusRes = await app.handle(
        new Request(`http://localhost/pilot/whitelist/status/${walletA}`, {
          headers: { 'x-internal-api-key': OPS_SECRET },
        }),
      );
      const operatorStatus = (await operatorStatusRes.json()) as Record<string, unknown>;
      expect(operatorStatus.status).toBe('revoked');
      expect(operatorStatus.revocationReason).toBe('Sanctions screening match');

      // Revoked wallet can submit a fresh whitelist request
      const resubmitRes = await app.handle(
        new Request('http://localhost/pilot/whitelist/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: walletA,
            fullName: 'Investor Alpha Cleared',
            idType: 'passport',
            idReference: 'PASS-ALPHA-2',
          }),
        }),
      );
      expect(resubmitRes.status).toBe(200);
      const resubmitBody = (await resubmitRes.json()) as {
        data: { id: string; status: string };
      };
      expect(resubmitBody.data.status).toBe('pending');
      createdRequestIds.push(resubmitBody.data.id);

      // 2. Submit request B -> reject -> attempt revoke (must return 4xx)
      const walletB = randomWallet();
      createdWallets.push(walletB);
      const submitResB = await app.handle(
        new Request('http://localhost/pilot/whitelist/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: walletB,
            fullName: 'Investor Beta',
            idType: 'national_id',
            idReference: 'NAT-BETA',
          }),
        }),
      );
      const submitBodyB = (await submitResB.json()) as { data: { id: string } };
      const requestIdB = submitBodyB.data.id;
      createdRequestIds.push(requestIdB);

      const rejectRes = await app.handle(
        new Request(`http://localhost/internal/operations/pilot/whitelist/${requestIdB}/review`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': OPS_SECRET,
            'x-operator-wallet': OPERATOR_WALLET,
          },
          body: JSON.stringify({ action: 'reject', reason: 'Expired passport' }),
        }),
      );
      expect(rejectRes.status).toBe(200);

      const revokeRejectedRes = await app.handle(
        new Request(`http://localhost/internal/operations/pilot/whitelist/${requestIdB}/revoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': OPS_SECRET,
          },
          body: JSON.stringify({ reason: 'Cannot revoke rejected' }),
        }),
      );
      expect(revokeRejectedRes.status).toBe(409);

      // 3. Verify all three operator actions wrote audit_log rows with action, wallet, and reason
      const logsA = await db.select().from(auditLog).where(eq(auditLog.entityId, requestIdA));
      const actionsA = logsA.map((entry) => entry.action).sort();
      expect(actionsA).toEqual(['whitelist.approve', 'whitelist.revoke']);

      const approveAudit = logsA.find((entry) => entry.action === 'whitelist.approve');
      expect(approveAudit?.actor).toBe(OPERATOR_WALLET);
      expect(approveAudit?.metadata).toEqual({
        walletAddress: walletA,
        reason: 'Documents verified',
        txHash: 'chain-approve-tx-hash',
      });

      const revokeAudit = logsA.find((entry) => entry.action === 'whitelist.revoke');
      expect(revokeAudit?.actor).toBe(OPERATOR_WALLET);
      expect(revokeAudit?.metadata).toEqual({
        walletAddress: walletA,
        reason: 'Sanctions screening match',
        txHash: 'chain-revoke-tx-hash',
      });

      const logsB = await db.select().from(auditLog).where(eq(auditLog.entityId, requestIdB));
      expect(logsB).toHaveLength(1);
      expect(logsB[0]?.action).toBe('whitelist.reject');
      expect(logsB[0]?.actor).toBe(OPERATOR_WALLET);
      expect(logsB[0]?.metadata).toEqual({
        walletAddress: walletB,
        reason: 'Expired passport',
      });
    });

    it('applies the revoke migration cleanly on a table that already contains rows', async () => {
      const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
      const schemaName = `mig_test_${Date.now()}`;

      try {
        await sql.unsafe(`CREATE SCHEMA "${schemaName}"`);
        await sql.unsafe(`
          CREATE TYPE "${schemaName}"."pilot_whitelist_id_type" AS ENUM('passport', 'national_id', 'drivers_license');
          CREATE TYPE "${schemaName}"."pilot_whitelist_status" AS ENUM('pending', 'approved', 'rejected');
          CREATE TABLE "${schemaName}"."pilot_whitelist_requests" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "wallet_address" varchar(56) NOT NULL UNIQUE,
            "full_name" varchar(255) NOT NULL,
            "id_type" "${schemaName}"."pilot_whitelist_id_type" NOT NULL,
            "id_reference" varchar(255) NOT NULL,
            "status" "${schemaName}"."pilot_whitelist_status" DEFAULT 'pending' NOT NULL,
            "rejection_reason" text,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL,
            "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
            "reviewed_at" timestamp with time zone
          );
        `);

        // Seed existing rows in every pre-migration state before applying 0018 statements
        const walletPending = randomWallet();
        const walletApproved = randomWallet();
        const walletRejected = randomWallet();

        await sql.unsafe(
          `INSERT INTO "${schemaName}"."pilot_whitelist_requests" ("wallet_address", "full_name", "id_type", "id_reference", "status")
           VALUES ($1, 'Pending Row', 'passport', 'REF-1', 'pending'),
                  ($2, 'Approved Row', 'national_id', 'REF-2', 'approved'),
                  ($3, 'Rejected Row', 'drivers_license', 'REF-3', 'rejected')`,
          [walletPending, walletApproved, walletRejected],
        );

        const migrationFile = await Bun.file(
          new URL('../../drizzle/migrations/0018_whitelist_revoke_status.sql', import.meta.url),
        ).text();
        const scopedSql = migrationFile
          .replaceAll('"public".', `"${schemaName}".`)
          .replaceAll('"pilot_whitelist_requests"', `"${schemaName}"."pilot_whitelist_requests"`)
          .split('--> statement-breakpoint')
          .map((stmt) => stmt.trim())
          .filter(Boolean);

        for (const statement of scopedSql) {
          await sql.unsafe(statement);
        }

        await sql.unsafe(
          `UPDATE "${schemaName}"."pilot_whitelist_requests"
           SET "status" = 'revoked', "revocation_reason" = 'Revoked after migration', "revoked_at" = now()
           WHERE "wallet_address" = $1`,
          [walletApproved],
        );

        const rows = await sql.unsafe<
          Array<{ wallet_address: string; status: string; revocation_reason: string | null }>
        >(
          `SELECT "wallet_address", "status", "revocation_reason"
           FROM "${schemaName}"."pilot_whitelist_requests"
           ORDER BY "id_reference" ASC`,
        );

        expect([...rows]).toEqual([
          { wallet_address: walletPending, status: 'pending', revocation_reason: null },
          {
            wallet_address: walletApproved,
            status: 'revoked',
            revocation_reason: 'Revoked after migration',
          },
          { wallet_address: walletRejected, status: 'rejected', revocation_reason: null },
        ]);
      } finally {
        await sql.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        await sql.end();
      }
    });
  },
);
