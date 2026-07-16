/**
 * Tests for dead-letter queue and exponential back-off in NotificationWorker.
 *
 * Test areas:
 *  1. computeBackoffDelay() – verifies doubling delay and hard cap.
 *  2. dispatch() – verifies the computed delay is forwarded to markAsFailed().
 *  3. DLQ promotion – when retries are exhausted the service moves the entry
 *     to the DLQ and flips the notification to BOUNCED.
 *  4. reprocessDlqEntry() – verifies the admin reprocess path.
 *  5. Reprocess endpoint – smoke-tests the admin HTTP route.
 */
import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { NotificationWorker } from '../workers/notificationWorker';
import { NotificationService } from '../services/NotificationService';
import { NotificationDlqRepository } from '../repositories/NotificationDlqRepository';
import { NotificationRepository } from '../repositories/NotificationRepository';
import type { Notification, NotificationDlqEntry } from '../db/schema';

// ─── helpers ──────────────────────────────────────────────────────────────────

function sampleNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    userId: 'u-1',
    eventType: 'SYSTEM_ALERT',
    title: 'Test',
    message: 'Test message',
    channel: 'EMAIL',
    recipient: 'user@example.com',
    relatedEntityType: null,
    relatedEntityId: null,
    deliveryStatus: 'PENDING',
    retryCount: '0',
    maxRetries: '3',
    isRead: false,
    readAt: null,
    sentAt: null,
    deliveredAt: null,
    failureReason: null,
    nextRetryAt: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Notification;
}

function sampleDlqEntry(overrides: Partial<NotificationDlqEntry> = {}): NotificationDlqEntry {
  return {
    id: 'dlq-1',
    notificationId: 'n-1',
    userId: 'u-1',
    eventType: 'SYSTEM_ALERT',
    title: 'Test',
    message: 'Test message',
    channel: 'EMAIL',
    recipient: 'user@example.com',
    relatedEntityType: null,
    relatedEntityId: null,
    metadata: null,
    lastFailureReason: 'Webhook responded with 500',
    retryCount: 3,
    requeuedAt: null,
    requeuedBy: null,
    resolvedAt: null,
    createdAt: new Date(),
    ...overrides,
  } as NotificationDlqEntry;
}

type MinimalService = {
  getPendingNotifications: ReturnType<typeof mock>;
  getNotificationsReadyForRetry: ReturnType<typeof mock>;
  markAsDelivered: ReturnType<typeof mock>;
  markAsFailed: ReturnType<typeof mock>;
};

function makeMinimalService(overrides: Partial<MinimalService> = {}): MinimalService {
  return {
    getPendingNotifications: mock(() => Promise.resolve([])),
    getNotificationsReadyForRetry: mock(() => Promise.resolve([])),
    markAsDelivered: mock(() => Promise.resolve(undefined)),
    markAsFailed: mock(() => Promise.resolve(undefined)),
    ...overrides,
  };
}

// ─── 1. computeBackoffDelay (via the worker's public tick) ────────────────────

