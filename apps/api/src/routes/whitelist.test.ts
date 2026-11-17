/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test';
import { db } from '../db';
import { whitelistService, WhitelistService } from '../services/WhitelistService';
import Elysia from 'elysia';
import { whitelistRoutes } from './whitelist';
import { internalOperationsRoutes } from './internalOperations';
import { errorHandler } from '../middleware/errorHandler';
import { NotFoundError, ConflictError } from '../utils/errors';

// Setup a minimal app for testing routes with global error handler
const testApp = new Elysia().use(errorHandler).use(whitelistRoutes).use(internalOperationsRoutes);

process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-secret';

describe('Whitelist API Routes', () => {
  // Valid Stellar Ed25519 public keys
  const mockWallet = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
  const resubmitWallet = 'GDNZ5UQ7KH7ETZPT64LYI2BTDAR6ST7CTO7GE7EER4HGDTAZTXARFC7I';

  // Invalid wallet address test vectors
  const notAKey = 'not-a-key';
  const badChecksum56 = 'GA' + 'A'.repeat(54);
  const contractAddress = 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526';

  let mockDbStore: any[] = [];

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

  beforeEach(() => {
    mockDbStore = [];

    // Mock whitelist service for route-level tests
    mock.module('../services/WhitelistService', () => {
      return {
        whitelistService: {
          approveRequest: mock(async (id: string) => {
            if (id === 'unknown_id') {
              throw new NotFoundError('Whitelist request not found');
            }
            return 'mock_tx_hash';
          }),
          rejectRequest: mock(async (id: string, reason: string) => {
            if (id === 'unknown_id') {
              throw new NotFoundError('Whitelist request not found');
            }
            if (!reason) {
              throw new Error('Rejection reason is required');
            }
            return;
          }),
        },
        WhitelistService,
      };
    });

    // Mock db queries
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
            id: `test_id_${Date.now()}_${Math.random().toString(36).slice(2)}`,
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
          if (mockDbStore.length > 0) {
            Object.assign(mockDbStore[0], val);
          }
        },
      }),
    }));

    (db as any).delete = mock(() => ({
      where: async () => {
        // Deletions should not happen during re-submission anymore
      },
    }));
  });

  afterEach(() => {
    mock.restore();
    for (const prop of ['query', 'insert', 'update', 'delete']) {
      delete (db as any)[prop];
    }
  });

  it('should submit a new whitelist request successfully', async () => {
    const response = await testApp.handle(
      new Request('http://localhost/pilot/whitelist/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

  it('should return 409 when submitting a duplicate request for a pending wallet', async () => {
    mockDbStore.push({
      id: 'existing_pending_id',
      walletAddress: mockWallet,
      status: 'pending',
      createdAt: new Date(),
    });

    const response = await testApp.handle(
      new Request('http://localhost/pilot/whitelist/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: mockWallet,
          fullName: 'Test User 2',
          idType: 'national_id',
          idReference: 'B7654321',
        }),
      }),
    );

    expect(response.status).toBe(409);
    const result = (await response.json()) as any;
    expect(result.success).toBe(false);
    expect(result.error).toBe('CONFLICT');
    expect(result.message).toBe('A whitelist request is already pending for this address');
  });

  it('should return 409 when submitting a request for an already approved wallet', async () => {
    mockDbStore.push({
      id: 'existing_approved_id',
      walletAddress: mockWallet,
      status: 'approved',
      createdAt: new Date(),
    });

    const response = await testApp.handle(
      new Request('http://localhost/pilot/whitelist/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: mockWallet,
          fullName: 'Test User 3',
          idType: 'passport',
          idReference: 'C1234567',
        }),
      }),
    );

    expect(response.status).toBe(409);
    const result = (await response.json()) as any;
    expect(result.success).toBe(false);
    expect(result.error).toBe('CONFLICT');
    expect(result.message).toBe('This address is already whitelisted');
  });

  describe('Stellar address validation (400 rejection)', () => {
    it('should reject not-a-key with 400 on request route', async () => {
      const response = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: notAKey,
            fullName: 'Invalid Key',
            idType: 'passport',
            idReference: 'INV1',
          }),
        }),
      );
      expect(response.status).toBe(400);
      const result = (await response.json()) as any;
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('should reject 56-character string with bad checksum with 400 on request route', async () => {
      const response = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: badChecksum56,
            fullName: 'Bad Checksum',
            idType: 'passport',
            idReference: 'INV2',
          }),
        }),
      );
      expect(response.status).toBe(400);
      const result = (await response.json()) as any;
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('should reject contract address (C...) with 400 on request route', async () => {
      const response = await testApp.handle(
        new Request('http://localhost/pilot/whitelist/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: contractAddress,
            fullName: 'Contract Address',
            idType: 'passport',
            idReference: 'INV3',
          }),
        }),
      );
      expect(response.status).toBe(400);
      const result = (await response.json()) as any;
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('should reject not-a-key with 400 on status route', async () => {
      const response = await testApp.handle(
        new Request(`http://localhost/pilot/whitelist/status/${notAKey}`, {
          method: 'GET',
        }),
      );
      expect(response.status).toBe(400);
      const result = (await response.json()) as any;
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('should reject 56-character string with bad checksum with 400 on status route', async () => {
      const response = await testApp.handle(
        new Request(`http://localhost/pilot/whitelist/status/${badChecksum56}`, {
          method: 'GET',
        }),
      );
      expect(response.status).toBe(400);
      const result = (await response.json()) as any;
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
    });

    it('should reject contract address (C...) with 400 on status route', async () => {
      const response = await testApp.handle(
        new Request(`http://localhost/pilot/whitelist/status/${contractAddress}`, {
          method: 'GET',
        }),
      );
      expect(response.status).toBe(400);
      const result = (await response.json()) as any;
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
    });
  });

  it('should allow resubmission after rejection and retain rejected history', async () => {
    // Seed a rejected request for this wallet
    mockDbStore.push({
      id: 'old_rejected_id',
      walletAddress: resubmitWallet,
      status: 'rejected',
      fullName: 'Old Submission',
      idType: 'passport',
      idReference: 'OLD123',
      rejectionReason: 'Document blurred',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    const response = await testApp.handle(
      new Request('http://localhost/pilot/whitelist/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

    // Both the new request and the old rejected request must still exist
    const requestsForWallet = mockDbStore.filter((r) => r.walletAddress === resubmitWallet);
    expect(requestsForWallet.length).toBe(2);

    const oldRecord = requestsForWallet.find((r) => r.id === 'old_rejected_id');
    expect(oldRecord).toBeDefined();
    expect(oldRecord.status).toBe('rejected');
    expect(oldRecord.rejectionReason).toBe('Document blurred');

    const newRecord = requestsForWallet.find((r) => r.id !== 'old_rejected_id');
    expect(newRecord).toBeDefined();
    expect(newRecord.status).toBe('pending');
  });

  it('should fetch pending requests', async () => {
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

  it('should review a request successfully', async () => {
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
    expect(whitelistService.approveRequest).toHaveBeenCalledWith('req_id_1');
  });

  it('should return 404 when reviewing an unknown id', async () => {
    const response = await testApp.handle(
      new Request('http://localhost/internal/operations/pilot/whitelist/unknown_id/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-api-key': 'test-secret' },
        body: JSON.stringify({ action: 'approve' }),
      }),
    );

    expect(response.status).toBe(404);
    const result = (await response.json()) as any;
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(404);
    expect(result.error).toBe('NOT_FOUND');
  });

  it('should return 400 when reviewing with reject action and missing reason', async () => {
    const response = await testApp.handle(
      new Request('http://localhost/internal/operations/pilot/whitelist/req_id_1/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-api-key': 'test-secret' },
        body: JSON.stringify({ action: 'reject' }),
      }),
    );

    expect(response.status).toBe(400);
    const result = (await response.json()) as any;
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(400);
    expect(result.message).toBe('Rejection reason is required');
  });

  describe('WhitelistService unit tests', () => {
    it('should throw NotFoundError when approving an unknown request id', async () => {
      const service = new WhitelistService();
      await expect(service.approveRequest('non_existent_id')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when rejecting an unknown request id', async () => {
      const service = new WhitelistService();
      await expect(service.rejectRequest('non_existent_id', 'Some reason')).rejects.toThrow(
        NotFoundError,
      );
    });

    it('should throw ConflictError when approving an already approved request', async () => {
      mockDbStore.push({
        id: 'already_approved_id',
        walletAddress: mockWallet,
        status: 'approved',
      });
      const service = new WhitelistService();
      await expect(service.approveRequest('already_approved_id')).rejects.toThrow(ConflictError);
    });

    it('should throw ConflictError when rejecting an already approved request', async () => {
      mockDbStore.push({
        id: 'already_approved_id',
        walletAddress: mockWallet,
        status: 'approved',
      });
      const service = new WhitelistService();
      await expect(
        service.rejectRequest('already_approved_id', 'Cannot reject'),
      ).rejects.toThrow(ConflictError);
    });
  });
});
