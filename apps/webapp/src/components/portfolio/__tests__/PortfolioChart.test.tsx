/* eslint-disable @typescript-eslint/no-unused-vars, react/display-name */
/**
 * Render tests for PortfolioChart.
 *
 * Strategy:
 *   - Mock `usePortfolioPerformance` so the component renders predictably
 *     without any real fetch calls.
 *   - Mock `recharts` so its SVG internals are replaced with plain divs,
 *     avoiding JSDOM limitations with SVG sizing (recharts calls
 *     ResizeObserver / getBoundingClientRect internally).
 *   - Mock `framer-motion` (same pattern used by InvestModal.test.tsx) to
 *     prevent framer-motion from requiring WAAPI / Element.animate.
 *   - Assert each distinct render state: loading, error, empty, and data.
 */

import "@/test/setup-dom";

// ---------------------------------------------------------------------------
// Polyfill missing DOM globals that framer-motion and @testing-library need.
// setup-dom.ts initialises JSDOM but doesn't expose all globals.
// ---------------------------------------------------------------------------
{
  const win = globalThis.window as Window & typeof globalThis;

  const globals: Array<keyof (Window & typeof globalThis)> = [
    "SVGElement",
    "Element",
    "Event",
    "CustomEvent",
    "getComputedStyle",
    "ResizeObserver",
  ] as Array<keyof (Window & typeof globalThis)>;

  for (const key of globals) {
    if (!(key in globalThis) && key in win) {
      Object.defineProperty(globalThis, key, {
        value: win[key],
        writable: true,
        configurable: true,
      });
    }
  }

  // ResizeObserver is not in JSDOM - stub it so recharts doesn't throw
  if (!("ResizeObserver" in globalThis)) {
    class FakeResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(globalThis, "ResizeObserver", {
      value: FakeResizeObserver,
      writable: true,
      configurable: true,
    });
  }
}

import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { UsePortfolioPerformanceReturn } from "@/hooks/usePortfolioPerformance";
import { mockPortfolioPerformance } from "@/mocks/fixtures/portfolioPerformance";

// ---------------------------------------------------------------------------
// Mock framer-motion (identical to InvestModal.test.tsx)
// ---------------------------------------------------------------------------

