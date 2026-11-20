// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
(dom.window as unknown as { fetch: typeof fetch }).fetch = fetch;
globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.MutationObserver = dom.window.MutationObserver;
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { afterEach, beforeAll, beforeEach, describe, expect, it, mock, vi } from "bun:test";
import React from "react";
import { render, cleanup, act, waitFor } from "@testing-library/react";
import fs from "fs";
import path from "path";

// Mock next-intl and navigation modules before any component import
mock.module("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

mock.module("next-intl/routing", () => ({
  defineRouting: (config: unknown) => config,
}));

mock.module("next-intl/navigation", () => ({
  createNavigation: () => ({
    Link: ({ children, href, ...props }: Record<string, unknown>) =>
      React.createElement("a", { href, ...props }, children as React.ReactNode),
    redirect: vi.fn(),
    usePathname: () => "/dashboard",
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
    }),
  }),
}));

mock.module("@/i18n/routing", () => ({
  Link: ({ children, href, ...props }: Record<string, unknown>) =>
    React.createElement("a", { href, ...props }, children as React.ReactNode),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/dashboard",
}));

// Mock sub-components that depend on external router/theme
mock.module("@/components/game/PilotCta", () => ({
  PilotCta: () => React.createElement("div", { "data-testid": "pilot-cta" }),
}));

mock.module("@/components/layout/ThemeToggle", () => ({
  ThemeToggle: () => React.createElement("div", { "data-testid": "theme-toggle" }),
}));

mock.module("@/components/layout/LocaleSwitcher", () => ({
  LocaleSwitcher: () => React.createElement("div", { "data-testid": "locale-switcher" }),
}));

// Mock framer-motion to bypass animations in tests
mock.module("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  motion: new Proxy(
    {},
    {
      get: (_target, tagName: string) =>
        React.forwardRef(function PassthroughMotion(
          { children, ...props }: Record<string, unknown>,
          ref,
        ) {
          return React.createElement(
            tagName,
            { ref, ...props },
            children as React.ReactNode,
          );
        }),
    },
  ),
}));

import { GameEventProvider, useGameEvents } from "@/context/GameEventContext";

/**
 * Fully-typed MockEventSource conforming to EventSource and EventTarget interfaces.
 */
class MockEventSource implements EventTarget {
  static instances: MockEventSource[] = [];
  readonly url: string;
  readonly withCredentials: boolean = false;
  readyState: number = 0; // 0: CONNECTING, 1: OPEN, 2: CLOSED
  readonly CONNECTING: number = 0;
  readonly OPEN: number = 1;
  readonly CLOSED: number = 2;
  closed: boolean = false;

  onopen: ((this: EventSource, ev: Event) => void) | null = null;
  onmessage: ((this: EventSource, ev: MessageEvent) => void) | null = null;
  onerror: ((this: EventSource, ev: Event) => void) | null = null;

  private listeners: Map<string, Set<EventListenerOrEventListenerObject>> =
    new Map();

  constructor(url: string | URL, _eventSourceInitDict?: EventSourceInit) {
    this.url = typeof url === "string" ? url : url.toString();
    this.readyState = 0;
    MockEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
    this.readyState = 2;
  }

  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
  ): void {
    if (!callback) return;
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
  }

  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null,
  ): void {
    if (!callback) return;
    this.listeners.get(type)?.delete(callback);
  }

  dispatchEvent(event: Event): boolean {
    const list = this.listeners.get(event.type);
    if (list) {
      for (const listener of list) {
        if (typeof listener === "function") {
          listener.call(this as unknown as EventSource, event);
        } else {
          listener.handleEvent(event);
        }
      }
    }
    if (event.type === "open" && this.onopen) {
      this.onopen.call(this as unknown as EventSource, event);
    } else if (event.type === "message" && this.onmessage) {
      this.onmessage.call(
        this as unknown as EventSource,
        event as MessageEvent,
      );
    } else if (event.type === "error" && this.onerror) {
      this.onerror.call(this as unknown as EventSource, event);
    }
    return true;
  }

  triggerOpen(): void {
    this.readyState = 1;
    this.dispatchEvent(new Event("open"));
  }

  triggerMessage(data: unknown): void {
    this.dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify(data) }),
    );
  }

  triggerError(): void {
    this.dispatchEvent(new Event("error"));
  }
}

