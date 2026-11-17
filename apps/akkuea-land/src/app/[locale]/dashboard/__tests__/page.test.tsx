// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";

if (typeof globalThis.window === "undefined") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });
  (dom.window as any).fetch = fetch;
  globalThis.window = dom.window as any;
  globalThis.document = dom.window.document as any;
  globalThis.navigator = dom.window.navigator as any;
  globalThis.HTMLElement = dom.window.HTMLElement as any;
  globalThis.MutationObserver = dom.window.MutationObserver as any;
}
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { readFileSync } from "fs";
import { join } from "path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
  vi,
} from "bun:test";
import React, { forwardRef } from "react";
import { act, cleanup, waitFor } from "@testing-library/react";
import { rpc as SorobanRpc } from "@stellar/stellar-sdk";
import { renderWithIntl } from "@/test/renderWithIntl";
import { GameEventProvider } from "@/context/GameEventContext";
import { TIMEOUTS } from "@/lib/constants";

mock.module("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
}));

mock.module("framer-motion", () => {
  const passthrough = new Proxy(
    {},
    {
      get: (_target, tagName: string) =>
        forwardRef<any, any>(function PassthroughMotion(
          { children, ...props }: any,
          ref,
        ) {
          return React.createElement(tagName, { ref, ...props }, children);
        }),
    },
  );
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: passthrough,
  };
});

import DashboardPage from "../page";

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string | URL) {
    this.url = String(url);
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emitOpen() {
    this.onopen?.();
  }

  emitMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent<string>);
  }

  emitError() {
    this.onerror?.();
  }
}

const originalEventSource = globalThis.EventSource;
let getLatestLedgerSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  MockEventSource.instances = [];
  (globalThis as any).EventSource = MockEventSource;
  getLatestLedgerSpy = spyOn(
    SorobanRpc.Server.prototype,
    "getLatestLedger",
  ).mockResolvedValue({
    id: "ledger-id",
    protocolVersion: 22,
    sequence: 40_000,
  } as any);
});

afterEach(() => {
  cleanup();
  getLatestLedgerSpy.mockRestore();
  if (originalEventSource) {
    globalThis.EventSource = originalEventSource;
  } else {
    delete (globalThis as any).EventSource;
  }
});

