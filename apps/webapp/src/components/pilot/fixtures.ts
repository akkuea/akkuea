import { buildCycleTimeline } from "@real-estate-defi/shared";
import type {
  PilotEvidenceDetail,
  PilotHoldings,
} from "@/services/pilot/reads";

/**
 * Shared sample data for pilot stories and tests.
 *
 * These are illustrative shapes for Storybook and unit tests only. Nothing here
 * is rendered in the application: the running dashboard reads exclusively from
 * Soroban RPC.
 */

const DAY = 24 * 60 * 60;
/** 2026-04-05T00:00:00Z, the expected date for the March 2026 cycle. */
export const MARCH_EXPECTED = 1775347200;
export const FEBRUARY_EXPECTED = MARCH_EXPECTED - 31 * DAY;
export const JANUARY_EXPECTED = FEBRUARY_EXPECTED - 28 * DAY;

/** A fixed "now" so stories and snapshots do not drift with the wall clock. */
export const SAMPLE_NOW = MARCH_EXPECTED + 20 * DAY;

const HASH = "3b1f".repeat(16);

export const paidOnTimeCycle: PilotEvidenceDetail = {
  cycleId: "2026-01",
  expectedAt: JANUARY_EXPECTED,
  evidence: {
    status: "approved",
    submittedAt: JANUARY_EXPECTED - 2 * DAY,
    reviewedAt: JANUARY_EXPECTED - DAY,
  },
  distribution: {
    distributedAt: JANUARY_EXPECTED,
    totalIncome: BigInt(12_000_0000000),
    holderAmount: BigInt(10_800_0000000),
  },
  evidenceHashHex: HASH,
  evidenceLink: "https://example.org/statements/2026-01.pdf",
  totalIncome: BigInt(12_000_0000000),
};

export const paidLateCycle: PilotEvidenceDetail = {
  cycleId: "2026-02",
  expectedAt: FEBRUARY_EXPECTED,
  evidence: {
    status: "approved",
    submittedAt: FEBRUARY_EXPECTED + DAY,
    reviewedAt: FEBRUARY_EXPECTED + 2 * DAY,
  },
  distribution: {
    distributedAt: FEBRUARY_EXPECTED + 12 * DAY,
    totalIncome: BigInt(11_500_0000000),
    holderAmount: BigInt(10_350_0000000),
  },
  evidenceHashHex: HASH,
  evidenceLink: "https://example.org/statements/2026-02.pdf",
  totalIncome: BigInt(11_500_0000000),
};

export const awaitingReviewCycle: PilotEvidenceDetail = {
  cycleId: "2026-03",
  expectedAt: MARCH_EXPECTED,
  evidence: {
    status: "submitted",
    submittedAt: MARCH_EXPECTED - DAY,
  },
  evidenceHashHex: HASH,
  evidenceLink: "https://example.org/statements/2026-03.pdf",
  totalIncome: BigInt(12_400_0000000),
};

export const rejectedCycle: PilotEvidenceDetail = {
  ...awaitingReviewCycle,
  evidence: {
    status: "rejected",
    submittedAt: MARCH_EXPECTED - DAY,
    reviewedAt: MARCH_EXPECTED,
    reviewReason: "The statement covers three weeks, not the full month.",
  },
};

export const disputedCycle: PilotEvidenceDetail = {
  ...awaitingReviewCycle,
  evidence: {
    status: "disputed",
    submittedAt: MARCH_EXPECTED - DAY,
    reviewedAt: MARCH_EXPECTED,
    reviewReason: "An investor reported a mismatch against the bank record.",
  },
};

/** A cycle the ally never reported, past its grace period. */
export const missingCycle: PilotEvidenceDetail = {
  cycleId: "2026-03",
  expectedAt: MARCH_EXPECTED,
};

export const populatedCycles: PilotEvidenceDetail[] = [
  paidOnTimeCycle,
  paidLateCycle,
  awaitingReviewCycle,
];

export const escalatedCycles: PilotEvidenceDetail[] = [
  paidOnTimeCycle,
  { cycleId: "2026-02", expectedAt: FEBRUARY_EXPECTED },
  missingCycle,
];

export function timelineFor(cycles: PilotEvidenceDetail[]) {
  return buildCycleTimeline(cycles, { now: SAMPLE_NOW });
}

export const sampleHoldings: PilotHoldings = {
  balance: BigInt(250_0000000),
  totalSupply: BigInt(1_000_0000000),
  decimals: 7,
  symbol: "AKIN",
  whitelisted: true,
};
