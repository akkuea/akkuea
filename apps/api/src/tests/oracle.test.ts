import { Elysia } from 'elysia';
import { errorHandler } from '../middleware/errorHandler';
import { oracleRoutes } from '../routes/oracle';
import { describe, test, expect, spyOn, mock, beforeEach, afterEach } from 'bun:test';
import { OracleService } from '../services/OracleService';
import { ValuationRepository } from '../repositories/ValuationRepository';
import type { RealEstateValuationPayload, ValuationRecord } from '@akkuea/shared';
import { ValidationService } from '@akkuea/shared';

// In-memory store used by the spies below.
// Using spyOn instead of mock.module so the mock is properly scoped to this file
// and does not leak into integration test files that run in the same Bun worker.
const store = new Map<string, ValuationRecord[]>();

beforeEach(() => {
  store.clear();

  spyOn(ValuationRepository, 'save').mockImplementation(async (record: ValuationRecord) => {
    const list = store.get(record.propertyId) ?? [];
    const idx = list.findIndex((r) => r.id === record.id);
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.push(record);
    }
    store.set(record.propertyId, list);
    return record;
  });

  spyOn(ValuationRepository, 'findLatest').mockImplementation(async (propertyId: string) => {
    const list = store.get(propertyId) ?? [];
    return list.length ? list[list.length - 1] : undefined;
  });

  spyOn(ValuationRepository, 'findHistory').mockImplementation(
    async (propertyId: string, limit?: number) => {
      const safeLimit =
        typeof limit === 'number' && Number.isFinite(limit) && limit > 0
          ? Math.min(Math.max(Math.floor(limit), 1), 500)
          : 50;
      const list = [...(store.get(propertyId) ?? [])].reverse();
      return list.slice(0, safeLimit);
    },
  );

  spyOn(ValuationRepository, 'findAll').mockImplementation(async () => {
    return Array.from(store.values()).map((list) => list[list.length - 1]!);
  });

  spyOn(ValuationRepository, 'updateStatus').mockImplementation(
    async (
      id: string,
      propertyId: string,
      status: ValuationRecord['status'],
      rejectionReason?: string,
    ) => {
      const list = store.get(propertyId);
      if (!list) return undefined;
      const record = list.find((r) => r.id === id);
      if (!record) return undefined;
      record.status = status;
      if (rejectionReason) record.rejectionReason = rejectionReason;
      return record;
    },
  );
});

afterEach(() => {
  // Restore all active spyOn mocks so subsequent test files running in the same
  // Bun worker see the real ValuationRepository implementation, not the in-memory stub.
  mock.restore();
});

const makePayload = (
  overrides: Partial<RealEstateValuationPayload> = {},
): RealEstateValuationPayload => ({
  propertyId: `prop_${Math.random().toString(36).slice(2)}`,
  price: 350_000,
  currency: 'USD',
  sourceId: 'source_appraisal_001',
  sourceName: 'Acme Appraisals LLC',
  timestamp: new Date(),
  confidence: 92,
  methodology: 'comparable_sales',
  provenance: {
    dataProvider: 'Acme Appraisals LLC',
    licenseNumber: 'LIC-12345',
    assessorName: 'Jane Doe',
  },
  metadata: {
    squareFootage: 1800,
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 2005,
    propertyType: 'residential',
  },
  ...overrides,
});

