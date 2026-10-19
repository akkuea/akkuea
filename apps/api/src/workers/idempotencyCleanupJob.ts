import { lt } from 'drizzle-orm';
import { db } from '../db';
import { idempotencyKeys } from '../db/schema/idempotency';
import { logger } from '../services/logger';

export interface IdempotencyCleanupJobConfig {
  /** How often the job runs, in milliseconds. Default: 1 hour. */
  pollIntervalMs?: number;
}

interface ResolvedConfig {
  pollIntervalMs: number;
}

const DEFAULT_POLL_INTERVAL_MS = 60 * 60 * 1_000; // 1 hour

/**
 * IdempotencyCleanupJob
 *
 * Periodically deletes `idempotency_keys` rows whose `expiresAt` has
 * passed. Without this, expired rows are only ever reclaimed if the same
 * key is reused (see middleware/idempotency.ts); keys that are never
 * reused would otherwise accumulate in the table forever.
 *
 * Disable via env: IDEMPOTENCY_CLEANUP_JOB_ENABLED=false
 * Tune poll interval: IDEMPOTENCY_CLEANUP_POLL_INTERVAL_MS=<ms>
 */
export class IdempotencyCleanupJob {
  private readonly config: ResolvedConfig;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private processing = false;

  constructor(config?: IdempotencyCleanupJobConfig) {
    this.config = {
      pollIntervalMs: config?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info('Idempotency cleanup job started', {
      operation: 'IDEMPOTENCY_CLEANUP_JOB_START',
      pollIntervalMs: this.config.pollIntervalMs,
    });
    // Run immediately on start, then schedule future ticks
    void this.tick();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    // Wait for any in-flight tick to complete
    while (this.processing) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    logger.info('Idempotency cleanup job stopped', {
      operation: 'IDEMPOTENCY_CLEANUP_JOB_STOP',
    });
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Execute one cleanup cycle. Public so tests can call it directly against
   * a mocked database.
   */
  async tick(): Promise<{ deleted: number }> {
    if (this.processing) return { deleted: 0 };
    this.processing = true;

    let deletedCount = 0;
    try {
      const deleted = await db
        .delete(idempotencyKeys)
        .where(lt(idempotencyKeys.expiresAt, new Date()))
        .returning({ key: idempotencyKeys.key });
      deletedCount = deleted.length;

      if (deletedCount > 0) {
        logger.info('Expired idempotency keys deleted', {
          operation: 'IDEMPOTENCY_CLEANUP',
          count: deletedCount,
        });
      }
    } catch (err) {
      logger.error('Idempotency cleanup job tick failed', {
        operation: 'IDEMPOTENCY_CLEANUP_JOB_TICK_ERROR',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.processing = false;
      this.scheduleNext();
    }

    return { deleted: deletedCount };
  }

  private scheduleNext(): void {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      void this.tick();
    }, this.config.pollIntervalMs);
    // Do not keep the event loop alive solely for the poll timer
    const t = this.timer as unknown as { unref?: () => void };
    if (typeof t.unref === 'function') t.unref();
  }
}

/**
 * Factory that respects the IDEMPOTENCY_CLEANUP_JOB_ENABLED env flag (default: enabled).
 */
export function createIdempotencyCleanupJobFromEnv(): IdempotencyCleanupJob | null {
  const enabled = (process.env.IDEMPOTENCY_CLEANUP_JOB_ENABLED ?? 'true').toLowerCase() !== 'false';
  if (!enabled) {
    logger.info('Idempotency cleanup job disabled via IDEMPOTENCY_CLEANUP_JOB_ENABLED=false', {
      operation: 'IDEMPOTENCY_CLEANUP_JOB_DISABLED',
    });
    return null;
  }

  const pollIntervalMs = Number(process.env.IDEMPOTENCY_CLEANUP_POLL_INTERVAL_MS);

  return new IdempotencyCleanupJob({
    pollIntervalMs:
      Number.isFinite(pollIntervalMs) && pollIntervalMs > 0 ? pollIntervalMs : undefined,
  });
}
