/**
 * Shared observability contracts for performance and operational monitoring.
 * These types standardize how metrics, timings, and health signals are
 * represented across API handlers, services, and frontend instrumentation.
 */

// ---------------------------------------------------------------------------
// Metric names — single source of truth for event naming conventions
// ---------------------------------------------------------------------------

/**
 * REQ-002: Standardized performance event names.
 * Use these constants everywhere instead of raw strings to avoid typos and
 * keep naming consistent across API, services, and UI.
 */
export const MetricName = {
  // API surface
  API_REQUEST_DURATION: "api.request.duration",
  API_REQUEST_ERROR: "api.request.error",

  // Service layer
  SERVICE_OPERATION_DURATION: "service.operation.duration",
  SERVICE_OPERATION_ERROR: "service.operation.error",

  // Blockchain / Stellar
  STELLAR_TX_DURATION: "stellar.transaction.duration",
  STELLAR_TX_ERROR: "stellar.transaction.error",

  // Database
  DB_QUERY_DURATION: "db.query.duration",
  DB_QUERY_ERROR: "db.query.error",

  // UI / frontend
  UI_RENDER_DURATION: "ui.render.duration",
  UI_INTERACTION_DURATION: "ui.interaction.duration",
} as const;

export type MetricName = (typeof MetricName)[keyof typeof MetricName];

// ---------------------------------------------------------------------------
// Core shapes
// ---------------------------------------------------------------------------

/** Outcome of a measured operation. */
export type OperationStatus = "success" | "error" | "timeout";

/**
 * REQ-001: Shared measurement primitive.
 * Represents a single timing observation with enough context for APM ingestion.
 */
export interface TimingMetric {
  /** Standardized event name — use MetricName constants. */
  name: MetricName | string;
  /** Wall-clock duration in milliseconds. */
  durationMs: number;
  /** ISO-8601 timestamp when the operation started. */
  startedAt: string;
  /** Outcome of the measured operation. */
  status: OperationStatus;
  /** Optional free-form labels for filtering / grouping. */
  labels?: Record<string, string>;
  /** Optional error message when status is "error". */
  errorMessage?: string;
}

/**
 * Serializable payload sent to an APM backend or logging pipeline.
 * REQ-004: Designed so a real APM adapter can wrap this without changes.
 */
export interface MetricPayload {
  metric: TimingMetric;
  /** Service or app that produced the metric. */
  source: string;
  /** Schema version — bump when the shape changes. */
  schemaVersion: "1.0";
}