describe('ValidationService.validateValuationPayload', () => {
  test('accepts a valid payload', () => {
    const result = ValidationService.validateValuationPayload(makePayload());
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects missing propertyId', () => {
    const result = ValidationService.validateValuationPayload(makePayload({ propertyId: '' }));
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Property ID is required');
  });

  test('rejects price <= 0', () => {
    const result = ValidationService.validateValuationPayload(makePayload({ price: 0 }));
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Price'))).toBe(true);
  });

  test('rejects price exceeding max bound', () => {
    const result = ValidationService.validateValuationPayload(
      makePayload({ price: 2_000_000_000 }),
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Price'))).toBe(true);
  });

  test('rejects stale timestamp', () => {
    const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const result = ValidationService.validateValuationPayload(
      makePayload({ timestamp: staleDate }),
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('stale'))).toBe(true);
  });

  test('rejects future timestamp', () => {
    const futureDate = new Date(Date.now() + 60_000);
    const result = ValidationService.validateValuationPayload(
      makePayload({ timestamp: futureDate }),
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('future'))).toBe(true);
  });

  test('rejects confidence out of range', () => {
    const result = ValidationService.validateValuationPayload(makePayload({ confidence: 150 }));
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Confidence'))).toBe(true);
  });

  test('rejects missing sourceId', () => {
    const result = ValidationService.validateValuationPayload(makePayload({ sourceId: '' }));
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Source ID is required');
  });

  test('rejects missing provenance dataProvider', () => {
    const result = ValidationService.validateValuationPayload(
      makePayload({ provenance: { dataProvider: '' } }),
    );
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Provenance'))).toBe(true);
  });
});

describe('OracleService.ingestValuation', () => {
  test('stores a valid valuation and returns it as active', async () => {
    const payload = makePayload();
    const { record, warnings } = await OracleService.ingestValuation(payload);

    expect(record.status).toBe('active');
    expect(record.id).toBeTruthy();
    expect(record.propertyId).toBe(payload.propertyId);
    expect(record.price).toBe(payload.price);
    expect(typeof warnings).toBe('object');
  });

  test('throws and saves rejected record for stale valuation', async () => {
    const stalePayload = makePayload({
      timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });

    await expect(OracleService.ingestValuation(stalePayload)).rejects.toThrow(/rejected/i);
  });

  test('throws for out-of-range price', async () => {
    const badPayload = makePayload({ price: -500 });
    await expect(OracleService.ingestValuation(badPayload)).rejects.toThrow(/rejected/i);
  });
});

describe('OracleService.getLatestValuation', () => {
  test('returns current valuation for a known property', async () => {
    const payload = makePayload();
    await OracleService.ingestValuation(payload);

    const record = await OracleService.getLatestValuation(payload.propertyId);
    expect(record.propertyId).toBe(payload.propertyId);
    expect(record.price).toBe(payload.price);
  });

  test('throws for unknown property', async () => {
    await expect(OracleService.getLatestValuation('nonexistent_prop')).rejects.toThrow();
  });

  test('latest valuation reflects the most recent submission', async () => {
    const propertyId = `prop_update_${Date.now()}`;
    await OracleService.ingestValuation(makePayload({ propertyId, price: 200_000 }));
    await OracleService.ingestValuation(makePayload({ propertyId, price: 210_000 }));

    const latest = await OracleService.getLatestValuation(propertyId);
    expect(latest.price).toBe(210_000);
  });
});

