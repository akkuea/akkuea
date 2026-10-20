import { pgTable, varchar, jsonb, timestamp, integer } from 'drizzle-orm/pg-core';

/**
 * Idempotency key store for state-changing endpoints.
 * `response` holds either a pending marker or the JSON response body.
 * `statusCode` is the HTTP status replayed with a cached body. Only 2xx
 * results are cached; failed requests release their key.
 */
export const idempotencyKeys = pgTable('idempotency_keys', {
  key: varchar('key', { length: 255 }).primaryKey(),
  response: jsonb('response').notNull(),
  statusCode: integer('status_code').notNull().default(200),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
