import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  ReviewTurnaroundService,
  type WhitelistRequestRow,
} from '../services/ReviewTurnaroundService';
import { getPilotReviewSlaConfig } from '../config/pilotReviewSla';
import type { EvidenceLookupResult } from '../services/PilotPayoutEvidenceReader';

const HOUR_MS = 60 * 60 * 1000;
const SLA_HOURS = 48;
const T0 = new Date('2026-03-01T00:00:00.000Z');

function hoursAfter(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * HOUR_MS);
}

const defaultSla = {
  whitelistSlaHours: SLA_HOURS,
  evidenceSlaHours: SLA_HOURS,
  defaultWindowDays: 30,
};

describe('ReviewTurnaroundService whitelist metrics', () => {
  it('computes stats from seeded request records with known timestamps', async () => {
    const now = hoursAfter(T0, 49);
    const rows: WhitelistRequestRow[] = [
      { id: 'w1', createdAt: T0, reviewedAt: hoursAfter(T0, 1) },
      { id: 'w2', createdAt: T0, reviewedAt: hoursAfter(T0, 2) },
      { id: 'w3', createdAt: T0, reviewedAt: hoursAfter(T0, 3) },
      { id: 'w4', createdAt: T0, reviewedAt: hoursAfter(T0, 4) },
      { id: 'w5', createdAt: T0, reviewedAt: hoursAfter(T0, 50) },
      { id: 'p1', createdAt: hoursAfter(T0, 1), reviewedAt: null },
      { id: 'p2', createdAt: T0, reviewedAt: null },
    ];

    const service = new ReviewTurnaroundService({
      listWhitelistRequests: async () => rows,
      evidenceReader: { hasEvidence: async () => ({ present: false }) },
      sla: defaultSla,
      agreementStartAt: null,
      now: () => now,
    });

    const metrics = await service.getWhitelistMetrics({
      from: T0,
      to: hoursAfter(T0, 60),
    });

    expect(metrics.count).toBe(5);
    expect(metrics.meanMs).toBe(12 * HOUR_MS);
    expect(metrics.medianMs).toBe(3 * HOUR_MS);
    expect(metrics.p95Ms).toBe(Math.round(40.8 * HOUR_MS));
    expect(metrics.breachCount).toBe(1);
    expect(metrics.completedBreachIds).toEqual(['w5']);
    expect(metrics.pendingBreachCount).toBe(1);
    expect(metrics.pendingBreachIds).toEqual(['p2']);
    expect(metrics.breached).toBe(true);
  });
});

