// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
  vi,
} from "bun:test";
import React from "react";
import { act, cleanup } from "@testing-library/react";
import { rpc as SorobanRpc } from "@stellar/stellar-sdk";
import type { GameEvent } from "@akkuea/shared";
import { GameEventProvider } from "@/context/GameEventContext";
import { renderWithIntl } from "@/test/renderWithIntl";

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

import DashboardPage from "../[locale]/dashboard/page";

const hadInitialWindow = typeof globalThis.window !== "undefined";

function ensureDomInitialized(): void {
  if (typeof globalThis.window !== "undefined" && globalThis.document) {
    return;
  }
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });
  (dom.window as unknown as { fetch: typeof fetch }).fetch = fetch;
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;
  globalThis.navigator = dom.window.navigator;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.MutationObserver = dom.window.MutationObserver;
  (
    globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
}

type LatestLedgerResponse = Awaited<
  ReturnType<SorobanRpc.Server["getLatestLedger"]>
>;

function makeLedgerResponse(sequence: number): LatestLedgerResponse {
  return {
    id: `ledger-${sequence}`,
    protocolVersion: 22,
    sequence,
    closeTime: "1700000000",
    headerXdr: "",
    metadataXdr: "",
  } as unknown as LatestLedgerResponse;
}

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string | URL) {
    this.url = String(url);
    MockEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  emitOpen(): void {
    this.onopen?.();
  }

  emitMessage(data: string): void {
    this.onmessage?.({ data } as MessageEvent<string>);
  }

  emitError(): void {
    this.onerror?.();
  }
}

interface ScheduledTimer {
  id: number;
  delay: number;
  callback: () => void;
}

