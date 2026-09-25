/* eslint-disable @next/next/no-img-element, @typescript-eslint/no-unused-vars */
import "@/test/setup-dom";
import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import {
  createElement,
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import axe from "axe-core";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "../../../../messages/en.json";
import type { AbstractIntlMessages } from "next-intl";

const messages = enMessages as unknown as AbstractIntlMessages;

function withIntl(children: ReactNode) {
  return createElement(
    NextIntlClientProvider,
    { locale: "en", messages, timeZone: "UTC", children },
  );
}

// Framer-motion passthrough to avoid animation issues in jsdom.
const passthroughDiv = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & Record<string, unknown>
>(function PassthroughDiv(
  {
    children,
    whileHover: _wh,
    whileTap: _wt,
    initial: _i,
    animate: _a,
    exit: _e,
    transition: _tr,
    variants: _v,
    ...props
  },
  ref,
) {
  return createElement("div", { ref, ...props }, children as ReactNode);
});

const passthroughButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>
>(function PassthroughButton(
  {
    children,
    whileHover: _wh,
    whileTap: _wt,
    initial: _i,
    animate: _a,
    exit: _e,
    transition: _tr,
    variants: _v,
    ...props
  },
  ref,
) {
  return createElement("button", { ref, ...props }, children as ReactNode);
});

// Mock framer-motion for jsdom compatibility.
mock.module("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) =>
    createElement("div", {}, children),
  motion: new Proxy(
    { div: passthroughDiv, button: passthroughButton },
    {
      get: (target, property) =>
        property in target
          ? target[property as keyof typeof target]
          : passthroughDiv,
    },
  ),
}));

afterEach(() => {
  cleanup();
});

async function assertNoAxeViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
  });
  const violations = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(violations.map((v) => `${v.id}: ${v.description}`)).toHaveLength(0);
}

