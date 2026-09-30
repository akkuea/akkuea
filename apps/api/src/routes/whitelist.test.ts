/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test';
import { db } from '../db';
import { whitelistService } from '../services/WhitelistService';
import { StorageService } from '../services/StorageService';
import Elysia from 'elysia';
import { whitelistRoutes } from './whitelist';

// Setup a minimal app for testing routes
import { internalOperationsRoutes } from './internalOperations';
const testApp = new Elysia().use(whitelistRoutes).use(internalOperationsRoutes);

process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-secret';

const TEST_FIELD_ENCRYPTION_KEY = 'dGVzdC1rZXktbWF0ZXJpYWwtdGhhdC1pcy0zMi1ieXRlcy1sb25nLg=='; // 32 bytes base64

describe('Whitelist API Routes', () => {
  const mockWallet = 'GDK7PZZY4QJ6GZ46X34PXZY2C46Y7PZZY4QJ6GZ46X34PXZY2C46Y7PZ';
  let mockDbStore: any[] = [];
  let originalStore: unknown;
  let originalSignedUrl: unknown;
  let originalDelete: unknown;
  let originalApprove: unknown;
  let originalReject: unknown;

  /**
   * Collects every Param value from a Drizzle condition AST. Controller
   * queries are single `eq(column, value)` conditions, so the first Param is
   * the bound value (a request id or a wallet address depending on caller).
   */
  function collectParamValues(node: any, out: unknown[] = []): unknown[] {
    if (node == null || typeof node !== 'object') return out;
    for (const chunk of node.queryChunks ?? []) {
      if (chunk?.constructor?.name === 'Param') {
        out.push(chunk.value);
      } else {
        collectParamValues(chunk, out);
      }
    }
    return out;
  }

  /** Builds a multipart body, the format POST /request requires. */
  function buildMultipartBody(overrides: Record<string, string> = {}): FormData {
    const formData = new FormData();
    formData.append('walletAddress', mockWallet);
    formData.append('fullName', 'Test User');
    formData.append('idType', 'passport');
    formData.append('idReference', 'A1234567');
    for (const [key, value] of Object.entries(overrides)) {
      formData.set(key, value);
    }
    const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    formData.append('document', new File([pdfBuffer], 'passport.pdf', { type: 'application/pdf' }));
    return formData;
  }

  beforeEach(() => {
    mockDbStore = [];

    // Stub WhitelistService (review flow) and StorageService statics on their
    // exported objects rather than via mock.module(): bun test applies
    // mock.module() to the whole process, which would leak into every other
    // test file loaded after this one.
    originalStore = StorageService.store;
    originalSignedUrl = StorageService.getSignedReadUrl;
    originalDelete = StorageService.deleteByRelativePath;

    process.env.FIELD_ENCRYPTION_KEY = TEST_FIELD_ENCRYPTION_KEY;

    originalApprove = whitelistService.approveRequest;
    originalReject = whitelistService.rejectRequest;
    whitelistService.approveRequest = mock(() => Promise.resolve('mock_tx_hash')) as any;
    whitelistService.rejectRequest = mock(() => Promise.resolve()) as any;

    StorageService.store = mock(
      async (buffer: Buffer, userId: string, ext: string, docId?: string) => {
        return {
          storedFileName: `${docId || 'test-id'}${ext}`,
          relativePath: `kyc/${userId}/${docId || 'test-id'}${ext}`,
          extension: ext,
        };
      },
    ) as typeof StorageService.store;
    StorageService.getSignedReadUrl = mock(
      async (path: string) => `http://localhost:3001/storage/${path}?token=test`,
    ) as typeof StorageService.getSignedReadUrl;
    StorageService.deleteByRelativePath = mock(
      async () => {},
    ) as typeof StorageService.deleteByRelativePath;

    // Mock db queries
    (db as any).query = {
      pilotWhitelistRequests: {
        findFirst: mock(async ({ where }: any) => {
          const [paramValue] = collectParamValues(where);
          if (paramValue === undefined) return undefined;
          return (
            mockDbStore.find((r) => r.id === paramValue) ??
            mockDbStore.find((r) => r.walletAddress === paramValue)
          );
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
        where: async (whereExpr: any) => {
          const [paramValue] = collectParamValues(whereExpr);
          const target =
            mockDbStore.find((r) => r.id === paramValue) ??
            mockDbStore.find((r) => r.walletAddress === paramValue);
          if (target) {
            Object.assign(target, val);
          }
        },
      }),
    }));

    (db as any).delete = mock(() => ({
      where: async (whereExpr: any) => {
        const [paramValue] = collectParamValues(whereExpr);
        if (paramValue !== undefined) {
          mockDbStore = mockDbStore.filter((r) => r.walletAddress !== paramValue);
        }
      },
    }));
  });

  afterEach(() => {
    // Restore stubbed statics first so no later file sees a mock, then drop
    // the db Proxy overrides (they persist across files in one bun process).
    whitelistService.approveRequest = originalApprove as any;
    whitelistService.rejectRequest = originalReject as any;
    StorageService.store = originalStore as typeof StorageService.store;
    StorageService.getSignedReadUrl = originalSignedUrl as typeof StorageService.getSignedReadUrl;
    StorageService.deleteByRelativePath =
      originalDelete as typeof StorageService.deleteByRelativePath;
    delete process.env.FIELD_ENCRYPTION_KEY;
    mock.restore();
    // Direct property assignment on the db Proxy mutates _dbTarget, which
    // persists across test files in the same bun process. mock.restore()
    // only undoes mock() calls, not these mutations, so delete them
    // unconditionally: beforeEach always re-populates all four from scratch,
    // so there's no prior legitimate state to preserve.
    for (const prop of ['query', 'insert', 'update', 'delete']) {
      delete (db as any)[prop];
    }
  });

  it('should submit a new whitelist request successfully', async () => {
    const response = await testApp.handle(
      new Request('http://localhost/pilot/whitelist/request', {
        method: 'POST',
        headers: { 'x-test-bypass-ratelimit': 'true' },
        body: buildMultipartBody(),
      }),
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as any;
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
        headers: { 'x-test-bypass-ratelimit': 'true' },
        body: buildMultipartBody({
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
    const result = (await response.json()) as any;
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
    const result = (await response.json()) as any;
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
        headers: { 'x-test-bypass-ratelimit': 'true' },
        body: buildMultipartBody({
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
        headers: { 'x-test-bypass-ratelimit': 'true' },
        body: buildMultipartBody(),
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
        headers: { 'x-test-bypass-ratelimit': 'true' },
        body: buildMultipartBody(),
      }),
    );

    expect(response.status).not.toBe(200);
  });
});