describe("DashboardPage shared event stream", () => {
  const originalEventSource = globalThis.EventSource;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;

  let nextTimerId = 1;
  let activeTimeouts: Map<number, ScheduledTimer>;
  let activeIntervals: Map<number, ScheduledTimer>;
  let ledgerSpy: ReturnType<typeof spyOn> | null = null;

  const getReconnectTimers = (): ScheduledTimer[] =>
    Array.from(activeTimeouts.values()).filter((timer) => timer.delay >= 1_000);

  beforeEach(() => {
    ensureDomInitialized();
    (
      globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;

    MockEventSource.instances = [];
    nextTimerId = 1;
    activeTimeouts = new Map();
    activeIntervals = new Map();

    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
    (
      globalThis.window as unknown as { EventSource: typeof EventSource }
    ).EventSource = MockEventSource as unknown as typeof EventSource;

    globalThis.setTimeout = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      const delay = Number(timeout ?? 0);
      if (delay < 1_000) {
        return originalSetTimeout(handler, timeout, ...args);
      }
      const id = nextTimerId++;
      activeTimeouts.set(id, {
        id,
        delay,
        callback: () => {
          activeTimeouts.delete(id);
          if (typeof handler === "function") {
            (handler as (...fnArgs: unknown[]) => void)(...args);
          }
        },
      });
      return id as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout;

    globalThis.clearTimeout = ((id?: ReturnType<typeof setTimeout>) => {
      if (typeof id === "number" && activeTimeouts.has(id)) {
        activeTimeouts.delete(id);
        return;
      }
      originalClearTimeout(id);
    }) as unknown as typeof clearTimeout;

    globalThis.setInterval = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      const id = nextTimerId++;
      activeIntervals.set(id, {
        id,
        delay: Number(timeout ?? 0),
        callback: () => {
          if (typeof handler === "function") {
            (handler as (...fnArgs: unknown[]) => void)(...args);
          }
        },
      });
      return id as unknown as ReturnType<typeof setInterval>;
    }) as unknown as typeof setInterval;

    globalThis.clearInterval = ((id?: ReturnType<typeof setInterval>) => {
      if (typeof id === "number" && activeIntervals.has(id)) {
        activeIntervals.delete(id);
        return;
      }
      originalClearInterval(id);
    }) as unknown as typeof clearInterval;
  });

  afterEach(() => {
    cleanup();
    ledgerSpy?.mockRestore();
    ledgerSpy = null;
    globalThis.EventSource = originalEventSource;
    if (globalThis.window) {
      (
        globalThis.window as unknown as {
          EventSource: typeof EventSource | undefined;
        }
      ).EventSource = originalEventSource;
    }
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  });

  afterAll(() => {
    if (!hadInitialWindow) {
      Reflect.deleteProperty(globalThis, "window");
      Reflect.deleteProperty(globalThis, "document");
      Reflect.deleteProperty(globalThis, "navigator");
      Reflect.deleteProperty(globalThis, "HTMLElement");
      Reflect.deleteProperty(globalThis, "MutationObserver");
    }
  });

  it("opens exactly one EventSource on the dashboard and updates ledger accrual from stream events", async () => {
    ledgerSpy = spyOn(
      SorobanRpc.Server.prototype,
      "getLatestLedger",
    ).mockResolvedValue(makeLedgerResponse(36_000));

    let view!: ReturnType<typeof renderWithIntl>;
    await act(async () => {
      view = renderWithIntl(
        <GameEventProvider>
          <DashboardPage />
        </GameEventProvider>,
      );
    });

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe("/api/game/events");
    expect(activeIntervals.size).toBe(0);
    expect(view.container.textContent).toContain("36,000");

    const event: GameEvent = {
      type: "PropertyBought",
      id: "60000-tx-0",
      contractId: "CCPUVGQAMDUUASHMXB7Z6F6XHCZI2WXOPR7DXEVPJBEGYZVJEABEABLE",
      ledger: 60_000,
      timestamp: "2026-06-01T00:00:00Z",
      tileId: "prop-0-1",
      buyer: "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M",
      price: "1500000000",
    };

    await act(async () => {
      MockEventSource.instances[0].emitOpen();
      MockEventSource.instances[0].emitMessage(JSON.stringify(event));
    });

    expect(MockEventSource.instances).toHaveLength(1);
    expect(view.container.textContent).toContain("60,000");
  });

  it("falls back to Soroban RPC polling when the stream fails and updates the ledger", async () => {
    let sequence = 40_000;
    ledgerSpy = spyOn(
      SorobanRpc.Server.prototype,
      "getLatestLedger",
    ).mockImplementation(async () => makeLedgerResponse(sequence));

    let view!: ReturnType<typeof renderWithIntl>;
    await act(async () => {
      view = renderWithIntl(<DashboardPage />);
    });

    expect(MockEventSource.instances).toHaveLength(1);
    expect(view.container.textContent).toContain("40,000");

    sequence = 45_000;
    await act(async () => {
      MockEventSource.instances[0].emitError();
    });

    expect(activeIntervals.size).toBe(1);
    expect(view.container.textContent).toContain("45,000");

    sequence = 50_500;
    const pollTimer = Array.from(activeIntervals.values())[0];
    await act(async () => {
      pollTimer.callback();
    });

    expect(view.container.textContent).toContain("50,500");
  });

  it("closes the EventSource connection and clears reconnect and polling timers on unmount", async () => {
    ledgerSpy = spyOn(
      SorobanRpc.Server.prototype,
      "getLatestLedger",
    ).mockResolvedValue(makeLedgerResponse(41_000));

    let view!: ReturnType<typeof renderWithIntl>;
    await act(async () => {
      view = renderWithIntl(<DashboardPage />);
    });

    expect(MockEventSource.instances).toHaveLength(1);

    await act(async () => {
      MockEventSource.instances[0].emitError();
    });

    expect(MockEventSource.instances[0].closed).toBe(true);
    expect(getReconnectTimers()).toHaveLength(1);
    expect(activeIntervals.size).toBe(1);

    const reconnectTimer = getReconnectTimers()[0];
    await act(async () => {
      reconnectTimer.callback();
    });

    expect(MockEventSource.instances).toHaveLength(2);
    expect(MockEventSource.instances[1].closed).toBe(false);

    await act(async () => {
      view.unmount();
    });

    expect(MockEventSource.instances.every((es) => es.closed)).toBe(true);
    expect(getReconnectTimers()).toHaveLength(0);
    expect(activeIntervals.size).toBe(0);
  });
});
