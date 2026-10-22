import {
  pgTable,
  uuid,
  varchar,
  decimal,
  timestamp,
  pgEnum,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const transactionTypeEnum = pgEnum('transaction_type', [
  'deposit',
  'withdraw',
  'borrow',
  'repay',
  'liquidation',
  'buy_shares',
  'sell_shares',
  'dividend',
]);

export const transactionStatusEnum = pgEnum('transaction_status', [
  'pending',
  'confirmed',
  'failed',
]);

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: transactionTypeEnum('type').notNull(),
  // Unique so the same on-chain transaction can only ever be recorded once:
  // confirming a purchase twice hits the conflict and returns the first result.
  hash: varchar('hash', { length: 64 }).unique(),
  fromUserId: uuid('from_user_id')
    .notNull()
    .references(() => users.id),
  toUserId: uuid('to_user_id').references(() => users.id),
  amount: decimal('amount', { precision: 20, scale: 7 }).notNull(),
  asset: varchar('asset', { length: 56 }).notNull(),
  status: transactionStatusEnum('status').notNull().default('pending'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
}, (t) => [index('transactions_hash_idx').on(t.hash)]);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  fromUser: one(users, {
    fields: [transactions.fromUserId],
    references: [users.id],
  }),
  toUser: one(users, {
    fields: [transactions.toUserId],
    references: [users.id],
  }),
}));

// Type exports
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
