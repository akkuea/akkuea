import { eq, and, desc, sql, lte, or, isNull } from 'drizzle-orm';
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