describe("Dashboard and GameEventStream behavioral consolidation (#1340)", () => {
  const originalFetch = globalThis.fetch;
  const originalEventSource = globalThis.EventSource;
  let DashboardPage: React.ComponentType;

  beforeAll(async () => {
    const mod = await import("../[locale]/dashboard/page");
    DashboardPage = mod.default;
  });

  beforeEach(() => {
    cleanup();
    MockEventSource.instances = [];
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
    vi.restoreAllMocks();
  });

  it("renders dashboard inside GameEventProvider with exactly one EventSource open", () => {
    const view = render(
      <GameEventProvider>
        <DashboardPage />
      </GameEventProvider>,
    );

    expect(MockEventSource.instances.length).toBe(1);
    const instance = MockEventSource.instances[0];
    expect(instance.url).toBe("/api/game/events");
    expect(instance.closed).toBe(false);

    view.unmount();
  });

  it("verifies stream failure lets polling update the ledger sequence", async () => {
    let polledLedger = 50000;
    const fetchMock = mock(async (_url: string | URL | Request, _init?: RequestInit) => {
      polledLedger += 50;
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { sequence: polledLedger },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    function TestConsumer() {
      const { currentLedger, connected } = useGameEvents();
      return (
        <div>
          <span data-testid="ledger-val">{currentLedger}</span>
          <span data-testid="conn-status">{connected ? "yes" : "no"}</span>
        </div>
      );
    }

    const view = render(
      <GameEventProvider>
        <TestConsumer />
      </GameEventProvider>,
    );

    const instance = MockEventSource.instances[0];
    expect(instance).toBeDefined();

    // Trigger stream error
    act(() => {
      instance.triggerError();
    });

    expect(instance.closed).toBe(true);

    // Ledger advances through RPC polling even when stream fails
    await waitFor(() => {
      const ledgerText = view.getByTestId("ledger-val").textContent;
      expect(Number(ledgerText)).toBeGreaterThanOrEqual(50050);
    });

    view.unmount();
  });

  it("verifies unmounting closes the connection and cleans up listeners", () => {
    const view = render(
      <GameEventProvider>
        <DashboardPage />
      </GameEventProvider>,
    );

    expect(MockEventSource.instances.length).toBe(1);
    const instance = MockEventSource.instances[0];
    expect(instance.closed).toBe(false);

    // Unmount
    view.unmount();

    expect(instance.closed).toBe(true);
    expect(instance.readyState).toBe(2);
  });

  it("verifies no react-hooks/exhaustive-deps suppression remains in dashboard page", () => {
    const dashboardPagePath = path.resolve(
      __dirname,
      "../[locale]/dashboard/page.tsx",
    );
    const content = fs.readFileSync(dashboardPagePath, "utf-8");
    expect(content.includes("react-hooks/exhaustive-deps")).toBe(false);
  });

  it("verifies dashboard page does not open its own EventSource", () => {
    const dashboardPagePath = path.resolve(
      __dirname,
      "../[locale]/dashboard/page.tsx",
    );
    const content = fs.readFileSync(dashboardPagePath, "utf-8");
    expect(content.includes("new EventSource")).toBe(false);
    expect(content.includes("SSE_ENDPOINT")).toBe(false);
    expect(content.includes("useGameEvents")).toBe(true);
  });

  it("verifies layout wraps GameEventProvider as the shared event source", () => {
    const layoutPath = path.resolve(__dirname, "../[locale]/layout.tsx");
    const content = fs.readFileSync(layoutPath, "utf-8");
    expect(content.includes("GameEventProvider")).toBe(true);
  });
});
