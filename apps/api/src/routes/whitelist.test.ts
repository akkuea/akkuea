import { describe, expect, it, mock, beforeEach, afterEach, spyOn } from 'bun:test';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import Elysia from 'elysia';
import { db } from '../db';
import { errorHandler } from '../middleware/errorHandler';
import { stellarService } from '../services/StellarService';
import { whitelistRoutes } from './whitelist';

// Setup a minimal app for testing routes
import { internalOperationsRoutes } from './internalOperations';
const testApp = new Elysia().use(errorHandler).use(whitelistRoutes).use(internalOperationsRoutes);

process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-secret';

interface StoredRequest {
  id: string;
  walletAddress: string;
  fullName?: string;
  idType?: string;
  idReference?: string;
  status: string;
  rejectionReason?: string;
  createdAt?: Date;
  reviewedAt?: Date;
}

interface ErrorBody {
  success: boolean;
  error: string;
  message: string;
  statusCode: number;
}

/**
 * Collects the string parameters bound in a Drizzle SQL expression. The
 * controller and service query whitelist rows by either wallet address or id,
 * and both arrive as bound parameters, so the mock store can resolve the row
 * without modelling Drizzle's query builder.
 */
function collectParamValues(value: unknown, acc: string[] = []): string[] {
  if (value == null || typeof value !== 'object') return acc;

  if (Array.isArray(value)) {
    for (const item of value) collectParamValues(item, acc);
    return acc;
  }

  const candidate = value as { value?: unknown; queryChunks?: unknown[] };
  if (typeof candidate.value === 'string') acc.push(candidate.value);
  if (Array.isArray(candidate.queryChunks)) {
    for (const chunk of candidate.queryChunks) collectParamValues(chunk, acc);
  }
  return acc;
}

function matchesWhere(row: StoredRequest, where: unknown): boolean {
  const values = collectParamValues(where);
  return values.includes(row.walletAddress) || values.includes(row.id);
}

