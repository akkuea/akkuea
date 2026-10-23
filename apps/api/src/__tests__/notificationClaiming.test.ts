/**
 * Notification delivery against a real PostgreSQL database: row claiming
 * across concurrent workers, batch limits, stale-claim recovery, the atomic
 * retry increment and the single dead-letter entry per notification.
 *
 * These need DATABASE_URL with the drizzle migrations applied, and are skipped
 * without it. Each test works on notifications owned by one throwaway user.
 * Claimable rows left behind by other test files are hidden from the claim
 * query for the duration of a test and restored afterwards, so the counts here
 * are exact without deleting anyone else's data.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  notificationDlq,
  notifications,
  users,
  type NewNotification,
  type Notification,
} from '../db/schema';
import { NotificationService } from '../services/NotificationService';
import { NotificationWorker } from '../workers/notificationWorker';

const skipIfNoDatabase = !process.env.DATABASE_URL;

const WEBHOOK_URL = 'https://hooks.example.test/notifications';

let userId = '';
let parkedIds: string[] = [];

/** A fake webhook that records which notification each request delivered. */
function recordingWebhook(status = 200) {
  const deliveredIds: string[] = [];
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { id: string };
    deliveredIds.push(body.id);
    // Yield to the event loop so concurrent workers really interleave.
    await new Promise((resolve) => setTimeout(resolve, 2));
    return new Response(null, { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, deliveredIds };
}

function makeWorker(
  fetchImpl: typeof fetch,
  options: { batchSize?: number; claimTimeoutMs?: number } = {},
) {
  return new NotificationWorker(new NotificationService(), {
    pollIntervalMs: 60_000,
    webhookUrl: WEBHOOK_URL,
    fetchImpl,
    batchSize: options.batchSize ?? 50,
    claimTimeoutMs: options.claimTimeoutMs ?? 5 * 60_000,
    retryBaseDelayMs: 60_000,
    maxRetryDelayMs: 60 * 60_000,
  });
}

async function insertNotifications(
  count: number,
  overrides: Partial<NewNotification> = {},
): Promise<Notification[]> {
  const rows: NewNotification[] = Array.from({ length: count }, (_, i) => ({
    userId,
    eventType: 'SYSTEM_ALERT',
    title: `Claim test ${i}`,
    message: 'Delivered by the notification worker',
    channel: 'IN_APP',
    deliveryStatus: 'PENDING',
    retryCount: '0',
    maxRetries: '3',
    ...overrides,
  }));
  return db.insert(notifications).values(rows).returning();
}

async function reload(id: string): Promise<Notification> {
  const [row] = await db.select().from(notifications).where(eq(notifications.id, id));
  if (!row) throw new Error(`notification ${id} not found`);
  return row;
}

async function dlqRowsFor(notificationId: string): Promise<number> {
  const rows = await db
    .select({ id: notificationDlq.id })
    .from(notificationDlq)
    .where(eq(notificationDlq.notificationId, notificationId));
  return rows.length;
}

function countBy(ids: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

describe.skipIf(skipIfNoDatabase)('Notification delivery against a real database', () => {
  beforeAll(async () => {
    const wallet = `G${crypto.randomUUID().replace(/-/g, '').toUpperCase()}`.padEnd(56, 'A');
    const [user] = await db.insert(users).values({ walletAddress: wallet }).returning();
    userId = user!.id;
  });

  beforeEach(async () => {
    // Hide claimable rows that belong to other tests so batch counts are exact.
    const parked = await db
      .update(notifications)
      .set({ claimedAt: sql`'infinity'::timestamptz` })
      .where(
        and(
          ne(notifications.userId, userId),
          sql`${notifications.claimedAt} is null`,
          inArray(notifications.deliveryStatus, ['PENDING', 'FAILED']),
        ),
      )
      .returning({ id: notifications.id });
    parkedIds = parked.map((row) => row.id);
  });

  afterEach(async () => {
    if (parkedIds.length > 0) {
      await db
        .update(notifications)
        .set({ claimedAt: null })
        .where(inArray(notifications.id, parkedIds));
    }
    parkedIds = [];
    await db.delete(notificationDlq).where(eq(notificationDlq.userId, userId));
    await db.delete(notifications).where(eq(notifications.userId, userId));
  });

  afterAll(async () => {
    if (userId) await db.delete(users).where(eq(users.id, userId));
  });

  describe('claiming', () => {
    it('two workers ticking at the same time deliver each pending notification exactly once', async () => {
      const ours = await insertNotifications(30);
      const ourIds = new Set(ours.map((n) => n.id));
      const webhook = recordingWebhook();
      const workerA = makeWorker(webhook.fetchImpl, { batchSize: 10 });
      const workerB = makeWorker(webhook.fetchImpl, { batchSize: 10 });

      for (let round = 0; round < 5; round++) {
        await Promise.all([workerA.tick(), workerB.tick()]);
      }

      const deliveredOurs = webhook.deliveredIds.filter((id) => ourIds.has(id));
      const counts = countBy(deliveredOurs);
      expect(counts.size).toBe(30);
      expect([...counts.values()].every((n) => n === 1)).toBe(true);

      const rows = await db.select().from(notifications).where(eq(notifications.userId, userId));
      expect(rows.every((row) => row.deliveryStatus === 'DELIVERED')).toBe(true);
      expect(rows.every((row) => row.claimedAt === null)).toBe(true);
    });

    it('concurrent claims never hand out the same row', async () => {
      await insertNotifications(30);
      const service = new NotificationService();

      const batches = await Promise.all(
        Array.from({ length: 5 }, () =>
          service.claimDeliveryBatch({ limit: 10, staleAfterMs: 60_000 }),
        ),
      );

      const claimed = batches.flat().map((n) => n.id);
      expect(claimed).toHaveLength(30);
      expect(new Set(claimed).size).toBe(30);
      expect(batches.every((batch) => batch.length <= 10)).toBe(true);
    });

    it('tick() delivers at most the configured batch size', async () => {
      await insertNotifications(7);
      const webhook = recordingWebhook();

      await makeWorker(webhook.fetchImpl, { batchSize: 3 }).tick();

      expect(webhook.deliveredIds).toHaveLength(3);
      const rows = await db.select().from(notifications).where(eq(notifications.userId, userId));
      expect(rows.filter((row) => row.deliveryStatus === 'DELIVERED')).toHaveLength(3);
      // The rest were never claimed, so another worker can take them right away.
      const untouched = rows.filter((row) => row.deliveryStatus === 'PENDING');
      expect(untouched).toHaveLength(4);
      expect(untouched.every((row) => row.claimedAt === null)).toBe(true);
    });

    it('picks up a row claimed by a crashed worker once the claim is stale, and not before', async () => {
      const [abandoned, inFlight] = await insertNotifications(2);
      await db
        .update(notifications)
        .set({ claimedAt: new Date(Date.now() - 10 * 60_000) })
        .where(eq(notifications.id, abandoned!.id));
      await db
        .update(notifications)
        .set({ claimedAt: new Date(Date.now() - 10_000) })
        .where(eq(notifications.id, inFlight!.id));
      const webhook = recordingWebhook();

      await makeWorker(webhook.fetchImpl, { claimTimeoutMs: 5 * 60_000 }).tick();

      expect(webhook.deliveredIds).toEqual([abandoned!.id]);
      expect((await reload(abandoned!.id)).deliveryStatus).toBe('DELIVERED');
      expect((await reload(inFlight!.id)).deliveryStatus).toBe('PENDING');
    });

    it('claims FAILED rows whose retry is due and leaves the ones scheduled for later', async () => {
      const [due] = await insertNotifications(1, {
        deliveryStatus: 'FAILED',
        retryCount: '1',
        nextRetryAt: new Date(Date.now() - 1_000),
      });
      const [later] = await insertNotifications(1, {
        deliveryStatus: 'FAILED',
        retryCount: '1',
        nextRetryAt: new Date(Date.now() + 60 * 60_000),
      });
      const webhook = recordingWebhook();

      await makeWorker(webhook.fetchImpl).tick();

      expect(webhook.deliveredIds).toEqual([due!.id]);
      expect((await reload(later!.id)).deliveryStatus).toBe('FAILED');
    });
  });

  describe('failure accounting', () => {
    it('two concurrent markAsFailed calls on one row raise retryCount by 2', async () => {
      const [row] = await insertNotifications(1, { retryCount: '0', maxRetries: '5' });
      const service = new NotificationService();

      await Promise.all([
        service.markAsFailed(row!.id, 'first failure'),
        service.markAsFailed(row!.id, 'second failure'),
      ]);

      const after = await reload(row!.id);
      expect(after.retryCount).toBe('2');
      expect(after.deliveryStatus).toBe('FAILED');
      expect(after.nextRetryAt!.getTime()).toBeGreaterThan(Date.now());
      expect(await dlqRowsFor(row!.id)).toBe(0);
    });

    it('concurrent failures that exhaust the retries create exactly one DLQ row', async () => {
      const [row] = await insertNotifications(1, { retryCount: '1', maxRetries: '3' });
      const service = new NotificationService();

      await Promise.all([
        service.markAsFailed(row!.id, 'attempt 2 failed'),
        service.markAsFailed(row!.id, 'attempt 3 failed'),
      ]);

      const after = await reload(row!.id);
      expect(after.retryCount).toBe('3');
      expect(after.deliveryStatus).toBe('BOUNCED');
      expect(await dlqRowsFor(row!.id)).toBe(1);
    });

    it('many concurrent failures on the final attempt still create exactly one DLQ row', async () => {
      const [row] = await insertNotifications(1, { retryCount: '2', maxRetries: '3' });
      const service = new NotificationService();

      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) => service.markAsFailed(row!.id, `failure ${i}`)),
      );

      // Only one call moved the row to BOUNCED; the rest found it terminal.
      expect(results.filter((result) => result?.deliveryStatus === 'BOUNCED')).toHaveLength(1);
      expect(results.filter((result) => result === undefined)).toHaveLength(4);
      const after = await reload(row!.id);
      expect(after.retryCount).toBe('3');
      expect(after.deliveryStatus).toBe('BOUNCED');
      expect(await dlqRowsFor(row!.id)).toBe(1);
    });

    it('computes the next retry from the incremented count when no delay is given', async () => {
      const [row] = await insertNotifications(1, { retryCount: '2', maxRetries: '10' });
      const service = new NotificationService(undefined, {
        maxRetries: 10,
        retryDelayMs: 1_000,
        maxRetryDelayMs: 60 * 60_000,
      });

      const before = Date.now();
      const updated = await service.markAsFailed(row!.id, 'third attempt failed');

      // This was attempt 3, so the delay is 1_000 * 2^(3 - 1) = 4_000 ms.
      expect(updated?.retryCount).toBe('3');
      const delay = updated!.nextRetryAt!.getTime() - before;
      expect(delay).toBeGreaterThan(4_000 - 1_500);
      expect(delay).toBeLessThan(4_000 + 1_500);
    });

    it('releases the claim when a delivery fails, so the row can be retried', async () => {
      const [row] = await insertNotifications(1, { retryCount: '0', maxRetries: '3' });
      const webhook = recordingWebhook(503);

      await makeWorker(webhook.fetchImpl).tick();

      const after = await reload(row!.id);
      expect(after.deliveryStatus).toBe('FAILED');
      expect(after.retryCount).toBe('1');
      expect(after.claimedAt).toBeNull();
      expect(after.failureReason).toContain('503');
    });

    it('a late failure cannot overwrite a notification another worker already delivered', async () => {
      const [row] = await insertNotifications(1);
      const service = new NotificationService();

      expect((await service.markAsDelivered(row!.id))?.deliveryStatus).toBe('DELIVERED');
      expect(await service.markAsFailed(row!.id, 'stale worker')).toBeUndefined();
      expect(await service.markAsDelivered(row!.id)).toBeUndefined();

      const after = await reload(row!.id);
      expect(after.deliveryStatus).toBe('DELIVERED');
      expect(after.retryCount).toBe('0');
    });
  });
});