describe("DashboardPage event stream and ledger lifecycle", () => {
  it("opens exactly one EventSource on the dashboard even inside an outer GameEventProvider", async () => {
    const view = renderWithIntl(
      <GameEventProvider>
        <DashboardPage />
      </GameEventProvider>,
    );

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe("/api/game/events");
    expect(MockEventSource.instances[0].closed).toBe(false);

    await waitFor(() => {
      expect(view.container.textContent).toContain((40_000).toLocaleString());
    });
  });

  it("recalculates accrued income on each ledger tick from the shared event stream", async () => {
    const view = renderWithIntl(<DashboardPage />);
    expect(MockEventSource.instances).toHaveLength(1);
    const stream = MockEventSource.instances[0];

    await waitFor(() => {
      expect(view.container.textContent).toContain((40_000).toLocaleString());
    });
    const accruedSection = view.getByLabelText("Portfolio Overview");
    const beforeTickText = accruedSection.textContent ?? "";

    act(() => {
      stream.emitOpen();
      stream.emitMessage({
        id: "60000-tx-0",
        type: "PropertyBought",
        ledger: 60_000,
        timestamp: "2026-06-01T00:00:00Z",
        contractId: "CCONTRACT",
        tileId: "1",
        buyer: "GBUYER",
        price: "1500000000",
      });
    });

    await waitFor(() => {
      expect(view.container.textContent).toContain((60_000).toLocaleString());
    });
    expect(accruedSection.textContent).not.toBe(beforeTickText);
  });

  it("falls back to polling when the stream fails and keeps updating the ledger", async () => {
    let nextSequence = 45_000;
    getLatestLedgerSpy.mockImplementation(async () => ({
      id: "ledger-id",
      protocolVersion: 22,
      sequence: nextSequence,
    }));

    const realSetInterval = globalThis.setInterval;
    const realClearInterval = globalThis.clearInterval;
    const intervalCallbacks: Array<() => void> = [];
    const setIntervalSpy = spyOn(globalThis, "setInterval").mockImplementation(
      ((fn: TimerHandler, ms?: number, ...args: unknown[]) => {
        if (ms === TIMEOUTS.LEDGER_POLL_MS && typeof fn === "function") {
          intervalCallbacks.push(fn as () => void);
          return 701 as unknown as ReturnType<typeof setInterval>;
        }
        return realSetInterval(fn, ms, ...args);
      }) as unknown as typeof setInterval,
    );
    const clearIntervalSpy = spyOn(
      globalThis,
      "clearInterval",
    ).mockImplementation(((id?: ReturnType<typeof setInterval>) => {
      if ((id as unknown) === 701) return;
      realClearInterval(id);
    }) as unknown as typeof clearInterval);

    try {
      const view = renderWithIntl(<DashboardPage />);
      const stream = MockEventSource.instances[0];

      await waitFor(() => {
        expect(view.container.textContent).toContain((45_000).toLocaleString());
      });

      nextSequence = 48_500;
      act(() => {
        stream.emitError();
      });

      await waitFor(() => {
        expect(view.container.textContent).toContain((48_500).toLocaleString());
      });
      expect(intervalCallbacks.length).toBeGreaterThan(0);

      nextSequence = 52_000;
      await act(async () => {
        intervalCallbacks[intervalCallbacks.length - 1]();
      });

      await waitFor(() => {
        expect(view.container.textContent).toContain((52_000).toLocaleString());
      });
    } finally {
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    }
  });

  it("closes the EventSource connection and clears all timers on unmount", async () => {
    const activeTimeouts = new Set<number>();
    const activeIntervals = new Set<number>();
    let nextTimerId = 100;

    const setTimeoutSpy = spyOn(globalThis, "setTimeout").mockImplementation(((
      _fn: TimerHandler,
    ) => {
      const id = ++nextTimerId;
      activeTimeouts.add(id);
      return id as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout);

    const clearTimeoutSpy = spyOn(
      globalThis,
      "clearTimeout",
    ).mockImplementation(((id?: ReturnType<typeof setTimeout>) => {
      if (typeof id === "number") {
        activeTimeouts.delete(id);
      }
    }) as unknown as typeof clearTimeout);

    const setIntervalSpy = spyOn(globalThis, "setInterval").mockImplementation(
      ((_fn: TimerHandler) => {
        const id = ++nextTimerId;
        activeIntervals.add(id);
        return id as unknown as ReturnType<typeof setInterval>;
      }) as unknown as typeof setInterval,
    );

    const clearIntervalSpy = spyOn(
      globalThis,
      "clearInterval",
    ).mockImplementation(((id?: ReturnType<typeof setInterval>) => {
      if (typeof id === "number") {
        activeIntervals.delete(id);
      }
    }) as unknown as typeof clearInterval);

    try {
      const view = renderWithIntl(<DashboardPage />);
      expect(MockEventSource.instances).toHaveLength(1);
      const stream = MockEventSource.instances[0];

      // Trigger a stream failure so both the reconnect timeout and the
      // fallback polling interval are scheduled before unmounting.
      act(() => {
        stream.emitError();
      });

      expect(activeTimeouts.size).toBeGreaterThan(0);
      expect(activeIntervals.size).toBeGreaterThan(0);

      view.unmount();

      expect(stream.closed).toBe(true);
      expect(activeTimeouts.size).toBe(0);
      expect(activeIntervals.size).toBe(0);
    } finally {
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    }
  });

  it("contains no react-hooks/exhaustive-deps suppression in dashboard/page.tsx", () => {
    const source = readFileSync(
      join(import.meta.dir, "..", "page.tsx"),
      "utf8",
    );
    expect(source).not.toContain("react-hooks/exhaustive-deps");
  });
});
