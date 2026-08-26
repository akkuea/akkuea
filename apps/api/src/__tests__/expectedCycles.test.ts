import { describe, it, expect } from 'bun:test';
import { buildExpectedCycles } from '../workers/pilotEscalation/expectedCycles';

describe('buildExpectedCycles', () => {
  const agreementStartAt = new Date('2026-01-01T00:00:00.000Z');

  it('returns no cycles before the first cadence period elapses', () => {
    const now = new Date('2026-01-15T00:00:00.000Z');
    const result = buildExpectedCycles({ agreementStartAt, cadenceDays: 30 }, now);
    expect(result).toEqual([]);
  });

  it('includes a cycle exactly when its deadline has passed', () => {
    const now = new Date('2026-01-31T00:00:00.000Z');
    const result = buildExpectedCycles({ agreementStartAt, cadenceDays: 30 }, now);
    expect(result).toHaveLength(1);
    expect(result[0]?.cycleId).toBe('cycle-1');
    expect(result[0]?.dueAt.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  it('accumulates multiple cycles as time passes', () => {
    const now = new Date('2026-04-01T00:00:00.000Z'); // ~90 days later
    const result = buildExpectedCycles({ agreementStartAt, cadenceDays: 30 }, now);
    expect(result.map((c) => c.cycleId)).toEqual(['cycle-1', 'cycle-2', 'cycle-3']);
  });

  it('honors a custom cadence and prefix', () => {
    const now = new Date('2026-01-15T00:00:00.000Z');
    const result = buildExpectedCycles(
      { agreementStartAt, cadenceDays: 7, cycleIdPrefix: 'week-' },
      now,
    );
    expect(result.map((c) => c.cycleId)).toEqual(['week-1', 'week-2']);
  });

  it('rejects a non-positive cadence', () => {
    expect(() => buildExpectedCycles({ agreementStartAt, cadenceDays: 0 }, new Date())).toThrow();
  });
});