describe('ReviewTurnaroundService evidence metrics', () => {
  const agreementStartAt = new Date('2026-01-01T00:00:00.000Z');
  // cycle-1 due 2026-01-31, cycle-2 due 2026-03-02, cycle-3 due 2026-04-01
  const cycle1Due = new Date('2026-01-31T00:00:00.000Z');
  const cycle2Due = new Date('2026-03-02T00:00:00.000Z');
  const now = new Date('2026-04-03T01:00:00.000Z');

  function unixSeconds(date: Date): number {
    return Math.floor(date.getTime() / 1000);
  }

  it('computes turnaround from on-chain recorded_at, not a database table', async () => {
    const lookups: Record<string, EvidenceLookupResult> = {
      'cycle-1': { present: true, recordedAt: unixSeconds(hoursAfter(cycle1Due, 2)) },
      'cycle-2': { present: true, recordedAt: unixSeconds(hoursAfter(cycle2Due, 50)) },
      'cycle-3': { present: false },
    };

    const service = new ReviewTurnaroundService({
      listWhitelistRequests: async () => [],
      evidenceReader: {
        hasEvidence: async (cycleId) => lookups[cycleId] ?? { present: false },
      },
      sla: defaultSla,
      agreementStartAt,
      cadenceDays: 30,
      contractId: 'C-TEST',
      now: () => now,
    });

    const metrics = await service.getEvidenceMetrics({
      from: agreementStartAt,
      to: now,
    });

    expect(metrics.available).toBe(true);
    expect(metrics.count).toBe(2);
    expect(metrics.meanMs).toBe(((2 + 50) / 2) * HOUR_MS);
    expect(metrics.medianMs).toBe(((2 + 50) / 2) * HOUR_MS);
    expect(metrics.breachCount).toBe(1);
    expect(metrics.completedBreachIds).toEqual(['cycle-2']);
    expect(metrics.pendingCount).toBe(1);
    expect(metrics.pendingBreachCount).toBe(1);
    expect(metrics.pendingBreachIds).toEqual(['cycle-3']);
    expect(metrics.breached).toBe(true);
  });

  it('returns unavailable metrics when the agreement start is not configured', async () => {
    const service = new ReviewTurnaroundService({
      listWhitelistRequests: async () => [],
      sla: defaultSla,
      agreementStartAt: null,
      now: () => now,
    });

    const metrics = await service.getEvidenceMetrics({
      from: agreementStartAt,
      to: now,
    });

    expect(metrics.available).toBe(false);
    expect(metrics.unavailableReason).toBe('agreement_start_not_configured');
    expect(metrics.count).toBe(0);
  });

  it('degrades on RPC failure without throwing', async () => {
    const service = new ReviewTurnaroundService({
      listWhitelistRequests: async () => [],
      evidenceReader: {
        hasEvidence: async () => {
          throw new Error('rpc down');
        },
      },
      sla: defaultSla,
      agreementStartAt,
      cadenceDays: 30,
      contractId: 'C-TEST',
      now: () => now,
    });

    const metrics = await service.getEvidenceMetrics({
      from: agreementStartAt,
      to: now,
    });

    expect(metrics.available).toBe(false);
    expect(metrics.unavailableReason).toBe('rpc_error');
  });
});

describe('ReviewTurnaroundService.getMetrics', () => {
  it('returns both surfaces and a combined report', async () => {
    const now = hoursAfter(T0, 2);
    const service = new ReviewTurnaroundService({
      listWhitelistRequests: async () => [
        { id: 'w1', createdAt: T0, reviewedAt: hoursAfter(T0, 1) },
      ],
      evidenceReader: { hasEvidence: async () => ({ present: false }) },
      sla: defaultSla,
      agreementStartAt: null,
      now: () => now,
    });

    const result = await service.getMetrics({
      from: T0.toISOString(),
      to: now.toISOString(),
    });

    expect(result.whitelist.count).toBe(1);
    expect(result.whitelist.breached).toBe(false);
    expect(result.evidence.available).toBe(false);
    expect(result.report).toContain('Whitelist review');
    expect(result.report).toContain('Evidence review');
  });
});

describe('getPilotReviewSlaConfig', () => {
  const originalWhitelist = process.env.PILOT_WHITELIST_REVIEW_SLA_HOURS;
  const originalEvidence = process.env.PILOT_EVIDENCE_REVIEW_SLA_HOURS;

  beforeEach(() => {
    delete process.env.PILOT_WHITELIST_REVIEW_SLA_HOURS;
    delete process.env.PILOT_EVIDENCE_REVIEW_SLA_HOURS;
  });

  afterEach(() => {
    if (originalWhitelist === undefined) {
      delete process.env.PILOT_WHITELIST_REVIEW_SLA_HOURS;
    } else {
      process.env.PILOT_WHITELIST_REVIEW_SLA_HOURS = originalWhitelist;
    }
    if (originalEvidence === undefined) {
      delete process.env.PILOT_EVIDENCE_REVIEW_SLA_HOURS;
    } else {
      process.env.PILOT_EVIDENCE_REVIEW_SLA_HOURS = originalEvidence;
    }
  });

  it('defaults to 48 hours and honors env overrides', () => {
    expect(getPilotReviewSlaConfig().whitelistSlaHours).toBe(48);

    process.env.PILOT_WHITELIST_REVIEW_SLA_HOURS = '16';
    process.env.PILOT_EVIDENCE_REVIEW_SLA_HOURS = '24';
    expect(getPilotReviewSlaConfig().whitelistSlaHours).toBe(16);
    expect(getPilotReviewSlaConfig().evidenceSlaHours).toBe(24);
  });
});
