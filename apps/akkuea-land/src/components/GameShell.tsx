"use client";

import { GameEventProvider, useGameEvents } from "@/context/GameEventContext";
import { CityMap } from "@/components/CityMap";

function StatusBar() {
  const { connected, events } = useGameEvents();
  return (
    <p style={{ fontSize: 12, color: connected ? "#16a34a" : "#dc2626" }}>
      {connected ? "● Live" : "○ Connecting…"} — {events.length} events received
    </p>
  );
}

export function GameShell() {
  return (
    <GameEventProvider>
      <main style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ marginBottom: 8 }}>Akkuea Land</h1>
        <StatusBar />
        <div style={{ marginTop: 16 }}>
          <CityMap />
        </div>
      </main>
    </GameEventProvider>
  );
}
