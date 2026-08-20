import { desc, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  treasuryPositionSnapshots,
  treasuryTransactions,
  type NewTreasuryPositionSnapshot,
  type NewTreasuryTransaction,
  type TreasuryPositionSnapshot,
  type TreasuryTransaction,
} from '../db/schema/treasury';

export interface TreasuryHistoryQuery {
  venue?: string;
  limit: number;
  offset: number;
}

export class TreasuryRepository {
  static async recordTransaction(entry: NewTreasuryTransaction): Promise<TreasuryTransaction> {
    const [row] = await db.insert(treasuryTransactions).values(entry).returning();
    if (!row) {
      throw new Error('Failed to persist treasury transaction: no row returned');
    }
    return row;
  }

  static async listTransactions(query: TreasuryHistoryQuery): Promise<TreasuryTransaction[]> {
    const base = db.select().from(treasuryTransactions);
    const filtered = query.venue ? base.where(eq(treasuryTransactions.venue, query.venue)) : base;

    return filtered
      .orderBy(desc(treasuryTransactions.createdAt))
      .limit(query.limit)
      .offset(query.offset);
  }

  static async recordSnapshot(
    snapshot: NewTreasuryPositionSnapshot,
  ): Promise<TreasuryPositionSnapshot> {
    const [row] = await db.insert(treasuryPositionSnapshots).values(snapshot).returning();
    if (!row) {
      throw new Error('Failed to persist treasury snapshot: no row returned');
    }
    return row;
  }

  static async listSnapshots(query: TreasuryHistoryQuery): Promise<TreasuryPositionSnapshot[]> {
    const base = db.select().from(treasuryPositionSnapshots);
    const filtered = query.venue
      ? base.where(eq(treasuryPositionSnapshots.venue, query.venue))
      : base;

    return filtered
      .orderBy(desc(treasuryPositionSnapshots.capturedAt))
      .limit(query.limit)
      .offset(query.offset);
  }
}
