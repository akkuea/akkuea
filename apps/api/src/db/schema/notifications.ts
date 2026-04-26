import { pgTable, uuid, varchar, timestamp, pgEnum, text, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const notificationEventTypeEnum = pgEnum('notification_event_type', [
  'VERIFICATION_APPROVED',
  'VERIFICATION_REJECTED',
  'VALUATION_UPDATED',
  'REPAYMENT_REMINDER',
  'REPAYMENT_OVERDUE',
  'REPAYMENT_PROCESSED',
  'RISK_WARNING',
  'LIQUIDATION_RISK',
  'LIQUIDATION_EXECUTED',
  'SYSTEM_ALERT',
  'INVESTMENT_OPPORTUNITY',
  'PORTFOLIO_UPDATE',
]);

export const notificationChannelEnum = pgEnum('notification_channel', ['IN_APP', 'EMAIL', 'SMS']);

export const notificationDeliveryStatusEnum = pgEnum('notification_delivery_status', [
  'PENDING',
  'SENT',
  'DELIVERED',
  'FAILED',
  'BOUNCED',
]);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  eventType: notificationEventTypeEnum('event_type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  relatedEntityType: varchar('related_entity_type', { length: 50 }), // 'property', 'loan', 'investment', etc.
  relatedEntityId: varchar('related_entity_id', { length: 255 }), // UUID or ID of the related entity
  channel: notificationChannelEnum('channel').notNull(),
  deliveryStatus: notificationDeliveryStatusEnum('delivery_status').notNull().default('PENDING'),
  recipient: varchar('recipient', { length: 255 }), // email or phone number
  sentAt: timestamp('sent_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  failureReason: text('failure_reason'),
  retryCount: varchar('retry_count', { length: 3 }).notNull().default('0'),
  maxRetries: varchar('max_retries', { length: 3 }).notNull().default('3'),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  isRead: boolean('is_read').notNull().default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  metadata: text('metadata'), // JSON string for additional data
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const notificationsRelations = relations(notifications, ({ one }: any) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

// Type exports
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationEventType = (typeof notificationEventTypeEnum.enumValues)[number];
export type NotificationChannel = (typeof notificationChannelEnum.enumValues)[number];
export type NotificationDeliveryStatus = (typeof notificationDeliveryStatusEnum.enumValues)[number];
