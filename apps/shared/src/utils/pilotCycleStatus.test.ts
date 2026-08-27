import { describe, it, expect } from "vitest";
import {
  DEFAULT_GRACE_PERIOD_SECONDS,
  ESCALATION_MISSED_CYCLES,
  buildCycleTimeline,
  countConsecutiveMissedCycles,
  deriveCycleStatus,
  hasEscalation,
  type PilotCycleRecord,
} from "./pilotCycleStatus";

const DAY = 24 * 60 * 60;

/** 2026-03-01T00:00:00Z, used as the expected date for the baseline cycle. */
const MARCH = 1772323200;
const FEBRUARY = MARCH - 28 * DAY;
const JANUARY = FEBRUARY - 31 * DAY;

function cycle(overrides: Partial<PilotCycleRecord> = {}): PilotCycleRecord {
  return {
    cycleId: "2026-03",
    expectedAt: MARCH,
    ...overrides,
  };
}

function distributedAt(timestamp: number) {
  return {
    distributedAt: timestamp,
    totalIncome: 1_000_0000000n,
    holderAmount: 950_0000000n,
  };
}

describe("deriveCycleStatus", () => {
  it("returns pending inside the grace period when nothing has been distributed", () => {
    const status = deriveCycleStatus(cycle(), { now: MARCH + DAY });
    expect(status).toBe("pending");
  });

  it("returns pending exactly on the grace period boundary", () => {
    const status = deriveCycleStatus(cycle(), {
      now: MARCH + DEFAULT_GRACE_PERIOD_SECONDS,
    });
    expect(status).toBe("pending");
  });

  it("returns not_received one second after the grace period elapses", () => {
    const status = deriveCycleStatus(cycle(), {
      now: MARCH + DEFAULT_GRACE_PERIOD_SECONDS + 1,
    });
    expect(status).toBe("not_received");
  });

  it("returns on_time for a distribution before the expected date", () => {
    const status = deriveCycleStatus(
      cycle({ distribution: distributedAt(MARCH - DAY) }),
      { now: MARCH + 30 * DAY },
    );
    expect(status).toBe("on_time");
  });

  it("returns on_time for a distribution exactly on the grace deadline", () => {
    const status = deriveCycleStatus(
      cycle({
        distribution: distributedAt(MARCH + DEFAULT_GRACE_PERIOD_SECONDS),
      }),
      { now: MARCH + 30 * DAY },
    );
    expect(status).toBe("on_time");
  });

  it("returns late for a distribution one second past the grace deadline", () => {
    const status = deriveCycleStatus(
      cycle({
        distribution: distributedAt(MARCH + DEFAULT_GRACE_PERIOD_SECONDS + 1),
      }),
      { now: MARCH + 30 * DAY },
    );
    expect(status).toBe("late");
  });

  it("returns disputed even when the cycle was eventually distributed", () => {
    const status = deriveCycleStatus(
      cycle({
        evidence: {
          status: "disputed",
          submittedAt: MARCH,
          reviewedAt: MARCH + DAY,
          reviewReason: "Reported income does not match the bank statement",
        },
        distribution: distributedAt(MARCH + DAY),
      }),
      { now: MARCH + 30 * DAY },
    );
    expect(status).toBe("disputed");
  });

  it("honours a custom grace period", () => {
    const status = deriveCycleStatus(
      cycle({ distribution: distributedAt(MARCH + 2 * DAY) }),
      { now: MARCH + 30 * DAY, gracePeriodSeconds: DAY },
    );
    expect(status).toBe("late");
  });

  it("does not treat submitted or approved evidence as a payment", () => {
    const status = deriveCycleStatus(
      cycle({ evidence: { status: "approved", submittedAt: MARCH } }),
      { now: MARCH + 30 * DAY },
    );
    expect(status).toBe("not_received");
  });
});

