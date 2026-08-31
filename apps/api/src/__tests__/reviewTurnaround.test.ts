import { describe, expect, it } from 'bun:test';
import {
  computeReviewTurnaround,
  emptyTurnaroundMetrics,
  isReviewSlaBreached,
  percentile,
  resolveMetricsWindow,
  type ReviewSample,
} from '../services/reviewTurnaround';

const HOUR_MS = 60 * 60 * 1000;
const SLA_HOURS = 48;
const T0 = new Date('2026-03-01T00:00:00.000Z');

function hoursAfter(hours: number): Date {
  return new Date(T0.getTime() + hours * HOUR_MS);
}

describe('percentile', () => {
  it('returns null for an empty sample', () => {
    expect(percentile([], 95)).toBeNull();
  });

  it('returns the sole value for a one-element sample', () => {
    expect(percentile([7], 50)).toBe(7);
    expect(percentile([7], 95)).toBe(7);
  });

  it('linearly interpolates p95 of five sorted values', () => {
    // index = 0.95 * 4 = 3.8 -> 4 + 0.8*(50-4) = 40.8
    expect(percentile([1, 2, 3, 4, 50], 95)).toBeCloseTo(40.8, 10);
  });

  it('rejects a percentile outside 0-100', () => {
    expect(() => percentile([1], -1)).toThrow();
    expect(() => percentile([1], 101)).toThrow();
  });
});

describe('computeReviewTurnaround', () => {
  const window = { from: T0, to: hoursAfter(60) };
  const now = hoursAfter(49);

  it('computes exact mean, median, p95, and SLA breaches from seeded timestamps', () => {
    const samples: ReviewSample[] = [
      { id: 'w1', startedAt: T0, completedAt: hoursAfter(1) },
      { id: 'w2', startedAt: T0, completedAt: hoursAfter(2) },
      { id: 'w3', startedAt: T0, completedAt: hoursAfter(3) },
      { id: 'w4', startedAt: T0, completedAt: hoursAfter(4) },
      { id: 'w5', startedAt: T0, completedAt: hoursAfter(50) },
      { id: 'p1', startedAt: hoursAfter(1), completedAt: null },
      { id: 'p2', startedAt: T0, completedAt: null },
    ];

    const metrics = computeReviewTurnaround('whitelist', samples, SLA_HOURS, window, now);

    expect(metrics.count).toBe(5);
    expect(metrics.meanMs).toBe(12 * HOUR_MS);
    expect(metrics.medianMs).toBe(3 * HOUR_MS);
    expect(metrics.p95Ms).toBe(Math.round(40.8 * HOUR_MS));
    expect(metrics.breachCount).toBe(1);
    expect(metrics.breachPercent).toBe(20);
    expect(metrics.completedBreachIds).toEqual(['w5']);
    expect(metrics.pendingCount).toBe(2);
    expect(metrics.pendingBreachCount).toBe(1);
    expect(metrics.pendingBreachIds).toEqual(['p2']);
    expect(metrics.totalBreachCount).toBe(2);
    expect(metrics.breached).toBe(true);
    expect(isReviewSlaBreached(metrics)).toBe(true);
    expect(metrics.slaTargetHours).toBe(48);
    expect(metrics.slaTargetMs).toBe(48 * HOUR_MS);
    expect(metrics.report).toContain('SLA breached');
  });

  it('does not treat a duration equal to the SLA as a breach', () => {
    const samples: ReviewSample[] = [{ id: 'on-time', startedAt: T0, completedAt: hoursAfter(48) }];
    const metrics = computeReviewTurnaround('whitelist', samples, SLA_HOURS, window, now);
    expect(metrics.breachCount).toBe(0);
    expect(metrics.breached).toBe(false);
    expect(isReviewSlaBreached(metrics)).toBe(false);
  });

  it('treats a pending request older than the SLA as a breach with no completed duration', () => {
    const samples: ReviewSample[] = [{ id: 'overdue', startedAt: T0, completedAt: null }];
    const metrics = computeReviewTurnaround('whitelist', samples, SLA_HOURS, window, now);
    expect(metrics.count).toBe(0);
    expect(metrics.meanMs).toBeNull();
    expect(metrics.medianMs).toBeNull();
    expect(metrics.p95Ms).toBeNull();
    expect(metrics.pendingCount).toBe(1);
    expect(metrics.pendingBreachCount).toBe(1);
    expect(metrics.totalBreachCount).toBe(1);
    expect(metrics.breached).toBe(true);
  });

  it('clamps a completed-before-start duration to zero (clock skew)', () => {
    const samples: ReviewSample[] = [{ id: 'skew', startedAt: hoursAfter(2), completedAt: T0 }];
    const metrics = computeReviewTurnaround('whitelist', samples, SLA_HOURS, window, now);
    expect(metrics.count).toBe(1);
    expect(metrics.meanMs).toBe(0);
    expect(metrics.breached).toBe(false);
  });
});

describe('emptyTurnaroundMetrics', () => {
  it('returns zeros and nulls for an empty window', () => {
    const window = { from: T0, to: hoursAfter(24) };
    const metrics = emptyTurnaroundMetrics('evidence', SLA_HOURS, window);
    expect(metrics.count).toBe(0);
    expect(metrics.breached).toBe(false);
    expect(metrics.kind).toBe('evidence');
  });
});

describe('resolveMetricsWindow', () => {
  it('defaults to the last N days ending at now when from is omitted', () => {
    const now = new Date('2026-04-01T00:00:00.000Z');
    const window = resolveMetricsWindow({}, 30, now);
    expect(window.to.toISOString()).toBe(now.toISOString());
    expect(window.from.toISOString()).toBe('2026-03-02T00:00:00.000Z');
  });

  it('honors explicit from/to', () => {
    const window = resolveMetricsWindow(
      {
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-01-31T00:00:00.000Z',
      },
      30,
    );
    expect(window.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(window.to.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  it('rejects a reversed window', () => {
    expect(() =>
      resolveMetricsWindow(
        { from: '2026-02-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' },
        30,
      ),
    ).toThrow(/from/);
  });
});
