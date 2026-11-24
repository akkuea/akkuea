export interface ExpectedCycle {
  /** Calendar month identifier used by `record_evidence`, e.g. `2026-03`. */
  cycleId: string;
  /** When this cycle's evidence was due, on the payment day of the next month. */
  dueAt: Date;
}

export interface ExpectedCyclesConfig {
  /** When the ally's reporting agreement began. */
  agreementStartAt: Date;
  /** Day of the month when income is due, from 1 through 28. Default: 5. */
  paymentDay?: number;
}

const DEFAULT_PAYMENT_DAY = 5;

/**
 * Builds the ordered list of calendar-month reporting cycles whose payment
 * deadline has passed as of `now`. Evidence for a cycle is due on the
 * configured payment day of the following month.
 */
export function buildExpectedCycles(
  config: ExpectedCyclesConfig,
  now: Date = new Date(),
): ExpectedCycle[] {
  const { agreementStartAt, paymentDay = DEFAULT_PAYMENT_DAY } = config;

  if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 28) {
    throw new Error('paymentDay must be a whole number from 1 to 28');
  }
  if (Number.isNaN(agreementStartAt.getTime())) {
    throw new Error('agreementStartAt must be a valid date');
  }

  const cycles: ExpectedCycle[] = [];
  let year = agreementStartAt.getUTCFullYear();
  let month = agreementStartAt.getUTCMonth();

  while (true) {
    const cycleId = `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}`;
    const dueAt = new Date(Date.UTC(year, month + 1, paymentDay));
    if (dueAt.getTime() > now.getTime()) break;

    cycles.push({ cycleId, dueAt });
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }

  return cycles;
}
