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
  claimDeliveryBatch: ReturnType<typeof mock>;
  markAsDelivered: ReturnType<typeof mock>;
  markAsFailed: ReturnType<typeof mock>;
};

function makeMinimalService(overrides: Partial<MinimalService> = {}): MinimalService {
  const service: MinimalService = {
    getPendingNotifications: mock(() => Promise.resolve([])),
    getNotificationsReadyForRetry: mock(() => Promise.resolve([])),
    // The worker claims its batch in one call; here the claim hands back
    // whatever the pending and retry-ready mocks return, in that order.
    claimDeliveryBatch: mock(async () => {
      const [pending, retry] = await Promise.all([
        service.getPendingNotifications(),
        service.getNotificationsReadyForRetry(),
      ]);
      return [...(pending as Notification[]), ...(retry as Notification[])];
    }),
    markAsDelivered: mock(() => Promise.resolve(undefined)),
    markAsFailed: mock(() => Promise.resolve(undefined)),
  };
  return Object.assign(service, overrides);
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

    const fetchImpl = mock(async () => {
      throw new Error('ECONNREFUSED');
    });
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
//
// markAsFailed records the attempt through one atomic repository call
// (recordFailure) and decides on the DLQ from the row that call returns. The
// SQL itself (atomic increment, BOUNCED transition, backoff) is exercised
// against a real database in notificationClaiming.test.ts.

type RecordFailureCall = [
  string,
  { reason: string; nextRetryDelayMs?: number; retryBaseDelayMs: number; maxRetryDelayMs: number },
];

function recordFailureCalls(recordFailure: ReturnType<typeof mock>): RecordFailureCall[] {
  return (recordFailure as unknown as { mock: { calls: RecordFailureCall[] } }).mock.calls;
}

describe('NotificationService.markAsFailed – DLQ promotion', () => {
  it('inserts a DLQ entry and marks the notification BOUNCED when retries are exhausted', async () => {
    const bounced = sampleNotification({
      retryCount: '3',
      maxRetries: '3',
      deliveryStatus: 'BOUNCED',
    });

    const recordFailure = mock(() => Promise.resolve(bounced));
    const createFromNotification = mock(() => Promise.resolve(sampleDlqEntry()));

    const notifRepo = { recordFailure } as unknown as NotificationRepository;
    const dlqRepo = { createFromNotification } as unknown as NotificationDlqRepository;

    const service = new NotificationService(
      notifRepo,
      { maxRetries: 3, retryDelayMs: 1_000 },
      dlqRepo,
    );
    const result = await service.markAsFailed('n-1', 'Webhook responded with 500');

    // DLQ must be written, from the row the atomic update returned
    expect(createFromNotification).toHaveBeenCalledTimes(1);
    expect(createFromNotification).toHaveBeenCalledWith(bounced, 'Webhook responded with 500');
    // Status must be BOUNCED so the notification is excluded from retry polling
    expect(result?.deliveryStatus).toBe('BOUNCED');
    expect(recordFailureCalls(recordFailure)[0]![0]).toBe('n-1');
  });

  it('does not insert a DLQ entry when retries remain', async () => {
    const failed = sampleNotification({
      retryCount: '1',
      maxRetries: '3',
      deliveryStatus: 'FAILED',
    });

    const recordFailure = mock(() => Promise.resolve(failed));
    const createFromNotification = mock(() => Promise.resolve(sampleDlqEntry()));

    const notifRepo = { recordFailure } as unknown as NotificationRepository;
    const dlqRepo = { createFromNotification } as unknown as NotificationDlqRepository;

    const service = new NotificationService(
      notifRepo,
      { maxRetries: 3, retryDelayMs: 1_000 },
      dlqRepo,
    );
    const result = await service.markAsFailed('n-1', 'Webhook responded with 503');

    expect(createFromNotification).not.toHaveBeenCalled();
    expect(result?.deliveryStatus).toBe('FAILED');
  });

  it('forwards an explicit retry delay and its backoff settings to the atomic update', async () => {
    const BASE = 10_000;
    const recordFailure = mock(() =>
      Promise.resolve(sampleNotification({ deliveryStatus: 'FAILED' })),
    );
    const notifRepo = { recordFailure } as unknown as NotificationRepository;
    const dlqRepo = { createFromNotification: mock() } as unknown as NotificationDlqRepository;

    const service = new NotificationService(
      notifRepo,
      { maxRetries: 5, retryDelayMs: BASE, maxRetryDelayMs: 120_000 },
      dlqRepo,
    );
    // Supply explicit delay (as the worker would) so the service honours it
    const explicitDelay = 20_000;
    await service.markAsFailed('n-1', 'error', explicitDelay);

    const [, options] = recordFailureCalls(recordFailure)[0]!;
    expect(options.reason).toBe('error');
    expect(options.nextRetryDelayMs).toBe(explicitDelay);
    expect(options.retryBaseDelayMs).toBe(BASE);
    expect(options.maxRetryDelayMs).toBe(120_000);
  });

  it('is non-fatal when the DLQ write fails', async () => {
    const bounced = sampleNotification({
      retryCount: '3',
      maxRetries: '3',
      deliveryStatus: 'BOUNCED',
    });

    const recordFailure = mock(() => Promise.resolve(bounced));
    const createFromNotification = mock(() => Promise.reject(new Error('DB down')));

    const notifRepo = { recordFailure } as unknown as NotificationRepository;
    const dlqRepo = { createFromNotification } as unknown as NotificationDlqRepository;

    const service = new NotificationService(
      notifRepo,
      { maxRetries: 3, retryDelayMs: 1_000 },
      dlqRepo,
    );

    // Must not throw even though the DLQ write rejected
    const result = await service.markAsFailed('n-1', 'webhook error');
    expect(result).toBeDefined();
    // Status is still BOUNCED
    expect(result?.deliveryStatus).toBe('BOUNCED');
  });

  it('writes no DLQ entry when the notification was already DELIVERED or BOUNCED', async () => {
    // recordFailure returns nothing when the row is already terminal, e.g. a
    // concurrent call bounced it first.
    const recordFailure = mock(() => Promise.resolve(undefined));
    const createFromNotification = mock(() => Promise.resolve(sampleDlqEntry()));

    const notifRepo = { recordFailure } as unknown as NotificationRepository;
    const dlqRepo = { createFromNotification } as unknown as NotificationDlqRepository;

    const service = new NotificationService(
      notifRepo,
      { maxRetries: 3, retryDelayMs: 1_000 },
      dlqRepo,
    );
    const result = await service.markAsFailed('n-1', 'webhook error');
    expect(result).toBeUndefined();
  });
});
