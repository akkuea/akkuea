/**
 * Cycle identity helpers.
 *
 * A cycle is one calendar month of an ally's rental income, identified on-chain
 * by its `YYYY-MM` string. Its expected payment date is the configured payment
 * day of the following month, which is a term of the ally's agreement rather
 * than anything the contract knows about.
 */

const CYCLE_PATTERN = /^(\d{4})-(\d{2})$/;

export interface ParsedCycle {
  year: number;
  /** 1 through 12. */
  month: number;
}

export function parseCycleId(cycleId: string): ParsedCycle | null {
  const match = CYCLE_PATTERN.exec(cycleId);
  if (!match) {
    return null;
  }
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  if (month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

export function formatCycleId(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Unix seconds the cycle's income is due: the configured payment day of the
 * month after the cycle, at midnight UTC.
 */
export function expectedAtFor(cycleId: string, paymentDay: number): number {
  const parsed = parseCycleId(cycleId);
  if (!parsed) {
    throw new Error(`Invalid cycle id: ${cycleId}`);
  }
  // Month is 1-based here and 0-based in Date.UTC, so passing `parsed.month`
  // directly already lands on the month after the cycle.
  return Math.floor(Date.UTC(parsed.year, parsed.month, paymentDay) / 1000);
}

/**
 * Every cycle from `startCycleId` up to and including the month containing
 * `now`, oldest first.
 */
export function enumerateCycles(startCycleId: string, now: Date): string[] {
  const start = parseCycleId(startCycleId);
  if (!start) {
    throw new Error(`Invalid start cycle id: ${startCycleId}`);
  }

  const endYear = now.getUTCFullYear();
  const endMonth = now.getUTCMonth() + 1;

  const cycles: string[] = [];
  let year = start.year;
  let month = start.month;

  // A misconfigured start cycle in the future yields an empty list rather than
  // an unbounded loop.
  while (year < endYear || (year === endYear && month <= endMonth)) {
    cycles.push(formatCycleId(year, month));
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return cycles;
}
