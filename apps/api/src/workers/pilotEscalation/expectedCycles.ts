export const DEFAULT_PILOT_PAYMENT_DAY = 5;
export const MIN_PILOT_PAYMENT_DAY = 1;
export const MAX_PILOT_PAYMENT_DAY = 28;

export interface ExpectedCycle {
  /** Calendar month cycle identifier in `YYYY-MM` format, e.g. `2026-03`. */
  cycleId: string;
  /** When this cycle's evidence was due (midnight UTC on `paymentDay` of the following month). */
  dueAt: Date;
}

export interface ExpectedCyclesConfig {
  /** When the ally's reporting agreement began (UTC year and month identify the first cycle). */
  agreementStartAt: Date;
  /**
   * Day of the month, in the month after each cycle, when evidence is due.
   * Must be an integer from 1 to 28. Default: 5.
   */
  paymentDay?: number;
}

export function formatCycleId(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function assertValidPaymentDay(paymentDay: number): void {
  if (
    !Number.isInteger(paymentDay) ||
    paymentDay < MIN_PILOT_PAYMENT_DAY ||
    paymentDay > MAX_PILOT_PAYMENT_DAY
  ) {
    throw new RangeError(
      `paymentDay must be an integer between ${MIN_PILOT_PAYMENT_DAY} and ${MAX_PILOT_PAYMENT_DAY}`,
    );
  }
}

/**
 * Parses `PILOT_ESCALATION_PAYMENT_DAY` with the same default (5) and bounds
 * (1 through 28) used by `pilotPaymentDay()` in `apps/webapp`.
 */
export function parsePaymentDayFromEnv(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_PILOT_PAYMENT_DAY;
  }
  const parsed = Number.parseInt(raw.trim(), 10);
  if (
    /^\d+$/.test(raw.trim()) &&
    Number.isInteger(parsed) &&
    parsed >= MIN_PILOT_PAYMENT_DAY &&
    parsed <= MAX_PILOT_PAYMENT_DAY
  ) {
    return parsed;
  }
  return DEFAULT_PILOT_PAYMENT_DAY;
}

/**
 * Parses `PILOT_ESCALATION_AGREEMENT_START` from either a `YYYY-MM` cycle string
 * or a full ISO-8601 date/timestamp string.
 */
export function parseAgreementStart(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const yearMonthMatch = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (yearMonthMatch) {
    const year = Number.parseInt(yearMonthMatch[1]!, 10);
    const month = Number.parseInt(yearMonthMatch[2]!, 10);
    if (month < 1 || month > 12) return undefined;
    return new Date(Date.UTC(year, month - 1, 1));
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Builds the ordered list of `YYYY-MM` reporting cycles from the agreement
 * start month up to the last month whose payment day (in the following month,
 * at 00:00:00 UTC) has passed as of `now`.
 */
export function buildExpectedCycles(
  config: ExpectedCyclesConfig,
  now: Date = new Date(),
): ExpectedCycle[] {
  const { agreementStartAt, paymentDay = DEFAULT_PILOT_PAYMENT_DAY } = config;
  assertValidPaymentDay(paymentDay);

  if (Number.isNaN(agreementStartAt.getTime())) {
    throw new Error('agreementStartAt must be a valid Date');
  }

  let year = agreementStartAt.getUTCFullYear();
  let month = agreementStartAt.getUTCMonth() + 1;
  const nowMs = now.getTime();
  const cycles: ExpectedCycle[] = [];

  while (true) {
    // `month` is 1-based while `Date.UTC` expects a 0-based month index, so
    // passing `month` directly lands on `paymentDay` of the following month
    // (including rolling December `month = 12` to January of `year + 1`).
    const dueAt = new Date(Date.UTC(year, month, paymentDay));
    if (dueAt.getTime() > nowMs) {
      break;
    }

    cycles.push({
      cycleId: formatCycleId(year, month),
      dueAt,
    });

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return cycles;
}
