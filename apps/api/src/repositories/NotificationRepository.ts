import { eq, and, desc, sql, lte, lt, or, isNull, inArray, notInArray } from 'drizzle-orm';
import { db } from '../db';
import {
  notifications,
  type Notification,
  type NewNotification,
  type NotificationEventType,
  type NotificationDeliveryStatus,
} from '../db/schema';
import { BaseRepository } from './BaseRepository';

interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface ClaimDeliveryBatchOptions {
  /** Maximum number of rows to claim */
  limit: number;
  /** A claim older than this is treated as abandoned and can be taken again */
  staleAfterMs: number;
}

export interface RecordFailureOptions {
  reason: string;
  /**
   * Delay before the next attempt. When omitted it is derived in SQL from the
   * incremented retry count: `min(retryBaseDelayMs * 2^(attempt - 1), maxRetryDelayMs)`.
   */
  nextRetryDelayMs?: number;
  retryBaseDelayMs: number;
  maxRetryDelayMs: number;
}

/** Statuses a delivery attempt can no longer change. */
const TERMINAL_DELIVERY_STATUSES: NotificationDeliveryStatus[] = ['DELIVERED', 'BOUNCED'];

export class NotificationRepository extends BaseRepository<
  typeof notifications,
  Notification,
  NewNotification
