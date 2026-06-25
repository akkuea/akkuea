/**
 * Integration test: ValuationRepository persistence against a real PostgreSQL instance.
 *
 * Requires DATABASE_URL to point to a running Postgres DB with the valuations table
 * already migrated (run `bun run db:migrate` first).
 *
 * Skip gracefully when DATABASE_URL is absent (e.g. pure unit-test CI runs).
 */
import { describe, test, expect, afterAll } from 'bun:test';
import { ValuationRepository } from '../repositories/ValuationRepository';
import { closeDatabaseConnection } from '../db';
import type { ValuationRecord } from '@real-estate-defi/shared';
import { db } from '../db';
import { valuations } from '../db/schema/valuations';
import { eq } from 'drizzle-orm';

const SKIP = !process.env.DATABASE_URL;

function makeRecord(overrides: Partial<ValuationRecord> = {}): ValuationRecord {
  const id = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    propertyId: `prop-integration-${id}`,
    sourceId: 'source-integration-001',
    sourceName: 'Integration Test Appraiser',
    price: 400_000,
    currency: 'USD',
    confidence: 90,
    methodology: 'comparable_sales',
    status: 'active',
    provenance: { dataProvider: 'Integration Test Appraiser' },
    metadata: { propertyType: 'residential' },
    timestamp: new Date(),
    receivedAt: new Date(),
    ...overrides,
  };
}

describe('ValuationRepository integration', () => {
  const savedIds: string[] = [];

  afterAll(async () => {
    // Clean up test rows
    for (const id of savedIds) {
      await db.delete(valuations).where(eq(valuations.id, id));
    }
    await closeDatabaseConnection();
  });

  test('save() persists a record and findLatest() retrieves it', async () => {
    if (SKIP) {
      console.log('Skipping integration test: DATABASE_URL not set');
      return;
    }

    const record = makeRecord();
    savedIds.push(record.id);

    await ValuationRepository.save(record);

    const found = await ValuationRepository.findLatest(record.propertyId);
    expect(found).toBeDefined();
    expect(found!.id).toBe(record.id);
    expect(found!.price).toBe(record.price);
    expect(found!.propertyId).toBe(record.propertyId);
  });

  test('data survives a simulated restart (new db proxy call re-queries)', async () => {
    if (SKIP) {
      console.log('Skipping integration test: DATABASE_URL not set');
      return;
    }

    const record = makeRecord({ price: 500_000 });
    savedIds.push(record.id);

    await ValuationRepository.save(record);

    // Simulate "restart": clear module-level state by re-importing via a fresh query
    // (the db proxy always goes to Postgres, so this is equivalent to a new process read)
    const [row] = await db.select().from(valuations).where(eq(valuations.id, record.id)).limit(1);

    expect(row).toBeDefined();
    expect(Number(row!.price)).toBe(500_000);
  });

  test('findLatest() returns the most recently timestamped record', async () => {
    if (SKIP) {
      console.log('Skipping integration test: DATABASE_URL not set');
      return;
    }

    const propertyId = `prop-latest-${Date.now()}`;
    const older = makeRecord({
      propertyId,
      price: 300_000,
      timestamp: new Date(Date.now() - 5000),
    });
    const newer = makeRecord({ propertyId, price: 350_000, timestamp: new Date() });
    savedIds.push(older.id, newer.id);

    await ValuationRepository.save(older);
    await ValuationRepository.save(newer);

    const latest = await ValuationRepository.findLatest(propertyId);
    expect(latest!.price).toBe(350_000);
  });
});
