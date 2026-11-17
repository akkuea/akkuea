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

import React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  spyOn,
  vi,
} from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { GameEvent, GameEventType } from "@akkuea/shared";
import { GameEventProvider, useGameEvents } from "@/context/GameEventContext";
import { useGameEventStream } from "../useGameEventStream";

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

  emitRaw(data: string) {
    this.onmessage?.({ data } as MessageEvent<string>);
  }

  emitEvent(event: GameEvent) {
    this.emitRaw(JSON.stringify(event));
  }

  emitError() {
    this.onerror?.();
  }
}

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(GameEventProvider, null, children);

const SAMPLE_BOUGHT: GameEvent = {
  id: "1200-tx1-0",
  ledger: 1200,
  timestamp: "2026-10-16T12:00:00Z",
  contractId: "CCONTRACT",
  type: "PropertyBought",
  tileId: "prop-2-4",
  buyer: "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M",
  price: "1500",
};

const SAMPLE_RENT: GameEvent = {
  id: "1201-tx2-0",
  ledger: 1201,
  timestamp: "2026-10-16T12:00:05Z",
  contractId: "CCONTRACT",
  type: "RentCollected",
  tileId: "prop-2-4",
  owner: "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M",
  amount: "80",
};

const originalEventSource = globalThis.EventSource;

beforeEach(() => {
  MockEventSource.instances = [];
  (globalThis as any).EventSource = MockEventSource;
});

afterEach(() => {
  cleanup();
  if (originalEventSource) {
    globalThis.EventSource = originalEventSource;
  } else {
    delete (globalThis as any).EventSource;
  }
});

describe("useGameEventStream", () => {
  it("connects to /api/game/events and delivers matching events to onEvent", () => {
    const onEvent = vi.fn();

    const { result } = renderHook(
      () => {
        useGameEventStream(["PropertyBought"], onEvent);
        return useGameEvents();
      },
      { wrapper },
    );

    expect(MockEventSource.instances).toHaveLength(1);
    const stream = MockEventSource.instances[0];
    expect(stream.url).toBe("/api/game/events");
    expect(result.current.connected).toBe(false);

    act(() => {
      stream.emitOpen();
    });
    expect(result.current.connected).toBe(true);

    act(() => {
      stream.emitEvent(SAMPLE_RENT);
    });
    expect(onEvent).not.toHaveBeenCalled();

    act(() => {
      stream.emitEvent(SAMPLE_BOUGHT);
    });
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(SAMPLE_BOUGHT);
  });

  it("picks up updated types and callback without opening a second EventSource", () => {
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();

    const { rerender } = renderHook(
      ({
        types,
        handler,
      }: {
        types: GameEventType[];
        handler: (event: GameEvent) => void;
      }) => useGameEventStream(types, handler),
      {
        initialProps: {
          types: ["PropertyBought"] as GameEventType[],
          handler: firstHandler,
        },
        wrapper,
      },
    );

    rerender({
      types: ["RentCollected"],
      handler: secondHandler,
    });

    expect(MockEventSource.instances).toHaveLength(1);

    act(() => {
      MockEventSource.instances[0].emitEvent(SAMPLE_RENT);
    });

    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).toHaveBeenCalledTimes(1);
    expect(secondHandler).toHaveBeenCalledWith(SAMPLE_RENT);
  });

  it("ignores malformed or non-event payloads on the SSE stream", () => {
    const onEvent = vi.fn();
    renderHook(
      () =>
        useGameEventStream(
          [
            "PropertyBought",
            "PropertyListed",
            "PropertyTransferred",
            "RentCollected",
          ],
          onEvent,
        ),
      { wrapper },
    );

    const stream = MockEventSource.instances[0];

    act(() => {
      stream.emitRaw("not-json");
      stream.emitRaw("null");
      stream.emitRaw("42");
      stream.emitRaw("{}");
    });

    expect(onEvent).not.toHaveBeenCalled();
  });

  it("reconnects with backoff after a stream error and resumes delivering events", () => {
    const scheduled: Array<{ delay: number; callback: () => void }> = [];
    const setTimeoutSpy = spyOn(globalThis, "setTimeout").mockImplementation(((
      fn: TimerHandler,
      ms?: number,
    ) => {
      if (typeof fn === "function") {
        scheduled.push({ delay: ms ?? 0, callback: fn as () => void });
      }
      return scheduled.length as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout);
    const clearTimeoutSpy = spyOn(
      globalThis,
      "clearTimeout",
    ).mockImplementation(() => {});

    try {
      const onEvent = vi.fn();
      const { result } = renderHook(
        () => {
          useGameEventStream(["PropertyBought"], onEvent);
          return useGameEvents();
        },
        { wrapper },
      );

      const firstStream = MockEventSource.instances[0];
      act(() => {
        firstStream.emitOpen();
      });
      expect(result.current.connected).toBe(true);

      act(() => {
        firstStream.emitError();
      });
      expect(firstStream.closed).toBe(true);
      expect(result.current.connected).toBe(false);
      expect(scheduled).toHaveLength(1);
      expect(scheduled[0].delay).toBe(1_000);

      act(() => {
        scheduled[0].callback();
      });
      expect(MockEventSource.instances).toHaveLength(2);

      const secondStream = MockEventSource.instances[1];
      act(() => {
        secondStream.emitOpen();
        secondStream.emitEvent(SAMPLE_BOUGHT);
      });
      expect(result.current.connected).toBe(true);
      expect(onEvent).toHaveBeenCalledTimes(1);
      expect(onEvent).toHaveBeenCalledWith(SAMPLE_BOUGHT);
    } finally {
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    }
  });

  it("closes the EventSource and clears pending reconnect timers on unmount", () => {
    const activeTimers = new Set<number>();
    let nextId = 10;

    const setTimeoutSpy = spyOn(globalThis, "setTimeout").mockImplementation(((
      _fn: TimerHandler,
    ) => {
      const id = ++nextId;
      activeTimers.add(id);
      return id as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout);
    const clearTimeoutSpy = spyOn(
      globalThis,
      "clearTimeout",
    ).mockImplementation(((id?: ReturnType<typeof setTimeout>) => {
      if (typeof id === "number") {
        activeTimers.delete(id);
      }
    }) as unknown as typeof clearTimeout);

    try {
      const onEvent = vi.fn();
      const { unmount } = renderHook(
        () => useGameEventStream(["PropertyBought"], onEvent),
        { wrapper },
      );

      const stream = MockEventSource.instances[0];
      act(() => {
        stream.emitError();
        stream.emitError();
      });
      expect(activeTimers.size).toBe(1);

      unmount();

      expect(stream.closed).toBe(true);
      expect(activeTimers.size).toBe(0);
    } finally {
      setTimeoutSpy.mockRestore();
      clearTimeoutSpy.mockRestore();
    }
  });
});
