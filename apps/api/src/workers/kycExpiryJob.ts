import { kycRepository } from '../repositories/KYCRepository';
import { NotificationService } from '../services/NotificationService';
import { logger } from '../services/logger';

export interface KycExpiryJobConfig {
  /** How often the job runs, in milliseconds. Default: 24 hours. */
  pollIntervalMs?: number;
  /**
   * How far in advance to send the expiry reminder.
   * Default: 30 days (in milliseconds).
   */
  reminderWindowMs?: number;
  /** Injected NotificationService (useful for testing). */
  notificationService?: NotificationService;
}

interface ResolvedConfig {
  pollIntervalMs: number;
  reminderWindowMs: number;
  notificationService: NotificationService;
}

const DEFAULT_POLL_INTERVAL_MS = 24 * 60 * 60 * 1_000; // 24 hours
const DEFAULT_REMINDER_WINDOW_MS = 30 * 24 * 60 * 60 * 1_000; // 30 days

/**
 * KycExpiryJob
 *
 * Periodically:
 *  1. Marks approved KYC records as `expired` when kycExpiresAt has passed.
 *  2. Sends a re-verification reminder to users whose KYC will expire within
 *     the configured reminder window (default 30 days).
 *
 * Disable via env: KYC_EXPIRY_JOB_ENABLED=false
 * Tune poll interval: KYC_EXPIRY_POLL_INTERVAL_MS=<ms>
 * Tune reminder window: KYC_EXPIRY_REMINDER_WINDOW_MS=<ms>
 */
export class KycExpiryJob {
  private readonly config: ResolvedConfig;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private processing = false;

  constructor(config?: KycExpiryJobConfig) {
    this.config = {
      pollIntervalMs: config?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
      reminderWindowMs: config?.reminderWindowMs ?? DEFAULT_REMINDER_WINDOW_MS,
      notificationService: config?.notificationService ?? new NotificationService(),
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info('KYC expiry job started', {
      operation: 'KYC_EXPIRY_JOB_START',
      pollIntervalMs: this.config.pollIntervalMs,
      reminderWindowMs: this.config.reminderWindowMs,
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
    logger.info('KYC expiry job stopped', { operation: 'KYC_EXPIRY_JOB_STOP' });
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Execute one cycle of the job. Public so tests can call it directly
   * with mocked repository/service to simulate arbitrary dates.
   */
  async tick(): Promise<{ expired: number; reminded: number }> {
    if (this.processing) return { expired: 0, reminded: 0 };
    this.processing = true;

    let expiredCount = 0;
    let remindedCount = 0;

    try {
      // ── Step 1: expire overdue approved KYC records ───────────────────
      const overdueUsers = await kycRepository.findExpiredApprovedUsers();

      for (const user of overdueUsers) {
        try {
          await kycRepository.updateUserKycStatus(user.id, 'expired', user.kycExpiresAt);
          await this.config.notificationService.notifyKycExpired(user.id, 'IN_APP');
          expiredCount++;
          logger.info('KYC record expired', {
            operation: 'KYC_EXPIRED',
            userId: user.id,
            kycExpiresAt: user.kycExpiresAt,
          });
        } catch (err) {
          logger.error('Failed to expire KYC for user', {
            operation: 'KYC_EXPIRE_ERROR',
            userId: user.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // ── Step 2: send reminders for KYC expiring soon ──────────────────
      const soonToExpireUsers = await kycRepository.findUsersExpiringWithin(
        this.config.reminderWindowMs,
      );

      for (const user of soonToExpireUsers) {
        try {
          await this.config.notificationService.notifyKycExpiringSoon(
            user.id,
            user.kycExpiresAt,
            'IN_APP',
          );
          remindedCount++;
          logger.info('KYC expiry reminder sent', {
            operation: 'KYC_EXPIRY_REMINDER_SENT',
            userId: user.id,
            kycExpiresAt: user.kycExpiresAt,
          });
        } catch (err) {
          logger.error('Failed to send KYC expiry reminder', {
            operation: 'KYC_REMINDER_ERROR',
            userId: user.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      logger.error('KYC expiry job tick failed', {
        operation: 'KYC_EXPIRY_JOB_TICK_ERROR',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.processing = false;
      this.scheduleNext();
    }

    return { expired: expiredCount, reminded: remindedCount };
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
 * Factory that respects the KYC_EXPIRY_JOB_ENABLED env flag (default: enabled).
 */
export function createKycExpiryJobFromEnv(): KycExpiryJob | null {
  const enabled = (process.env.KYC_EXPIRY_JOB_ENABLED ?? 'true').toLowerCase() !== 'false';
  if (!enabled) {
    logger.info('KYC expiry job disabled via KYC_EXPIRY_JOB_ENABLED=false', {
      operation: 'KYC_EXPIRY_JOB_DISABLED',
    });
    return null;
  }

  const pollIntervalMs = Number(process.env.KYC_EXPIRY_POLL_INTERVAL_MS);
  const reminderWindowMs = Number(process.env.KYC_EXPIRY_REMINDER_WINDOW_MS);

  return new KycExpiryJob({
    pollIntervalMs:
      Number.isFinite(pollIntervalMs) && pollIntervalMs > 0 ? pollIntervalMs : undefined,
    reminderWindowMs:
      Number.isFinite(reminderWindowMs) && reminderWindowMs > 0 ? reminderWindowMs : undefined,
  });
}