describe("countConsecutiveMissedCycles", () => {
  const now = MARCH + 30 * DAY;

  it("counts zero when every elapsed cycle was distributed", () => {
    const cycles = [
      cycle({
        cycleId: "2026-01",
        expectedAt: JANUARY,
        distribution: distributedAt(JANUARY),
      }),
      cycle({
        cycleId: "2026-02",
        expectedAt: FEBRUARY,
        distribution: distributedAt(FEBRUARY),
      }),
      cycle({
        cycleId: "2026-03",
        expectedAt: MARCH,
        distribution: distributedAt(MARCH),
      }),
    ];
    expect(countConsecutiveMissedCycles(cycles, { now })).toBe(0);
  });

  it("counts the trailing streak only, ignoring older recovered cycles", () => {
    const cycles = [
      cycle({ cycleId: "2026-01", expectedAt: JANUARY }),
      cycle({
        cycleId: "2026-02",
        expectedAt: FEBRUARY,
        distribution: distributedAt(FEBRUARY),
      }),
      cycle({ cycleId: "2026-03", expectedAt: MARCH }),
    ];
    expect(countConsecutiveMissedCycles(cycles, { now })).toBe(1);
  });

  it("counts a disputed cycle as missed", () => {
    const cycles = [
      cycle({
        cycleId: "2026-02",
        expectedAt: FEBRUARY,
        evidence: { status: "disputed", submittedAt: FEBRUARY },
      }),
      cycle({ cycleId: "2026-03", expectedAt: MARCH }),
    ];
    expect(countConsecutiveMissedCycles(cycles, { now })).toBe(2);
  });

  it("ignores cycles still inside their grace period", () => {
    const cycles = [
      cycle({ cycleId: "2026-02", expectedAt: FEBRUARY }),
      cycle({ cycleId: "2026-03", expectedAt: MARCH }),
    ];
    // Only February has elapsed at this point, March is still pending.
    expect(countConsecutiveMissedCycles(cycles, { now: MARCH + DAY })).toBe(1);
  });

  it("orders by expected date rather than array order", () => {
    const cycles = [
      cycle({ cycleId: "2026-03", expectedAt: MARCH }),
      cycle({
        cycleId: "2026-02",
        expectedAt: FEBRUARY,
        distribution: distributedAt(FEBRUARY),
      }),
    ];
    expect(countConsecutiveMissedCycles(cycles, { now })).toBe(1);
  });
});

describe("hasEscalation", () => {
  const now = MARCH + 30 * DAY;

  it("is false at one missed cycle", () => {
    const cycles = [
      cycle({
        cycleId: "2026-02",
        expectedAt: FEBRUARY,
        distribution: distributedAt(FEBRUARY),
      }),
      cycle({ cycleId: "2026-03", expectedAt: MARCH }),
    ];
    expect(hasEscalation(cycles, { now })).toBe(false);
  });

  it("is true exactly at the two-cycle boundary", () => {
    const cycles = [
      cycle({ cycleId: "2026-02", expectedAt: FEBRUARY }),
      cycle({ cycleId: "2026-03", expectedAt: MARCH }),
    ];
    expect(ESCALATION_MISSED_CYCLES).toBe(2);
    expect(hasEscalation(cycles, { now })).toBe(true);
  });

  it("clears once the ally reports again", () => {
    const cycles = [
      cycle({ cycleId: "2026-01", expectedAt: JANUARY }),
      cycle({ cycleId: "2026-02", expectedAt: FEBRUARY }),
      cycle({
        cycleId: "2026-03",
        expectedAt: MARCH,
        distribution: distributedAt(MARCH),
      }),
    ];
    expect(hasEscalation(cycles, { now })).toBe(false);
  });

  it("is false for an empty history", () => {
    expect(hasEscalation([], { now })).toBe(false);
  });
});

describe("buildCycleTimeline", () => {
  const now = MARCH + 30 * DAY;

  it("orders entries oldest first and sums distributions to holders", () => {
    const timeline = buildCycleTimeline(
      [
        cycle({
          cycleId: "2026-03",
          expectedAt: MARCH,
          distribution: distributedAt(MARCH),
        }),
        cycle({
          cycleId: "2026-01",
          expectedAt: JANUARY,
          distribution: distributedAt(JANUARY),
        }),
        cycle({ cycleId: "2026-02", expectedAt: FEBRUARY }),
      ],
      { now },
    );

    expect(timeline.entries.map((entry) => entry.cycle.cycleId)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
    expect(timeline.entries.map((entry) => entry.status)).toEqual([
      "on_time",
      "not_received",
      "on_time",
    ]);
    expect(timeline.totalDistributed).toBe(1_900_0000000n);
    expect(timeline.escalated).toBe(false);
    expect(timeline.consecutiveMissed).toBe(0);
  });

  it("returns an empty timeline for a holder with no cycles yet", () => {
    const timeline = buildCycleTimeline([], { now });
    expect(timeline.entries).toEqual([]);
    expect(timeline.totalDistributed).toBe(0n);
    expect(timeline.escalated).toBe(false);
  });

  it("reports escalation alongside the entries", () => {
    const timeline = buildCycleTimeline(
      [
        cycle({ cycleId: "2026-02", expectedAt: FEBRUARY }),
        cycle({ cycleId: "2026-03", expectedAt: MARCH }),
      ],
      { now },
    );
    expect(timeline.escalated).toBe(true);
    expect(timeline.consecutiveMissed).toBe(2);
  });
});
