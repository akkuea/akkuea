/**
 * Pure breach-detection logic for the pilot ally reporting-cycle escalation job.
 *
 * Kept free of I/O (no RPC, no database, no clock reads) so the two-cycle-gap
 * rule can be unit tested exhaustively against hand-built cycle histories.
 */

export type EvidenceCheckStatus = "confirmed" | "missing" | "unknown";

export interface CycleEvidenceStatus {
  /** The cycle identifier, e.g. `cycle-3`. */
  cycleId: string;
  /** Whether `record_evidence` was found on-chain for this cycle. */
  hasEvidence: boolean;
  /** True when RPC was unavailable and the evidence could not be checked. */
  isUnknown: boolean;
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
  /** Cycle IDs where RPC was unavailable and evidence could not be checked. */
  unknownCycleIds: string[];
  /** Count of cycles where RPC was unavailable. */
  unknownCount: number;
}

/**
 * Determines whether the ally has missed `thresholdCycles` or more
 * consecutive expected reporting cycles.
 *
 * `cycles` must be ordered oldest-to-newest and should only contain cycles
 * whose reporting deadline has already passed (see `buildExpectedCycles`).
 *
 * Unknown cycles (RPC unavailable) are never counted as missed. An unknown
 * cycle acts as a wall: the gap detection stops at the first unknown cycle,
 * because we cannot determine whether the ally has reported or not.
 */
export function detectMissedCycles(
  cycles: CycleEvidenceStatus[],
  thresholdCycles: number,
): CycleGapResult {
  if (!Number.isInteger(thresholdCycles) || thresholdCycles < 1) {
    throw new Error('thresholdCycles must be an integer >= 1');
  }

  const missedCycleIds: string[] = [];
  const unknownCycleIds: string[] = [];

  for (let i = cycles.length - 1; i >= 0; i--) {
    const cycle = cycles[i];
    if (!cycle) break;

    if (cycle.isUnknown) {
      unknownCycleIds.unshift(cycle.cycleId);
      break;
    }

    if (cycle.hasEvidence) break;

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
    unknownCycleIds,
    unknownCount: unknownCycleIds.length,
  };
}
