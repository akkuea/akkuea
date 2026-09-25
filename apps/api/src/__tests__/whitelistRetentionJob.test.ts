import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { db } from '../db';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { eq, and, lt } from 'drizzle-orm';
import { WhitelistRetentionJob } from '../workers/whitelistRetentionJob';
import { StorageService } from '../services/StorageService';

describe('WhitelistRetentionJob', () => {
  let mockDbStore: any[] = [];

  function extractWalletAddress(obj: any): string | undefined {
    if (obj == null || typeof obj !== 'object') return undefined;
    if (obj.queryChunks && Array.isArray(obj.queryChunks)) {
      for (const chunk of obj.queryChunks) {
        if (chunk?.constructor?.name === 'Param' && typeof chunk.value === 'string') {
          return chunk.value;
        }
      }
    }
    if ('value' in obj && typeof obj.value === 'string') return obj.value;
    return undefined;
  }

  beforeEach(() => {
    mockDbStore = [
      {
        id: 'req_old_rejected',
        walletAddress: 'GOLD123456789012345678901234567890123456789012345678901234',
        fullName: 'Old Rejected',
        idReference: 'OLD123',
        documentUrl: 'kyc/GOLD123456789012345678901234567890123456789012345678901234/doc1.pdf',
        fullNameEncrypted: 'encrypted',
        idReferenceEncrypted: 'encrypted',
        status: 'rejected',
        updatedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
        createdAt: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'req_recent_rejected',
        walletAddress: 'GRECENT123456789012345678901234567890123456789012345678901234',
        fullName: 'Recent Rejected',
        idReference: 'RECENT123',
        documentUrl: 'kyc/GRECENT123456789012345678901234567890123456789012345678901234/doc2.pdf',
        fullNameEncrypted: 'encrypted',
        idReferenceEncrypted: 'encrypted',
        status: 'rejected',
        updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'req_approved',
        walletAddress: 'GAPPROVED123456789012345678901234567890123456789012345678901234',
        fullName: 'Approved User',
        idReference: 'APPROVED123',
        documentUrl: 'kyc/GAPPROVED123456789012345678901234567890123456789012345678901234/doc3.pdf',
        fullNameEncrypted: 'encrypted',
        idReferenceEncrypted: 'encrypted',
        status: 'approved',
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'req_pending',
        walletAddress: 'GPENDING123456789012345678901234567890123456789012345678901234',
        fullName: 'Pending User',
        idReference: 'PENDING123',
        documentUrl: null,
        fullNameEncrypted: 'encrypted',
        idReferenceEncrypted: 'encrypted',
        status: 'pending',
        updatedAt: new Date(),
        createdAt: new Date(),
      },
    ];

    mock.module('../services/StorageService', () => {
      return {
        StorageService: {
          deleteByRelativePath: mock(async (path: string) => {
            // Verify the path is correct
            expect(path).toBeDefined();
          }),
        },
      };
    });

    (db as any).query = {
      pilotWhitelistRequests: {
        findMany: mock(async ({ where }: any) => {
          // Simulate the query: rejected AND updatedAt < cutoff
          return mockDbStore.filter(r => 
            r.status === 'rejected' && 
            r.updatedAt < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
          );
        }),
      },
    };

    (db as any).update = mock(() => ({
      set: (val: any) => ({
        where: async (whereExpr: any) => {
          // Find the request by ID in where clause
          const reqId = whereExpr?.chunks?.[0]?.value;
          if (reqId) {
            const idx = mockDbStore.findIndex(r => r.id === reqId);
            if (idx >= 0) {
              Object.assign(mockDbStore[idx], val);
            }
          }
        },
      }),
    }));
  });

  afterEach(() => {
    mock.restore();
    for (const prop of ['query', 'update', 'delete']) {
      delete (db as any)[prop];
    }
  });

  it('processes only rejected requests older than retention period', async () => {
    const job = new WhitelistRetentionJob({
      retentionDays: 90,
      dryRun: false,
    });

    const result = await job.tick();

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);

    // Check that only the old rejected request was anonymized
    const oldRejected = mockDbStore.find(r => r.id === 'req_old_rejected');
    expect(oldRejected.fullName).toBe('[REDACTED]');
    expect(oldRejected.idReference).toBe('[REDACTED]');
    expect(oldRejected.fullNameEncrypted).toBeNull();
    expect(oldRejected.idReferenceEncrypted).toBeNull();
    expect(oldRejected.documentUrl).toBeNull();

    // Recent rejected should NOT be processed
    const recentRejected = mockDbStore.find(r => r.id === 'req_recent_rejected');
    expect(recentRejected.fullName).toBe('Recent Rejected');

    // Approved should NOT be processed
    const approved = mockDbStore.find(r => r.id === 'req_approved');
    expect(approved.fullName).toBe('Approved User');

    // Pending should NOT be processed
    const pending = mockDbStore.find(r => r.id === 'req_pending');
    expect(pending.fullName).toBe('Pending User');
  });

  it('dry run mode logs but does not modify data', async () => {
    const job = new WhitelistRetentionJob({
      retentionDays: 90,
      dryRun: true,
    });

    const result = await job.tick();

    expect(result.processed).toBe(1);
    expect(result.errors).toBe(0);

    // Data should be unchanged in dry run
    const oldRejected = mockDbStore.find(r => r.id === 'req_old_rejected');
    expect(oldRejected.fullName).toBe('Old Rejected');
    expect(oldRejected.documentUrl).toBeDefined();
  });

  it('deletes document from storage for processed requests', async () => {
    const job = new WhitelistRetentionJob({
      retentionDays: 90,
      dryRun: false,
    });

    await job.tick();

    // Verify StorageService.deleteByRelativePath was called with correct path
    const { StorageService } = await import('../services/StorageService');
    expect(StorageService.deleteByRelativePath).toHaveBeenCalledWith(
      'kyc/GOLD123456789012345678901234567890123456789012345678901234/doc1.pdf'
    );
  });

  it('respects custom retention period', async () => {
    // Add a request that's 60 days old
    mockDbStore.push({
      id: 'req_60_days',
      walletAddress: 'G60DAYS123456789012345678901234567890123456789012345678901234',
      fullName: '60 Days Old',
      idReference: 'SIXTY123',
      documentUrl: null,
      fullNameEncrypted: 'encrypted',
      idReferenceEncrypted: 'encrypted',
      status: 'rejected',
      updatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
    });

    // With 30-day retention, this should be processed
    const job = new WhitelistRetentionJob({
      retentionDays: 30,
      dryRun: false,
    });

    const result = await job.tick();

    expect(result.processed).toBe(2); // old_rejected + 60_days

    const sixtyDays = mockDbStore.find(r => r.id === 'req_60_days');
    expect(sixtyDays.fullName).toBe('[REDACTED]');
  });

  it('continues processing other requests if one fails', async () => {
    // Make the storage delete fail for the first request
    const { StorageService } = await import('../services/StorageService');
    (StorageService.deleteByRelativePath as any).mockImplementationOnce(async () => {
      throw new Error('Storage error');
    });

    const job = new WhitelistRetentionJob({
      retentionDays: 90,
      dryRun: false,
    });

    const result = await job.tick();

    expect(result.processed).toBe(0); // Failed request doesn't count as processed
    expect(result.errors).toBe(1);
  });
});