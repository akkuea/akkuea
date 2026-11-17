import { describe, it, expect } from 'bun:test';
import {
  buildExpectedCycles,
  DEFAULT_PILOT_PAYMENT_DAY,
  parsePilotPaymentDay,
} from '../workers/pilotEscalation/expectedCycles';

describe('buildExpectedCycles', () => {
  const agreementStartAt = new Date('2026-01-15T00:00:00.000Z');

  it('returns no cycles before the first cycle payment day has passed', () => {
    expect(buildExpectedCycles({ agreementStartAt }, new Date('2026-01-31T23:59:59.999Z'))).toEqual(
      [],
    );
    expect(buildExpectedCycles({ agreementStartAt }, new Date('2026-02-04T23:59:59.999Z'))).toEqual(
      [],
    );
  });

  it('includes a YYYY-MM cycle once its payment day in the following month arrives', () => {
    const now = new Date('2026-02-05T00:00:00.000Z');
    const result = buildExpectedCycles({ agreementStartAt }, now);
    expect(result).toHaveLength(1);
    expect(result[0]?.cycleId).toBe('2026-01');
    expect(result[0]?.dueAt.toISOString()).toBe('2026-02-05T00:00:00.000Z');
  });

  it('accumulates calendar months up to the last month whose payment day has passed', () => {
    // In March after day 5, January and February are due, while March (due April 5) is not.
    const marchAfterPaymentDay = new Date('2026-03-10T12:00:00.000Z');
    const result = buildExpectedCycles({ agreementStartAt }, marchAfterPaymentDay);
    expect(result.map((c) => c.cycleId)).toEqual(['2026-01', '2026-02']);

    // In March before day 5, February is not yet due either.
    const marchBeforePaymentDay = new Date('2026-03-04T23:59:59.999Z');
    const earlier = buildExpectedCycles({ agreementStartAt }, marchBeforePaymentDay);
    expect(earlier.map((c) => c.cycleId)).toEqual(['2026-01']);
  });

  it('crosses year boundaries from 2026-12 to 2027-01', () => {
    const decStart = new Date('2026-12-01T00:00:00.000Z');
    const febNow = new Date('2027-02-05T00:00:00.000Z');
    const result = buildExpectedCycles({ agreementStartAt: decStart }, febNow);

    expect(result.map((c) => c.cycleId)).toEqual(['2026-12', '2027-01']);
    expect(result[0]?.dueAt.toISOString()).toBe('2027-01-05T00:00:00.000Z');
    expect(result[1]?.dueAt.toISOString()).toBe('2027-02-05T00:00:00.000Z');
  });

  it('returns an empty list when the agreement start is in the future', () => {
    const futureStart = new Date('2027-06-01T00:00:00.000Z');
    const now = new Date('2026-03-10T00:00:00.000Z');
    expect(buildExpectedCycles({ agreementStartAt: futureStart }, now)).toEqual([]);
  });

  it('defaults paymentDay to 5 and honors custom bounds 1 through 28', () => {
    expect(DEFAULT_PILOT_PAYMENT_DAY).toBe(5);

    const day1 = buildExpectedCycles(
      { agreementStartAt, paymentDay: 1 },
      new Date('2026-02-01T00:00:00.000Z'),
    );
    expect(day1.map((c) => c.cycleId)).toEqual(['2026-01']);

    const day28Before = buildExpectedCycles(
      { agreementStartAt, paymentDay: 28 },
      new Date('2026-02-27T23:59:59.999Z'),
    );
    expect(day28Before).toEqual([]);

    const day28On = buildExpectedCycles(
      { agreementStartAt, paymentDay: 28 },
      new Date('2026-02-28T00:00:00.000Z'),
    );
    expect(day28On.map((c) => c.cycleId)).toEqual(['2026-01']);
  });

  it('rejects a paymentDay outside 1 through 28 or non-integer values', () => {
    const now = new Date('2026-03-10T00:00:00.000Z');
    expect(() => buildExpectedCycles({ agreementStartAt, paymentDay: 0 }, now)).toThrow();
    expect(() => buildExpectedCycles({ agreementStartAt, paymentDay: 29 }, now)).toThrow();
    expect(() => buildExpectedCycles({ agreementStartAt, paymentDay: -1 }, now)).toThrow();
    expect(() => buildExpectedCycles({ agreementStartAt, paymentDay: 5.5 }, now)).toThrow();
  });

  it('rejects invalid dates', () => {
    expect(() =>
      buildExpectedCycles(
        { agreementStartAt: new Date('invalid') },
        new Date('2026-03-10T00:00:00.000Z'),
      ),
    ).toThrow();
    expect(() => buildExpectedCycles({ agreementStartAt }, new Date('invalid'))).toThrow();
  });
});

describe('parsePilotPaymentDay', () => {
  it('accepts integers from 1 through 28 and rejects out-of-range or malformed strings', () => {
    expect(parsePilotPaymentDay(undefined)).toBeUndefined();
    expect(parsePilotPaymentDay('')).toBeUndefined();
    expect(parsePilotPaymentDay('1')).toBe(1);
    expect(parsePilotPaymentDay(' 5 ')).toBe(5);
    expect(parsePilotPaymentDay('28')).toBe(28);
    expect(parsePilotPaymentDay('0')).toBeUndefined();
    expect(parsePilotPaymentDay('29')).toBeUndefined();
    expect(parsePilotPaymentDay('-3')).toBeUndefined();
    expect(parsePilotPaymentDay('5.5')).toBeUndefined();
    expect(parsePilotPaymentDay('5days')).toBeUndefined();
  });
});
