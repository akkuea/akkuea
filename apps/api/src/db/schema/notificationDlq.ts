import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const notificationDlq = pgTable('notification_dlq', {
  id: uuid('id').primaryKey().defaultRandom(),

  notificationId: uuid('notification_id').notNull(),
  userId: uuid('user_id').notNull(),
  eventType: text('event_type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  channel: text('channel').notNull(),
  recipient: text('recipient'),
  relatedEntityType: text('related_entity_type'),
  relatedEntityId: text('related_entity_id'),
  metadata: text('metadata'),

  lastFailureReason: text('last_failure_reason'),
  retryCount: integer('retry_count').notNull().default(0),

  requeuedAt: timestamp('requeued_at', { withTimezone: true }),
  requeuedBy: text('requeued_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type NotificationDlqEntry = typeof notificationDlq.$inferSelect;
export type NewNotificationDlqEntry = typeof notificationDlq.$inferInsert;
