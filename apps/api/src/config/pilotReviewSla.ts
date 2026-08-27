/**
 * Pilot review-turnaround SLA targets.
 *
 * Defaults match `docs/operations/pilot-review-sla.md`. Both values are
 * environment-overridable so a signed ally's actual expectations can be
 * applied without a code change.
 */

const DEFAULT_SLA_HOURS = 48;
const DEFAULT_WINDOW_DAYS = 30;

export interface PilotReviewSlaConfig {
  /** Whitelist request must be reviewed within this many hours of submission. */
  whitelistSlaHours: number;
  /** Evidence must be recorded on-chain within this many hours of the cycle due date. */
  evidenceSlaHours: number;
  /** Default lookback when the metrics query omits `from` / `windowDays`. */
  defaultWindowDays: number;
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function getPilotReviewSlaConfig(): PilotReviewSlaConfig {
  return {
    whitelistSlaHours: parsePositiveNumber(
      process.env.PILOT_WHITELIST_REVIEW_SLA_HOURS,
      DEFAULT_SLA_HOURS,
    ),
    evidenceSlaHours: parsePositiveNumber(
      process.env.PILOT_EVIDENCE_REVIEW_SLA_HOURS,
      DEFAULT_SLA_HOURS,
    ),
    defaultWindowDays: parsePositiveNumber(
      process.env.PILOT_REVIEW_METRICS_WINDOW_DAYS,
      DEFAULT_WINDOW_DAYS,
    ),
  };
}
