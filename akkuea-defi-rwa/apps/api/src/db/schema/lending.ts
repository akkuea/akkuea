import { pgTable, uuid, varchar, decimal, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { users } from './users';

export const lendingPools = pgTable('lending_pools', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  asset: varchar('asset', { length: 20 }).notNull(),
  assetAddress: varchar('asset_address', { length: 56 }).notNull(),
  totalDeposits: decimal('total_deposits', { precision: 20, scale: 7 }).notNull().default('0'),
  totalBorrows: decimal('total_borrows', { precision: 20, scale: 7 }).notNull().default('0'),
  availableLiquidity: decimal('available_liquidity', { precision: 20, scale: 7 })
    .notNull()
    .default('0'),
  utilizationRate: decimal('utilization_rate', { precision: 5, scale: 2 }).notNull().default('0'),
  supplyAPY: decimal('supply_apy', { precision: 5, scale: 2 }).notNull().default('0'),
  borrowAPY: decimal('borrow_apy', { precision: 5, scale: 2 }).notNull().default('0'),
  collateralFactor: decimal('collateral_factor', { precision: 5, scale: 2 }).notNull(),
  liquidationThreshold: decimal('liquidation_threshold', { precision: 5, scale: 2 }).notNull(),
  liquidationPenalty: decimal('liquidation_penalty', { precision: 5, scale: 2 }).notNull(),
  reserveFactor: integer('reserve_factor').notNull().default(1000),
  isActive: boolean('is_active').notNull().default(true),
  isPaused: boolean('is_paused').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const depositPositions = pgTable('deposit_positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  poolId: uuid('pool_id')
    .notNull()
    .references(() => lendingPools.id),
  depositorId: uuid('depositor_id')
    .notNull()
    .references(() => users.id),
  amount: decimal('amount', { precision: 20, scale: 7 }).notNull(),
  shares: decimal('shares', { precision: 20, scale: 7 }).notNull(),
  depositedAt: timestamp('deposited_at', { withTimezone: true }).notNull().defaultNow(),
  lastAccrualAt: timestamp('last_accrual_at', { withTimezone: true }).notNull().defaultNow(),
  accruedInterest: decimal('accrued_interest', { precision: 20, scale: 7 }).notNull().default('0'),
});

export const borrowPositions = pgTable('borrow_positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  poolId: uuid('pool_id')
    .notNull()
    .references(() => lendingPools.id),
  borrowerId: uuid('borrower_id')
    .notNull()
    .references(() => users.id),
  principal: decimal('principal', { precision: 20, scale: 7 }).notNull(),
  accruedInterest: decimal('accrued_interest', { precision: 20, scale: 7 }).notNull().default('0'),
  collateralAmount: decimal('collateral_amount', { precision: 20, scale: 7 }).notNull(),
  collateralAsset: varchar('collateral_asset', { length: 56 }).notNull(),
  healthFactor: decimal('health_factor', { precision: 10, scale: 4 }).notNull(),
  borrowedAt: timestamp('borrowed_at', { withTimezone: true }).notNull().defaultNow(),
  lastAccrualAt: timestamp('last_accrual_at', { withTimezone: true }).notNull().defaultNow(),
});

export const lendingPoolsRelations = relations(lendingPools, ({ many }) => ({
  depositPositions: many(depositPositions),
  borrowPositions: many(borrowPositions),
}));

export const depositPositionsRelations = relations(depositPositions, ({ one }) => ({
  pool: one(lendingPools, {
    fields: [depositPositions.poolId],
    references: [lendingPools.id],
  }),
  depositor: one(users, {
    fields: [depositPositions.depositorId],
    references: [users.id],
  }),
}));

export const borrowPositionsRelations = relations(borrowPositions, ({ one }) => ({
  pool: one(lendingPools, {
    fields: [borrowPositions.poolId],
    references: [lendingPools.id],
  }),
  borrower: one(users, {
    fields: [borrowPositions.borrowerId],
    references: [users.id],
  }),
}));

// Type exports
export type LendingPool = typeof lendingPools.$inferSelect;
export type NewLendingPool = typeof lendingPools.$inferInsert;
export type DepositPosition = typeof depositPositions.$inferSelect;
export type NewDepositPosition = typeof depositPositions.$inferInsert;
export type BorrowPosition = typeof borrowPositions.$inferSelect;
export type NewBorrowPosition = typeof borrowPositions.$inferInsert;
