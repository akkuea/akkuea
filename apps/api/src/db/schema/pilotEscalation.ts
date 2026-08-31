import { pgTable, uuid, varchar, integer, timestamp, text } from 'drizzle-orm/pg-core';

/**
 * Dedup/idempotency state for the pilot ally reporting-cycle escalation job.
 *
 * The evidence history itself is not duplicated here - the source of truth
 * stays on-chain in `pilot-payout-split`. This table only records "was an
 * escalation already sent for this breach", so a poll interval running
 * every few hours does not re-notify the operator every tick while the same
 * gap persists. One row per monitored contract.
 */
export const pilotEscalationState = pgTable('pilot_escalation_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: varchar('contract_id', { length: 56 }).notNull().unique(),
  lastMissedCycleId: text('last_missed_cycle_id').notNull(),
  consecutiveMissed: integer('consecutive_missed').notNull(),
  firstNotifiedAt: timestamp('first_notified_at', { withTimezone: true }).notNull(),
  lastNotifiedAt: timestamp('last_notified_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PilotEscalationState = typeof pilotEscalationState.$inferSelect;
export type NewPilotEscalationState = typeof pilotEscalationState.$inferInsert;
