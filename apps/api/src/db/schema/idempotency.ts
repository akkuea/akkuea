import { pgTable, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core';

/**
 * Idempotency key store for state-changing endpoints.
 * `response` is null while a request is in-flight (claim reserved);
 * once the handler finishes it is filled with the JSON response body.
 */
export const idempotencyKeys = pgTable('idempotency_keys', {
  key: varchar('key', { length: 255 }).primaryKey(),
  response: jsonb('response'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
