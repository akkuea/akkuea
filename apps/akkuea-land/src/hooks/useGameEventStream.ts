"use client";

import { useEffect, useRef } from "react";
import { useGameEvents } from "@/context/GameEventContext";
import type { GameEvent, GameEventType } from "@akkuea/shared";

/**
 * Subscribe to game events of specific types.
 * `onEvent` is called for each matching event received from the SSE stream.
 */
export function useGameEventStream(
  types: GameEventType[],
  onEvent: (event: GameEvent) => void,
): void {
  const { latest } = useGameEvents();
  const onEventRef = useRef(onEvent);
  const typesRef = useRef(types);

  useEffect(() => {
    onEventRef.current = onEvent;
    typesRef.current = types;
  });

  useEffect(() => {
    if (!latest) return;
    if (typesRef.current.includes(latest.type)) {
      onEventRef.current(latest);
    }
  }, [latest]);
}
