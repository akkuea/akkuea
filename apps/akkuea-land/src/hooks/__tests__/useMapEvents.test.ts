// @ts-expect-error: jsdom types not fully compatible with bun runtime
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
globalThis.window = dom.window as any;
globalThis.document = dom.window.document as any;
globalThis.navigator = dom.window.navigator as any;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { BuildingLevel, GameProperty } from "@/types/game.types";
import { useMapEvents } from "../useMapEvents";

interface ScheduledTimer {
  id: number;
  delay: number;
  callback: () => void;
}

const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;
const originalRandom = Math.random;

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

function flushNextTimer(): void {
  const next = scheduledTimers.shift();
  if (next) {
    next.callback();
  }
}

function makeProperty(overrides: Partial<GameProperty> = {}): GameProperty {
  return {
    id: "prop-1-2",
    name: "Oasis Sector",
    description: "Test tile",
    propertyType: "residential",
    location: {
      address: "Sector 1",
      city: "Akkuea City",
      country: "Stellar",
      coordinates: { latitude: 0, longitude: 0 },
    },
    totalValue: "100000",
    totalShares: 1000,
    availableShares: 0,
    pricePerShare: "250",
    images: [],
    documents: [],
    verified: true,
    listedAt: "2026-01-01T00:00:00Z",
    owner: "GCPRLG7MR6J4WL527RRZ6S55GDZQ7ZDIUB6EQTRX77ETVGFH6FFM2F4M",
    buildingLevel: 1 as BuildingLevel,
    earnedIncome: 0,
    improveCost: 300,
    isListed: true,
    ...overrides,
  };
}

function mockRandomSequence(values: number[]): void {
  let index = 0;
  Math.random = () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

beforeEach(() => {
  installControlledTimers();
});

afterEach(() => {
  cleanup();
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
  Math.random = originalRandom;
});

describe("useMapEvents", () => {
  it("applies ownership_change events by assigning a new owner and clearing listings", () => {
    // Sequence: [scheduleDelay, tileIndex, roll (< 0.4), addressRandom, nextDelay]
    mockRandomSequence([0.5, 0, 0.2, 0.123456, 0.5]);
    const initial = makeProperty({ isListed: true });
    const onPropertyChange = vi.fn();

    const { result } = renderHook(() =>
      useMapEvents([initial], onPropertyChange, {
        minInterval: 1000,
        maxInterval: 2000,
      }),
    );

    expect(result.current.lastEvent).toBeNull();
    expect(scheduledTimers).toHaveLength(1);
    expect(scheduledTimers[0].delay).toBe(1500);

    act(() => {
      flushNextTimer();
    });

    expect(onPropertyChange).toHaveBeenCalledTimes(1);
    const updated = onPropertyChange.mock.calls[0][0] as GameProperty;
    expect(updated.id).toBe(initial.id);
    expect(updated.owner).not.toBe(initial.owner);
    expect(updated.owner?.startsWith("G")).toBe(true);
    expect(updated.isListed).toBe(false);
    expect(result.current.lastEvent?.propertyId).toBe(initial.id);
    expect(result.current.lastEvent?.type).toBe("ownership_change");
  });

  it("applies level_upgrade events and clamps buildingLevel at 3", () => {
    // First tick upgrades 1 -> 2, second tick clamps 3 -> 3
    mockRandomSequence([0, 0, 0.5, 0, 0, 0.65, 0]);
    const levelOne = makeProperty({ buildingLevel: 1 });
    const levelThree = makeProperty({ id: "prop-2-2", buildingLevel: 3 });
    const onPropertyChange = vi.fn();

    const { result, rerender } = renderHook(
      ({ props }) => useMapEvents(props, onPropertyChange),
      { initialProps: { props: [levelOne] } },
    );

    act(() => {
      flushNextTimer();
    });

    expect(onPropertyChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: "prop-1-2", buildingLevel: 2 }),
    );
    expect(result.current.lastEvent?.type).toBe("level_upgrade");

    rerender({ props: [levelThree] });

    act(() => {
      flushNextTimer();
    });

    expect(onPropertyChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "prop-2-2", buildingLevel: 3 }),
    );
  });

  it("applies listing events with isListed set to true and a positive price string", () => {
    // Sequence: [scheduleDelay, tileIndex, roll (>= 0.7), priceRoll, nextDelay]
    mockRandomSequence([0, 0, 0.85, 0.25, 0]);
    const initial = makeProperty({ isListed: false, pricePerShare: "100" });
    const onPropertyChange = vi.fn();

    const { result } = renderHook(() =>
      useMapEvents([initial], onPropertyChange),
    );

    act(() => {
      flushNextTimer();
    });

    expect(onPropertyChange).toHaveBeenCalledTimes(1);
    const updated = onPropertyChange.mock.calls[0][0] as GameProperty;
    expect(updated.isListed).toBe(true);
    expect(updated.pricePerShare).toBe("1100");
    expect(result.current.lastEvent?.type).toBe("listing");
  });

  it("ignores empty or malformed property entries and cleans up timers on unmount", () => {
    mockRandomSequence([0, 0, 0.5, 0]);
    const onPropertyChange = vi.fn();
    const malformed = {
      ...makeProperty(),
      id: "",
      buildingLevel: Number.NaN as unknown as BuildingLevel,
    };

    const { result, rerender, unmount } = renderHook(
      ({ props, enabled }) =>
        useMapEvents(props, onPropertyChange, { enabled }),
      {
        initialProps: {
          props: [malformed],
          enabled: true,
        },
      },
    );

    act(() => {
      flushNextTimer();
    });

    expect(onPropertyChange).not.toHaveBeenCalled();
    expect(result.current.lastEvent).toBeNull();

    rerender({ props: [], enabled: true });
    act(() => {
      flushNextTimer();
    });
    expect(onPropertyChange).not.toHaveBeenCalled();

    unmount();
    expect(scheduledTimers).toHaveLength(0);
  });

  it("does not schedule timers when enabled is false", () => {
    const onPropertyChange = vi.fn();
    renderHook(() =>
      useMapEvents([makeProperty()], onPropertyChange, { enabled: false }),
    );

    expect(scheduledTimers).toHaveLength(0);
    expect(onPropertyChange).not.toHaveBeenCalled();
  });
});
