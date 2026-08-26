/**
 * Pure breach-detection logic for the pilot ally reporting-cycle escalation job.
 *
 * Kept free of I/O (no RPC, no database, no clock reads) so the two-cycle-gap
 * rule can be unit tested exhaustively against hand-built cycle histories.
 */

export interface CycleEvidenceStatus {
  /** The cycle identifier, e.g. `cycle-3`. */
  cycleId: string;
  /** Whether `record_evidence` was found on-chain for this cycle. */
  hasEvidence: boolean;
}

export interface CycleGapResult {
  /** True once `consecutiveMissed` reaches the configured threshold. */
  breached: boolean;
  /** Count of consecutive missed cycles trailing the most recent expected cycle. */
  consecutiveMissed: number;
  /** Cycle IDs that make up the trailing gap, oldest first. */
  missedCycleIds: string[];
  /** The most recent missed cycle ID, or null if there is no trailing gap. */
  lastMissedCycleId: string | null;
}

/**
 * Determines whether the ally has missed `thresholdCycles` or more
 * consecutive expected reporting cycles.
 *
 * `cycles` must be ordered oldest-to-newest and should only contain cycles
 * whose reporting deadline has already passed (see `buildExpectedCycles`).
 * The gap is measured from the end of the list backward: evidence recorded
 * for the most recent cycle resets the gap to zero, even if an earlier gap
 * existed and was never notified on, because the ally is no longer
 * currently in breach.
 */
export function detectMissedCycles(
  cycles: CycleEvidenceStatus[],
  thresholdCycles: number,
): CycleGapResult {
  if (!Number.isInteger(thresholdCycles) || thresholdCycles < 1) {
    throw new Error('thresholdCycles must be an integer >= 1');
  }

  const missedCycleIds: string[] = [];
  for (let i = cycles.length - 1; i >= 0; i--) {
    const cycle = cycles[i];
    if (!cycle || cycle.hasEvidence) break;
    missedCycleIds.unshift(cycle.cycleId);
  }

  const consecutiveMissed = missedCycleIds.length;
  const lastMissedCycleId =
    consecutiveMissed > 0 ? missedCycleIds[missedCycleIds.length - 1] : null;

  return {
    breached: consecutiveMissed >= thresholdCycles,
    consecutiveMissed,
    missedCycleIds,
    lastMissedCycleId: lastMissedCycleId ?? null,
  };
}
