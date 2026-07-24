import { describe, expect, it, mock } from 'bun:test';
import { AuditService } from '../services/AuditService';
import type { AuditLogRepository } from '../repositories/AuditLogRepository';

function createMockRepository(): AuditLogRepository {
  return {
    create: mock(() => Promise.resolve({ id: 'mock-id' } as any)),
    findPaginated: mock(() =>
      Promise.resolve({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    ),
  } as unknown as AuditLogRepository;
}

describe('AuditService', () => {
  describe('logAction', () => {
    it('should call repository.create with correct values', async () => {
      const repo = createMockRepository();
      const service = new AuditService(repo);

      await service.logAction({
        actor: 'GActorWallet1234567890123456789012345678901234567890',
        action: 'kyc.approve',
        entityType: 'kyc_document',
        entityId: '550e8400-e29b-41d4-a716-446655440000',
        beforeValue: { status: 'pending' },
        afterValue: { status: 'approved' },
        metadata: { userId: 'user-123' },
      });

      expect(repo.create).toHaveBeenCalledTimes(1);
      const callArg = (repo.create as ReturnType<typeof mock>).mock.calls[0]![0];
      expect(callArg).toEqual({
        actor: 'GActorWallet1234567890123456789012345678901234567890',
        action: 'kyc.approve',
        entityType: 'kyc_document',
        entityId: '550e8400-e29b-41d4-a716-446655440000',
        beforeValue: { status: 'pending' },
        afterValue: { status: 'approved' },
        metadata: { userId: 'user-123' },
      });
    });

    it('should store null for undefined before/after/metadata', async () => {
      const repo = createMockRepository();
      const service = new AuditService(repo);

      await service.logAction({
        actor: 'GActor123',
        action: 'test.action',
        entityType: 'test',
        entityId: '550e8400-e29b-41d4-a716-446655440000',
      });

      const callArg = (repo.create as ReturnType<typeof mock>).mock.calls[0]![0];
      expect(callArg.beforeValue).toBeNull();
      expect(callArg.afterValue).toBeNull();
      expect(callArg.metadata).toBeNull();
    });

    it('should serialize before/after values correctly', async () => {
      const repo = createMockRepository();
      const service = new AuditService(repo);

      const beforeValue = {
        status: 'pending',
        verified: false,
        reviewStatus: 'pending_review',
        lastReviewNote: null,
        lastReviewedAt: null,
        lastReviewerWallet: null,
      };

      const afterValue = {
        status: 'approved',
        verified: true,
        reviewStatus: 'approved',
        lastReviewNote: 'Approved after review',
        lastReviewedAt: new Date('2025-07-24T12:00:00.000Z'),
        lastReviewerWallet: 'GReviewer123',
      };

      await service.logAction({
        actor: 'GAdmin123',
        action: 'property.approve',
        entityType: 'property',
        entityId: '550e8400-e29b-41d4-a716-446655440000',
        beforeValue: beforeValue as unknown as Record<string, unknown>,
        afterValue: afterValue as unknown as Record<string, unknown>,
      });

      const callArg = (repo.create as ReturnType<typeof mock>).mock.calls[0]![0];
      expect(callArg.beforeValue).toEqual(beforeValue);
      expect(callArg.afterValue).toEqual(afterValue);
    });
  });

  describe('getAuditLogs', () => {
    it('should call repository.findPaginated with provided filters', async () => {
      const repo = createMockRepository();
      const service = new AuditService(repo);

      await service.getAuditLogs({
        actor: 'GActor123',
        action: 'kyc.approve',
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-12-31T23:59:59.000Z',
        page: 2,
        limit: 10,
      });

      expect(repo.findPaginated).toHaveBeenCalledTimes(1);
      const callArg = (repo.findPaginated as ReturnType<typeof mock>).mock.calls[0]![0];
      expect(callArg).toEqual({
        actor: 'GActor123',
        action: 'kyc.approve',
        startDate: '2025-01-01T00:00:00.000Z',
        endDate: '2025-12-31T23:59:59.000Z',
        page: 2,
        limit: 10,
      });
    });

    it('should return paginated results', async () => {
      const repo = createMockRepository();
      const mockData = Array.from({ length: 3 }, (_, i) => ({
        id: `id-${i}`,
        actor: 'GActor123',
        action: 'kyc.approve',
        entityType: 'kyc_document',
        entityId: `doc-${i}`,
        beforeValue: null,
        afterValue: null,
        metadata: null,
        createdAt: new Date(),
      }));
      (repo.findPaginated as ReturnType<typeof mock>).mockResolvedValue({
        data: mockData,
        pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
      });

      const service = new AuditService(repo);
      const result = await service.getAuditLogs({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should handle empty results', async () => {
      const repo = createMockRepository();
      const service = new AuditService(repo);
      const result = await service.getAuditLogs({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });
  });
});
