/**
 * useMapEvents - unit tests
 *
 * The hook schedules mock contract events on a timer and turns each one into
 * a map update. Tests drive the timers with fake timers and pin Math.random so
 * every event type can be produced deterministically:
 *
 *   ownership_change -> the tile gets a new owner and leaves the market
 *   level_upgrade    -> the tile gains one building level
 *   listing          -> the tile is listed with a fresh price
 *
 * Guard cases cover input the hook cannot apply: an empty property list and
 * events disabled altogether. Neither may touch the map.
 *
 * No real timers fire and no network is involved.
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
};

globalThis.window = dom.window as any;
globalThis.document = dom.window.document as any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { act, cleanup, renderHook } from "@testing-library/react";
import { useMapEvents } from "../useMapEvents";
import type { GameProperty } from "../../types/game.types";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const OWNER = "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M";

function makeProperty(overrides: Partial<GameProperty> = {}): GameProperty {
  return {
    id: "prop-3-7",
    name: "Test Tile",
    description: "Test",
    propertyType: "land",
    location: {
      address: "Block 4, Lot 8",
      city: "Akkuea City",
      country: "Stellar",
      coordinates: { latitude: 0, longitude: 0 },
    },
    totalValue: "1000",
    totalShares: 100,
    availableShares: 100,
    pricePerShare: "100",
    images: [],
    documents: [],
    verified: true,
    listedAt: "2026-01-01T00:00:00Z",
    owner: OWNER,
    buildingLevel: 0,
    earnedIncome: 0,
    improveCost: 100,
    isListed: false,
    ...overrides,
  };
}

const INTERVAL = 100;

/**
 * Queue the values Math.random returns. Every value is consumed once, then
 * random falls back to 0. A single simulateEvent call draws three values in
 * this order: the timer delay, the tile index, the event-type roll. Ownership
 * changes draw a fourth for the fake address, listings draw one for the price.
 */
let randomQueue: number[] = [];
let randomSpy: ReturnType<typeof vi.spyOn>;

function renderMapEvents(
  properties: GameProperty[],
  onPropertyChange: (updated: GameProperty) => void,
  options: { enabled?: boolean } = {},
) {
  return renderHook(() =>
    useMapEvents(properties, onPropertyChange, {
      minInterval: INTERVAL,
      maxInterval: INTERVAL,
      ...options,
    }),
  );
}

function tick(ms = INTERVAL) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const lastUpdated = (onPropertyChange: ReturnType<typeof vi.fn>) =>
  (onPropertyChange.mock as any).calls.at(-1)[0] as GameProperty;

// ── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  randomQueue = [];
  randomSpy = vi
    .spyOn(Math, "random")
    .mockImplementation(() => (randomQueue.length ? randomQueue.shift()! : 0));
});

afterEach(() => {
  cleanup();
  randomSpy.mockRestore();
  vi.useRealTimers();
});

afterAll(() => {
  globalThis.window = originalGlobals.window;
  globalThis.document = originalGlobals.document;
});

describe("useMapEvents - event types", () => {
  it("ownership_change assigns a new owner and unlists the tile", () => {
    const onPropertyChange = vi.fn();
    const property = makeProperty({ isListed: true });
    // delay, tile index, roll below 0.4
    randomQueue = [0, 0, 0.1];

    const { result } = renderMapEvents([property], onPropertyChange);

    expect(result.current.lastEvent).toBeNull();
    tick();

    expect(onPropertyChange).toHaveBeenCalledTimes(1);
    const updated = lastUpdated(onPropertyChange);
    expect(updated.owner).not.toBe(OWNER);
    expect(updated.owner.startsWith("G")).toBe(true);
    expect(updated.isListed).toBe(false);
    expect(updated.id).toBe(property.id);

    expect(result.current.lastEvent?.type).toBe("ownership_change");
    expect(result.current.lastEvent?.propertyId).toBe(property.id);
    expect(typeof result.current.lastEvent?.timestamp).toBe("number");
  });

  it("level_upgrade raises the building level by one", () => {
    const onPropertyChange = vi.fn();
    const property = makeProperty({ buildingLevel: 1 });
    // delay, tile index, roll between 0.4 and 0.7
    randomQueue = [0, 0, 0.5];

    const { result } = renderMapEvents([property], onPropertyChange);
    tick();

    expect(onPropertyChange).toHaveBeenCalledTimes(1);
    const updated = lastUpdated(onPropertyChange);
    expect(updated.buildingLevel).toBe(2);
    expect(updated.owner).toBe(OWNER);

    expect(result.current.lastEvent?.type).toBe("level_upgrade");
    expect(result.current.lastEvent?.propertyId).toBe(property.id);
  });

  it("listing marks the tile listed with a price", () => {
    const onPropertyChange = vi.fn();
    const property = makeProperty();
    // delay, tile index, roll at or above 0.7, price roll
    randomQueue = [0, 0, 0.9, 0.5];

    const { result } = renderMapEvents([property], onPropertyChange);
    tick();

    expect(onPropertyChange).toHaveBeenCalledTimes(1);
    const updated = lastUpdated(onPropertyChange);
    expect(updated.isListed).toBe(true);
    expect(updated.pricePerShare).toBe("2100");
    expect(updated.owner).toBe(OWNER);

    expect(result.current.lastEvent?.type).toBe("listing");
    expect(result.current.lastEvent?.propertyId).toBe(property.id);
  });
});

describe("useMapEvents - ignored input", () => {
  it("does not emit anything when there is no property to update", () => {
    const onPropertyChange = vi.fn();

    const { result } = renderMapEvents([], onPropertyChange);
    tick();
    tick(5000);

    expect(onPropertyChange).not.toHaveBeenCalled();
    expect(result.current.lastEvent).toBeNull();
  });

  it("does not emit anything when events are disabled", () => {
    const onPropertyChange = vi.fn();

    const { result } = renderMapEvents([makeProperty()], onPropertyChange, {
      enabled: false,
    });
    tick(5000);

    expect(onPropertyChange).not.toHaveBeenCalled();
    expect(result.current.lastEvent).toBeNull();
  });
});

describe("useMapEvents - unmount", () => {
  it("stops scheduling events after unmount", () => {
    const onPropertyChange = vi.fn();

    const { unmount } = renderMapEvents([makeProperty()], onPropertyChange);
    tick();
    expect(onPropertyChange).toHaveBeenCalledTimes(1);

    unmount();
    tick(10_000);

    expect(onPropertyChange).toHaveBeenCalledTimes(1);
  });
});
