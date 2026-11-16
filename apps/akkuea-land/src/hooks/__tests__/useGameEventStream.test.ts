// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
globalThis.window = dom.window as any;
globalThis.document = dom.window.document as any;
globalThis.navigator = dom.window.navigator as any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { GameEvent } from "@akkuea/shared";
import { GameEventProvider, useGameEvents } from "@/context/GameEventContext";
import { useGameEventStream } from "../useGameEventStream";

interface ScheduledTimer {
  id: number;
  delay: number;
  callback: () => void;
}

class MockEventSource {
  static instances: MockEventSource[] = [];

  readonly url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  emitOpen(): void {
    this.onopen?.();
  }

  emitMessage(payload: string): void {
    this.onmessage?.({ data: payload } as MessageEvent<string>);
  }

  emitError(): void {
    this.onerror?.();
  }
}

const originalEventSource = globalThis.EventSource;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;

let nextTimerId = 1;
let scheduledTimers: ScheduledTimer[] = [];

function installControlledTimers(): void {
  nextTimerId = 1;
  scheduledTimers = [];
  globalThis.setTimeout = ((cb: (...args: any[]) => void, ms?: number) => {
    const id = nextTimerId++;
    scheduledTimers.push({
      id,
      delay: typeof ms === "number" ? ms : 0,
      callback: () => cb(),
    });
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;

  globalThis.clearTimeout = ((id?: ReturnType<typeof setTimeout>) => {
    scheduledTimers = scheduledTimers.filter(
      (entry) => entry.id !== (id as unknown as number),
    );
  }) as typeof clearTimeout;
}

function flushNextTimer(): ScheduledTimer | undefined {
  const next = scheduledTimers.shift();
  if (next) {
    next.callback();
  }
  return next;
}

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(GameEventProvider, null, children);
}

const SAMPLE_BOUGHT_EVENT: GameEvent = {
  id: "100-tx1-0",
  type: "PropertyBought",
  tileId: "prop-0-1",
  buyer: "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M",
  price: "1500000000",
  ledger: 100,
  timestamp: "2026-06-01T00:00:00Z",
  contractId: "CCPUVGQAMDUUASHMXB7Z6F6XHCZI2WXOPR7DXEVPJBEGYZVJEABEABLE",
};

const SAMPLE_LISTED_EVENT: GameEvent = {
  id: "101-tx2-0",
  type: "PropertyListed",
  tileId: "prop-0-2",
  seller: "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M",
  askPrice: "2500000000",
  ledger: 101,
  timestamp: "2026-06-01T00:01:00Z",
  contractId: "CDKRZTY5PFNA4DHI2GFPSTOAADI2WV7SXYVS4VMTDC6M7IKKIPQJP5A3",
};

beforeEach(() => {
  MockEventSource.instances = [];
  globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
  installControlledTimers();
});

afterEach(() => {
  cleanup();
  globalThis.EventSource = originalEventSource;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
});

describe("useGameEventStream", () => {
  it("connects to /api/game/events and updates connection status on open", () => {
    const onEvent = vi.fn();
    const { result } = renderHook(
      () => {
        useGameEventStream(["PropertyBought"], onEvent);
        return useGameEvents();
      },
      { wrapper },
    );

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe("/api/game/events");
    expect(result.current.connected).toBe(false);

    act(() => {
      MockEventSource.instances[0].emitOpen();
    });

    expect(result.current.connected).toBe(true);
  });

  it("delivers subscribed events and ignores unsubscribed or malformed messages", () => {
    const onEvent = vi.fn();
    const { result } = renderHook(
      () => {
        useGameEventStream(["PropertyBought"], onEvent);
        return useGameEvents();
      },
      { wrapper },
    );

    const stream = MockEventSource.instances[0];

    act(() => {
      stream.emitOpen();
      stream.emitMessage(JSON.stringify(SAMPLE_LISTED_EVENT));
      stream.emitMessage("{malformed-json");
      stream.emitMessage("null");
      stream.emitMessage(JSON.stringify({ type: "UnknownContractEvent" }));
    });

    expect(onEvent).not.toHaveBeenCalled();
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0]).toEqual(SAMPLE_LISTED_EVENT);

    act(() => {
      stream.emitMessage(JSON.stringify(SAMPLE_BOUGHT_EVENT));
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(SAMPLE_BOUGHT_EVENT);
  });

  it("reconnects with backoff after stream errors without leaking duplicate timers", () => {
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
      firstStream.emitError();
    });

    expect(firstStream.closed).toBe(true);
    expect(result.current.connected).toBe(false);
    expect(scheduledTimers).toHaveLength(1);
    expect(scheduledTimers[0].delay).toBe(1000);

    act(() => {
      flushNextTimer();
    });

    expect(MockEventSource.instances).toHaveLength(2);
    const secondStream = MockEventSource.instances[1];

    act(() => {
      secondStream.emitOpen();
      secondStream.emitMessage(JSON.stringify(SAMPLE_BOUGHT_EVENT));
    });

    expect(result.current.connected).toBe(true);
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(SAMPLE_BOUGHT_EVENT);
  });

  it("closes the active stream and cancels pending reconnect timers on unmount", () => {
    const onEvent = vi.fn();
    const { unmount } = renderHook(
      () => useGameEventStream(["PropertyBought"], onEvent),
      { wrapper },
    );

    const stream = MockEventSource.instances[0];
    act(() => {
      stream.emitError();
    });

    expect(stream.closed).toBe(true);
    expect(scheduledTimers).toHaveLength(1);

    unmount();

    expect(scheduledTimers).toHaveLength(0);
    expect(MockEventSource.instances).toHaveLength(1);
  });
});
