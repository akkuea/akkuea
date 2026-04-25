import { describe, it, expect, mock } from 'bun:test';
import { NotificationWorker } from '../workers/notificationWorker';
import type { NotificationService } from '../services/NotificationService';
import type { Notification } from '../db/schema';

type MockedService = {
  getPendingNotifications: ReturnType<typeof mock>;
  getNotificationsReadyForRetry: ReturnType<typeof mock>;
  markAsDelivered: ReturnType<typeof mock>;
  markAsFailed: ReturnType<typeof mock>;
};

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

function makeService(overrides: Partial<MockedService> = {}): MockedService {
  return {
    getPendingNotifications: mock(() => Promise.resolve([])),
    getNotificationsReadyForRetry: mock(() => Promise.resolve([])),
    markAsDelivered: mock(() => Promise.resolve(undefined)),
    markAsFailed: mock(() => Promise.resolve(undefined)),
    ...overrides,
  };
}

describe('NotificationWorker', () => {
  describe('successful delivery', () => {
    it('POSTs the notification to the webhook and marks it delivered', async () => {
      const service = makeService({
        getPendingNotifications: mock(() => Promise.resolve([sampleNotification()])),
      });
      const fetchImpl = mock(async () => new Response(null, { status: 200 }));

      const worker = new NotificationWorker(service as unknown as NotificationService, {
        pollIntervalMs: 10_000,
        webhookUrl: 'https://example.com/hook',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      await worker.tick();

      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const [url, init] = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]!;
      expect(url).toBe('https://example.com/hook');
      expect((init as RequestInit).method).toBe('POST');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.id).toBe('n-1');
      expect(body.eventType).toBe('SYSTEM_ALERT');

      expect(service.markAsDelivered).toHaveBeenCalledWith('n-1');
      expect(service.markAsFailed).not.toHaveBeenCalled();
    });

    it('processes pending and retry-ready notifications in the same tick', async () => {
      const pending = sampleNotification({ id: 'p-1' });
      const retry = sampleNotification({ id: 'r-1', deliveryStatus: 'FAILED' });
      const service = makeService({
        getPendingNotifications: mock(() => Promise.resolve([pending])),
        getNotificationsReadyForRetry: mock(() => Promise.resolve([retry])),
      });
      const fetchImpl = mock(async () => new Response(null, { status: 200 }));

      const worker = new NotificationWorker(service as unknown as NotificationService, {
        pollIntervalMs: 10_000,
        webhookUrl: 'https://example.com/hook',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      await worker.tick();

      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(service.markAsDelivered).toHaveBeenCalledTimes(2);
    });
  });

  describe('retry on failure', () => {
    it('marks the notification as failed when the webhook returns a non-2xx response', async () => {
      const service = makeService({
        getPendingNotifications: mock(() => Promise.resolve([sampleNotification()])),
      });
      const fetchImpl = mock(async () => new Response('bad gateway', { status: 502 }));

      const worker = new NotificationWorker(service as unknown as NotificationService, {
        pollIntervalMs: 10_000,
        webhookUrl: 'https://example.com/hook',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      await worker.tick();

      expect(service.markAsDelivered).not.toHaveBeenCalled();
      expect(service.markAsFailed).toHaveBeenCalledTimes(1);
      const call = (service.markAsFailed as unknown as { mock: { calls: unknown[][] } }).mock
        .calls[0]!;
      expect(call[0]).toBe('n-1');
      expect(String(call[1])).toContain('502');
    });

    it('marks the notification as failed when fetch throws', async () => {
      const service = makeService({
        getPendingNotifications: mock(() => Promise.resolve([sampleNotification()])),
      });
      const fetchImpl = mock(async () => {
        throw new Error('network down');
      });

      const worker = new NotificationWorker(service as unknown as NotificationService, {
        pollIntervalMs: 10_000,
        webhookUrl: 'https://example.com/hook',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      await worker.tick();

      expect(service.markAsFailed).toHaveBeenCalledWith('n-1', 'network down');
    });
  });

  describe('permanent failure', () => {
    it('still calls markAsFailed on the last attempt — the service decides the terminal state', async () => {
      // This notification is on its 3rd attempt (retryCount=2, maxRetries=3).
      // NotificationService.markAsFailed is responsible for flipping to permanent FAILED;
      // the worker must always delegate retry accounting to it.
      const note = sampleNotification({ retryCount: '2', maxRetries: '3' });

      const markAsFailed = mock((_id: string, _reason: string) =>
        Promise.resolve({
          ...note,
          deliveryStatus: 'FAILED',
          retryCount: '3',
          nextRetryAt: null,
        } as Notification),
      );

      const service = makeService({
        getPendingNotifications: mock(() => Promise.resolve([note])),
        markAsFailed,
      });
      const fetchImpl = mock(async () => new Response(null, { status: 500 }));

      const worker = new NotificationWorker(service as unknown as NotificationService, {
        pollIntervalMs: 10_000,
        webhookUrl: 'https://example.com/hook',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      await worker.tick();

      expect(markAsFailed).toHaveBeenCalledTimes(1);
      const [id, reason] = (markAsFailed as unknown as { mock: { calls: unknown[][] } }).mock
        .calls[0]!;
      expect(id).toBe('n-1');
      expect(String(reason)).toMatch(/500/);
    });
  });

  describe('configuration and lifecycle', () => {
    it('skips dispatch without marking failed when no webhook URL is configured', async () => {
      const service = makeService({
        getPendingNotifications: mock(() => Promise.resolve([sampleNotification()])),
      });
      const fetchImpl = mock(async () => new Response(null, { status: 200 }));

      const worker = new NotificationWorker(service as unknown as NotificationService, {
        pollIntervalMs: 10_000,
        webhookUrl: undefined,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      await worker.tick();

      expect(fetchImpl).not.toHaveBeenCalled();
      expect(service.markAsDelivered).not.toHaveBeenCalled();
      expect(service.markAsFailed).not.toHaveBeenCalled();
    });

    it('start() and stop() do not leave timers behind', async () => {
      const service = makeService();
      const worker = new NotificationWorker(service as unknown as NotificationService, {
        pollIntervalMs: 1_000_000,
        webhookUrl: 'https://example.com/hook',
      });
      worker.start();
      worker.start();
      await worker.stop();
      expect(worker.isRunning()).toBe(false);
    });

    it('overlapping ticks are prevented — a second tick is a no-op while the first is running', async () => {
      let resolveFetch: ((value: Response) => void) | null = null;
      const service = makeService({
        getPendingNotifications: mock(() => Promise.resolve([sampleNotification()])),
      });
      const fetchImpl = mock(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      );

      const worker = new NotificationWorker(service as unknown as NotificationService, {
        pollIntervalMs: 10_000,
        webhookUrl: 'https://example.com/hook',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });

      const firstTick = worker.tick();
      // Yield so the first tick can reach the fetch call before we fire the second.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      const secondTick = worker.tick();

      expect(fetchImpl).toHaveBeenCalledTimes(1);

      resolveFetch!(new Response(null, { status: 200 }));
      await Promise.all([firstTick, secondTick]);
    });
  });
});
