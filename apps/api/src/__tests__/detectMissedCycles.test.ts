import { describe, it, expect } from 'bun:test';
import {
  detectMissedCycles,
  type CycleEvidenceStatus,
} from '../workers/pilotEscalation/detectMissedCycles';

function cycles(pattern: boolean[]): CycleEvidenceStatus[] {
  return pattern.map((hasEvidence, i) => ({ cycleId: `cycle-${i + 1}`, hasEvidence }));
}

describe('detectMissedCycles', () => {
  it('reports no breach when there is no trailing gap', () => {
    const result = detectMissedCycles(cycles([true, true, true]), 2);
    expect(result.breached).toBe(false);
    expect(result.consecutiveMissed).toBe(0);
    expect(result.missedCycleIds).toEqual([]);
    expect(result.lastMissedCycleId).toBeNull();
  });

  it('does not breach on exactly one missed cycle (threshold 2)', () => {
    const result = detectMissedCycles(cycles([true, true, false]), 2);
    expect(result.breached).toBe(false);
    expect(result.consecutiveMissed).toBe(1);
    expect(result.missedCycleIds).toEqual(['cycle-3']);
  });

  it('breaches on exactly two consecutive missed cycles (threshold 2)', () => {
    const result = detectMissedCycles(cycles([true, false, false]), 2);
    expect(result.breached).toBe(true);
    expect(result.consecutiveMissed).toBe(2);
    expect(result.missedCycleIds).toEqual(['cycle-2', 'cycle-3']);
    expect(result.lastMissedCycleId).toBe('cycle-3');
  });

  it('breaches on more than the threshold', () => {
    const result = detectMissedCycles(cycles([true, false, false, false]), 2);
    expect(result.breached).toBe(true);
    expect(result.consecutiveMissed).toBe(3);
    expect(result.missedCycleIds).toEqual(['cycle-2', 'cycle-3', 'cycle-4']);
  });

  it('only counts the trailing gap, not an earlier resolved gap', () => {
    // Ally missed two cycles, then resumed reporting - no longer in breach.
    const result = detectMissedCycles(cycles([true, false, false, true]), 2);
    expect(result.breached).toBe(false);
    expect(result.consecutiveMissed).toBe(0);
  });

  it('treats an all-missing history as a full trailing gap', () => {
    const result = detectMissedCycles(cycles([false, false]), 2);
    expect(result.breached).toBe(true);
    expect(result.consecutiveMissed).toBe(2);
  });

  it('returns no breach for an empty cycle history', () => {
    const result = detectMissedCycles([], 2);
    expect(result.breached).toBe(false);
    expect(result.consecutiveMissed).toBe(0);
  });

  it('respects a configurable threshold other than 2', () => {
    const result = detectMissedCycles(cycles([false, false, false]), 3);
    expect(result.breached).toBe(true);
    expect(result.consecutiveMissed).toBe(3);

    const belowThreshold = detectMissedCycles(cycles([false, false]), 3);
    expect(belowThreshold.breached).toBe(false);
  });

  it('rejects a non-positive threshold', () => {
    expect(() => detectMissedCycles(cycles([false]), 0)).toThrow();
    expect(() => detectMissedCycles(cycles([false]), -1)).toThrow();
  });
});
