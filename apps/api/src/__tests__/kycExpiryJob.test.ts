/**
 * Tests for KycExpiryJob
 *
 * All tests run entirely in memory — no database required.
 * The repository methods and NotificationService are replaced with mocks
 * so we can simulate arbitrary date scenarios.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { KycExpiryJob } from '../workers/kycExpiryJob';
import { kycRepository } from '../repositories/KYCRepository';
import type { NotificationService } from '../services/NotificationService';
import type { Notification } from '../db/schema';

// ── Date helpers ─────────────────────────────────────────────────────────────

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function daysAgo(days: number): Date {
  return daysFromNow(-days);
}

// ── Mock repository methods ───────────────────────────────────────────────────

const mockUpdateUserKycStatus = mock(async (_id: string, _status: string, _exp?: Date | null) => {});
const mockFindExpiredApprovedUsers = mock(async (): Promise<{ id: string; kycExpiresAt: Date }[]> => []);
const mockFindUsersExpiringWithin = mock(async (_ms: number): Promise<{ id: string; kycExpiresAt: Date }[]> => []);

kycRepository.findExpiredApprovedUsers = mockFindExpiredApprovedUsers;
kycRepository.findUsersExpiringWithin = mockFindUsersExpiringWithin;
kycRepository.updateUserKycStatus = mockUpdateUserKycStatus as typeof kycRepository.updateUserKycStatus;

// ── Mock NotificationService ──────────────────────────────────────────────────

const mockNotifyKycExpired = mock(async (_userId: string, _channel?: string): Promise<Notification> => ({}) as Notification);
const mockNotifyKycExpiringSoon = mock(async (_userId: string, _exp: Date, _channel?: string): Promise<Notification> => ({}) as Notification);

const mockNotificationService = {
  notifyKycExpired: mockNotifyKycExpired,
  notifyKycExpiringSoon: mockNotifyKycExpiringSoon,
} as unknown as NotificationService;

// ── Factory ───────────────────────────────────────────────────────────────────

function createJob(overrides?: { reminderWindowMs?: number }) {
  return new KycExpiryJob({
    pollIntervalMs: 999_999_999, // prevent auto-scheduling during tests
    reminderWindowMs: overrides?.reminderWindowMs,
    notificationService: mockNotificationService,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('KycExpiryJob', () => {
  beforeEach(() => {
    mockUpdateUserKycStatus.mockReset();
    mockFindExpiredApprovedUsers.mockReset();
    mockFindUsersExpiringWithin.mockReset();
    mockNotifyKycExpired.mockReset();
    mockNotifyKycExpiringSoon.mockReset();
    // Default: no users to process
    mockFindExpiredApprovedUsers.mockImplementation(async () => []);
    mockFindUsersExpiringWithin.mockImplementation(async () => []);
  });

  // ── Already-expired records ────────────────────────────────────────────────

  describe('already expired KYC records', () => {
    it('marks a user as expired when kycExpiresAt is in the past', async () => {
      const userId = 'user-already-expired';
      const expiredAt = daysAgo(1);

      mockFindExpiredApprovedUsers.mockImplementation(async () => [
        { id: userId, kycExpiresAt: expiredAt },
      ]);

      const job = createJob();
      const result = await job.tick();

      expect(result.expired).toBe(1);
      expect(mockUpdateUserKycStatus).toHaveBeenCalledTimes(1);
      expect(mockUpdateUserKycStatus).toHaveBeenCalledWith(userId, 'expired', expiredAt);
      expect(mockNotifyKycExpired).toHaveBeenCalledTimes(1);
      expect(mockNotifyKycExpired).toHaveBeenCalledWith(userId, 'IN_APP');
    });

    it('marks multiple expired users in a single tick', async () => {
      mockFindExpiredApprovedUsers.mockImplementation(async () => [
        { id: 'user-a', kycExpiresAt: daysAgo(5) },
        { id: 'user-b', kycExpiresAt: daysAgo(1) },
      ]);

      const job = createJob();
      const result = await job.tick();

      expect(result.expired).toBe(2);
      expect(mockUpdateUserKycStatus).toHaveBeenCalledTimes(2);
      expect(mockNotifyKycExpired).toHaveBeenCalledTimes(2);
    });

    it('returns expired=0 when no records are overdue', async () => {
      const job = createJob();
      const result = await job.tick();

      expect(result.expired).toBe(0);
      expect(mockUpdateUserKycStatus).not.toHaveBeenCalled();
      expect(mockNotifyKycExpired).not.toHaveBeenCalled();
    });
  });

  // ── About-to-expire reminders ──────────────────────────────────────────────

  describe('about-to-expire reminders', () => {
    it('sends a reminder for a user whose KYC expires within the default 30-day window', async () => {
      const userId = 'user-expiring-soon';
      const expiresAt = daysFromNow(15);

      mockFindUsersExpiringWithin.mockImplementation(async () => [
        { id: userId, kycExpiresAt: expiresAt },
      ]);

      const job = createJob();
      const result = await job.tick();

      expect(result.reminded).toBe(1);
      expect(mockNotifyKycExpiringSoon).toHaveBeenCalledTimes(1);
      expect(mockNotifyKycExpiringSoon).toHaveBeenCalledWith(userId, expiresAt, 'IN_APP');
    });

    it('sends reminders to multiple users expiring soon', async () => {
      mockFindUsersExpiringWithin.mockImplementation(async () => [
        { id: 'user-c', kycExpiresAt: daysFromNow(7) },
        { id: 'user-d', kycExpiresAt: daysFromNow(29) },
      ]);

      const job = createJob();
      const result = await job.tick();

      expect(result.reminded).toBe(2);
      expect(mockNotifyKycExpiringSoon).toHaveBeenCalledTimes(2);
    });

    it('sends no reminders when no users are expiring soon', async () => {
      const job = createJob();
      const result = await job.tick();

      expect(result.reminded).toBe(0);
      expect(mockNotifyKycExpiringSoon).not.toHaveBeenCalled();
    });

    it('respects a custom reminderWindowMs', async () => {
      const userId = 'user-custom-window';
      mockFindUsersExpiringWithin.mockImplementation(async () => [
        { id: userId, kycExpiresAt: daysFromNow(3) },
      ]);

      // 7-day custom window
      const job = createJob({ reminderWindowMs: 7 * 24 * 60 * 60 * 1_000 });
      const result = await job.tick();

      expect(result.reminded).toBe(1);
    });
  });

  // ── Combined in one tick ───────────────────────────────────────────────────

  describe('combined: expired + reminders in same tick', () => {
    it('handles both expired records and reminder candidates simultaneously', async () => {
      mockFindExpiredApprovedUsers.mockImplementation(async () => [
        { id: 'expired-user', kycExpiresAt: daysAgo(2) },
      ]);
      mockFindUsersExpiringWithin.mockImplementation(async () => [
        { id: 'soon-user', kycExpiresAt: daysFromNow(10) },
      ]);

      const job = createJob();
      const result = await job.tick();

      expect(result.expired).toBe(1);
      expect(result.reminded).toBe(1);
      expect(mockUpdateUserKycStatus).toHaveBeenCalledTimes(1);
      expect(mockNotifyKycExpired).toHaveBeenCalledTimes(1);
      expect(mockNotifyKycExpiringSoon).toHaveBeenCalledTimes(1);
    });
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  describe('start() / stop() lifecycle', () => {
    it('starts and can be stopped cleanly', async () => {
      const job = createJob();
      job.start();
      expect(job.isRunning()).toBe(true);
      await job.stop();
      expect(job.isRunning()).toBe(false);
    });

    it('calling start() twice is a no-op', async () => {
      const job = createJob();
      job.start();
      job.start();
      expect(job.isRunning()).toBe(true);
      await job.stop();
    });

    it('stop() on a never-started job does not throw', async () => {
      const job = createJob();
      await expect(job.stop()).resolves.toBeUndefined();
      expect(job.isRunning()).toBe(false);
    });
  });

  // ── Error resilience ───────────────────────────────────────────────────────

  describe('error handling', () => {
    it('continues processing remaining users even if one throws', async () => {
      mockFindExpiredApprovedUsers.mockImplementation(async () => [
        { id: 'user-will-fail', kycExpiresAt: daysAgo(3) },
        { id: 'user-will-succeed', kycExpiresAt: daysAgo(1) },
      ]);

      let callCount = 0;
      mockUpdateUserKycStatus.mockImplementation(async (id: string) => {
        callCount++;
        if (id === 'user-will-fail') throw new Error('Simulated DB error');
      });

      const job = createJob();
      const result = await job.tick();

      expect(callCount).toBe(2);
      // Only the successful user increments the counter
      expect(result.expired).toBe(1);
    });

    it('returns zero counts when the repository throws at the top level', async () => {
      mockFindExpiredApprovedUsers.mockImplementation(async () => {
        throw new Error('DB connection lost');
      });

      const job = createJob();
      const result = await job.tick();

      expect(result.expired).toBe(0);
      expect(result.reminded).toBe(0);
    });
  });
});
