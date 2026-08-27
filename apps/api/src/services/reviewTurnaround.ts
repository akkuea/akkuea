/**
 * Pure review-turnaround statistics.
 *
 * Shared by the operator metrics endpoint and any later consumer (C7-007's
 * escalation job, a log/report printer) so breach detection is not
 * re-derived ad hoc at each call site.
 */

export type ReviewKind = 'whitelist' | 'evidence';

export interface ReviewSample {
  /** Request id (whitelist) or cycle id (evidence). */
  id: string;
  /** Submission time, or the expected cycle due date for evidence. */
  startedAt: Date;
  /** Review/record time. Null while still pending. */
  completedAt: Date | null;
}

export interface ReviewWindow {
  from: Date;
  to: Date;
}

export interface ReviewTurnaroundMetrics {
  kind: ReviewKind;
  slaTargetHours: number;
  slaTargetMs: number;
  window: { from: string; to: string };
  /** Completed reviews in the window. */
  count: number;
  meanMs: number | null;
  medianMs: number | null;
  p95Ms: number | null;
  /** Completed reviews whose duration exceeded the SLA. */
  breachCount: number;
  /** `breachCount / count`, or 0 when count is 0. */
  breachPercent: number;
  pendingCount: number;
  pendingBreachCount: number;
  completedBreachIds: string[];
  pendingBreachIds: string[];
  /** Reviewed-late plus pending-overdue. The number a job should key off. */
  totalBreachCount: number;
  /** True when `totalBreachCount > 0`. */
  breached: boolean;
  /** One-line summary for a human or a log line. */
  report: string;
}

/**
 * Linear-interpolation percentile of a sorted-ascending sample.
 * `p` is in [0, 100]. Empty input returns null.
 */
export function percentile(sortedAscending: number[], p: number): number | null {
  if (sortedAscending.length === 0) return null;
  if (p < 0 || p > 100) {
    throw new Error('percentile p must be between 0 and 100');
  }
  if (sortedAscending.length === 1) return sortedAscending[0]!;

  const index = (p / 100) * (sortedAscending.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const lowerVal = sortedAscending[lower]!;
  const upperVal = sortedAscending[upper]!;
  if (lower === upper) return lowerVal;
  return lowerVal + (upperVal - lowerVal) * (index - lower);
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundMs(value: number): number {
  return Math.round(value);
}

function formatHours(ms: number | null): string {
  if (ms === null) return 'n/a';
  return `${(ms / (60 * 60 * 1000)).toFixed(2)}h`;
}

export function formatTurnaroundReport(metrics: Omit<ReviewTurnaroundMetrics, 'report'>): string {
  const label = metrics.kind === 'whitelist' ? 'Whitelist review' : 'Evidence review';
  const reviewedLate =
    metrics.count === 0
      ? '0 reviewed late'
      : `${metrics.breachCount}/${metrics.count} reviewed late (${metrics.breachPercent.toFixed(1)}%)`;
  const status = metrics.breached ? 'SLA breached' : 'SLA met';
  return (
    `${label} (${metrics.window.from} to ${metrics.window.to}, SLA ${metrics.slaTargetHours}h): ` +
    `${metrics.count} reviewed, mean ${formatHours(metrics.meanMs)}, ` +
    `median ${formatHours(metrics.medianMs)}, p95 ${formatHours(metrics.p95Ms)}, ` +
    `${reviewedLate}. ${metrics.pendingCount} pending, ${metrics.pendingBreachCount} overdue. ${status}.`
  );
}

export function emptyTurnaroundMetrics(
  kind: ReviewKind,
  slaTargetHours: number,
  window: ReviewWindow,
): ReviewTurnaroundMetrics {
  return computeReviewTurnaround(kind, [], slaTargetHours, window, window.to);
}

/**
 * Compute turnaround stats from seeded samples.
 *
 * Completed duration is `max(0, completedAt - startedAt)`. Pending items
 * older than the SLA count as breaches even though they have no completed
 * duration (they are the "still waiting" signal).
 */
export function computeReviewTurnaround(
  kind: ReviewKind,
  samples: ReviewSample[],
  slaTargetHours: number,
  window: ReviewWindow,
  now: Date = new Date(),
): ReviewTurnaroundMetrics {
  const slaTargetMs = slaTargetHours * 60 * 60 * 1000;
  const durationsMs: number[] = [];
  const completedBreachIds: string[] = [];
  const pendingBreachIds: string[] = [];
  let pendingCount = 0;

  for (const sample of samples) {
    if (sample.completedAt) {
      const durationMs = Math.max(0, sample.completedAt.getTime() - sample.startedAt.getTime());
      durationsMs.push(durationMs);
      if (durationMs > slaTargetMs) {
        completedBreachIds.push(sample.id);
      }
    } else {
      pendingCount += 1;
      const ageMs = Math.max(0, now.getTime() - sample.startedAt.getTime());
      if (ageMs > slaTargetMs) {
        pendingBreachIds.push(sample.id);
      }
    }
  }

  durationsMs.sort((a, b) => a - b);
  const count = durationsMs.length;
  const breachCount = completedBreachIds.length;
  const pendingBreachCount = pendingBreachIds.length;
  const meanMs = mean(durationsMs);
  const medianMs = percentile(durationsMs, 50);
  const p95Ms = percentile(durationsMs, 95);
  const totalBreachCount = breachCount + pendingBreachCount;

  const partial: Omit<ReviewTurnaroundMetrics, 'report'> = {
    kind,
    slaTargetHours,
    slaTargetMs,
    window: { from: window.from.toISOString(), to: window.to.toISOString() },
    count,
    meanMs: meanMs === null ? null : roundMs(meanMs),
    medianMs: medianMs === null ? null : roundMs(medianMs),
    p95Ms: p95Ms === null ? null : roundMs(p95Ms),
    breachCount,
    breachPercent: count === 0 ? 0 : (breachCount / count) * 100,
    pendingCount,
    pendingBreachCount,
    completedBreachIds,
    pendingBreachIds,
    totalBreachCount,
    breached: totalBreachCount > 0,
  };

  return { ...partial, report: formatTurnaroundReport(partial) };
}

/** Machine-readable breach flag for a scheduled job. */
export function isReviewSlaBreached(metrics: ReviewTurnaroundMetrics): boolean {
  return metrics.breached;
}

export interface MetricsWindowQuery {
  from?: string;
  to?: string;
  windowDays?: number;
}

export function resolveMetricsWindow(
  query: MetricsWindowQuery,
  defaultWindowDays: number,
  now: Date = new Date(),
): ReviewWindow {
  const to = query.to ? new Date(query.to) : now;
  if (Number.isNaN(to.getTime())) {
    throw new Error('Invalid "to" timestamp');
  }

  const windowDays = query.windowDays ?? defaultWindowDays;
  if (!Number.isFinite(windowDays) || windowDays <= 0) {
    throw new Error('windowDays must be a positive number');
  }

  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - windowDays * 24 * 60 * 60 * 1000);
  if (Number.isNaN(from.getTime())) {
    throw new Error('Invalid "from" timestamp');
  }
  if (from.getTime() > to.getTime()) {
    throw new Error('"from" must be before "to"');
  }

  return { from, to };
}