describe('OracleService.getValuationHistory', () => {
  test('returns ordered history of valuations', async () => {
    const propertyId = `prop_hist_${Date.now()}`;
    await OracleService.ingestValuation(makePayload({ propertyId, price: 100_000 }));
    await OracleService.ingestValuation(makePayload({ propertyId, price: 110_000 }));
    await OracleService.ingestValuation(makePayload({ propertyId, price: 120_000 }));

    const history = await OracleService.getValuationHistory(propertyId);
    expect(history.length).toBe(3);
    expect(history[0]!.price).toBe(120_000);
  });

  test('respects limit parameter', async () => {
    const propertyId = `prop_limit_${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      await OracleService.ingestValuation(makePayload({ propertyId, price: 100_000 + i * 10_000 }));
    }

    const history = await OracleService.getValuationHistory(propertyId, 2);
    expect(history.length).toBe(2);
  });

  test('returns empty array for property with no history', async () => {
    const history = await OracleService.getValuationHistory('prop_never_existed');
    expect(history).toEqual([]);
  });
});

describe('OracleService.buildContractPayload', () => {
  test('returns deterministic contract payload', async () => {
    const payload = makePayload({ price: 500_000 });
    await OracleService.ingestValuation(payload);

    const contractPayload = await OracleService.buildContractPayload(payload.propertyId);
    expect(contractPayload.propertyId).toBe(payload.propertyId);
    expect(contractPayload.priceMicroUsd).toBe(500_000 * 1_000_000);
    expect(typeof contractPayload.timestamp).toBe('number');
    expect(typeof contractPayload.sourceHash).toBe('string');
    expect(contractPayload.sourceHash.length).toBeGreaterThan(0);

    const second = await OracleService.buildContractPayload(payload.propertyId);
    expect(second.priceMicroUsd).toBe(contractPayload.priceMicroUsd);
    expect(second.sourceHash).toBe(contractPayload.sourceHash);
  });

  test('throws for non-active valuation status', async () => {
    const payload = makePayload();
    await OracleService.ingestValuation(payload);

    const record = await ValuationRepository.findLatest(payload.propertyId);
    await ValuationRepository.updateStatus(record!.id, payload.propertyId, 'manual_review', 'test');

    await expect(OracleService.buildContractPayload(payload.propertyId)).rejects.toThrow(
      /cannot build contract payload/i,
    );
  });
});

describe('OracleService.flagForManualReview', () => {
  test('sets valuation status to manual_review', async () => {
    const payload = makePayload();
    const { record } = await OracleService.ingestValuation(payload);

    const updated = await OracleService.flagForManualReview(
      record.id,
      payload.propertyId,
      'Suspicious value',
    );
    expect(updated.status).toBe('manual_review');
    expect(updated.rejectionReason).toBe('Suspicious value');
  });

  test('throws for unknown valuation id', async () => {
    const payload = makePayload();
    await OracleService.ingestValuation(payload);

    await expect(
      OracleService.flagForManualReview('bad_id', payload.propertyId, 'reason'),
    ).rejects.toThrow();
  });
});

describe('OracleService.submitManualOverride', () => {
  test('stores override with manual methodology and active status', async () => {
    const payload = makePayload({ methodology: 'comparable_sales' });
    const record = await OracleService.submitManualOverride({
      ...payload,
      overrideReason: 'Manual appraisal after dispute',
    });

    expect(record.status).toBe('active');
    expect(record.methodology).toBe('manual');
    expect(record.id).toBeTruthy();
  });
});


describe('Oracle API Routes Authentication & Validation', () => {
  const app = new Elysia().use(errorHandler).use(oracleRoutes);
  const TEST_CREDENTIAL = 'test-internal-ops-key';
  const authHeaders = {
    'content-type': 'application/json',
    'x-internal-api-key': TEST_CREDENTIAL,
  };
  const origEnv = process.env.OPERATIONS_BACKEND_CREDENTIAL;

  beforeEach(() => {
    process.env.OPERATIONS_BACKEND_CREDENTIAL = TEST_CREDENTIAL;
  });

  afterEach(() => {
    process.env.OPERATIONS_BACKEND_CREDENTIAL = origEnv;
  });

  test('POST /oracle/valuations returns 401 without credentials', async () => {
    const payload = makePayload();
    const res = await app.handle(
      new Request('http://localhost/oracle/valuations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    );
    expect(res.status).toBe(401);
  });

  test('POST /oracle/valuations returns 200 with credentials', async () => {
    const payload = makePayload();
    const res = await app.handle(
      new Request('http://localhost/oracle/valuations', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; record: ValuationRecord };
    expect(json.success).toBe(true);
    expect(json.record.propertyId).toBe(payload.propertyId);
  });

  test('POST /oracle/valuations returns 400 for invalid payload', async () => {
    const res = await app.handle(
      new Request('http://localhost/oracle/valuations', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ propertyId: '', price: -10 }),
      }),
    );
    expect(res.status).toBe(400);
  });

  test('POST /oracle/valuations/:propertyId/manual-review returns 401 without credentials', async () => {
    const res = await app.handle(
      new Request('http://localhost/oracle/valuations/prop_123/manual-review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: 'val_123', reason: 'Dispute' }),
      }),
    );
    expect(res.status).toBe(401);
  });

  test('POST /oracle/valuations/:propertyId/manual-review works with credentials', async () => {
    const payload = makePayload();
    const { record } = await OracleService.ingestValuation(payload);

    const res = await app.handle(
      new Request(`http://localhost/oracle/valuations/${payload.propertyId}/manual-review`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ id: record.id, reason: 'Disputed value' }),
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; record: ValuationRecord };
    expect(json.success).toBe(true);
    expect(json.record.status).toBe('manual_review');
  });

  test('POST /oracle/valuations/manual-override returns 401 without credentials', async () => {
    const payload = makePayload();
    const res = await app.handle(
      new Request('http://localhost/oracle/valuations/manual-override', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, overrideReason: 'Owner appeal' }),
      }),
    );
    expect(res.status).toBe(401);
  });

  test('POST /oracle/valuations/manual-override works with credentials', async () => {
    const payload = makePayload();
    const res = await app.handle(
      new Request('http://localhost/oracle/valuations/manual-override', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...payload, overrideReason: 'Owner appeal' }),
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; record: ValuationRecord };
    expect(json.success).toBe(true);
    expect(json.record.methodology).toBe('manual');
  });

  test('POST /oracle/valuations/manual-override returns 400 for invalid payload missing overrideReason', async () => {
    const payload = makePayload();
    const res = await app.handle(
      new Request('http://localhost/oracle/valuations/manual-override', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      }),
    );
    expect(res.status).toBe(400);
  });

  test('GET /oracle/valuations/:propertyId is public and returns latest valuation', async () => {
    const payload = makePayload();
    await OracleService.ingestValuation(payload);

    const res = await app.handle(
      new Request(`http://localhost/oracle/valuations/${payload.propertyId}`),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; record: ValuationRecord };
    expect(json.record.propertyId).toBe(payload.propertyId);
  });

  test('GET /oracle/valuations/:propertyId/history is public and bounds limit for invalid inputs (limit=abc, limit=-5)', async () => {
    const propertyId = `prop_history_${Date.now()}`;
    await OracleService.ingestValuation(makePayload({ propertyId, price: 100_000 }));
    await OracleService.ingestValuation(makePayload({ propertyId, price: 110_000 }));

    // limit=abc should not error or cause unbounded query; defaults safely to capped limit
    const resAbc = await app.handle(
      new Request(`http://localhost/oracle/valuations/${propertyId}/history?limit=abc`),
    );
    expect(resAbc.status).toBe(200);
    const jsonAbc = (await resAbc.json()) as { success: boolean; history: ValuationRecord[] };
    expect(jsonAbc.history.length).toBe(2);

    // limit=-5 should not error or cause unbounded query; defaults safely to capped limit
    const resNeg = await app.handle(
      new Request(`http://localhost/oracle/valuations/${propertyId}/history?limit=-5`),
    );
    expect(resNeg.status).toBe(200);
    const jsonNeg = (await resNeg.json()) as { success: boolean; history: ValuationRecord[] };
    expect(jsonNeg.history.length).toBe(2);
  });

  test('GET /oracle/valuations/:propertyId/contract-payload is public', async () => {
    const payload = makePayload({ price: 400_000 });
    await OracleService.ingestValuation(payload);

    const res = await app.handle(
      new Request(`http://localhost/oracle/valuations/${payload.propertyId}/contract-payload`),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; payload: { propertyId: string } };
    expect(json.payload.propertyId).toBe(payload.propertyId);
  });
});