describe('Whitelist API Routes', () => {
  let mockDbStore: StoredRequest[] = [];
  let adminKeypair: Keypair;
  const originalEnv = {
    WHITELIST_CONTRACT_ID: process.env.WHITELIST_CONTRACT_ID,
    STELLAR_ADMIN_PUBLIC_KEY: process.env.STELLAR_ADMIN_PUBLIC_KEY,
    STELLAR_ADMIN_SECRET: process.env.STELLAR_ADMIN_SECRET,
  };

  /** A fresh, checksum-valid Stellar public key for each request. */
  function newWallet(): string {
    return Keypair.random().publicKey();
  }

  beforeEach(() => {
    mockDbStore = [];
    adminKeypair = Keypair.random();
    process.env.WHITELIST_CONTRACT_ID = 'CDQYJRBYP62Y2BSMDEUBJYM2I4V3JE2RL7TCR3JPTW42NRLUXWKUS3MZ';
    process.env.STELLAR_ADMIN_PUBLIC_KEY = adminKeypair.publicKey();
    process.env.STELLAR_ADMIN_SECRET = adminKeypair.secret();

    // The happy path for approve calls the on-chain service; stub only that
    // out so the real WhitelistService database logic still runs.
    spyOn(stellarService, 'submitWhitelistApprove').mockResolvedValue('mock_tx_hash');
    spyOn(stellarService, 'submitWhitelistRevoke').mockResolvedValue('mock_revoke_tx_hash');

    // Mock db queries
    (db as unknown as Record<string, unknown>).query = {
      pilotWhitelistRequests: {
        findFirst: mock(async ({ where, orderBy }: { where?: unknown; orderBy?: unknown }) => {
          const matches = mockDbStore.filter((row) => matchesWhere(row, where));
          if (orderBy) {
            matches.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
          }
          return matches[0];
        }),
        findMany: mock(async () => mockDbStore),
      },
    };

    (db as unknown as Record<string, unknown>).insert = mock(() => ({
      values: (val: Omit<StoredRequest, 'id'>) => ({
        returning: async () => {
          const inserted: StoredRequest = {
            id: `test_id_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            ...val,
          };
          mockDbStore.push(inserted);
          return [inserted];
        },
      }),
    }));

    (db as unknown as Record<string, unknown>).update = mock(() => ({
      set: (val: Partial<StoredRequest>) => ({
        where: (whereExpr: unknown) => {
          const updated: StoredRequest[] = [];
          for (const row of mockDbStore) {
            if (matchesWhere(row, whereExpr)) {
              Object.assign(row, val);
              updated.push(row);
            }
          }
          return {
            returning: async () => updated,
            then: (resolve: (arg: unknown) => void) => resolve(updated),
          };
        },
      }),
    }));
  });

  afterEach(() => {
    mock.restore();
    // Direct property assignment on the db Proxy mutates _dbTarget, which
    // persists across test files in the same bun process. mock.restore()
    // only undoes mock() calls, not these mutations, so delete them
    // unconditionally: beforeEach always re-populates them from scratch,
    // so there's no prior legitimate state to preserve.
    for (const prop of ['query', 'insert', 'update', 'delete']) {
      delete (db as unknown as Record<string, unknown>)[prop];
    }

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  function postRequest(body: Record<string, unknown>) {
    return testApp.handle(
      new Request('http://localhost/pilot/whitelist/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  }

  function validRequest(walletAddress: string, fullName = 'Test User') {
    return {
      walletAddress,
      fullName,
      idType: 'passport',
      idReference: 'A1234567',
    };
  }

  function review(id: string, body: Record<string, unknown>) {
    return testApp.handle(
      new Request(`http://localhost/internal/operations/pilot/whitelist/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-api-key': 'test-secret' },
        body: JSON.stringify(body),
      }),
    );
  }

  it('should submit a new whitelist request successfully', async () => {
    const wallet = newWallet();

    const response = await postRequest(validRequest(wallet));

    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      success: boolean;
      data: StoredRequest;
    };
    expect(result.success).toBe(true);
    expect(result.data.walletAddress).toBe(wallet);
    expect(result.data.status).toBe('pending');
    expect(mockDbStore.length).toBe(1);
  });

  it('returns 409 with a showable message for a second request on a pending wallet', async () => {
    const wallet = newWallet();
    mockDbStore.push({ id: 'existing_id', walletAddress: wallet, status: 'pending' });

    const response = await postRequest(validRequest(wallet));

    expect(response.status).toBe(409);
    const result = (await response.json()) as ErrorBody;
    expect(result.success).toBe(false);
    expect(result.error).toBe('CONFLICT');
    expect(result.message).toContain('already pending');
    expect(mockDbStore.length).toBe(1);
  });

  it('returns 409 for a request on an already approved wallet', async () => {
    const wallet = newWallet();
    mockDbStore.push({ id: 'approved_id', walletAddress: wallet, status: 'approved' });

    const response = await postRequest(validRequest(wallet));

    expect(response.status).toBe(409);
    const result = (await response.json()) as ErrorBody;
    expect(result.error).toBe('CONFLICT');
    expect(result.message).toContain('already whitelisted');
  });

  it('rejects a non-key string with 400', async () => {
    const response = await postRequest(validRequest('not-a-key'));

    expect(response.status).toBe(400);
    const result = (await response.json()) as ErrorBody;
    expect(result.success).toBe(false);
    expect(mockDbStore.length).toBe(0);
  });

  it('rejects a 56-character string with a bad checksum with 400', async () => {
    const validWallet = newWallet();
    const badChecksum = `${validWallet.slice(0, -1)}${validWallet.endsWith('A') ? 'B' : 'A'}`;
    expect(badChecksum).toHaveLength(56);

    const response = await postRequest(validRequest(badChecksum));

    expect(response.status).toBe(400);
    const result = (await response.json()) as ErrorBody;
    expect(result.success).toBe(false);
    expect(mockDbStore.length).toBe(0);
  });

  it('rejects a contract address (C...) with 400', async () => {
    const contractAddress = StrKey.encodeContract(Keypair.random().rawPublicKey());
    expect(contractAddress.startsWith('C')).toBe(true);
    expect(contractAddress).toHaveLength(56);

    const response = await postRequest(validRequest(contractAddress));

    expect(response.status).toBe(400);
    const result = (await response.json()) as ErrorBody;
    expect(result.success).toBe(false);
    expect(mockDbStore.length).toBe(0);
  });

  it('keeps the rejected record when the wallet submits a new request', async () => {
    const wallet = newWallet();
    mockDbStore.push({
      id: 'old_rejected_id',
      walletAddress: wallet,
      status: 'rejected',
      fullName: 'Old Submission',
      idType: 'passport',
      idReference: 'OLD123',
      rejectionReason: 'Document illegible',
    });

    const response = await postRequest(validRequest(wallet, 'New Submission'));

    expect(response.status).toBe(200);
    const result = (await response.json()) as { success: boolean; data: StoredRequest };
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('pending');
    expect(result.data.fullName).toBe('New Submission');

    const requestsForWallet = mockDbStore.filter((row) => row.walletAddress === wallet);
    expect(requestsForWallet.length).toBe(2);

    const rejected = requestsForWallet.find((row) => row.id === 'old_rejected_id');
    expect(rejected).toBeDefined();
    expect(rejected?.status).toBe('rejected');
    expect(rejected?.rejectionReason).toBe('Document illegible');
  });

  it('rejects a status lookup for an invalid Stellar address with 400', async () => {
    const response = await testApp.handle(
      new Request('http://localhost/pilot/whitelist/status/not-a-key'),
    );

    expect(response.status).toBe(400);
    const result = (await response.json()) as ErrorBody;
    expect(result.success).toBe(false);
  });

  it('rejects a status lookup for a bad-checksum address with 400', async () => {
    const validWallet = newWallet();
    const badChecksum = `${validWallet.slice(0, -1)}${validWallet.endsWith('A') ? 'B' : 'A'}`;

    const response = await testApp.handle(
      new Request(`http://localhost/pilot/whitelist/status/${badChecksum}`),
    );

    expect(response.status).toBe(400);
    const result = (await response.json()) as ErrorBody;
    expect(result.error).toBe('BAD_REQUEST');
  });

  it('returns the newest request status after a rejected request was resubmitted', async () => {
    const wallet = newWallet();
    mockDbStore.push({
      id: 'old_rejected_id',
      walletAddress: wallet,
      status: 'rejected',
      rejectionReason: 'Document illegible',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
    mockDbStore.push({
      id: 'new_pending_id',
      walletAddress: wallet,
      status: 'pending',
      createdAt: new Date('2026-02-01T00:00:00Z'),
    });

    const response = await testApp.handle(
      new Request(`http://localhost/pilot/whitelist/status/${wallet}`),
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as {
      success: boolean;
      status: string;
      rejectionReason?: string;
    };
    expect(result.status).toBe('pending');
    expect(result.rejectionReason).toBeUndefined();
  });

  it('still returns the status for a valid wallet', async () => {
    const wallet = newWallet();

    const response = await testApp.handle(
      new Request(`http://localhost/pilot/whitelist/status/${wallet}`),
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as { success: boolean; status: string };
    expect(result.success).toBe(true);
    expect(result.status).toBe('none');
  });

  it('should fetch pending requests', async () => {
    mockDbStore.push({
      id: 'pending_id',
      walletAddress: newWallet(),
      status: 'pending',
    });

    const response = await testApp.handle(
      new Request('http://localhost/internal/operations/pilot/whitelist/pending', {
        method: 'GET',
        headers: { 'x-internal-api-key': 'test-secret' },
      }),
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as { success: boolean; data: unknown[] };
    expect(result.success).toBe(true);
    expect(result.data.length).toBe(1);
  });

  it('should approve a request', async () => {
    const wallet = newWallet();
    mockDbStore.push({ id: 'req_id_1', walletAddress: wallet, status: 'pending' });

    const response = await review('req_id_1', { action: 'approve' });

    expect(response.status).toBe(200);
    const result = (await response.json()) as { success: boolean; txHash: string };
    expect(result.success).toBe(true);
    expect(result.txHash).toBe('mock_tx_hash');
    expect(stellarService.submitWhitelistApprove).toHaveBeenCalledWith(
      process.env.WHITELIST_CONTRACT_ID as string,
      adminKeypair.publicKey(),
      adminKeypair.secret(),
      wallet,
    );
    expect(mockDbStore[0]?.status).toBe('approved');
  });

  it('returns 404 when reviewing an unknown request id', async () => {
    const response = await review('unknown-id', { action: 'approve' });

    expect(response.status).toBe(404);
    const result = (await response.json()) as ErrorBody;
    expect(result.success).toBe(false);
    expect(result.error).toBe('NOT_FOUND');
    expect(result.message).toContain('not found');
  });

  it('returns 409 when approving an already approved request', async () => {
    mockDbStore.push({ id: 'approved_id', walletAddress: newWallet(), status: 'approved' });

    const response = await review('approved_id', { action: 'approve' });

    expect(response.status).toBe(409);
    const result = (await response.json()) as ErrorBody;
    expect(result.error).toBe('CONFLICT');
    expect(result.message).toContain('already approved');
  });

  it('returns 400 when rejecting without a reason', async () => {
    mockDbStore.push({ id: 'pending_id', walletAddress: newWallet(), status: 'pending' });

    const response = await review('pending_id', { action: 'reject' });

    expect(response.status).toBe(400);
    const result = (await response.json()) as ErrorBody;
    expect(result.error).toBe('BAD_REQUEST');
    expect(result.message).toContain('reason is required');
    expect(mockDbStore[0]?.status).toBe('pending');
  });

  it('records the rejection reason when rejecting a pending request', async () => {
    mockDbStore.push({ id: 'pending_id', walletAddress: newWallet(), status: 'pending' });

    const response = await review('pending_id', {
      action: 'reject',
      reason: 'Document illegible',
    });

    expect(response.status).toBe(200);
    expect(mockDbStore[0]?.status).toBe('rejected');
    expect(mockDbStore[0]?.rejectionReason).toBe('Document illegible');
    expect(mockDbStore[0]?.reviewedAt).toBeDefined();
  });

  it('returns 400 for an invalid review action', async () => {
    mockDbStore.push({ id: 'pending_id', walletAddress: newWallet(), status: 'pending' });

    const response = await review('pending_id', { action: 'hold' });

    expect(response.status).toBe(400);
    const result = (await response.json()) as ErrorBody;
    expect(result.success).toBe(false);
  });

  it('should revoke a request via /review with action=revoke', async () => {
    const wallet = newWallet();
    mockDbStore.push({ id: 'approved_req_1', walletAddress: wallet, status: 'approved' });

    const response = await review('approved_req_1', {
      action: 'revoke',
      reason: 'Sanctions violation',
    });

    expect(response.status).toBe(200);
    const result = (await response.json()) as { success: boolean; txHash: string };
    expect(result.success).toBe(true);
    expect(result.txHash).toBe('mock_revoke_tx_hash');
    expect(stellarService.submitWhitelistRevoke).toHaveBeenCalledWith(
      process.env.WHITELIST_CONTRACT_ID as string,
      adminKeypair.publicKey(),
      adminKeypair.secret(),
      wallet,
    );
    expect(mockDbStore[0]?.status).toBe('revoked');
    expect(mockDbStore[0]?.rejectionReason).toBe('Sanctions violation');
  });

  it('should revoke a request via dedicated POST /:id/revoke', async () => {
    const wallet = newWallet();
    mockDbStore.push({ id: 'approved_req_2', walletAddress: wallet, status: 'approved' });

    const response = await testApp.handle(
      new Request('http://localhost/internal/operations/pilot/whitelist/approved_req_2/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': 'test-secret',
          'x-operator-wallet': 'GBU54MOHX7J3F2C2X4R56Y7PZZY4QJ6GZ46X34PXZY2C46Y7PZZY4QJ6',
        },
        body: JSON.stringify({ reason: 'Compliance audit failed' }),
      }),
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as { success: boolean; txHash: string };
    expect(result.success).toBe(true);
    expect(result.txHash).toBe('mock_revoke_tx_hash');
    expect(mockDbStore[0]?.status).toBe('revoked');
    expect(mockDbStore[0]?.rejectionReason).toBe('Compliance audit failed');
  });

  it('allows resubmission after revocation without deleting the revoked record', async () => {
    const revokeWallet = newWallet();
    mockDbStore.push({
      id: 'old_revoked_id',
      walletAddress: revokeWallet,
      status: 'revoked',
      rejectionReason: 'Sanctions list match',
      fullName: 'Old Revoked Submission',
      idType: 'passport',
      idReference: 'REVOKED123',
    });

    const response = await postRequest(validRequest(revokeWallet, 'New Submission After Revoke'));

    expect(response.status).toBe(200);
    const result = (await response.json()) as { success: boolean; data: StoredRequest };
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('pending');
    expect(result.data.fullName).toBe('New Submission After Revoke');

    // Both the new pending request and the historical revoked row exist
    const requestsForWallet = mockDbStore.filter((r) => r.walletAddress === revokeWallet);
    expect(requestsForWallet.length).toBe(2);
    const revoked = requestsForWallet.find((r) => r.id === 'old_revoked_id');
    expect(revoked).toBeDefined();
    expect(revoked?.status).toBe('revoked');
  });

  describe('Revocation 4xx error cases', () => {
    const errorCases = [
      { status: 'pending', label: 'pending request' },
      { status: 'rejected', label: 'rejected request' },
      { status: 'revoked', label: 'already revoked request' },
    ];

    for (const { status, label } of errorCases) {
      it(`POST /:id/revoke returns 4xx for a ${label}`, async () => {
        const wallet = newWallet();
        mockDbStore.push({ id: `req_${status}_1`, walletAddress: wallet, status });

        const response = await testApp.handle(
          new Request(
            `http://localhost/internal/operations/pilot/whitelist/req_${status}_1/revoke`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-api-key': 'test-secret',
              },
              body: JSON.stringify({ reason: 'Compliance issue' }),
            },
          ),
        );

        expect(response.status).toBe(400);
        const result = (await response.json()) as ErrorBody;
        expect(result.success).toBe(false);
      });

      it(`POST /:id/review with action=revoke returns 4xx for a ${label}`, async () => {
        const wallet = newWallet();
        mockDbStore.push({ id: `req_${status}_review`, walletAddress: wallet, status });

        const response = await review(`req_${status}_review`, {
          action: 'revoke',
          reason: 'Compliance issue',
        });

        expect(response.status).toBe(400);
        const result = (await response.json()) as ErrorBody;
        expect(result.success).toBe(false);
      });
    }

    it('POST /:id/revoke returns 404 for a missing request', async () => {
      const response = await testApp.handle(
        new Request('http://localhost/internal/operations/pilot/whitelist/nonexistent_id/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': 'test-secret',
          },
          body: JSON.stringify({ reason: 'Compliance issue' }),
        }),
      );

      expect(response.status).toBe(404);
      const result = (await response.json()) as ErrorBody;
      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_FOUND');
    });

    it('POST /:id/review with action=revoke returns 404 for a missing request', async () => {
      const response = await review('nonexistent_id', {
        action: 'revoke',
        reason: 'Compliance issue',
      });

      expect(response.status).toBe(404);
      const result = (await response.json()) as ErrorBody;
      expect(result.success).toBe(false);
      expect(result.error).toBe('NOT_FOUND');
    });
  });
});
