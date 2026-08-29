/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test';
import { db } from '../db';
import { whitelistService } from '../services/WhitelistService';
import Elysia from 'elysia';
import { whitelistRoutes } from './whitelist';
// Mock whitelist service
mock.module('../services/WhitelistService', () => {
  return {
    whitelistService: {
      approveRequest: mock(() => Promise.resolve('mock_tx_hash')),
      rejectRequest: mock(() => Promise.resolve()),
    },
  };
});

// Setup a minimal app for testing routes
import { internalOperationsRoutes } from './internalOperations';
const testApp = new Elysia().use(whitelistRoutes).use(internalOperationsRoutes);

process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-secret';

describe('Whitelist API Routes', () => {
  const mockWallet = 'GDK7PZZY4QJ6GZ46X34PXZY2C46Y7PZZY4QJ6GZ46X34PXZY2C46Y7PZ';
  let mockDbStore: any[] = [];

  beforeEach(() => {
    mockDbStore = [];

    // Extract a Stellar address from a drizzle SQL expression
    function extractWalletAddress(obj: any): string | undefined {
      if (obj == null || typeof obj !== 'object') return undefined;
      // Check for Param object (drizzle eq() result)
      if (obj.queryChunks && Array.isArray(obj.queryChunks)) {
        for (const chunk of obj.queryChunks) {
          if (chunk?.constructor?.name === 'Param' && typeof chunk.value === 'string') {
            return chunk.value;
          }
        }
      }
      // Fallback: check common expression properties
      if ('value' in obj && typeof obj.value === 'string') return obj.value;
      return undefined;
    }

    // Mock db queries
    (db as any).query = {
      pilotWhitelistRequests: {
        findFirst: mock(async ({ where }: any) => {
          const walletAddr = extractWalletAddress(where);
          if (walletAddr) {
            return mockDbStore.find((r) => r.walletAddress === walletAddr);
          }
          return undefined;
        }),
        findMany: mock(async () => mockDbStore),
      },
    };

    (db as any).insert = mock(() => ({
      values: (val: any) => ({
        returning: async () => {
          const inserted = {
            id: `test_id_${Date.now()}_${Math.random().toString(36).slice(2)}`,
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
      where: async (whereExpr: any) => {
        const walletAddr = extractWalletAddress(whereExpr);
        if (walletAddr) {
          mockDbStore = mockDbStore.filter((r) => r.walletAddress !== walletAddr);
        }
      },
    }));
  });

  afterEach(() => {
    mock.restore();
  });

  it('should submit a new whitelist request successfully', async () => {
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
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.walletAddress).toBe(mockWallet);
    expect(result.data.status).toBe('pending');
    expect(mockDbStore.length).toBe(1);
  });

  it('should fail to submit a duplicate request', async () => {
    mockDbStore.push({
      id: 'existing_id',
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

    expect(response.status).not.toBe(200);
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
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.length).toBe(1);
  });

  it('should review a request', async () => {
    const response = await testApp.handle(
      new Request('http://localhost/internal/operations/pilot/whitelist/req_id_1/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-api-key': 'test-secret' },
        body: JSON.stringify({ action: 'approve' }),
      }),
    );

    const status = response.status;
    const result = await response.json();
    console.log('REVIEW RESPONSE:', status, result);
    expect(status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.txHash).toBe('mock_tx_hash');
    expect(whitelistService.approveRequest).toHaveBeenCalledWith('req_id_1');
  });

  it('should allow resubmission after rejection', async () => {
    const resubmitWallet = 'GDC3C4X5R7N2X7CII7SPRD4U6ZLKZKAJZDW6N4Q4QAV3FJ7Q3N7GJ5P6';

    // Seed a rejected request for this wallet
    mockDbStore.push({
      id: 'old_rejected_id',
      walletAddress: resubmitWallet,
      status: 'rejected',
      fullName: 'Old Submission',
      idType: 'passport',
      idReference: 'OLD123',
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
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('pending');
    expect(result.data.fullName).toBe('New Submission');

    // Only the new request should exist; the old one was deleted
    const requestsForWallet = mockDbStore.filter((r) => r.walletAddress === resubmitWallet);
    expect(requestsForWallet.length).toBe(1);
    expect(requestsForWallet[0].id).not.toBe('old_rejected_id');
  });

  it('should block resubmission when request is pending', async () => {
    mockDbStore.push({
      id: 'pending_id',
      walletAddress: mockWallet,
      status: 'pending',
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

    expect(response.status).not.toBe(200);
  });

  it('should block resubmission when address is already approved', async () => {
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

    expect(response.status).not.toBe(200);
  });
});