mock.module("framer-motion", () => {
  const passthroughDiv = ({
    children,
    whileHover: _wh,
    whileTap: _wt,
    initial: _i,
    animate: _a,
    exit: _e,
    transition: _t,
    variants: _v,
    ...props
  }: HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => (
    <div {...props}>{children}</div>
  );
  const passthroughButton = ({
    children,
    whileHover: _wh,
    whileTap: _wt,
    initial: _i,
    animate: _a,
    exit: _e,
    transition: _t,
    variants: _v,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>) => (
    <button {...props}>{children}</button>
  );

  return {
    AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
    motion: new Proxy(
      { div: passthroughDiv, button: passthroughButton },
      {
        get: (target, prop) =>
          prop in target ? target[prop as keyof typeof target] : passthroughDiv,
      },
    ),
  };
});

// ---------------------------------------------------------------------------
// Mock recharts - replace with plain divs to avoid SVG / ResizeObserver issues
// ---------------------------------------------------------------------------

mock.module("recharts", () => {
  const passDiv =
    (label: string) =>
    ({ children }: { children?: ReactNode }) => (
      <div data-testid={label}>{children ?? null}</div>
    );

  return {
    ResponsiveContainer: passDiv("recharts-responsive-container"),
    AreaChart: passDiv("recharts-area-chart"),
    Area: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

// ---------------------------------------------------------------------------
// Mock next-intl - useTranslations falls back to the key
// ---------------------------------------------------------------------------

mock.module("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// ---------------------------------------------------------------------------
// Mock the data hook - each test controls what the component receives
// ---------------------------------------------------------------------------

let hookImpl: UsePortfolioPerformanceReturn = {
  data: [],
  isLoading: true,
  error: null,
  refetch: mock(() => {}),
};

mock.module("@/hooks/usePortfolioPerformance", () => ({
  usePortfolioPerformance: () => hookImpl,
}));

// ---------------------------------------------------------------------------
// Dynamic import AFTER all mocks are registered
// ---------------------------------------------------------------------------

const { PortfolioChart } =
  await import("@/components/portfolio/PortfolioChart");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WALLET = "GDEMOUSER1234567890AKKUEA00000000000000000000000000000000";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PortfolioChart", () => {
  beforeEach(() => {
    cleanup();
  });

  afterAll(() => {
    cleanup();
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  it("renders a loading skeleton while data is being fetched", () => {
    hookImpl = {
      data: [],
      isLoading: true,
      error: null,
      refetch: mock(() => {}),
    };

    const view = render(<PortfolioChart walletAddress={WALLET} />);

    const skeleton = view.queryByRole("status", { name: /loading chart/i });
    expect(skeleton).not.toBeNull();
    // Chart should not be present during loading
    expect(view.queryByTestId("recharts-area-chart")).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  it("renders an error message with a retry button on failure", () => {
    const retryFn = mock(() => {});
    hookImpl = {
      data: [],
      isLoading: false,
      error: "Network error: unable to reach server",
      refetch: retryFn,
    };

    const view = render(<PortfolioChart walletAddress={WALLET} />);

    const alert = view.queryByRole("alert");
    expect(alert).not.toBeNull();
    expect(
      view.queryByText(/Network error: unable to reach server/i),
    ).not.toBeNull();

    const retryBtn = view.queryByRole("button", {
      name: /retry loading chart data/i,
    });
    expect(retryBtn).not.toBeNull();

    fireEvent.click(retryBtn!);
    expect(retryFn).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------

  it("renders the empty state when there are no data points", () => {
    hookImpl = {
      data: [],
      isLoading: false,
      error: null,
      refetch: mock(() => {}),
    };

    const view = render(<PortfolioChart walletAddress={WALLET} />);

    expect(view.queryByText(/No performance data yet/i)).not.toBeNull();
    expect(view.queryByTestId("recharts-area-chart")).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Data state
  // -----------------------------------------------------------------------

  it("renders the recharts container when data is available", () => {
    hookImpl = {
      data: mockPortfolioPerformance.points,
      isLoading: false,
      error: null,
      refetch: mock(() => {}),
    };

    const view = render(<PortfolioChart walletAddress={WALLET} />);

    expect(view.queryByTestId("recharts-responsive-container")).not.toBeNull();
    expect(view.queryByTestId("recharts-area-chart")).not.toBeNull();

    // No error or skeleton
    expect(view.queryByRole("alert")).toBeNull();
    expect(view.queryByRole("status", { name: /loading chart/i })).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Legend labels visible when data is present
  // -----------------------------------------------------------------------

  it("shows Holdings Value and Collateral Ratio legend labels", () => {
    hookImpl = {
      data: mockPortfolioPerformance.points,
      isLoading: false,
      error: null,
      refetch: mock(() => {}),
    };

    const view = render(<PortfolioChart walletAddress={WALLET} />);

    expect(view.queryByText(/Holdings Value/i)).not.toBeNull();
    expect(view.queryByText(/Collateral Ratio/i)).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // Time-range switcher renders
  // -----------------------------------------------------------------------

  it("renders the 1M / 3M / ALL time-range buttons", () => {
    hookImpl = {
      data: mockPortfolioPerformance.points,
      isLoading: false,
      error: null,
      refetch: mock(() => {}),
    };

    const view = render(<PortfolioChart walletAddress={WALLET} />);

    expect(view.queryByRole("button", { name: "1M" })).not.toBeNull();
    expect(view.queryByRole("button", { name: "3M" })).not.toBeNull();
    expect(view.queryByRole("button", { name: "ALL" })).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // Active range reflected via aria-pressed
  // -----------------------------------------------------------------------

  it("highlights the active range button with aria-pressed=true", () => {
    hookImpl = {
      data: mockPortfolioPerformance.points,
      isLoading: false,
      error: null,
      refetch: mock(() => {}),
    };

    const view = render(<PortfolioChart walletAddress={WALLET} />);

    // Default range is "3M"
    const btn3M = view.getByRole("button", { name: "3M" });
    expect(btn3M.getAttribute("aria-pressed")).toBe("true");

    const btn1M = view.getByRole("button", { name: "1M" });
    expect(btn1M.getAttribute("aria-pressed")).toBe("false");

    // Switch to 1M
    fireEvent.click(btn1M);
    expect(btn1M.getAttribute("aria-pressed")).toBe("true");
    expect(btn3M.getAttribute("aria-pressed")).toBe("false");
  });

  // -----------------------------------------------------------------------
  // Card title always visible
  // -----------------------------------------------------------------------

  it("renders the 'Portfolio Performance' card title", () => {
    hookImpl = {
      data: [],
      isLoading: false,
      error: null,
      refetch: mock(() => {}),
    };

    const view = render(<PortfolioChart walletAddress={WALLET} />);
    expect(view.queryByText(/Portfolio Performance/i)).not.toBeNull();
  });

  // -----------------------------------------------------------------------
  // Null wallet address - empty state
  // -----------------------------------------------------------------------

  it("renders the empty state when walletAddress is null", () => {
    hookImpl = {
      data: [],
      isLoading: false,
      error: null,
      refetch: mock(() => {}),
    };

    const view = render(<PortfolioChart walletAddress={null} />);
    expect(view.queryByText(/No performance data yet/i)).not.toBeNull();
  });
});
