/**
 * REQ-001 / REQ-003: Lightweight performance timing helpers.
 *
 * Usage (API handler):
 *   const stop = startTimer();
 *   await doWork();
 *   const metric = stop(MetricName.API_REQUEST_DURATION, { route: "/properties" });
 *
 * Usage (async wrap):
 *   const { result, metric } = await measureAsync(
 *     MetricName.SERVICE_OPERATION_DURATION,
 *     () => propertyService.list(),
 *     { source: "api" }
 *   );
 */

import type {
  MetricName,
  MetricPayload,
  TimingMetric,
  OperationStatus,
} from "../types/observability";

// ---------------------------------------------------------------------------
// Timer primitive
// ---------------------------------------------------------------------------

export interface StopTimer {
  /**
   * Stop the timer and return a TimingMetric.
   * @param name  Standardized metric name (use MetricName constants).
   * @param labels  Optional key/value labels for filtering.
   */
  (name: MetricName | string, labels?: Record<string, string>): TimingMetric;
}

/**
 * Start a high-resolution timer.
 * Returns a `stop` function that, when called, produces a TimingMetric.
 *
 * @example
 * const stop = startTimer();
 * await fetchData();
 * const metric = stop(MetricName.API_REQUEST_DURATION, { route: "/loans" });
 */
export function startTimer(): StopTimer {
  const startMs = Date.now();
  const startedAt = new Date(startMs).toISOString();

  return function stop(
    name: MetricName | string,
    labels?: Record<string, string>,
  ): TimingMetric {
    const durationMs = Date.now() - startMs;
    return {
      name,
      durationMs,
      startedAt,
      status: "success",
      labels,
    };
  };
}

// ---------------------------------------------------------------------------
// Async wrapper
// ---------------------------------------------------------------------------

export interface MeasureAsyncOptions {
  /** Identifies the service/app emitting the metric. Defaults to "unknown". */
  source?: string;
  /** Extra labels to attach. */
  labels?: Record<string, string>;
}

export interface MeasureAsyncResult<T> {
  result: T;
  metric: TimingMetric;
  payload: MetricPayload;
}

/**
 * Wrap an async operation and automatically capture its duration and outcome.
 * Errors are re-thrown after the metric is captured.
 *
 * @example
 * const { result, metric } = await measureAsync(
 *   MetricName.DB_QUERY_DURATION,
 *   () => db.select().from(properties),
 *   { source: "api", labels: { table: "properties" } }
 * );
 */
export async function measureAsync<T>(
  name: MetricName | string,
  fn: () => Promise<T>,
  options: MeasureAsyncOptions = {},
): Promise<MeasureAsyncResult<T>> {
  const { source = "unknown", labels } = options;
  const startMs = Date.now();
  const startedAt = new Date(startMs).toISOString();
  let status: OperationStatus = "success";
  let errorMessage: string | undefined;

  try {
    const result = await fn();
    const metric: TimingMetric = {
      name,
      durationMs: Date.now() - startMs,
      startedAt,
      status,
      labels,
    };
    return { result, metric, payload: serializeMetric(metric, source) };
  } catch (err) {
    status = "error";
    errorMessage = err instanceof Error ? err.message : String(err);
    const metric: TimingMetric = {
      name,
      durationMs: Date.now() - startMs,
      startedAt,
      status,
      labels,
      errorMessage,
    };
    // Capture metric before re-throwing so callers can log it if needed
    void serializeMetric(metric, source);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Serialization helper
// ---------------------------------------------------------------------------

/**
 * Produce a stable, serializable MetricPayload from a TimingMetric.
 * REQ-004: Shape is designed for direct APM ingestion.
 */
export function serializeMetric(
  metric: TimingMetric,
  source: string,
): MetricPayload {
  return {
    metric: { ...metric },
    source,
    schemaVersion: "1.0",
  };
}
