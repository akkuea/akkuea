import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
  integer,
  decimal,
  boolean,
  jsonb,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const propertyTypeEnum = pgEnum('property_type', [
  'residential',
  'commercial',
  'industrial',
  'land',
  'mixed',
]);

export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  propertyType: propertyTypeEnum('property_type').notNull(),
  location: jsonb('location').notNull().$type<{
    address: string;
    city: string;
    country: string;
    postalCode?: string;
    coordinates?: { latitude: number; longitude: number };
  }>(),
  totalValue: decimal('total_value', { precision: 20, scale: 2 }).notNull(),
  tokenAddress: varchar('token_address', { length: 56 }),
  totalShares: integer('total_shares').notNull(),
  availableShares: integer('available_shares').notNull(),
  pricePerShare: decimal('price_per_share', { precision: 20, scale: 2 }).notNull(),
  images: jsonb('images').notNull().$type<string[]>(),
  verified: boolean('verified').notNull().default(false),
  listedAt: timestamp('listed_at', { withTimezone: true }).notNull().defaultNow(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
});

export const propertyDocumentTypeEnum = pgEnum('property_document_type', [
  'deed',
  'appraisal',
  'inspection',
  'insurance',
  'other',
]);

export const propertyDocuments = pgTable('property_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id')
    .notNull()
    .references(() => properties.id, { onDelete: 'cascade' }),
  type: propertyDocumentTypeEnum('type').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  url: text('url').notNull(),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  verified: boolean('verified').notNull().default(false),
});

export const shareOwnerships = pgTable('share_ownerships', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id')
    .notNull()
    .references(() => properties.id),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id),
  shares: integer('shares').notNull(),
  purchasePrice: decimal('purchase_price', { precision: 20, scale: 2 }).notNull(),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull().defaultNow(),
  lastDividendClaimed: timestamp('last_dividend_claimed', { withTimezone: true }),
});

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  owner: one(users, {
    fields: [properties.ownerId],
    references: [users.id],
  }),
  documents: many(propertyDocuments),
  shareOwnerships: many(shareOwnerships),
}));

export const propertyDocumentsRelations = relations(propertyDocuments, ({ one }) => ({
  property: one(properties, {
    fields: [propertyDocuments.propertyId],
    references: [properties.id],
  }),
}));

export const shareOwnershipsRelations = relations(shareOwnerships, ({ one }) => ({
  property: one(properties, {
    fields: [shareOwnerships.propertyId],
    references: [properties.id],
  }),
  owner: one(users, {
    fields: [shareOwnerships.ownerId],
    references: [users.id],
  }),
}));

// Type exports
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type PropertyDocument = typeof propertyDocuments.$inferSelect;
export type NewPropertyDocument = typeof propertyDocuments.$inferInsert;
export type ShareOwnership = typeof shareOwnerships.$inferSelect;
export type NewShareOwnership = typeof shareOwnerships.$inferInsert;
