"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { GameEvent } from "@akkuea/shared";

interface GameEventContextValue {
  events: GameEvent[];
  /** Latest event received, or null if none yet. */
  latest: GameEvent | null;
  connected: boolean;
}

const GameEventContext = createContext<GameEventContextValue>({
  events: [],
  latest: null,
  connected: false,
});

const MAX_BUFFERED = 200;

const VALID_GAME_EVENT_TYPES = new Set<string>([
  "PropertyBought",
  "PropertyListed",
  "PropertyTransferred",
  "RentCollected",
]);

function isValidGameEvent(value: unknown): value is GameEvent {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.type === "string" &&
    VALID_GAME_EVENT_TYPES.has(candidate.type)
  );
}

export function GameEventProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [latest, setLatest] = useState<GameEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);

  const dispatch = useCallback((event: GameEvent) => {
    setLatest(event);
    setEvents((prev) => {
      const next = [...prev, event];
      return next.length > MAX_BUFFERED ? next.slice(-MAX_BUFFERED) : next;
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    let backoff = 1_000;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (!mountedRef.current) return;

      const es = new EventSource("/api/game/events");
      esRef.current = es;

      es.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        backoff = 1_000;
      };

      es.onmessage = (e: MessageEvent<string>) => {
        if (!mountedRef.current) return;
        try {
          const parsed: unknown = JSON.parse(e.data);
          if (!isValidGameEvent(parsed)) return;
          dispatch(parsed);
        } catch {
          // malformed payload - ignore
        }
      };

      es.onerror = () => {
        if (!mountedRef.current) return;
        es.close();
        setConnected(false);
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          timeoutId = null;
          backoff = Math.min(backoff * 2, 60_000);
          connect();
        }, backoff);
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [dispatch]);

  return (
    <GameEventContext.Provider value={{ events, latest, connected }}>
      {children}
    </GameEventContext.Provider>
  );
}

export function useGameEvents(): GameEventContextValue {
  return useContext(GameEventContext);
}