// ---------------------------------------------------------------------------
// CycleStatusBadge
// ---------------------------------------------------------------------------
describe("CycleStatusBadge accessibility", () => {
  it("has no critical axe violations for all status values", async () => {
    const { CycleStatusBadge } = await import("../CycleStatusBadge");
    const statuses = [
      "on_time",
      "late",
      "disputed",
      "not_received",
      "pending",
    ] as const;
    for (const status of statuses) {
      const { container } = render(
        withIntl(createElement(CycleStatusBadge, { status })),
      );
      await assertNoAxeViolations(container);
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// CycleStatusTimeline
// ---------------------------------------------------------------------------
describe("CycleStatusTimeline accessibility", () => {
  it("has no critical axe violations in loaded state", async () => {
    const { CycleStatusTimeline } = await import("../CycleStatusTimeline");
    const { timelineFor, populatedCycles, SAMPLE_NOW } =
      await import("../fixtures");
    const { container } = render(
      withIntl(
        createElement(CycleStatusTimeline, {
          timeline: timelineFor(populatedCycles),
          isLoading: false,
          error: null,
          lastUpdatedAt: new Date(SAMPLE_NOW * 1000),
          connectionStatus: "connected" as const,
          onRefresh: () => {},
        }),
      ),
    );
    await assertNoAxeViolations(container);
  });

  it("has no critical axe violations in loading state", async () => {
    const { CycleStatusTimeline } = await import("../CycleStatusTimeline");
    const { timelineFor, SAMPLE_NOW } = await import("../fixtures");
    const { container } = render(
      withIntl(
        createElement(CycleStatusTimeline, {
          timeline: timelineFor([]),
          isLoading: true,
          error: null,
          lastUpdatedAt: new Date(SAMPLE_NOW * 1000),
          connectionStatus: "connecting" as const,
          onRefresh: () => {},
        }),
      ),
    );
    await assertNoAxeViolations(container);
  });

  it("has no critical axe violations in error state", async () => {
    const { CycleStatusTimeline } = await import("../CycleStatusTimeline");
    const { timelineFor } = await import("../fixtures");
    const { container } = render(
      withIntl(
        createElement(CycleStatusTimeline, {
          timeline: timelineFor([]),
          isLoading: false,
          error: "Could not reach Soroban RPC.",
          lastUpdatedAt: null,
          connectionStatus: "disconnected" as const,
          onRefresh: () => {},
        }),
      ),
    );
    await assertNoAxeViolations(container);
  });
});

// ---------------------------------------------------------------------------
// EvidenceReviewQueue
// ---------------------------------------------------------------------------
describe("EvidenceReviewQueue accessibility", () => {
  it("has no critical axe violations in disconnected state", async () => {
    const { EvidenceReviewQueueView } = await import("../EvidenceReviewQueue");
    const { SAMPLE_NOW } = await import("../fixtures");
    const wallet = {
      address: null,
      isConnected: false,
      connect: () => {},
      signTransaction: async (xdr: string) => xdr,
    };
    const { container } = render(
      withIntl(
        createElement(EvidenceReviewQueueView, {
          cycles: [],
          isLoading: false,
          error: null,
          lastUpdatedAt: new Date(SAMPLE_NOW * 1000),
          connectionStatus: "connected" as const,
          onRefresh: () => {},
          wallet,
        }),
      ),
    );
    await assertNoAxeViolations(container);
  });

  it("has no critical axe violations with pending cycles", async () => {
    const { EvidenceReviewQueueView } = await import("../EvidenceReviewQueue");
    const { populatedCycles, SAMPLE_NOW } = await import("../fixtures");
    const wallet = {
      address: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA",
      isConnected: true,
      connect: () => {},
      signTransaction: async (xdr: string) => xdr,
    };
    const { container } = render(
      withIntl(
        createElement(EvidenceReviewQueueView, {
          cycles: populatedCycles,
          isLoading: false,
          error: null,
          lastUpdatedAt: new Date(SAMPLE_NOW * 1000),
          connectionStatus: "connected" as const,
          onRefresh: () => {},
          wallet,
        }),
      ),
    );
    await assertNoAxeViolations(container);
  });
});

// ---------------------------------------------------------------------------
// EvidenceSubmissionForm
// ---------------------------------------------------------------------------
describe("EvidenceSubmissionForm accessibility", () => {
  it("has no critical axe violations in connected state", async () => {
    const { EvidenceSubmissionFormView } =
      await import("../EvidenceSubmissionForm");
    const wallet = {
      address: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA",
      isConnected: true,
      connect: () => {},
      signTransaction: async (xdr: string) => xdr,
    };
    const { container } = render(
      withIntl(
        createElement(EvidenceSubmissionFormView, {
          cycleId: "2026-03",
          wallet,
        }),
      ),
    );
    await assertNoAxeViolations(container);
  });

  it("has no critical axe violations when disconnected", async () => {
    const { EvidenceSubmissionFormView } =
      await import("../EvidenceSubmissionForm");
    const wallet = {
      address: null,
      isConnected: false,
      connect: () => {},
      signTransaction: async (xdr: string) => xdr,
    };
    const { container } = render(
      withIntl(
        createElement(EvidenceSubmissionFormView, {
          cycleId: "2026-03",
          wallet,
        }),
      ),
    );
    await assertNoAxeViolations(container);
  });

  it("has no critical axe violations when paused", async () => {
    const { EvidenceSubmissionFormView } =
      await import("../EvidenceSubmissionForm");
    const wallet = {
      address: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGBDQCQZVQQ6BRVV12BKHA",
      isConnected: true,
      connect: () => {},
      signTransaction: async (xdr: string) => xdr,
    };
    const { container } = render(
      withIntl(
        createElement(EvidenceSubmissionFormView, {
          cycleId: "2026-03",
          wallet,
          isPaused: true,
        }),
      ),
    );
    await assertNoAxeViolations(container);
  });
});

// ---------------------------------------------------------------------------
// InvestorHoldingsCard
// ---------------------------------------------------------------------------
describe("InvestorHoldingsCard accessibility", () => {
  it("has no critical axe violations with holdings data", async () => {
    const { InvestorHoldingsCard } = await import("../InvestorHoldingsCard");
    const { sampleHoldings, SAMPLE_NOW } = await import("../fixtures");
    const { container } = render(
      withIntl(
        createElement(InvestorHoldingsCard, {
          holdings: sampleHoldings,
          totalDistributed: BigInt(21_150_0000000),
          isLoading: false,
          error: null,
          isDisconnected: false,
          lastUpdatedAt: new Date(SAMPLE_NOW * 1000),
          connectionStatus: "connected" as const,
          onRefresh: () => {},
        }),
      ),
    );
    await assertNoAxeViolations(container);
  });

  it("has no critical axe violations in disconnected state", async () => {
    const { InvestorHoldingsCard } = await import("../InvestorHoldingsCard");
    const { SAMPLE_NOW } = await import("../fixtures");
    const { container } = render(
      withIntl(
        createElement(InvestorHoldingsCard, {
          holdings: null,
          totalDistributed: BigInt(0),
          isLoading: false,
          error: null,
          isDisconnected: true,
          lastUpdatedAt: new Date(SAMPLE_NOW * 1000),
          connectionStatus: "disconnected" as const,
          onRefresh: () => {},
        }),
      ),
    );
    await assertNoAxeViolations(container);
  });

  it("has no critical axe violations with non-whitelisted holder", async () => {
    const { InvestorHoldingsCard } = await import("../InvestorHoldingsCard");
    const { sampleHoldings, SAMPLE_NOW } = await import("../fixtures");
    const { container } = render(
      withIntl(
        createElement(InvestorHoldingsCard, {
          holdings: { ...sampleHoldings, whitelisted: false },
          totalDistributed: BigInt(21_150_0000000),
          isLoading: false,
          error: null,
          isDisconnected: false,
          lastUpdatedAt: new Date(SAMPLE_NOW * 1000),
          connectionStatus: "connected" as const,
          onRefresh: () => {},
        }),
      ),
    );
    await assertNoAxeViolations(container);
  });
});

// ---------------------------------------------------------------------------
// PropertyEvidencePanel
// ---------------------------------------------------------------------------
describe("PropertyEvidencePanel accessibility", () => {
  it("has no critical axe violations in empty (no splat) state", async () => {
    const { PropertyEvidencePanel } = await import("../PropertyEvidencePanel");
    const { container } = render(
      withIntl(
        createElement(PropertyEvidencePanel, {
          splatUrl: null,
          propertyName: "Algarve Marina Residences",
        }),
      ),
    );
    await assertNoAxeViolations(container);
  });
});
