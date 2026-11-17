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
import type { BuildingLevel, GameProperty } from "@/types/game.types";
import { useMapEvents } from "../useMapEvents";

function makeProperty(overrides: Partial<GameProperty> = {}): GameProperty {
  return {
    id: "prop-2-5",
    name: "Test Sector",
    description: "Test tile",
    propertyType: "residential",
    location: {
      address: "Sector 2",
      city: "Akkuea City",
      country: "Stellar",
      coordinates: { latitude: 0, longitude: 0 },
    },
    totalValue: "1000",
    totalShares: 100,
    availableShares: 100,
    pricePerShare: "150",
    images: [],
    documents: [],
    verified: true,
    listedAt: "2026-01-01T00:00:00Z",
    owner: "GTREASURYADDRESS0000000000000000000000000000000000000000",
    buildingLevel: 1 as BuildingLevel,
    earnedIncome: 0,
    improveCost: 300,
    isListed: true,
    ...overrides,
  };
}

let scheduledTimers: Map<number, () => void>;
let nextTimerId: number;
let setTimeoutSpy: ReturnType<typeof spyOn>;
let clearTimeoutSpy: ReturnType<typeof spyOn>;
let randomSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  scheduledTimers = new Map();
  nextTimerId = 1;

  setTimeoutSpy = spyOn(globalThis, "setTimeout").mockImplementation(((
    fn: TimerHandler,
  ) => {
    const id = nextTimerId++;
    if (typeof fn === "function") {
      scheduledTimers.set(id, fn as () => void);
    }
    return id as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout);

  clearTimeoutSpy = spyOn(globalThis, "clearTimeout").mockImplementation(((
    id?: ReturnType<typeof setTimeout>,
  ) => {
    if (typeof id === "number") {
      scheduledTimers.delete(id);
    }
  }) as unknown as typeof clearTimeout);

  randomSpy = spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  cleanup();
  randomSpy.mockRestore();
  setTimeoutSpy.mockRestore();
  clearTimeoutSpy.mockRestore();
});

function fireNextScheduledTick() {
  const first = scheduledTimers.entries().next();
  if (first.done) {
    throw new Error("Expected a scheduled map-event timer, found none");
  }
  const [id, callback] = first.value;
  scheduledTimers.delete(id);
  callback();
}

