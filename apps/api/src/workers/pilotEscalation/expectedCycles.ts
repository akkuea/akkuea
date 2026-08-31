export interface ExpectedCycle {
  /** Sequential cycle identifier, e.g. `cycle-3`. */
  cycleId: string;
  /** When this cycle's evidence was due. */
  dueAt: Date;
}

export interface ExpectedCyclesConfig {
  /** When the ally's reporting agreement began. */
  agreementStartAt: Date;
  /** Expected reporting cadence, in days. */
  cadenceDays: number;
  /** Prefix used to build sequential cycle IDs. Default: `cycle-`. */
  cycleIdPrefix?: string;
}

/**
 * Builds the ordered list of reporting cycles whose deadline has already
 * passed as of `now`.
 *
 * Cycle N covers `[start + (N-1)*cadence, start + N*cadence)` and is
 * "expected" once that window has fully elapsed. Cycle IDs are sequential
 * (`cycle-1`, `cycle-2`, ...) rather than derived from calendar dates: the
 * real `cycle_id` string convention is set by the operator/ally at
 * `record_evidence` time per their agreement, which does not exist yet for
 * a real pilot ally, so a deterministic, agreement-agnostic scheme is used
 * here and made configurable via `cycleIdPrefix`.
 */
export function buildExpectedCycles(
  config: ExpectedCyclesConfig,
  now: Date = new Date(),
): ExpectedCycle[] {
  const { agreementStartAt, cadenceDays, cycleIdPrefix = 'cycle-' } = config;

  if (cadenceDays <= 0) {
    throw new Error('cadenceDays must be > 0');
  }

  const cadenceMs = cadenceDays * 24 * 60 * 60 * 1_000;
  const startMs = agreementStartAt.getTime();
  const nowMs = now.getTime();
  const cycles: ExpectedCycle[] = [];

  let index = 1;
  let dueAtMs = startMs + cadenceMs;

  while (dueAtMs <= nowMs) {
    cycles.push({ cycleId: `${cycleIdPrefix}${index}`, dueAt: new Date(dueAtMs) });
    index += 1;
    dueAtMs = startMs + cadenceMs * index;
  }

  return cycles;
}
