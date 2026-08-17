"use client";

import { GameEventProvider, useGameEvents } from "@/context/GameEventContext";
import { CityMap } from "@/components/CityMap";

function StatusBar() {
  const { connected, events } = useGameEvents();
  return (
    <p className={`text-xs ${connected ? "text-land-success" : "text-land-danger"}`}>
      {connected ? "● Live" : "○ Connecting…"} - {events.length} events received
    </p>
  );
}

export function GameShell() {
  return (
    <GameEventProvider>
      <main className="p-6 font-game">
        <h1 className="mb-2">Akkuea Land</h1>
        <StatusBar />
        <div className="mt-4">
          <CityMap />
        </div>
      </main>
    </GameEventProvider>
  );
}
