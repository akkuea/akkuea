"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameEventStream } from "@/hooks/useGameEventStream";
import type { GameEvent } from "@akkuea/shared";

interface TileState {
  id: string;
  owner: string | null;
  listed: boolean;
  pulsing: boolean;
}

const GRID_COLS = 10;
const GRID_ROWS = 10;
const PULSE_DURATION_MS = 800;

function buildInitialTiles(): TileState[] {
  return Array.from({ length: GRID_COLS * GRID_ROWS }, (_, i) => ({
    id: String(i),
    owner: null,
    listed: false,
    pulsing: false,
  }));
}

export function CityMap() {
  const [tiles, setTiles] = useState<TileState[]>(buildInitialTiles);
  const pulseTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const pulse = useCallback((tileId: string) => {
    // Clear any existing pulse timer for this tile
    const existing = pulseTimers.current.get(tileId);
    if (existing) clearTimeout(existing);

    setTiles((prev) =>
      prev.map((t) => (t.id === tileId ? { ...t, pulsing: true } : t)),
    );

    const timer = setTimeout(() => {
      setTiles((prev) =>
        prev.map((t) => (t.id === tileId ? { ...t, pulsing: false } : t)),
      );
      pulseTimers.current.delete(tileId);
    }, PULSE_DURATION_MS);

    pulseTimers.current.set(tileId, timer);
  }, []);

  const handleEvent = useCallback(
    (event: GameEvent) => {
      if (event.type === "PropertyBought") {
        setTiles((prev) =>
          prev.map((t) =>
            t.id === event.tileId
              ? { ...t, owner: event.buyer, listed: false }
              : t,
          ),
        );
        pulse(event.tileId);
      } else if (event.type === "PropertyListed") {
        setTiles((prev) =>
          prev.map((t) => (t.id === event.tileId ? { ...t, listed: true } : t)),
        );
        pulse(event.tileId);
      }
    },
    [pulse],
  );

  useGameEventStream(["PropertyBought", "PropertyListed"], handleEvent);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = pulseTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
        gap: 2,
        width: "100%",
        maxWidth: 600,
        aspectRatio: "1",
      }}
      aria-label="City map"
      role="grid"
    >
      {tiles.map((tile) => (
        <Tile key={tile.id} tile={tile} />
      ))}
    </div>
  );
}

function Tile({ tile }: { tile: TileState }) {
  const bg = tile.owner ? "#4ade80" : "#e5e7eb";
  const border = tile.listed ? "2px solid #f59e0b" : "1px solid #d1d5db";

  return (
    <div
      role="gridcell"
      aria-label={`Tile ${tile.id}${tile.owner ? `, owned by ${tile.owner}` : ""}${tile.listed ? ", listed" : ""}`}
      style={{
        backgroundColor: bg,
        border,
        borderRadius: 2,
        aspectRatio: "1",
        transition: "filter 0.1s ease-out",
        filter: tile.pulsing ? "brightness(1.8)" : "brightness(1)",
      }}
    />
  );
}