describe("useMapEvents", () => {
  it("applies ownership_change events by assigning a new owner and clearing isListed", () => {
    const onPropertyChange = vi.fn();
    const initial = makeProperty({ id: "prop-1-1", isListed: true });

    // Sequence of Math.random calls:
    // 1. scheduleNext delay -> 0
    // 2. tile index -> 0
    // 3. event roll (< 0.4 => ownership_change) -> 0.15
    // 4. fake address entropy -> 0.5
    // 5. next scheduleNext delay -> 0
    const rolls = [0, 0, 0.15, 0.5, 0];
    randomSpy.mockImplementation(() => rolls.shift() ?? 0);

    const { result } = renderHook(() =>
      useMapEvents([initial], onPropertyChange),
    );

    expect(result.current.lastEvent).toBeNull();

    act(() => {
      fireNextScheduledTick();
    });

    expect(onPropertyChange).toHaveBeenCalledTimes(1);
    const updated = onPropertyChange.mock.calls[0][0] as GameProperty;
    expect(updated.id).toBe("prop-1-1");
    expect(updated.owner).toMatch(/^G[A-Z0-9]+MOCK[A-Z0-9]+$/);
    expect(updated.owner).not.toBe(initial.owner);
    expect(updated.isListed).toBe(false);
    expect(result.current.lastEvent).toMatchObject({
      propertyId: "prop-1-1",
      type: "ownership_change",
    });
  });

  it("applies level_upgrade events and clamps buildingLevel at 3", () => {
    const onPropertyChange = vi.fn();
    const levelTwo = makeProperty({ id: "prop-2-2", buildingLevel: 2 });
    const levelThree = makeProperty({ id: "prop-3-3", buildingLevel: 3 });

    // First tick selects index 0 (level 2 -> 3), second tick selects index 1 (level 3 -> 3)
    const rolls = [0, 0.1, 0.55, 0, 0.9, 0.55, 0];
    randomSpy.mockImplementation(() => rolls.shift() ?? 0);

    const { result } = renderHook(() =>
      useMapEvents([levelTwo, levelThree], onPropertyChange),
    );

    act(() => {
      fireNextScheduledTick();
    });
    expect(
      (onPropertyChange.mock.calls[0][0] as GameProperty).buildingLevel,
    ).toBe(3);
    expect(result.current.lastEvent).toMatchObject({
      propertyId: "prop-2-2",
      type: "level_upgrade",
    });

    act(() => {
      fireNextScheduledTick();
    });
    expect(
      (onPropertyChange.mock.calls[1][0] as GameProperty).buildingLevel,
    ).toBe(3);
    expect(result.current.lastEvent).toMatchObject({
      propertyId: "prop-3-3",
      type: "level_upgrade",
    });
  });

  it("applies listing events by marking the tile listed with a positive price", () => {
    const onPropertyChange = vi.fn();
    const unListed = makeProperty({
      id: "prop-4-4",
      isListed: false,
      pricePerShare: "100",
    });

    // 1. scheduleNext -> 0, 2. index -> 0, 3. roll >= 0.7 -> 0.85, 4. price roll -> 0.25 (1100)
    const rolls = [0, 0, 0.85, 0.25, 0];
    randomSpy.mockImplementation(() => rolls.shift() ?? 0);

    const { result } = renderHook(() =>
      useMapEvents([unListed], onPropertyChange),
    );

    act(() => {
      fireNextScheduledTick();
    });

    expect(onPropertyChange).toHaveBeenCalledTimes(1);
    const updated = onPropertyChange.mock.calls[0][0] as GameProperty;
    expect(updated.isListed).toBe(true);
    expect(updated.pricePerShare).toBe("1100");
    expect(result.current.lastEvent).toMatchObject({
      propertyId: "prop-4-4",
      type: "listing",
    });
  });

  it("ignores empty or malformed property entries without mutating map state", () => {
    const onPropertyChange = vi.fn();

    const emptyHook = renderHook(() => useMapEvents([], onPropertyChange));
    act(() => {
      fireNextScheduledTick();
    });
    expect(onPropertyChange).not.toHaveBeenCalled();
    expect(emptyHook.result.current.lastEvent).toBeNull();
    emptyHook.unmount();

    const malformedEntries = [
      undefined,
      { id: "", buildingLevel: 1 },
      { id: "prop-bad", buildingLevel: Number.NaN },
    ] as unknown as GameProperty[];

    const rolls = [0, 0.0, 0, 0.5, 0, 0.9, 0];
    randomSpy.mockImplementation(() => rolls.shift() ?? 0);

    const malformedHook = renderHook(() =>
      useMapEvents(malformedEntries, onPropertyChange),
    );
    act(() => {
      fireNextScheduledTick();
      fireNextScheduledTick();
      fireNextScheduledTick();
    });

    expect(onPropertyChange).not.toHaveBeenCalled();
    expect(malformedHook.result.current.lastEvent).toBeNull();
  });

  it("does not schedule timers when disabled and clears active timers on unmount", () => {
    const onPropertyChange = vi.fn();
    const disabledHook = renderHook(() =>
      useMapEvents([makeProperty()], onPropertyChange, { enabled: false }),
    );
    expect(scheduledTimers.size).toBe(0);
    disabledHook.unmount();

    const activeHook = renderHook(() =>
      useMapEvents([makeProperty()], onPropertyChange, {
        minInterval: 5_000,
        maxInterval: 10_000,
      }),
    );
    expect(scheduledTimers.size).toBe(1);

    activeHook.unmount();
    expect(scheduledTimers.size).toBe(0);
  });
});
