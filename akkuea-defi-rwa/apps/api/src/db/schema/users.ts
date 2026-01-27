import { pgTable, uuid, varchar, timestamp, pgEnum, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const kycStatusEnum = pgEnum('kyc_status', [
  'not_started',
  'pending',
  'approved',
  'rejected',
  'expired',
]);

export const kycTierEnum = pgEnum('kyc_tier', ['none', 'basic', 'verified', 'accredited']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: varchar('wallet_address', { length: 56 }).notNull().unique(),
  email: varchar('email', { length: 255 }),
  displayName: varchar('display_name', { length: 50 }),
  kycStatus: kycStatusEnum('kyc_status').notNull().default('not_started'),
  kycTier: kycTierEnum('kyc_tier').notNull().default('none'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});

export const kycDocumentTypeEnum = pgEnum('kyc_document_type', [
  'passport',
  'national_id',
  'drivers_license',
  'proof_of_address',
  'bank_statement',
  'tax_document',
]);

export const kycDocumentStatusEnum = pgEnum('kyc_document_status', [
  'pending',
  'approved',
  'rejected',
]);

export const kycDocuments = pgTable('kyc_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: kycDocumentTypeEnum('type').notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileUrl: text('file_url').notNull(),
  status: kycDocumentStatusEnum('status').notNull().default('pending'),
  rejectionReason: text('rejection_reason'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
});

export const usersRelations = relations(users, ({ many }) => ({
  kycDocuments: many(kycDocuments),
}));

export const kycDocumentsRelations = relations(kycDocuments, ({ one }) => ({
  user: one(users, {
    fields: [kycDocuments.userId],
    references: [users.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type KycDocument = typeof kycDocuments.$inferSelect;
export type NewKycDocument = typeof kycDocuments.$inferInsert;
