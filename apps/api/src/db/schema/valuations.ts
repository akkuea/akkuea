import { pgTable, varchar, decimal, timestamp, jsonb, text, index } from 'drizzle-orm/pg-core';

export const valuationStatusEnum = ['active', 'stale', 'rejected', 'manual_review'] as const;

export const valuations = pgTable(
  'valuations',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    propertyId: varchar('property_id', { length: 255 }).notNull(),
    sourceId: varchar('source_id', { length: 255 }).notNull(),
    sourceName: varchar('source_name', { length: 255 }).notNull(),
    price: decimal('price', { precision: 20, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 10 }).notNull(),
    confidence: decimal('confidence', { precision: 7, scale: 4 }).notNull(),
    methodology: varchar('methodology', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('active'),
    rejectionReason: text('rejection_reason'),
    provenance: jsonb('provenance').notNull().$type<{
      dataProvider: string;
      reportUrl?: string;
      licenseNumber?: string;
      assessorName?: string;
    }>(),
    metadata: jsonb('metadata').notNull().$type<{
      squareFootage?: number;
      bedrooms?: number;
      bathrooms?: number;
      yearBuilt?: number;
      neighborhood?: string;
      propertyType?: string;
    }>(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('valuations_property_id_timestamp_idx').on(t.propertyId, t.timestamp)],
);

export type Valuation = typeof valuations.$inferSelect;
export type NewValuation = typeof valuations.$inferInsert;
