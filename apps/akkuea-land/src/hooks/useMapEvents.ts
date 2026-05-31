/**
 * Simulates real-time property events for the city map.
 *
 * Randomly picks a tile every 8–15 seconds and applies a mock
 * transaction (ownership change, level upgrade, or new listing).
 * Returns the last event so the grid can flash the affected tile.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { GameProperty, BuildingLevel } from "../types/game.types";

export interface MapEvent {
  propertyId: string;
  type: "ownership_change" | "level_upgrade" | "listing";
  timestamp: number;
}

interface UseMapEventsOptions {
  /** Minimum interval between events in ms (default 8000) */
  minInterval?: number;
  /** Maximum interval between events in ms (default 15000) */
  maxInterval?: number;
  /** Whether events are enabled (default true) */
  enabled?: boolean;
}

export function useMapEvents(
  properties: GameProperty[],
  onPropertyChange: (updated: GameProperty) => void,
  options: UseMapEventsOptions = {},
) {
  const {
    minInterval = 8000,
    maxInterval = 15000,
    enabled = true,
  } = options;

  const [lastEvent, setLastEvent] = useState<MapEvent | null>(null);
  const propertiesRef = useRef(properties);
  const onPropertyChangeRef = useRef(onPropertyChange);

  // Sync refs inside an effect to avoid writing during render (react-hooks/refs)
  useEffect(() => {
    propertiesRef.current = properties;
  }, [properties]);

  useEffect(() => {
    onPropertyChangeRef.current = onPropertyChange;
  }, [onPropertyChange]);

  const simulateEvent = useCallback(() => {
    const props = propertiesRef.current;
    if (props.length === 0) return;

    const idx = Math.floor(Math.random() * props.length);
    const prop = props[idx];

    // Randomly pick event type
    const roll = Math.random();
    let eventType: MapEvent["type"];
    let updated: GameProperty;

    if (roll < 0.4) {
      // Ownership change
      eventType = "ownership_change";
      const fakeAddr = `G${Math.random().toString(36).substring(2, 10).toUpperCase()}MOCK${Date.now().toString(36).toUpperCase()}`;
      updated = {
        ...prop,
        owner: fakeAddr,
        isListed: false,
      };
    } else if (roll < 0.7) {
      // Level upgrade
      eventType = "level_upgrade";
      const nextLevel = Math.min(prop.buildingLevel + 1, 3) as BuildingLevel;
      updated = {
        ...prop,
        buildingLevel: nextLevel,
      };
    } else {
      // New listing
      eventType = "listing";
      const price = Math.floor(Math.random() * 4000) + 100;
      updated = {
        ...prop,
        isListed: true,
        pricePerShare: price.toString(),
      };
    }

    onPropertyChangeRef.current(updated);

    setLastEvent({
      propertyId: prop.id,
      type: eventType,
      timestamp: Date.now(),
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const delay = minInterval + Math.random() * (maxInterval - minInterval);
      timeoutId = setTimeout(() => {
        simulateEvent();
        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [enabled, minInterval, maxInterval, simulateEvent]);

  return { lastEvent };
}
