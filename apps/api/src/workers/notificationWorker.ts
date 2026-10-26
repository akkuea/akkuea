import { NotificationService } from '../services/NotificationService';
import { logger } from '../services/logger';
import type { Notification } from '../db/schema';

export interface NotificationWorkerConfig {
  pollIntervalMs?: number;
  webhookUrl?: string;
  webhookSecret?: string;
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  retryBaseDelayMs?: number;
  maxRetryDelayMs?: number;
  batchSize?: number;
  claimTimeoutMs?: number;
}

interface ResolvedConfig {
  pollIntervalMs: number;
  webhookUrl?: string;
  webhookSecret?: string;
  requestTimeoutMs: number;
  fetchImpl: typeof fetch;
  retryBaseDelayMs: number;
  maxRetryDelayMs: number;
  batchSize: number;
  claimTimeoutMs: number;
}

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_BASE_DELAY_MS = 60_000;
const DEFAULT_MAX_RETRY_DELAY_MS = 60 * 60 * 1_000;
const DEFAULT_BATCH_SIZE = 100;
const CLAIM_TIMEOUT_MARGIN_MS = 5_000;

function positiveFromEnv(name: string): number | undefined {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export class NotificationWorker {
  private readonly service: NotificationService;
  private readonly config: ResolvedConfig;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private processing = false;

  private warnedMissingWebhook = false;

  constructor(service: NotificationService, config?: NotificationWorkerConfig) {
    this.service = service;
    const envPoll = Number(process.env.NOTIFICATION_POLL_INTERVAL_MS);
    const envTimeout = Number(process.env.NOTIFICATION_REQUEST_TIMEOUT_MS);
    const envBase = Number(process.env.NOTIFICATION_RETRY_BASE_DELAY_MS);
    const envMax = Number(process.env.NOTIFICATION_MAX_RETRY_DELAY_MS);
    const requestTimeoutMs =
      config?.requestTimeoutMs ??
      (Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : DEFAULT_REQUEST_TIMEOUT_MS);
    const batchSize = Math.floor(
      config?.batchSize ?? positiveFromEnv('NOTIFICATION_BATCH_SIZE') ?? DEFAULT_BATCH_SIZE,
    );
    this.config = {
      pollIntervalMs:
        config?.pollIntervalMs ??
        (Number.isFinite(envPoll) && envPoll > 0 ? envPoll : DEFAULT_POLL_INTERVAL_MS),
      webhookUrl: config?.webhookUrl ?? process.env.NOTIFICATION_WEBHOOK_URL,
      webhookSecret: config?.webhookSecret ?? process.env.NOTIFICATION_WEBHOOK_SECRET,
      requestTimeoutMs,
      fetchImpl: config?.fetchImpl ?? fetch,
      retryBaseDelayMs:
        config?.retryBaseDelayMs ??
        (Number.isFinite(envBase) && envBase > 0 ? envBase : DEFAULT_RETRY_BASE_DELAY_MS),
      maxRetryDelayMs:
        config?.maxRetryDelayMs ??
        (Number.isFinite(envMax) && envMax > 0 ? envMax : DEFAULT_MAX_RETRY_DELAY_MS),
      batchSize: batchSize > 0 ? batchSize : DEFAULT_BATCH_SIZE,
      claimTimeoutMs:
        config?.claimTimeoutMs ??
        positiveFromEnv('NOTIFICATION_CLAIM_TIMEOUT_MS') ??
        batchSize * requestTimeoutMs + CLAIM_TIMEOUT_MARGIN_MS,
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info('Notification worker started', {
      operation: 'NOTIFICATION_WORKER_START',
      pollIntervalMs: this.config.pollIntervalMs,
      batchSize: this.config.batchSize,
      claimTimeoutMs: this.config.claimTimeoutMs,
      webhookConfigured: Boolean(this.config.webhookUrl),
    });
    this.scheduleNext();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    while (this.processing) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    logger.info('Notification worker stopped', { operation: 'NOTIFICATION_WORKER_STOP' });
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Claims one bounded batch of due notifications and delivers it. The claim
   * is atomic across processes, so several API instances can run this worker
   * at the same time without delivering a notification twice.
   */
  async tick(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      // Without a webhook nothing can be delivered, so leave the rows unclaimed
      // for an instance that has one configured.
      if (!this.config.webhookUrl) {
        if (!this.warnedMissingWebhook) {
          this.warnedMissingWebhook = true;
          logger.warn('No NOTIFICATION_WEBHOOK_URL configured, skipping dispatch', {
            operation: 'NOTIFICATION_DISPATCH_SKIPPED',
          });
        }
        return;
      }

      const batch = await this.service.claimDeliveryBatch({
        limit: this.config.batchSize,
        staleAfterMs: this.config.claimTimeoutMs,
      });

      for (const notification of batch) {
        await this.dispatch(notification);
      }
    } catch (error) {
      logger.error('Notification worker tick failed', {
        operation: 'NOTIFICATION_WORKER_TICK',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.processing = false;
      this.scheduleNext();
    }
  }

  private scheduleNext(): void {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      void this.tick();
    }, this.config.pollIntervalMs);
    // Don't keep the event loop alive just for the worker poll.
    const t = this.timer as unknown as { unref?: () => void };
    if (typeof t.unref === 'function') t.unref();
  }

  private computeBackoffDelay(attemptNumber: number): number {
    const delay = this.config.retryBaseDelayMs * Math.pow(2, attemptNumber - 1);
    return Math.min(delay, this.config.maxRetryDelayMs);
  }

  private async dispatch(notification: Notification): Promise<void> {
    const webhookUrl = this.config.webhookUrl;
    if (!webhookUrl) return;

    const payload = {
      id: notification.id,
      userId: notification.userId,
      eventType: notification.eventType,
      title: notification.title,
      message: notification.message,
      channel: notification.channel,
      recipient: notification.recipient,
      relatedEntityType: notification.relatedEntityType,
      relatedEntityId: notification.relatedEntityId,
      metadata: this.parseMetadata(notification.metadata),
      createdAt: notification.createdAt,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    // `notification` comes from this worker's claim, so its retry count is the
    // current value and no other worker is attempting the same row.
    const attemptNumber = parseInt(notification.retryCount) + 1;
    const backoffDelay = this.computeBackoffDelay(attemptNumber);

    try {
      const response = await this.config.fetchImpl(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.webhookSecret ? { 'X-Webhook-Secret': this.config.webhookSecret } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const reason = `Webhook responded with ${response.status}`;
        await this.service.markAsFailed(notification.id, reason, backoffDelay);
        logger.warn('Notification delivery failed', {
          operation: 'NOTIFICATION_DELIVERY_FAILED',
          notificationId: notification.id,
          status: response.status,
          retryCount: notification.retryCount,
          nextRetryDelayMs: backoffDelay,
        });
        return;
      }

      await this.service.markAsDelivered(notification.id);
      logger.info('Notification delivered', {
        operation: 'NOTIFICATION_DELIVERED',
        notificationId: notification.id,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.service.markAsFailed(notification.id, reason, backoffDelay);
      logger.error('Notification delivery error', {
        operation: 'NOTIFICATION_DELIVERY_ERROR',
        notificationId: notification.id,
        error: reason,
        retryCount: notification.retryCount,
        nextRetryDelayMs: backoffDelay,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseMetadata(raw: string | null): Record<string, unknown> | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export function createNotificationWorkerFromEnv(
  service: NotificationService,
): NotificationWorker | null {
  const enabled = (process.env.NOTIFICATIONS_ENABLED ?? 'true').toLowerCase() !== 'false';
  if (!enabled) {
    logger.info('Notification worker disabled via NOTIFICATIONS_ENABLED=false', {
      operation: 'NOTIFICATION_WORKER_DISABLED',
    });
    return null;
  }
  return new NotificationWorker(service);
}
