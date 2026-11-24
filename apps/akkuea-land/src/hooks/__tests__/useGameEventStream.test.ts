/**
 * useGameEventStream - unit tests
 *
 * The hook consumes the SSE stream owned by GameEventProvider, so these tests
 * render it under the real provider and replace EventSource with an in-memory
 * fake. That covers the lifecycle the issue asks about: connect on mount,
 * deliver a matching event, reconnect after a stream error, and clean up on
 * unmount.
 *
 * No real network connection is opened. Every test drives the fake by hand.
 */

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "bun:test";
import { createElement } from "react";
import type { GameEvent, GameEventType } from "@akkuea/shared";

// ── jsdom setup for render ───────────────────────────────────────────────────

// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
// jsdom has no fetch; axe-core (used by the a11y tests) needs one on window.
(dom.window as any).fetch = fetch;

// Restore what this file replaces so later files in the same bun process keep
// their own DOM setup.
const originalGlobals = {
  window: globalThis.window,
  document: globalThis.document,
  EventSource: (globalThis as any).EventSource,
};

globalThis.window = dom.window as any;
globalThis.document = dom.window.document as any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// ── Fake EventSource ─────────────────────────────────────────────────────────

class FakeEventSource {
  static instances: FakeEventSource[] = [];

  readonly url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  open() {
    this.onopen?.();
  }

  receive(data: string) {
    this.onmessage?.({ data } as MessageEvent<string>);
  }

  fail() {
    this.onerror?.();
  }

  static reset() {
    FakeEventSource.instances = [];
  }

  static latest(): FakeEventSource {
    const instance = FakeEventSource.instances.at(-1);
    if (!instance) throw new Error("No EventSource has been created");
    return instance;
  }
}

(globalThis as any).EventSource = FakeEventSource;

// ── Import after the browser globals exist ───────────────────────────────────

import { act, cleanup, render } from "@testing-library/react";
import { GameEventProvider } from "@/context/GameEventContext";
import { useGameEventStream } from "../useGameEventStream";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const BUYER = "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M";

const boughtEvent: GameEvent = {
  id: "1000-txhash-0",
  ledger: 1000,
  timestamp: "2026-11-18T12:00:00Z",
  contractId: "CCONTRACT",
  type: "PropertyBought",
  tileId: "prop-3-7",
  buyer: BUYER,
  price: "1500",
};

const rentEvent: GameEvent = {
  id: "1001-txhash-0",
  ledger: 1001,
  timestamp: "2026-11-18T12:01:00Z",
  contractId: "CCONTRACT",
  type: "RentCollected",
  tileId: "prop-3-7",
  owner: BUYER,
  amount: "40",
};

interface HarnessProps {
  types: GameEventType[];
  onEvent: (event: GameEvent) => void;
}

function Harness({ types, onEvent }: HarnessProps) {
  useGameEventStream(types, onEvent);
  return null;
}

function renderHarness(
  types: GameEventType[],
  onEvent: (event: GameEvent) => void,
) {
  return render(
    createElement(
      GameEventProvider,
      null,
      createElement(Harness, { types, onEvent }),
    ),
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.reset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

afterAll(() => {
  globalThis.window = originalGlobals.window;
  globalThis.document = originalGlobals.document;
  (globalThis as any).EventSource = originalGlobals.EventSource;
});

describe("useGameEventStream - connection lifecycle", () => {
  it("connects to the game event stream on mount", () => {
    renderHarness(["PropertyBought"], vi.fn());

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.latest().url).toBe("/api/game/events");
    expect(FakeEventSource.latest().closed).toBe(false);
  });

  it("delivers a matching event to onEvent", () => {
    const onEvent = vi.fn();
    renderHarness(["PropertyBought"], onEvent);

    act(() => {
      FakeEventSource.latest().open();
    });
    act(() => {
      FakeEventSource.latest().receive(JSON.stringify(boughtEvent));
    });

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(boughtEvent);
  });

  it("reconnects after a stream error and keeps delivering events", () => {
    const onEvent = vi.fn();
    renderHarness(["PropertyBought", "RentCollected"], onEvent);

    const first = FakeEventSource.latest();
    act(() => {
      first.open();
      first.fail();
    });

    // The provider closes the failed stream and waits out its 1s backoff.
    expect(first.closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(FakeEventSource.instances).toHaveLength(2);
    const second = FakeEventSource.latest();
    expect(second).not.toBe(first);

    act(() => {
      second.open();
      second.receive(JSON.stringify(rentEvent));
    });

    expect(onEvent).toHaveBeenCalledWith(rentEvent);
  });

  it("closes the stream and stops reconnecting on unmount", () => {
    const onEvent = vi.fn();
    const { unmount } = renderHarness(["PropertyBought"], onEvent);
    const stream = FakeEventSource.latest();

    act(() => {
      stream.open();
      unmount();
    });

    expect(stream.closed).toBe(true);

    // A pending reconnect must not open a new connection after unmount.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(FakeEventSource.instances).toHaveLength(1);

    // Events arriving on the closed stream must not reach the hook.
    act(() => {
      stream.receive(JSON.stringify(boughtEvent));
    });
    expect(onEvent).not.toHaveBeenCalled();
  });
});

describe("useGameEventStream - filtering and malformed payloads", () => {
  it("ignores events whose type is not subscribed to", () => {
    const onEvent = vi.fn();
    renderHarness(["PropertyBought"], onEvent);

    act(() => {
      FakeEventSource.latest().receive(JSON.stringify(rentEvent));
    });

    expect(onEvent).not.toHaveBeenCalled();
  });

  it("ignores a malformed payload without breaking the stream", () => {
    const onEvent = vi.fn();
    renderHarness(["PropertyBought"], onEvent);

    expect(() => {
      act(() => {
        FakeEventSource.latest().receive("{not valid json");
      });
    }).not.toThrow();
    expect(onEvent).not.toHaveBeenCalled();

    // The stream is still usable after the bad frame.
    act(() => {
      FakeEventSource.latest().receive(JSON.stringify(boughtEvent));
    });
    expect(onEvent).toHaveBeenCalledWith(boughtEvent);
  });
});
