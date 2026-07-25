/**
 * Mock fixture data for the /portfolio/performance endpoint (issue #1001).
 *
 * Each data point represents a daily snapshot of:
 *   - holdingsValue:    total estimated value of tokenised property shares (USD)
 *   - collateralRatio:  holdings value / total borrowed, expressed as a percentage
 *
 * 90 days of history are generated so the chart has enough range to be meaningful.
 */

export interface PortfolioPerformancePoint {
  /** ISO-8601 date string (YYYY-MM-DD) */
  date: string;
  /** Total estimated holdings value in USD */
  holdingsValue: number;
  /** Collateral ratio as a percentage (e.g. 175 means 175 %) */
  collateralRatio: number;
}

export interface PortfolioPerformanceResponse {
  walletAddress: string;
  points: PortfolioPerformancePoint[];
  /** Date range covered */
  from: string;
  to: string;
}

/** Number of days of history to generate */
const HISTORY_DAYS = 90;

/**
 * Deterministically generates a realistic-looking time series using a seeded
 * pseudo-random walk so the data looks the same on every render.
 */
function generateSeries(
  startValue: number,
  volatility: number,
  seed: number,
): number[] {
  const values: number[] = [startValue];
  let s = seed;

  for (let i = 1; i < HISTORY_DAYS; i++) {
    // LCG pseudo-random — gives repeatable, visually smooth walks
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const rand = (s >>> 0) / 0xffffffff; // [0, 1)
    const delta = (rand - 0.5) * 2 * volatility;
    values.push(Math.max(0, values[i - 1]! + delta));
  }

  return values;
}

/** Formats a Date as YYYY-MM-DD */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const MOCK_WALLET =
  "GDEMOUSER1234567890AKKUEA00000000000000000000000000000000";

/**
 * Pre-built 90-day performance history starting from 2026-04-26 (today minus 90 days
 * relative to the current mock snapshot date of 2026-07-25).
 */
function buildPerformanceHistory(): PortfolioPerformanceResponse {
  const toDate = new Date("2026-07-25T00:00:00.000Z");
  const fromDate = new Date(toDate);
  fromDate.setUTCDate(fromDate.getUTCDate() - HISTORY_DAYS + 1);

  const holdingsSeries = generateSeries(420_000, 8_000, 42);
  const collateralSeries = generateSeries(175, 4, 99);

  const points: PortfolioPerformancePoint[] = holdingsSeries.map((hv, i) => {
    const d = new Date(fromDate);
    d.setUTCDate(d.getUTCDate() + i);
    return {
      date: toDateStr(d),
      holdingsValue: Math.round(hv * 100) / 100,
      collateralRatio: Math.round(collateralSeries[i]! * 10) / 10,
    };
  });

  return {
    walletAddress: MOCK_WALLET,
    points,
    from: toDateStr(fromDate),
    to: toDateStr(toDate),
  };
}

export const mockPortfolioPerformance: PortfolioPerformanceResponse =
  buildPerformanceHistory();
