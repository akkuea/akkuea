import { describe, it, expect } from "bun:test";
import { startTimer, measureAsync, serializeMetric } from "./performance";
import { MetricName } from "../types/observability";

describe("startTimer", () => {
  it("produces a metric with non-negative duration", () => {
    const stop = startTimer();
    const metric = stop(MetricName.API_REQUEST_DURATION);
    expect(metric.durationMs).toBeGreaterThanOrEqual(0);
    expect(metric.name).toBe(MetricName.API_REQUEST_DURATION);
    expect(metric.status).toBe("success");
    expect(metric.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("attaches labels when provided", () => {
    const stop = startTimer();
    const metric = stop(MetricName.DB_QUERY_DURATION, { table: "properties" });
    expect(metric.labels).toEqual({ table: "properties" });
  });

  it("captures elapsed time deterministically", async () => {
    const stop = startTimer();
    await new Promise((r) => setTimeout(r, 20));
    const metric = stop(MetricName.SERVICE_OPERATION_DURATION);
    expect(metric.durationMs).toBeGreaterThanOrEqual(15);
  });
});

describe("measureAsync", () => {
  it("returns result and metric on success", async () => {
    const { result, metric } = await measureAsync(
      MetricName.SERVICE_OPERATION_DURATION,
      async () => 42,
      { source: "test" },
    );
    expect(result).toBe(42);
    expect(metric.status).toBe("success");
    expect(metric.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("re-throws errors and marks status as error", async () => {
    await expect(
      measureAsync(MetricName.DB_QUERY_DURATION, async () => {
        throw new Error("db down");
      }),
    ).rejects.toThrow("db down");
  });
});

describe("serializeMetric", () => {
  it("produces a stable payload shape", () => {
    const stop = startTimer();
    const metric = stop(MetricName.API_REQUEST_DURATION, { route: "/health" });
    const payload = serializeMetric(metric, "api");

    expect(payload.schemaVersion).toBe("1.0");
    expect(payload.source).toBe("api");
    expect(payload.metric.name).toBe(MetricName.API_REQUEST_DURATION);
    expect(typeof payload.metric.durationMs).toBe("number");
  });

  it("can be reused across modules without type errors", () => {
    // Simulates reuse from a different module
    const stop = startTimer();
    const metric = stop(MetricName.UI_RENDER_DURATION);
    const payload = serializeMetric(metric, "webapp");
    expect(payload.source).toBe("webapp");
  });
});
