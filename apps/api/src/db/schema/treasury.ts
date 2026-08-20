import { pgTable, uuid, varchar, numeric, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const treasuryOperationEnum = ['deposit', 'withdraw'] as const;
export const treasuryOperationStatusEnum = ['submitted', 'confirmed', 'failed'] as const;

/**
 * Every treasury movement the platform has attempted, successful or not.
 *
 * Failures are kept deliberately: the point of the treasury track is that the
 * record is checkable, and a history that only shows the deposits that worked
 * is not a full record. `errorName`/`errorCode` carry the contract error as it
 * came back from chain.
 */
export const treasuryTransactions = pgTable(
  'treasury_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    venue: varchar('venue', { length: 64 }).notNull(),
    operation: varchar('operation', { length: 16 }).notNull(),
    status: varchar('status', { length: 16 }).notNull(),
    vaultContractId: varchar('vault_contract_id', { length: 56 }).notNull(),
    sourceAccount: varchar('source_account', { length: 56 }).notNull(),
    assetCode: varchar('asset_code', { length: 12 }).notNull(),
    /** Underlying asset amount, in whole units (not stroops). */
    amount: numeric('amount', { precision: 30, scale: 7 }),
    /** dfToken shares minted (deposit) or burned (withdraw). */
    shares: numeric('shares', { precision: 30, scale: 7 }),
    txHash: varchar('tx_hash', { length: 64 }),
    errorName: varchar('error_name', { length: 64 }),
    errorCode: varchar('error_code', { length: 16 }),
    requestedBy: varchar('requested_by', { length: 128 }).notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('treasury_transactions_venue_created_at_idx').on(t.venue, t.createdAt),
    index('treasury_transactions_status_idx').on(t.status),
  ],
);

/**
 * Point-in-time reads of a venue position, captured whenever the API reads one.
 *
 * These are what the treasury panel charts. They are derived entirely from
 * on-chain reads, so a snapshot can always be re-derived from the ledger; the
 * table is a cache of history, never the source of truth.
 */
export const treasuryPositionSnapshots = pgTable(
  'treasury_position_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    venue: varchar('venue', { length: 64 }).notNull(),
    vaultContractId: varchar('vault_contract_id', { length: 56 }).notNull(),
    assetCode: varchar('asset_code', { length: 12 }).notNull(),
    /** dfToken shares the platform holds. */
    shares: numeric('shares', { precision: 30, scale: 7 }).notNull(),
    /** Underlying asset those shares are currently worth. */
    positionValue: numeric('position_value', { precision: 30, scale: 7 }).notNull(),
    /** Underlying asset under management across all holders of this vault. */
    vaultTotalManaged: numeric('vault_total_managed', { precision: 30, scale: 7 }).notNull(),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('treasury_snapshots_venue_captured_at_idx').on(t.venue, t.capturedAt)],
);

export type TreasuryTransaction = typeof treasuryTransactions.$inferSelect;
export type NewTreasuryTransaction = typeof treasuryTransactions.$inferInsert;
export type TreasuryPositionSnapshot = typeof treasuryPositionSnapshots.$inferSelect;
export type NewTreasuryPositionSnapshot = typeof treasuryPositionSnapshots.$inferInsert;
