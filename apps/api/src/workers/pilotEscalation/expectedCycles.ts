export const DEFAULT_PILOT_PAYMENT_DAY = 5;
export const MIN_PILOT_PAYMENT_DAY = 1;
export const MAX_PILOT_PAYMENT_DAY = 28;

export interface ExpectedCycle {
  /** Calendar-month cycle identifier, e.g. `2026-03`. */
  cycleId: string;
  /**
   * When this cycle's evidence was due: midnight UTC on `paymentDay` of the
   * calendar month following the cycle.
   */
  dueAt: Date;
}

export interface ExpectedCyclesConfig {
  /** When the ally's reporting agreement began. */
  agreementStartAt: Date;
  /**
   * Day of the month (1 through 28), in the month after the cycle, on which
   * the cycle's income and evidence are due at midnight UTC. Default: 5.
   */
  paymentDay?: number;
}

export function formatCycleId(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Parses a configured payment day string (such as `PILOT_ESCALATION_PAYMENT_DAY`),
 * accepting integers from 1 through 28 to match the webapp's `pilotPaymentDay`
 * bounds and returning `undefined` when unset or out of range so callers fall
 * back to `DEFAULT_PILOT_PAYMENT_DAY` (5).
 */
export function parsePilotPaymentDay(value: string | undefined): number | undefined {
  const trimmed = value?.trim() ?? '';
  if (!/^-?\d+$/.test(trimmed)) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return parsed >= MIN_PILOT_PAYMENT_DAY && parsed <= MAX_PILOT_PAYMENT_DAY ? parsed : undefined;
}

/**
 * Builds the ordered list of calendar-month reporting cycles (`YYYY-MM`) whose
 * payment day has already passed as of `now`, starting from the calendar month
 * containing `agreementStartAt`.
 *
 * Matches the dashboard convention in `apps/webapp/src/services/pilot/cycles.ts`:
 * cycle `YYYY-MM` is due at midnight UTC on `paymentDay` of the month after
 * that cycle (`Date.UTC(year, month, paymentDay)`).
 */
export function buildExpectedCycles(
  config: ExpectedCyclesConfig,
  now: Date = new Date(),
): ExpectedCycle[] {
  const { agreementStartAt, paymentDay = DEFAULT_PILOT_PAYMENT_DAY } = config;

  if (Number.isNaN(agreementStartAt.getTime())) {
    throw new Error('agreementStartAt must be a valid Date');
  }
  if (Number.isNaN(now.getTime())) {
    throw new Error('now must be a valid Date');
  }
  if (
    !Number.isInteger(paymentDay) ||
    paymentDay < MIN_PILOT_PAYMENT_DAY ||
    paymentDay > MAX_PILOT_PAYMENT_DAY
  ) {
    throw new Error(
      `paymentDay must be an integer between ${MIN_PILOT_PAYMENT_DAY} and ${MAX_PILOT_PAYMENT_DAY}`,
    );
  }

  const nowMs = now.getTime();
  const cycles: ExpectedCycle[] = [];

  let year = agreementStartAt.getUTCFullYear();
  let month = agreementStartAt.getUTCMonth() + 1;

  // `month` is 1-based here and 0-based in `Date.UTC`, so passing `month`
  // directly lands on `paymentDay` of the following month and rolls December
  // into January of `year + 1`.
  let dueAtMs = Date.UTC(year, month, paymentDay);

  while (dueAtMs <= nowMs) {
    cycles.push({
      cycleId: formatCycleId(year, month),
      dueAt: new Date(dueAtMs),
    });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    dueAtMs = Date.UTC(year, month, paymentDay);
  }

  return cycles;
}
