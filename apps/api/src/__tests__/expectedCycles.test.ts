import { describe, it, expect } from 'bun:test';
import { buildExpectedCycles } from '../workers/pilotEscalation/expectedCycles';

describe('buildExpectedCycles', () => {
  const agreementStartAt = new Date('2026-01-01T00:00:00.000Z');

  it('returns no cycles before the first payment deadline', () => {
    const now = new Date('2026-02-04T23:59:59.999Z');
    const result = buildExpectedCycles({ agreementStartAt }, now);
    expect(result).toEqual([]);
  });

  it('includes a cycle at the payment-day boundary', () => {
    const now = new Date('2026-02-05T00:00:00.000Z');
    const result = buildExpectedCycles({ agreementStartAt }, now);
    expect(result).toHaveLength(1);
    expect(result[0]?.cycleId).toBe('2026-01');
    expect(result[0]?.dueAt.toISOString()).toBe('2026-02-05T00:00:00.000Z');
  });

  it('includes only cycles whose payment day has passed', () => {
    const now = new Date('2026-03-05T00:00:00.000Z');
    const result = buildExpectedCycles({ agreementStartAt }, now);
    expect(result.map((cycle) => cycle.cycleId)).toEqual(['2026-01', '2026-02']);
  });

  it('handles the December to January year boundary', () => {
    const start = new Date('2026-12-20T00:00:00.000Z');
    const now = new Date('2027-02-05T00:00:00.000Z');
    const result = buildExpectedCycles({ agreementStartAt: start }, now);
    expect(result.map((cycle) => cycle.cycleId)).toEqual(['2026-12', '2027-01']);
  });

  it('honors a configured payment day', () => {
    const now = new Date('2026-02-12T00:00:00.000Z');
    const result = buildExpectedCycles({ agreementStartAt, paymentDay: 12 }, now);
    expect(result[0]?.dueAt.toISOString()).toBe('2026-02-12T00:00:00.000Z');
  });

  it('rejects payment days outside the configured bounds', () => {
    expect(() => buildExpectedCycles({ agreementStartAt, paymentDay: 0 })).toThrow();
    expect(() => buildExpectedCycles({ agreementStartAt, paymentDay: 29 })).toThrow();
    expect(() => buildExpectedCycles({ agreementStartAt, paymentDay: 5.5 })).toThrow();
  });
});
