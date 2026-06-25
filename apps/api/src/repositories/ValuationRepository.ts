import { desc, eq } from 'drizzle-orm';
import type { ValuationRecord } from '@real-estate-defi/shared';
import { db } from '../db';
import { valuations } from '../db/schema/valuations';

function toRecord(row: typeof valuations.$inferSelect): ValuationRecord {
  return {
    id: row.id,
    propertyId: row.propertyId,
    sourceId: row.sourceId,
    sourceName: row.sourceName,
    price: Number(row.price),
    currency: row.currency,
    confidence: Number(row.confidence),
    methodology: row.methodology as ValuationRecord['methodology'],
    status: row.status as ValuationRecord['status'],
    rejectionReason: row.rejectionReason ?? undefined,
    provenance: row.provenance as ValuationRecord['provenance'],
    metadata: row.metadata as ValuationRecord['metadata'],
    timestamp: row.timestamp,
    receivedAt: row.receivedAt,
  };
}

export class ValuationRepository {
  static async save(record: ValuationRecord): Promise<ValuationRecord> {
    const [row] = await db
      .insert(valuations)
      .values({
        id: record.id,
        propertyId: record.propertyId,
        sourceId: record.sourceId,
        sourceName: record.sourceName,
        price: String(record.price),
        currency: record.currency,
        confidence: String(record.confidence),
        methodology: record.methodology,
        status: record.status,
        rejectionReason: record.rejectionReason ?? null,
        provenance: record.provenance,
        metadata: record.metadata,
        timestamp: record.timestamp instanceof Date ? record.timestamp : new Date(record.timestamp),
        receivedAt:
          record.receivedAt instanceof Date ? record.receivedAt : new Date(record.receivedAt),
      })
      .onConflictDoUpdate({
        target: valuations.id,
        set: { status: record.status, rejectionReason: record.rejectionReason ?? null },
      })
      .returning();
    if (!row) throw new Error(`Failed to persist valuation ${record.id}: no row returned`);
    return toRecord(row);
  }

  static async findLatest(propertyId: string): Promise<ValuationRecord | undefined> {
    const [row] = await db
      .select()
      .from(valuations)
      .where(eq(valuations.propertyId, propertyId))
      .orderBy(desc(valuations.timestamp))
      .limit(1);
    return row ? toRecord(row) : undefined;
  }

  static async findHistory(propertyId: string, limit?: number): Promise<ValuationRecord[]> {
    const query = db
      .select()
      .from(valuations)
      .where(eq(valuations.propertyId, propertyId))
      .orderBy(desc(valuations.timestamp));
    const rows = limit ? await query.limit(limit) : await query;
    return rows.map(toRecord);
  }

  static async findAll(): Promise<ValuationRecord[]> {
    const rows = await db
      .selectDistinctOn([valuations.propertyId])
      .from(valuations)
      .orderBy(valuations.propertyId, desc(valuations.timestamp));
    return rows.map(toRecord);
  }

  static async updateStatus(
    id: string,
    _propertyId: string,
    status: ValuationRecord['status'],
    rejectionReason?: string,
  ): Promise<ValuationRecord | undefined> {
    const [row] = await db
      .update(valuations)
      .set({ status, rejectionReason: rejectionReason ?? null })
      .where(eq(valuations.id, id))
      .returning();
    return row ? toRecord(row) : undefined;
  }
}
