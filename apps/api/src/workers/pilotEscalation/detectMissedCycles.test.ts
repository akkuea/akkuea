import { describe, expect, it } from 'bun:test';
import { detectMissedCycles } from '../detectMissedCycles';

describe('detectMissedCycles', () => {
  it('returns no breach when all cycles have evidence', () => {
    const cycles = [
      { cycleId: 'cycle-1', hasEvidence: true, isUnknown: false },
      { cycleId: 'cycle-2', hasEvidence: true, isUnknown: false },
    ];
    const result = detectMissedCycles(cycles, 2);
    expect(result.breached).toBe(false);
    expect(result.consecutiveMissed).toBe(0);
    expect(result.unknownCount).toBe(0);
  });

  it('detects breach when threshold is reached', () => {
    const cycles = [
      { cycleId: 'cycle-1', hasEvidence: true, isUnknown: false },
      { cycleId: 'cycle-2', hasEvidence: false, isUnknown: false },
      { cycleId: 'cycle-3', hasEvidence: false, isUnknown: false },
    ];
    const result = detectMissedCycles(cycles, 2);
    expect(result.breached).toBe(true);
    expect(result.consecutiveMissed).toBe(2);
  });

  it('does NOT count unknown cycles as missed', () => {
    const cycles = [
      { cycleId: 'cycle-1', hasEvidence: true, isUnknown: false },
      { cycleId: 'cycle-2', hasEvidence: false, isUnknown: true },
    ];
    const result = detectMissedCycles(cycles, 2);
    expect(result.breached).toBe(false);
    expect(result.consecutiveMissed).toBe(0);
    expect(result.unknownCount).toBe(1);
  });

  it('stops gap detection at unknown cycle', () => {
    const cycles = [
      { cycleId: 'cycle-1', hasEvidence: false, isUnknown: false },
      { cycleId: 'cycle-2', hasEvidence: false, isUnknown: true },
      { cycleId: 'cycle-3', hasEvidence: false, isUnknown: false },
    ];
    const result = detectMissedCycles(cycles, 2);
    expect(result.consecutiveMissed).toBe(1);
    expect(result.unknownCycleIds).toContain('cycle-2');
  });

  it('returns unknownCount > 0 when unknowns exist', () => {
    const cycles = [
      { cycleId: 'cycle-1', hasEvidence: false, isUnknown: true },
      { cycleId: 'cycle-2', hasEvidence: false, isUnknown: true },
    ];
    const result = detectMissedCycles(cycles, 2);
    expect(result.unknownCount).toBe(2);
    expect(result.breached).toBe(false);
  });
});
