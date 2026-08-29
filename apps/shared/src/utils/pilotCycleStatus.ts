/**
 * Pilot cycle status derivation.
 *
 * Every value this module returns is derived from on-chain facts emitted by the
 * C6-001 pilot payout-split contract, plus the ally's agreed expected payment
 * date. Nothing here reads a database, and nothing here is inferred from
 * client-side bookkeeping: given the same on-chain records and the same
 * reference instant, the result is identical for every viewer.
 *
 * Kept free of React so both the webapp and the API can derive the same status
 * from the same inputs.
 */

/** Evidence lifecycle as stored on-chain by the payout-split contract. */
export type PilotEvidenceStatus =
  "submitted" | "under_review" | "approved" | "rejected" | "disputed";

/**
 * Payment status an investor sees for a single income cycle.
 *
 * This describes whether the cycle's money arrived and when, which is a
 * different question from where the ally's evidence sits in review.
 */
export type PilotCycleStatus =
  "on_time" | "late" | "disputed" | "not_received" | "pending";

/**
 * A single cycle as read from the payout-split contract.
 *
 * Timestamps are Unix seconds, matching `env.ledger().timestamp()` on-chain.
 * A cycle with no evidence submitted yet is represented by omitting `evidence`.
 */
export interface PilotCycleRecord {
  /** Contract cycle identifier, for example "2026-03". */
  cycleId: string;
  /** Unix seconds. The date the ally's income was contractually due. */
  expectedAt: number;
  evidence?: {
    status: PilotEvidenceStatus;
    /** Unix seconds the ally submitted evidence for this cycle. */
    submittedAt: number;
    /** Unix seconds the operator approved or rejected. Absent while pending. */
    reviewedAt?: number;
    /** Operator's stated reason when rejected or disputed. */
    reviewReason?: string;
  };
  distribution?: {
    /** Unix seconds the payout transaction executed on-chain. */
    distributedAt: number;
    /** Total income reported for the cycle, in USDC stroops. */
    totalIncome: bigint;
    /** Amount split across token holders, in USDC stroops. */
    holderAmount: bigint;
  };
}

/**
 * Grace period, in seconds, between the expected date and the point where a
 * distribution counts as late rather than on time.
 *
 * Five days matches the pilot's stated tolerance in the product brief. It is a
 * parameter rather than a constant in the derivation so the pilot can tune it
 * against the ally's real behaviour without a code change reaching investors.
 */
export const DEFAULT_GRACE_PERIOD_SECONDS = 5 * 24 * 60 * 60;

/**
 * Zero as a bigint.
 *
 * Written this way rather than as `0n` because the webapp compiles at an ES2017
 * target, where bigint literals are unavailable.
 */
const ZERO = BigInt(0);

/** Number of consecutive unreported cycles that triggers escalation. */
export const ESCALATION_MISSED_CYCLES = 2;

export interface DeriveCycleStatusOptions {
  /** Unix seconds treated as "now". Required, so the result stays testable. */
  now: number;
  /** Overrides {@link DEFAULT_GRACE_PERIOD_SECONDS}. */
  gracePeriodSeconds?: number;
}

/**
 * Derives the payment status of a single cycle.
 *
 * Precedence, highest first:
 * 1. A disputed cycle stays disputed regardless of any payout that followed,
 *    because the dispute is the fact an investor most needs to see.
 * 2. A completed distribution is on time or late, measured against the
 *    expected date plus the grace period.
 * 3. An undistributed cycle whose grace period has not elapsed is pending.
 * 4. Anything else has not been received.
 */
export function deriveCycleStatus(
  cycle: PilotCycleRecord,
  options: DeriveCycleStatusOptions,
): PilotCycleStatus {
  const grace = options.gracePeriodSeconds ?? DEFAULT_GRACE_PERIOD_SECONDS;
  const deadline = cycle.expectedAt + grace;

  if (cycle.evidence?.status === "disputed") {
    return "disputed";
  }

  if (cycle.distribution) {
    return cycle.distribution.distributedAt <= deadline ? "on_time" : "late";
  }

  return options.now <= deadline ? "pending" : "not_received";
}

/**
 * True when the ally has gone {@link ESCALATION_MISSED_CYCLES} consecutive
 * cycles without a distribution reaching investors.
 *
 * Only cycles whose grace period has already elapsed can count as missed: a
 * cycle still inside its window is pending, not missed. Counting runs backwards
 * from the most recent elapsed cycle, so a single recovered cycle clears the
 * escalation rather than leaving it stuck on an old failure.
 */
export function hasEscalation(
  cycles: PilotCycleRecord[],
  options: DeriveCycleStatusOptions,
): boolean {
  return (
    countConsecutiveMissedCycles(cycles, options) >= ESCALATION_MISSED_CYCLES
  );
}

/**
 * Counts consecutive missed cycles ending at the most recent elapsed cycle.
 *
 * Exposed separately so the dashboard can show how deep the escalation runs,
 * not just that it crossed the threshold.
 */
export function countConsecutiveMissedCycles(
  cycles: PilotCycleRecord[],
  options: DeriveCycleStatusOptions,
): number {
  const grace = options.gracePeriodSeconds ?? DEFAULT_GRACE_PERIOD_SECONDS;

  const elapsed = [...cycles]
    .filter((cycle) => options.now > cycle.expectedAt + grace)
    .sort((a, b) => a.expectedAt - b.expectedAt);

  let streak = 0;
  for (let i = elapsed.length - 1; i >= 0; i -= 1) {
    const cycle = elapsed[i];
    if (!cycle) {
      break;
    }
    const status = deriveCycleStatus(cycle, options);
    if (status === "not_received" || status === "disputed") {
      streak += 1;
      continue;
    }
    break;
  }

  return streak;
}

/** A cycle paired with its derived status, ordered oldest first. */
export interface PilotCycleTimelineEntry {
  cycle: PilotCycleRecord;
  status: PilotCycleStatus;
}

export interface PilotCycleTimeline {
  entries: PilotCycleTimelineEntry[];
  /** True when the ally has missed the escalation threshold. */
  escalated: boolean;
  /** How many consecutive cycles are currently missed. */
  consecutiveMissed: number;
  /** Sum of `holderAmount` across every distributed cycle, in USDC stroops. */
  totalDistributed: bigint;
}

/**
 * Builds the full investor timeline in one pass.
 *
 * This is what the investor view renders: an ordered per-cycle status list, the
 * escalation flag, and the running total actually distributed to holders.
 */
export function buildCycleTimeline(
  cycles: PilotCycleRecord[],
  options: DeriveCycleStatusOptions,
): PilotCycleTimeline {
  const entries = [...cycles]
    .sort((a, b) => a.expectedAt - b.expectedAt)
    .map((cycle) => ({ cycle, status: deriveCycleStatus(cycle, options) }));

  const totalDistributed = entries.reduce(
    (sum, entry) => sum + (entry.cycle.distribution?.holderAmount ?? ZERO),
    ZERO,
  );

  const consecutiveMissed = countConsecutiveMissedCycles(cycles, options);

  return {
    entries,
    escalated: consecutiveMissed >= ESCALATION_MISSED_CYCLES,
    consecutiveMissed,
    totalDistributed,
  };
}
