import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  notificationDlq,
  type NotificationDlqEntry,
  type NewNotificationDlqEntry,
} from '../db/schema';
import type { Notification } from '../db/schema';

export class NotificationDlqRepository {
  /**
   * Insert a notification into the dead-letter queue.
   */
  async create(entry: NewNotificationDlqEntry): Promise<NotificationDlqEntry> {
    const [created] = await db.insert(notificationDlq).values(entry).returning();
    if (!created) throw new Error('Failed to create DLQ entry');
    return created;
  }

  /**
   * Build a DLQ entry from an existing Notification row.
   */
  async createFromNotification(
    notification: Notification,
    lastFailureReason?: string,
  ): Promise<NotificationDlqEntry> {
    return this.create({
      notificationId: notification.id,
      userId: notification.userId,
      eventType: notification.eventType,
      title: notification.title,
      message: notification.message,
      channel: notification.channel,
      recipient: notification.recipient ?? undefined,
      relatedEntityType: notification.relatedEntityType ?? undefined,
      relatedEntityId: notification.relatedEntityId ?? undefined,
      metadata: notification.metadata ?? undefined,
      lastFailureReason: lastFailureReason ?? notification.failureReason ?? undefined,
      retryCount: parseInt(notification.retryCount),
    });
  }

  /**
   * List all entries that haven't been requeued or resolved yet.
   */
  async findPending(limit = 100, offset = 0): Promise<NotificationDlqEntry[]> {
    return db
      .select()
      .from(notificationDlq)
      .where(and(isNull(notificationDlq.requeuedAt), isNull(notificationDlq.resolvedAt)))
      .orderBy(desc(notificationDlq.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Get a single DLQ entry by its own UUID.
   */
  async findById(id: string): Promise<NotificationDlqEntry | undefined> {
    const [entry] = await db
      .select()
      .from(notificationDlq)
      .where(eq(notificationDlq.id, id))
      .limit(1);
    return entry;
  }

  /**
   * Get all DLQ entries for a specific original notification.
   */
  async findByNotificationId(notificationId: string): Promise<NotificationDlqEntry[]> {
    return db
      .select()
      .from(notificationDlq)
      .where(eq(notificationDlq.notificationId, notificationId))
      .orderBy(desc(notificationDlq.createdAt));
  }

  /**
   * Mark a DLQ entry as requeued so it won't appear in the pending list again.
   */
  async markAsRequeued(
    id: string,
    requeuedBy: string,
  ): Promise<NotificationDlqEntry | undefined> {
    const [updated] = await db
      .update(notificationDlq)
      .set({ requeuedAt: new Date(), requeuedBy })
      .where(eq(notificationDlq.id, id))
      .returning();
    return updated;
  }

  /**
   * Mark a DLQ entry as resolved (discarded intentionally by an admin).
   */
  async markAsResolved(id: string): Promise<NotificationDlqEntry | undefined> {
    const [updated] = await db
      .update(notificationDlq)
      .set({ resolvedAt: new Date() })
      .where(eq(notificationDlq.id, id))
      .returning();
    return updated;
  }
}
