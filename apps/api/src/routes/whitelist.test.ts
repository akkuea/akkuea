/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Route-level tests for whitelist endpoints.
 *
 * Service-level audit-trail tests live in
 * src/__tests__/WhitelistService.audit.test.ts so that the WhitelistService
 * mock used here doesn't shadow the real implementation.
 */
import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test';
import { db } from '../db';
import Elysia from 'elysia';
import { whitelistRoutes } from './whitelist';

// Mock whitelist service so route tests are isolated from the real service.
mock.module('../services/WhitelistService', () => ({
  whitelistService: {
    approveRequest: mock(() => Promise.resolve('mock_tx_hash')),
    rejectRequest: mock(() => Promise.resolve()),
  },
}));

// Setup a minimal app for testing routes.
import { internalOperationsRoutes } from './internalOperations';
import { whitelistService } from '../services/WhitelistService';

const testApp = new Elysia().use(whitelistRoutes).use(internalOperationsRoutes);

process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-secret';

// ---------------------------------------------------------------------------
// Helper constants
// ---------------------------------------------------------------------------
const MOCK_WALLET = 'GDK7PZZY4QJ6GZ46X34PXZY2C46Y7PZZY4QJ6GZ46X34PXZY2C46Y7PZ';
const OPERATOR_WALLET = 'GOPERATOR_WALLET_123456789012345678901234567890123456789012';

// ---------------------------------------------------------------------------
// Route-level tests
// ---------------------------------------------------------------------------
describe('Whitelist API Routes', () => {
  let mockDbStore: any[] = [];

  beforeEach(() => {
    mockDbStore = [];

    (db as any).query = {
      pilotWhitelistRequests: {
        findFirst: mock(async () => mockDbStore.find((r) => r.walletAddress === MOCK_WALLET)),
        findMany: mock(async () => mockDbStore),
      },
    };

    (db as any).insert = mock(() => ({
      values: (val: any) => ({
        returning: async () => {
          const inserted = { id: 'test_id', ...val };
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
          walletAddress: MOCK_WALLET,
          fullName: 'Test User',
          idType: 'passport',
          idReference: 'A1234567',
        }),
      }),
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.walletAddress).toBe(MOCK_WALLET);
    expect(result.data.status).toBe('pending');
    expect(mockDbStore.length).toBe(1);
  });

  it('should fail to submit a duplicate request', async () => {
    mockDbStore.push({ id: 'existing_id', walletAddress: MOCK_WALLET, status: 'pending' });

    const response = await testApp.handle(
      new Request('http://localhost/pilot/whitelist/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: MOCK_WALLET,
          fullName: 'Test User 2',
          idType: 'national_id',
          idReference: 'B7654321',
        }),
      }),
    );

    expect(response.status).not.toBe(200);
  });

  it('should fetch pending requests', async () => {
    mockDbStore.push({ id: 'pending_id', walletAddress: MOCK_WALLET, status: 'pending' });

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

  it('should review a request and pass actorWallet to the service', async () => {
    const response = await testApp.handle(
      new Request('http://localhost/internal/operations/pilot/whitelist/req_id_1/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-api-key': 'test-secret' },
        body: JSON.stringify({
          action: 'approve',
          actorWallet: OPERATOR_WALLET,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.txHash).toBe('mock_tx_hash');
    expect(whitelistService.approveRequest).toHaveBeenCalledWith('req_id_1', OPERATOR_WALLET);
  });

  it('should reject a review request with missing actorWallet', async () => {
    const response = await testApp.handle(
      new Request('http://localhost/internal/operations/pilot/whitelist/req_id_1/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-api-key': 'test-secret' },
        body: JSON.stringify({ action: 'approve' }), // actorWallet intentionally omitted
      }),
    );

    // Elysia returns 422 (Unprocessable Entity) for body validation failures.
    expect([400, 422]).toContain(response.status);
  });
});