> {
  constructor() {
    super(notifications);
  }

  /**
   * Find notifications by user ID with pagination
   */
  async findByUserId(userId: string, options?: PaginationOptions): Promise<Notification[]> {
    let query = db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    return query;
  }

  /**
   * Count notifications by user ID
   */
  async countByUserId(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(eq(notifications.userId, userId));

    return result[0]?.count || 0;
  }

  /**
   * Find unread notifications by user ID
   */
  async findUnreadByUserId(userId: string): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .orderBy(desc(notifications.createdAt));
  }

  /**
   * Count unread notifications for a user
   */
  async countUnreadByUserId(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    return result[0]?.count || 0;
  }

  /**
   * Find notifications by event type
   */
  async findByEventType(
    eventType: NotificationEventType,
    options?: PaginationOptions,
  ): Promise<Notification[]> {
    let query = db
      .select()
      .from(notifications)
      .where(eq(notifications.eventType, eventType))
      .orderBy(desc(notifications.createdAt));

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    return query;
  }

  /**
   * Find notifications by user ID and event type
   */
  async findByUserIdAndEventType(
    userId: string,
    eventType: NotificationEventType,
  ): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.eventType, eventType)))
      .orderBy(desc(notifications.createdAt));
  }

  /**
   * Find notifications pending delivery
   */
  async findPendingDelivery(): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.deliveryStatus, 'PENDING'))
      .orderBy(notifications.createdAt);
  }

  /**
   * Find notifications ready for retry (FAILED and nextRetryAt is due or null).
   */
  async findReadyForRetry(): Promise<Notification[]> {
    const now = new Date();
    return db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.deliveryStatus, 'FAILED'),
          or(lte(notifications.nextRetryAt, now), isNull(notifications.nextRetryAt)),
        ),
      )
      .orderBy(notifications.nextRetryAt);
  }

  /**
   * Atomically claims up to `limit` notifications that are due for delivery:
   * PENDING rows, plus FAILED rows whose retry time has come. Rows already
   * claimed by another worker are skipped unless that claim is stale.
   *
   * The inner SELECT locks its rows with FOR UPDATE SKIP LOCKED, so concurrent
   * callers never receive the same row; the outer UPDATE stamps `claimed_at` in
   * the same statement, so once it commits the rows stay hidden from other
   * workers until the claim settles or goes stale.
   */
  async claimDeliveryBatch(options: ClaimDeliveryBatchOptions): Promise<Notification[]> {
    const limit = Math.max(0, Math.floor(options.limit));
    if (limit === 0) return [];

    const now = new Date();
    const staleBefore = new Date(now.getTime() - options.staleAfterMs);

    const claimable = db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          or(
            eq(notifications.deliveryStatus, 'PENDING'),
            and(
              eq(notifications.deliveryStatus, 'FAILED'),
              or(isNull(notifications.nextRetryAt), lte(notifications.nextRetryAt, now)),
            ),
          ),
          or(isNull(notifications.claimedAt), lt(notifications.claimedAt, staleBefore)),
        ),
      )
      .orderBy(sql`coalesce(${notifications.nextRetryAt}, ${notifications.createdAt})`)
      .limit(limit)
      .for('update', { skipLocked: true });

    return db
      .update(notifications)
      .set({ claimedAt: now })
      .where(inArray(notifications.id, claimable))
      .returning();
  }

  /**
   * Marks a notification DELIVERED and releases its claim. A row that is
   * already DELIVERED or BOUNCED is left untouched, so a late or duplicate
   * worker cannot overwrite the final state.
   */
  async markDelivered(notificationId: string): Promise<Notification | undefined> {
    const now = new Date();
    const [updated] = await db
      .update(notifications)
      .set({ deliveryStatus: 'DELIVERED', deliveredAt: now, claimedAt: null, updatedAt: now })
      .where(
        and(
          eq(notifications.id, notificationId),
          notInArray(notifications.deliveryStatus, TERMINAL_DELIVERY_STATUSES),
        ),
      )
      .returning();
    return updated;
  }

  /**
   * Records a failed delivery attempt in one atomic statement: the retry count
   * is incremented in SQL, the row moves to BOUNCED once it reaches
   * `max_retries` (FAILED otherwise), the next retry time is computed from the
   * incremented count, and the claim is released.
   *
   * Concurrent calls serialize on the row lock and each sees the other's
   * increment. A row that is already DELIVERED or BOUNCED is not changed and
   * `undefined` is returned, so exactly one call ever moves a row to BOUNCED.
   */
  async recordFailure(
    notificationId: string,
    options: RecordFailureOptions,
  ): Promise<Notification | undefined> {
    // In a SET clause `retry_count` is the value before this update, so the
    // attempt that just failed is `retry_count + 1` and its backoff exponent
    // is `retry_count`.
    const attempt = sql`(${notifications.retryCount}::int + 1)`;
    const exhausted = sql`${attempt} >= ${notifications.maxRetries}::int`;
    const delayMs =
      options.nextRetryDelayMs !== undefined
        ? sql`${options.nextRetryDelayMs}::double precision`
        : sql`least(${options.retryBaseDelayMs}::double precision * power(2, ${notifications.retryCount}::int), ${options.maxRetryDelayMs}::double precision)`;

    const [updated] = await db
      .update(notifications)
      .set({
        retryCount: sql`${attempt}::text`,
        deliveryStatus: sql`(case when ${exhausted} then 'BOUNCED' else 'FAILED' end)::notification_delivery_status`,
        failureReason: options.reason,
        nextRetryAt: sql`case when ${exhausted} then ${notifications.nextRetryAt} else now() + (${delayMs} * interval '1 millisecond') end`,
        claimedAt: null,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(notifications.id, notificationId),
          notInArray(notifications.deliveryStatus, TERMINAL_DELIVERY_STATUSES),
        ),
      )
      .returning();
    return updated;
  }

  /**
   * Find notifications by related entity
   */
  async findByRelatedEntity(entityType: string, entityId: string): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.relatedEntityType, entityType),
          eq(notifications.relatedEntityId, entityId),
        ),
      )
      .orderBy(desc(notifications.createdAt));
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<Notification | undefined> {
    return this.update(notificationId, {
      isRead: true,
      readAt: new Date(),
    });
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(notificationIds: string[]): Promise<Notification[]> {
    const results = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(sql`id = ANY(${notificationIds})`)
      .returning();

    return results;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsReadForUser(userId: string): Promise<number> {
    const results = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(eq(notifications.userId, userId))
      .returning();

    return results.length;
  }

  /**
   * Update delivery status
   */
  async updateDeliveryStatus(
    notificationId: string,
    status: NotificationDeliveryStatus,
    data?: {
      failureReason?: string;
      sentAt?: Date;
      deliveredAt?: Date;
      nextRetryAt?: Date;
      retryCount?: number;
    },
  ): Promise<Notification | undefined> {
    const updateData: Record<string, unknown> = {
      deliveryStatus: status,
    };

    if (data?.failureReason) {
      updateData.failureReason = data.failureReason;
    }
    if (data?.sentAt) {
      updateData.sentAt = data.sentAt;
    }
    if (data?.deliveredAt) {
      updateData.deliveredAt = data.deliveredAt;
    }
    if (data?.nextRetryAt) {
      updateData.nextRetryAt = data.nextRetryAt;
    }
    if (data?.retryCount !== undefined) {
      updateData.retryCount = data.retryCount.toString();
    }

    return this.update(notificationId, updateData as Partial<NewNotification>);
  }

  /**
   * Delete old notifications (older than specified days)
   */
  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const results = await db
      .delete(notifications)
      .where(sql`created_at < ${cutoffDate}`)
      .returning();

    return results.length;
  }
}
