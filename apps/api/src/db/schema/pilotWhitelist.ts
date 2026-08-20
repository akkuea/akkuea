import { pgTable, uuid, varchar, timestamp, pgEnum, text } from 'drizzle-orm/pg-core';

export const pilotWhitelistStatusEnum = pgEnum('pilot_whitelist_status', [
  'pending',
  'approved',
  'rejected',
]);

export const pilotWhitelistIdTypeEnum = pgEnum('pilot_whitelist_id_type', [
  'passport',
  'national_id',
  'drivers_license',
]);

export const pilotWhitelistRequests = pgTable('pilot_whitelist_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 56 }).notNull().unique(),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  idType: pilotWhitelistIdTypeEnum('id_type').notNull(),
  idReference: varchar('id_reference', { length: 255 }).notNull(),
  status: pilotWhitelistStatusEnum('status').notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
});

export type PilotWhitelistRequest = typeof pilotWhitelistRequests.$inferSelect;
export type NewPilotWhitelistRequest = typeof pilotWhitelistRequests.$inferInsert;