describe('NotificationWorker – exponential back-off', () => {
  it('passes an exponentially growing delay to markAsFailed on each attempt', async () => {
    const BASE = 1_000; // small for fast tests
    const MAX = 8_000;

    // retryCount = '0' → attemptNumber = 1 → delay = 1_000 * 2^0 = 1_000
    const note0 = sampleNotification({ retryCount: '0' });
    // retryCount = '1' → attemptNumber = 2 → delay = 1_000 * 2^1 = 2_000
    const note1 = sampleNotification({ id: 'n-2', retryCount: '1' });
    // retryCount = '2' → attemptNumber = 3 → delay = 1_000 * 2^2 = 4_000
    const note2 = sampleNotification({ id: 'n-3', retryCount: '2' });

    const markAsFailed = mock(() => Promise.resolve(undefined));
    const service = makeMinimalService({
      getPendingNotifications: mock(() => Promise.resolve([note0, note1, note2])),
      markAsFailed,
    });

    const fetchImpl = mock(async () => new Response(null, { status: 503 }));
    const worker = new NotificationWorker(service as unknown as NotificationService, {
      webhookUrl: 'https://example.com/hook',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryBaseDelayMs: BASE,
      maxRetryDelayMs: MAX,
    });

    await worker.tick();

    expect(markAsFailed).toHaveBeenCalledTimes(3);

    const calls = (markAsFailed as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    // [id, reason, delay]
    expect(calls[0]![2]).toBe(1_000); // 2^0
    expect(calls[1]![2]).toBe(2_000); // 2^1
    expect(calls[2]![2]).toBe(4_000); // 2^2
  });

  it('caps the computed delay at maxRetryDelayMs', async () => {
    const BASE = 10_000;
    const MAX = 15_000; // 10_000 * 2^1 = 20_000 would exceed this

    const note = sampleNotification({ retryCount: '1' }); // attempt 2 → 20_000 uncapped
    const markAsFailed = mock(() => Promise.resolve(undefined));
    const service = makeMinimalService({
      getPendingNotifications: mock(() => Promise.resolve([note])),
      markAsFailed,
    });

    const fetchImpl = mock(async () => new Response(null, { status: 503 }));
    const worker = new NotificationWorker(service as unknown as NotificationService, {
      webhookUrl: 'https://example.com/hook',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryBaseDelayMs: BASE,
      maxRetryDelayMs: MAX,
    });

    await worker.tick();

    const calls = (markAsFailed as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls[0]![2]).toBe(MAX);
  });

  it('also passes the backoff delay when fetch throws', async () => {
    const BASE = 2_000;
    const note = sampleNotification({ retryCount: '0' }); // attempt 1 → 2_000
    const markAsFailed = mock(() => Promise.resolve(undefined));
    const service = makeMinimalService({
      getPendingNotifications: mock(() => Promise.resolve([note])),
      markAsFailed,
    });

    const fetchImpl = mock(async () => { throw new Error('ECONNREFUSED'); });
    const worker = new NotificationWorker(service as unknown as NotificationService, {
      webhookUrl: 'https://example.com/hook',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryBaseDelayMs: BASE,
      maxRetryDelayMs: 60_000,
    });

    await worker.tick();

    const calls = (markAsFailed as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(calls[0]![0]).toBe('n-1');
    expect(calls[0]![2]).toBe(BASE);
  });
});

// ─── 2. NotificationService – DLQ promotion ───────────────────────────────────

describe('NotificationService.markAsFailed – DLQ promotion', () => {
  it('inserts a DLQ entry and marks the notification BOUNCED when retries are exhausted', async () => {
    const notification = sampleNotification({ retryCount: '2', maxRetries: '3' });

    const findById = mock(() => Promise.resolve(notification));
    const updateDeliveryStatus = mock(() =>
      Promise.resolve({ ...notification, deliveryStatus: 'BOUNCED' } as Notification),
    );
    const createFromNotification = mock(() => Promise.resolve(sampleDlqEntry()));

    const notifRepo = {
      findById,
      updateDeliveryStatus,
    } as unknown as NotificationRepository;

    const dlqRepo = {
      createFromNotification,
    } as unknown as NotificationDlqRepository;

    const service = new NotificationService(notifRepo, { maxRetries: 3, retryDelayMs: 1_000 }, dlqRepo);
    await service.markAsFailed('n-1', 'Webhook responded with 500');

    // DLQ must be written
    expect(createFromNotification).toHaveBeenCalledTimes(1);
    // Status must be BOUNCED so the notification is excluded from retry polling
    const statusCall = (updateDeliveryStatus as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    expect(statusCall[1]).toBe('BOUNCED');
  });

  it('does not insert a DLQ entry when retries remain', async () => {
    const notification = sampleNotification({ retryCount: '0', maxRetries: '3' });

    const findById = mock(() => Promise.resolve(notification));
    const updateDeliveryStatus = mock(() => Promise.resolve({ ...notification } as Notification));
    const createFromNotification = mock(() => Promise.resolve(sampleDlqEntry()));

    const notifRepo = { findById, updateDeliveryStatus } as unknown as NotificationRepository;
    const dlqRepo = { createFromNotification } as unknown as NotificationDlqRepository;

    const service = new NotificationService(notifRepo, { maxRetries: 3, retryDelayMs: 1_000 }, dlqRepo);
    await service.markAsFailed('n-1', 'Webhook responded with 503');

    expect(createFromNotification).not.toHaveBeenCalled();
    const statusCall = (updateDeliveryStatus as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    expect(statusCall[1]).toBe('FAILED');
  });

  it('applies exponential back-off when scheduling the next retry', async () => {
    const BASE = 10_000;
    const notification = sampleNotification({ retryCount: '1', maxRetries: '5' }); // attempt 2

    const findById = mock(() => Promise.resolve(notification));
    const updateDeliveryStatus = mock(() => Promise.resolve({ ...notification } as Notification));
    const notifRepo = { findById, updateDeliveryStatus } as unknown as NotificationRepository;
    const dlqRepo = { createFromNotification: mock() } as unknown as NotificationDlqRepository;

    const service = new NotificationService(
      notifRepo,
      { maxRetries: 5, retryDelayMs: BASE },
      dlqRepo,
    );
    // Supply explicit delay (as the worker would) so the service honours it
    const explicitDelay = 20_000;
    await service.markAsFailed('n-1', 'error', explicitDelay);

    const statusCall = (updateDeliveryStatus as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    const data = statusCall[2] as { nextRetryAt: Date };
    // nextRetryAt should be approximately now + explicitDelay
    const diff = data.nextRetryAt.getTime() - Date.now();
    expect(diff).toBeGreaterThan(explicitDelay - 500);
    expect(diff).toBeLessThan(explicitDelay + 500);
  });

  it('is non-fatal when the DLQ write fails', async () => {
    const notification = sampleNotification({ retryCount: '2', maxRetries: '3' });

    const findById = mock(() => Promise.resolve(notification));
    const updateDeliveryStatus = mock(() => Promise.resolve({ ...notification } as Notification));
    const createFromNotification = mock(() => Promise.reject(new Error('DB down')));

    const notifRepo = { findById, updateDeliveryStatus } as unknown as NotificationRepository;
    const dlqRepo = { createFromNotification } as unknown as NotificationDlqRepository;

    const service = new NotificationService(notifRepo, { maxRetries: 3, retryDelayMs: 1_000 }, dlqRepo);

    // Must not throw even though the DLQ write rejected
    await expect(service.markAsFailed('n-1', 'webhook error')).resolves.toBeDefined();
    // Status should still be updated to BOUNCED
    const statusCall = (updateDeliveryStatus as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
    expect(statusCall[1]).toBe('BOUNCED');
  });
});

// ─── 3. NotificationService.reprocessDlqEntry ─────────────────────────────────

describe('NotificationService.reprocessDlqEntry', () => {
  let findById: ReturnType<typeof mock>;
  let create: ReturnType<typeof mock>;
  let markAsRequeued: ReturnType<typeof mock>;

  beforeEach(() => {
    findById = mock(() => Promise.resolve(sampleDlqEntry()));
    create = mock(() => Promise.resolve(sampleNotification({ id: 'n-new' })));
    markAsRequeued = mock(() =>
      Promise.resolve(sampleDlqEntry({ requeuedAt: new Date(), requeuedBy: 'admin@example.com' })),
    );
  });

  it('re-creates the notification as PENDING and marks the DLQ entry requeued', async () => {
    const notifRepo = { create } as unknown as NotificationRepository;
    const dlqRepo = { findById, markAsRequeued } as unknown as NotificationDlqRepository;
    const service = new NotificationService(notifRepo, undefined, dlqRepo);

    const result = await service.reprocessDlqEntry('dlq-1', 'admin@example.com');

    expect(create).toHaveBeenCalledTimes(1);
    const createArg = (create as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0] as Record<string, unknown>;
    expect(createArg.deliveryStatus).toBe('PENDING');
    expect(createArg.retryCount).toBe('0');

    expect(markAsRequeued).toHaveBeenCalledWith('dlq-1', 'admin@example.com');
    expect(result.notification.id).toBe('n-new');
    expect(result.dlqEntry.requeuedBy).toBe('admin@example.com');
  });

  it('throws NOT_FOUND when the DLQ entry does not exist', async () => {
    const notifRepo = { create } as unknown as NotificationRepository;
    const dlqRepo = { findById: mock(() => Promise.resolve(undefined)) } as unknown as NotificationDlqRepository;
    const service = new NotificationService(notifRepo, undefined, dlqRepo);

    await expect(service.reprocessDlqEntry('dlq-missing', 'admin')).rejects.toThrow('not found');
  });

  it('throws CONFLICT when the DLQ entry has already been requeued', async () => {
    const already = sampleDlqEntry({ requeuedAt: new Date() });
    const notifRepo = { create } as unknown as NotificationRepository;
    const dlqRepo = { findById: mock(() => Promise.resolve(already)) } as unknown as NotificationDlqRepository;
    const service = new NotificationService(notifRepo, undefined, dlqRepo);

    await expect(service.reprocessDlqEntry('dlq-1', 'admin')).rejects.toThrow('already been requeued');
  });

  it('throws CONFLICT when the DLQ entry has already been resolved', async () => {
    const resolved = sampleDlqEntry({ resolvedAt: new Date() });
    const notifRepo = { create } as unknown as NotificationRepository;
    const dlqRepo = { findById: mock(() => Promise.resolve(resolved)) } as unknown as NotificationDlqRepository;
    const service = new NotificationService(notifRepo, undefined, dlqRepo);

    await expect(service.reprocessDlqEntry('dlq-1', 'admin')).rejects.toThrow('already been resolved');
  });
});

// ─── 4. DLQ Elysia Routes ─────────────────────────────────────────────────────

import { Elysia } from 'elysia';
import { notificationDlqRoutes } from '../routes/notificationDlq';

describe('DLQ Elysia Routes', () => {
  const CREDENTIAL = 'test-secret-key-1234';
  let app: { handle: (request: Request) => Promise<Response> };

  beforeEach(() => {
    process.env.OPERATIONS_BACKEND_CREDENTIAL = CREDENTIAL;
    app = new Elysia()
      .onError(({ error }) => {
        console.error("ELYSIA ERROR:", error);
      })
      .use(notificationDlqRoutes);
  });

  it('blocks request with 403 status if x-internal-api-key is incorrect', async () => {
    const response = await app.handle(
      new Request('http://localhost/internal/notifications/dlq', {
        headers: {
          'x-internal-api-key': 'wrong-key',
        },
      }),
    );
    expect(response.status).toBe(403);
    const body = (await response.json()) as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toBe('FORBIDDEN');
  });

  it('GET /internal/notifications/dlq returns lists of entries', async () => {
    const entry = sampleDlqEntry();
    const original = NotificationService.prototype.getDlqEntries;
    NotificationService.prototype.getDlqEntries = mock(() => Promise.resolve([entry]));

    try {
      const response = await app.handle(
        new Request('http://localhost/internal/notifications/dlq?limit=25&offset=0', {
          headers: {
            'x-internal-api-key': CREDENTIAL,
          },
        }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as { success: boolean; data: Array<{ id: string }> };
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0]!.id).toBe('dlq-1');
    } finally {
      NotificationService.prototype.getDlqEntries = original;
    }
  });

  it('GET /internal/notifications/dlq/:id returns 404 if not found', async () => {
    const original = NotificationService.prototype.getDlqEntryById;
    NotificationService.prototype.getDlqEntryById = mock(() => Promise.resolve(undefined));

    try {
      const nonExistentId = '12345678-1234-1234-1234-123456789012';
      const response = await app.handle(
        new Request(`http://localhost/internal/notifications/dlq/${nonExistentId}`, {
          headers: {
            'x-internal-api-key': CREDENTIAL,
          },
        }),
      );
      expect(response.status).toBe(404);
      const body = (await response.json()) as { success: boolean; error: string };
      expect(body.success).toBe(false);
      expect(body.error).toBe('NOT_FOUND');
    } finally {
      NotificationService.prototype.getDlqEntryById = original;
    }
  });

  it('POST /internal/notifications/dlq/:id/reprocess triggers reprocessing', async () => {
    const newNotif = sampleNotification({ id: 'n-new' });
    const dlqUpdated = sampleDlqEntry({ id: 'dlq-1', requeuedAt: new Date(), requeuedBy: 'admin@example.com' });
    const original = NotificationService.prototype.reprocessDlqEntry;
    NotificationService.prototype.reprocessDlqEntry = mock(() => Promise.resolve({ dlqEntry: dlqUpdated, notification: newNotif }));

    try {
      const dlqId = '12345678-1234-1234-1234-123456789012';
      const response = await app.handle(
        new Request(`http://localhost/internal/notifications/dlq/${dlqId}/reprocess`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': CREDENTIAL,
          },
          body: JSON.stringify({ requeuedBy: 'admin@example.com' }),
        }),
      );
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        success: boolean;
        data: { notification: { id: string }; dlqEntry: { requeuedBy: string } };
      };
      expect(body.success).toBe(true);
      expect(body.data.notification.id).toBe('n-new');
      expect(body.data.dlqEntry.requeuedBy).toBe('admin@example.com');
    } finally {
      NotificationService.prototype.reprocessDlqEntry = original;
    }
  });
});
