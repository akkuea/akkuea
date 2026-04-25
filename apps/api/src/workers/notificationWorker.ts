import { NotificationService } from '../services/NotificationService';
import { logger } from '../services/logger';
import type { Notification } from '../db/schema';

export interface NotificationWorkerConfig {
  pollIntervalMs?: number;
  webhookUrl?: string;
  webhookSecret?: string;
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface ResolvedConfig {
  pollIntervalMs: number;
  webhookUrl?: string;
  webhookSecret?: string;
  requestTimeoutMs: number;
  fetchImpl: typeof fetch;
}

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

export class NotificationWorker {
  private readonly service: NotificationService;
  private readonly config: ResolvedConfig;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private processing = false;

  constructor(service: NotificationService, config?: NotificationWorkerConfig) {
    this.service = service;
    const envPoll = Number(process.env.NOTIFICATION_POLL_INTERVAL_MS);
    const envTimeout = Number(process.env.NOTIFICATION_REQUEST_TIMEOUT_MS);
    this.config = {
      pollIntervalMs:
        config?.pollIntervalMs ??
        (Number.isFinite(envPoll) && envPoll > 0 ? envPoll : DEFAULT_POLL_INTERVAL_MS),
      webhookUrl: config?.webhookUrl ?? process.env.NOTIFICATION_WEBHOOK_URL,
      webhookSecret: config?.webhookSecret ?? process.env.NOTIFICATION_WEBHOOK_SECRET,
      requestTimeoutMs:
        config?.requestTimeoutMs ??
        (Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : DEFAULT_REQUEST_TIMEOUT_MS),
      fetchImpl: config?.fetchImpl ?? fetch,
    };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info('Notification worker started', {
      operation: 'NOTIFICATION_WORKER_START',
      pollIntervalMs: this.config.pollIntervalMs,
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

  async tick(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    try {
      const [pending, readyForRetry] = await Promise.all([
        this.service.getPendingNotifications(),
        this.service.getNotificationsReadyForRetry(),
      ]);

      const seen = new Set<string>();
      const queue = [...pending, ...readyForRetry].filter((n) => {
        if (seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
      });

      for (const notification of queue) {
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

  private async dispatch(notification: Notification): Promise<void> {
    if (!this.config.webhookUrl) {
      logger.warn('No NOTIFICATION_WEBHOOK_URL configured, skipping dispatch', {
        operation: 'NOTIFICATION_DISPATCH_SKIPPED',
        notificationId: notification.id,
      });
      return;
    }

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

    try {
      const response = await this.config.fetchImpl(this.config.webhookUrl, {
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
        await this.service.markAsFailed(notification.id, reason);
        logger.warn('Notification delivery failed', {
          operation: 'NOTIFICATION_DELIVERY_FAILED',
          notificationId: notification.id,
          status: response.status,
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
      await this.service.markAsFailed(notification.id, reason);
      logger.error('Notification delivery error', {
        operation: 'NOTIFICATION_DELIVERY_ERROR',
        notificationId: notification.id,
        error: reason,
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
