/**
 * Tests for IdempotencyCleanupJob.
 *
 * All tests run entirely in memory - no database required. `db.delete` is
 * replaced with a mock so we can simulate arbitrary results without a real
 * Postgres connection (same approach as routes/whitelist.test.ts).
 */
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { db } from '../db';
import {
  IdempotencyCleanupJob,
  createIdempotencyCleanupJobFromEnv,
} from '../workers/idempotencyCleanupJob';

function mockDelete(rows: Array<{ key: string }>, shouldThrow = false) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).delete = mock(() => ({
    where: () => ({
      returning: async (): Promise<Array<{ key: string }>> => {
        if (shouldThrow) throw new Error('simulated DB failure');
        return rows;
      },
    }),
  }));
}

describe('IdempotencyCleanupJob', () => {
  beforeEach(() => {
    mockDelete([]);
  });

  afterEach(() => {
    mock.restore();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (db as any).delete;
  });

  function createJob() {
    return new IdempotencyCleanupJob({ pollIntervalMs: 999_999_999 });
  }

  describe('tick()', () => {
    it('deletes expired rows and reports how many were removed', async () => {
      mockDelete([{ key: 'anonymous:key-1' }, { key: 'GABC...:key-2' }]);

      const job = createJob();
      const result = await job.tick();

      expect(result.deleted).toBe(2);
    });

    it('reports zero deletions when nothing is expired', async () => {
      mockDelete([]);

      const job = createJob();
      const result = await job.tick();

      expect(result.deleted).toBe(0);
    });

    it('does not throw if the database call fails', async () => {
      mockDelete([], true);

      const job = createJob();
      await expect(job.tick()).resolves.toEqual({ deleted: 0 });
    });

    it('does not run concurrent ticks', async () => {
      let resolveDelete: (() => void) | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db as any).delete = mock(() => ({
        where: () => ({
          returning: () =>
            new Promise<Array<{ key: string }>>((resolve) => {
              resolveDelete = () => resolve([]);
            }),
        }),
      }));

      const job = createJob();
      const firstTick = job.tick();
      const secondTick = job.tick();

      expect(await secondTick).toEqual({ deleted: 0 });
      resolveDelete?.();
      await firstTick;
    });
  });

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

  describe('createIdempotencyCleanupJobFromEnv()', () => {
    const originalEnabled = process.env.IDEMPOTENCY_CLEANUP_JOB_ENABLED;

    afterEach(() => {
      if (originalEnabled === undefined) {
        delete process.env.IDEMPOTENCY_CLEANUP_JOB_ENABLED;
      } else {
        process.env.IDEMPOTENCY_CLEANUP_JOB_ENABLED = originalEnabled;
      }
    });

    it('returns a job by default', () => {
      delete process.env.IDEMPOTENCY_CLEANUP_JOB_ENABLED;
      expect(createIdempotencyCleanupJobFromEnv()).not.toBeNull();
    });

    it('returns null when disabled via env', () => {
      process.env.IDEMPOTENCY_CLEANUP_JOB_ENABLED = 'false';
      expect(createIdempotencyCleanupJobFromEnv()).toBeNull();
    });
  });
});
