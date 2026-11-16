import { describe, it, expect } from 'bun:test';
import {
  buildExpectedCycles,
  parseAgreementStart,
  parsePaymentDayFromEnv,
} from '../workers/pilotEscalation/expectedCycles';

describe('buildExpectedCycles', () => {
  const agreementStartAt = new Date('2026-01-15T00:00:00.000Z');

  it('returns no cycles before the first month payment day has passed', () => {
    // 2026-01 cycle is due on 2026-02-05T00:00:00.000Z (default paymentDay = 5).
    const beforeDue = new Date('2026-02-04T23:59:59.999Z');
    expect(buildExpectedCycles({ agreementStartAt }, beforeDue)).toEqual([]);
  });

  it('includes a cycle once its payment day in the following month is reached', () => {
    const onDue = new Date('2026-02-05T00:00:00.000Z');
    const result = buildExpectedCycles({ agreementStartAt }, onDue);
    expect(result).toHaveLength(1);
    expect(result[0]?.cycleId).toBe('2026-01');
    expect(result[0]?.dueAt.toISOString()).toBe('2026-02-05T00:00:00.000Z');
  });

  it('accumulates YYYY-MM calendar months up to the last month whose payment day passed', () => {
    // On 2026-04-04, 2026-01 (due Feb 5) and 2026-02 (due Mar 5) are due; 2026-03 (due Apr 5) is not yet due.
    const beforeAprilPaymentDay = new Date('2026-04-04T12:00:00.000Z');
    expect(
      buildExpectedCycles({ agreementStartAt }, beforeAprilPaymentDay).map((c) => c.cycleId),
    ).toEqual(['2026-01', '2026-02']);

    const afterAprilPaymentDay = new Date('2026-04-06T00:00:00.000Z');
    expect(
      buildExpectedCycles({ agreementStartAt }, afterAprilPaymentDay).map((c) => c.cycleId),
    ).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('handles year boundaries from December to January', () => {
    const decStart = new Date('2026-12-10T00:00:00.000Z');
    const febAfterPaymentDay = new Date('2027-02-10T00:00:00.000Z');
    const result = buildExpectedCycles({ agreementStartAt: decStart }, febAfterPaymentDay);
    expect(result.map((c) => c.cycleId)).toEqual(['2026-12', '2027-01']);
    expect(result[0]?.dueAt.toISOString()).toBe('2027-01-05T00:00:00.000Z');
    expect(result[1]?.dueAt.toISOString()).toBe('2027-02-05T00:00:00.000Z');
  });

  it('honors custom paymentDay within bounds 1 to 28', () => {
    const now = new Date('2026-02-15T00:00:00.000Z');
    expect(
      buildExpectedCycles({ agreementStartAt, paymentDay: 20 }, now).map((c) => c.cycleId),
    ).toEqual([]);
    expect(
      buildExpectedCycles({ agreementStartAt, paymentDay: 15 }, now).map((c) => c.cycleId),
    ).toEqual(['2026-01']);
    expect(
      buildExpectedCycles({ agreementStartAt, paymentDay: 1 }, now).map((c) => c.cycleId),
    ).toEqual(['2026-01']);
    expect(
      buildExpectedCycles(
        { agreementStartAt, paymentDay: 28 },
        new Date('2026-02-28T00:00:00.000Z'),
      ).map((c) => c.cycleId),
    ).toEqual(['2026-01']);
  });

  it('rejects out-of-range or non-integer paymentDay values', () => {
    expect(() => buildExpectedCycles({ agreementStartAt, paymentDay: 0 }, new Date())).toThrow();
    expect(() => buildExpectedCycles({ agreementStartAt, paymentDay: 29 }, new Date())).toThrow();
    expect(() => buildExpectedCycles({ agreementStartAt, paymentDay: -3 }, new Date())).toThrow();
    expect(() => buildExpectedCycles({ agreementStartAt, paymentDay: 5.5 }, new Date())).toThrow();
  });

  it('parses paymentDay from env with default 5 and bounds 1 to 28', () => {
    expect(parsePaymentDayFromEnv(undefined)).toBe(5);
    expect(parsePaymentDayFromEnv('')).toBe(5);
    expect(parsePaymentDayFromEnv('1')).toBe(1);
    expect(parsePaymentDayFromEnv('15')).toBe(15);
    expect(parsePaymentDayFromEnv('28')).toBe(28);
    expect(parsePaymentDayFromEnv('0')).toBe(5);
    expect(parsePaymentDayFromEnv('29')).toBe(5);
    expect(parsePaymentDayFromEnv('abc')).toBe(5);
  });

  it('parses agreement start from YYYY-MM or ISO date strings', () => {
    expect(parseAgreementStart('2026-01')?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(parseAgreementStart('2026-01-15T00:00:00.000Z')?.toISOString()).toBe(
      '2026-01-15T00:00:00.000Z',
    );
    expect(parseAgreementStart('2026-13')).toBeUndefined();
    expect(parseAgreementStart('')).toBeUndefined();
  });
});
