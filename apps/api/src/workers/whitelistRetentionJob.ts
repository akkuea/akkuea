import { eq, lt, and } from 'drizzle-orm';
import { db } from '../db';
import { pilotWhitelistRequests } from '../db/schema/pilotWhitelist';
import { StorageService } from '../services/StorageService';
import { logger } from '../services/logger';

export interface WhitelistRetentionJobConfig {
  /** How often the job runs, in milliseconds. Default: 24 hours. */
  pollIntervalMs?: number;
  /**
   * Retention period for rejected/withdrawn requests in days.
   * Default: 90 days.
   */
  retentionDays?: number;
  /** Dry run mode - logs what would be done without actually deleting. */
  dryRun?: boolean;
}

interface ResolvedConfig {
  pollIntervalMs: number;
  retentionDays: number;
  dryRun: boolean;
}

const DEFAULT_POLL_INTERVAL_MS = 24 * 60 * 60 * 1_000; // 24 hours
const DEFAULT_RETENTION_DAYS = 90;

/**
 * WhitelistRetentionJob
 *
 * Periodically:
 *  1. Finds rejected whitelist requests older than the retention period
 *  2. Deletes their associated documents from storage
 *  3. Anonymizes PII fields (fullName, idReference) in the database
 *  4. Keeps approved requests intact for auditability
 *
 * Disable via env: WHITELIST_RETENTION_JOB_ENABLED=false
 * Configure retention: WHITELIST_RETENTION_DAYS_REJECTED=<days>
 * Tune poll interval: WHITELIST_RETENTION_POLL_INTERVAL_MS=<ms>
 */
export class WhitelistRetentionJob {
  private readonly config: ResolvedConfig;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private processing = false;

  constructor(config?: WhitelistRetentionJobConfig) {
    this.config = {
      pollIntervalMs: config?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      retentionDays: config?.retentionDays ?? DEFAULT_RETENTION_DAYS,
      dryRun: config?.dryRun ?? false,
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info('Whitelist retention job started', {
      operation: 'WHITELIST_RETENTION_JOB_START',
      pollIntervalMs: this.config.pollIntervalMs,
      retentionDays: this.config.retentionDays,
      dryRun: this.config.dryRun,
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
    logger.info('Whitelist retention job stopped', { operation: 'WHITELIST_RETENTION_JOB_STOP' });
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Execute one cycle of the job. Public so tests can call it directly
   * with mocked repository/service to simulate arbitrary dates.
   */
  async tick(): Promise<{ processed: number; errors: number }> {
    if (this.processing) return { processed: 0, errors: 0 };
    this.processing = true;

    let processedCount = 0;
    let errorCount = 0;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      // Find rejected requests older than retention period
      const expiredRequests = await db.query.pilotWhitelistRequests.findMany({
        where: and(
          eq(pilotWhitelistRequests.status, 'rejected'),
          lt(pilotWhitelistRequests.updatedAt, cutoffDate),
        ),
      });

      logger.info('Whitelist retention job processing', {
        operation: 'WHITELIST_RETENTION_JOB_TICK',
        found: expiredRequests.length,
        cutoffDate: cutoffDate.toISOString(),
        dryRun: this.config.dryRun,
      });

      for (const request of expiredRequests) {
        try {
          // Delete document from storage if exists
          if (request.documentUrl) {
            if (!this.config.dryRun) {
              await StorageService.deleteByRelativePath(request.documentUrl);
            }
            logger.info('Whitelist document deleted', {
              operation: 'WHITELIST_RETENTION_DOCUMENT_DELETED',
              requestId: request.id,
              documentUrl: request.documentUrl,
              dryRun: this.config.dryRun,
            });
          }

          // Anonymize PII fields
          if (!this.config.dryRun) {
            await db
              .update(pilotWhitelistRequests)
              .set({
                fullName: '[REDACTED]',
                idReference: '[REDACTED]',
                fullNameEncrypted: null,
                idReferenceEncrypted: null,
                documentUrl: null,
                documentEncryptionKey: null,
                updatedAt: new Date(),
              })
              .where(eq(pilotWhitelistRequests.id, request.id));
          }

          processedCount++;
          logger.info('Whitelist request anonymized', {
            operation: 'WHITELIST_RETENTION_ANONYMIZED',
            requestId: request.id,
            walletAddress: request.walletAddress,
            dryRun: this.config.dryRun,
          });
        } catch (err) {
          errorCount++;
          logger.error('Failed to process whitelist request for retention', {
            operation: 'WHITELIST_RETENTION_ERROR',
            requestId: request.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      errorCount++;
      logger.error('Whitelist retention job tick failed', {
        operation: 'WHITELIST_RETENTION_JOB_TICK_ERROR',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.processing = false;
      this.scheduleNext();
    }

    return { processed: processedCount, errors: errorCount };
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
 * Factory that respects the WHITELIST_RETENTION_JOB_ENABLED env flag (default: enabled).
 */
export function createWhitelistRetentionJobFromEnv(): WhitelistRetentionJob | null {
  const enabled = (process.env.WHITELIST_RETENTION_JOB_ENABLED ?? 'true').toLowerCase() !== 'false';
  if (!enabled) {
    logger.info('Whitelist retention job disabled via WHITELIST_RETENTION_JOB_ENABLED=false', {
      operation: 'WHITELIST_RETENTION_JOB_DISABLED',
    });
    return null;
  }

  const pollIntervalMs = Number(process.env.WHITELIST_RETENTION_POLL_INTERVAL_MS);
  const retentionDays = Number(process.env.WHITELIST_RETENTION_DAYS_REJECTED);

  return new WhitelistRetentionJob({
    pollIntervalMs:
      Number.isFinite(pollIntervalMs) && pollIntervalMs > 0 ? pollIntervalMs : undefined,
    retentionDays:
      Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : undefined,
  });
}