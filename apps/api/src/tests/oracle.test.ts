import { describe, test, expect } from 'bun:test';
import { OracleService } from '../services/OracleService';
import { ValuationRepository } from '../repositories/ValuationRepository';
import type { RealEstateValuationPayload } from '@real-estate-defi/shared';
import { ValidationService } from '@real-estate-defi/shared';

// Reset in-memory store between tests by re-importing won't work cleanly,
// so we test each scenario with unique propertyIds.

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
    const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
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
  test('stores a valid valuation and returns it as active', () => {
    const payload = makePayload();
    const { record, warnings } = OracleService.ingestValuation(payload);

    expect(record.status).toBe('active');
    expect(record.id).toBeTruthy();
    expect(record.propertyId).toBe(payload.propertyId);
    expect(record.price).toBe(payload.price);
    expect(typeof warnings).toBe('object');
  });

  test('throws and saves rejected record for stale valuation', () => {
    const stalePayload = makePayload({
      timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000),
    });

    expect(() => OracleService.ingestValuation(stalePayload)).toThrow(/rejected/i);
  });

  test('throws for out-of-range price', () => {
    const badPayload = makePayload({ price: -500 });
    expect(() => OracleService.ingestValuation(badPayload)).toThrow(/rejected/i);
  });
});

describe('OracleService.getLatestValuation', () => {
  test('returns current valuation for a known property', () => {
    const payload = makePayload();
    OracleService.ingestValuation(payload);

    const record = OracleService.getLatestValuation(payload.propertyId);
    expect(record.propertyId).toBe(payload.propertyId);
    expect(record.price).toBe(payload.price);
  });

  test('throws for unknown property', () => {
    expect(() => OracleService.getLatestValuation('nonexistent_prop')).toThrow();
  });

  test('latest valuation reflects the most recent submission', () => {
    const propertyId = `prop_update_${Date.now()}`;
    OracleService.ingestValuation(makePayload({ propertyId, price: 200_000 }));
    OracleService.ingestValuation(makePayload({ propertyId, price: 210_000 }));

    const latest = OracleService.getLatestValuation(propertyId);
    expect(latest.price).toBe(210_000);
  });
});

describe('OracleService.getValuationHistory', () => {
  test('returns ordered history of valuations', () => {
    const propertyId = `prop_hist_${Date.now()}`;
    OracleService.ingestValuation(makePayload({ propertyId, price: 100_000 }));
    OracleService.ingestValuation(makePayload({ propertyId, price: 110_000 }));
    OracleService.ingestValuation(makePayload({ propertyId, price: 120_000 }));

    const history = OracleService.getValuationHistory(propertyId);
    expect(history.length).toBe(3);
    // Should be sorted most recent first
    expect(history[0]!.price).toBe(120_000);
  });

  test('respects limit parameter', () => {
    const propertyId = `prop_limit_${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      OracleService.ingestValuation(makePayload({ propertyId, price: 100_000 + i * 10_000 }));
    }

    const history = OracleService.getValuationHistory(propertyId, 2);
    expect(history.length).toBe(2);
  });

  test('returns empty array for property with no history', () => {
    const history = OracleService.getValuationHistory('prop_never_existed');
    expect(history).toEqual([]);
  });
});

describe('OracleService.buildContractPayload', () => {
  test('returns deterministic contract payload', () => {
    const payload = makePayload({ price: 500_000 });
    OracleService.ingestValuation(payload);

    const contractPayload = OracleService.buildContractPayload(payload.propertyId);
    expect(contractPayload.propertyId).toBe(payload.propertyId);
    expect(contractPayload.priceMicroUsd).toBe(500_000 * 1_000_000);
    expect(typeof contractPayload.timestamp).toBe('number');
    expect(typeof contractPayload.sourceHash).toBe('string');
    expect(contractPayload.sourceHash.length).toBeGreaterThan(0);

    // Determinism: same call returns same values
    const second = OracleService.buildContractPayload(payload.propertyId);
    expect(second.priceMicroUsd).toBe(contractPayload.priceMicroUsd);
    expect(second.sourceHash).toBe(contractPayload.sourceHash);
  });

  test('throws for non-active valuation status', () => {
    const payload = makePayload();
    OracleService.ingestValuation(payload);

    const record = ValuationRepository.findLatest(payload.propertyId)!;
    ValuationRepository.updateStatus(record.id, payload.propertyId, 'manual_review', 'test');

    expect(() => OracleService.buildContractPayload(payload.propertyId)).toThrow(
      /cannot build contract payload/i,
    );
  });
});

describe('OracleService.flagForManualReview', () => {
  test('sets valuation status to manual_review', () => {
    const payload = makePayload();
    const { record } = OracleService.ingestValuation(payload);

    const updated = OracleService.flagForManualReview(
      record.id,
      payload.propertyId,
      'Suspicious value',
    );
    expect(updated.status).toBe('manual_review');
    expect(updated.rejectionReason).toBe('Suspicious value');
  });

  test('throws for unknown valuation id', () => {
    const payload = makePayload();
    OracleService.ingestValuation(payload);

    expect(() =>
      OracleService.flagForManualReview('bad_id', payload.propertyId, 'reason'),
    ).toThrow();
  });
});

describe('OracleService.submitManualOverride', () => {
  test('stores override with manual methodology and active status', () => {
    const payload = makePayload({ methodology: 'comparable_sales' });
    const record = OracleService.submitManualOverride({
      ...payload,
      overrideReason: 'Manual appraisal after dispute',
    });

    expect(record.status).toBe('active');
    expect(record.methodology).toBe('manual');
    expect(record.id).toBeTruthy();
  });
});
