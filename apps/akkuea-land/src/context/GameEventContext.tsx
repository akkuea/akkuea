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
  /** Latest ledger number observed on the stream, or null if none yet. */
  latestLedger: number | null;
  connected: boolean;
  /** True when the stream errored or EventSource is unavailable in this runtime. */
  streamFailed: boolean;
}

const GameEventContext = createContext<GameEventContextValue>({
  events: [],
  latest: null,
  latestLedger: null,
  connected: false,
  streamFailed: false,
});

const HasGameEventProviderContext = createContext(false);

const MAX_BUFFERED = 200;
const VALID_EVENT_TYPES = new Set<string>([
  "PropertyBought",
  "PropertyListed",
  "PropertyTransferred",
  "RentCollected",
]);

function isValidGameEvent(value: unknown): value is GameEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.type === "string" &&
    VALID_EVENT_TYPES.has(candidate.type) &&
    typeof candidate.ledger === "number" &&
    Number.isFinite(candidate.ledger)
  );
}

function extractStreamLedger(value: unknown): number | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.ledger === "number" &&
    Number.isFinite(candidate.ledger) &&
    candidate.ledger > 0
  ) {
    return candidate.ledger;
  }
  if (
    typeof candidate.sequence === "number" &&
    Number.isFinite(candidate.sequence) &&
    candidate.sequence > 0
  ) {
    return candidate.sequence;
  }
  return null;
}

function GameEventStreamBoundary({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [latest, setLatest] = useState<GameEvent | null>(null);
  const [latestLedger, setLatestLedger] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [streamFailed, setStreamFailed] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);

  const dispatch = useCallback((event: GameEvent) => {
    setLatest(event);
    setLatestLedger(event.ledger);
    setEvents((prev) => {
      const next = [...prev, event];
      return next.length > MAX_BUFFERED ? next.slice(-MAX_BUFFERED) : next;
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    let backoff = 1_000;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function clearReconnectTimer() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }

    function connect() {
      if (!mountedRef.current) return;

      if (typeof window === "undefined" || typeof EventSource === "undefined") {
        setConnected(false);
        setStreamFailed(true);
        return;
      }

      let es: EventSource;
      try {
        es = new EventSource("/api/game/events");
      } catch {
        setConnected(false);
        setStreamFailed(true);
        return;
      }

      esRef.current = es;

      es.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        setStreamFailed(false);
        backoff = 1_000;
      };

      es.onmessage = (e: MessageEvent<string>) => {
        if (!mountedRef.current) return;
        try {
          const parsed: unknown = JSON.parse(e.data);
          if (isValidGameEvent(parsed)) {
            dispatch(parsed);
            return;
          }
          const ledger = extractStreamLedger(parsed);
          if (ledger !== null) {
            setLatestLedger(ledger);
          }
        } catch {
          // malformed payload - ignore
        }
      };

      es.onerror = () => {
        if (!mountedRef.current) return;
        es.close();
        if (esRef.current === es) {
          esRef.current = null;
        }
        setConnected(false);
        setStreamFailed(true);
        clearReconnectTimer();
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
      esRef.current = null;
      clearReconnectTimer();
    };
  }, [dispatch]);

  return (
    <HasGameEventProviderContext.Provider value={true}>
      <GameEventContext.Provider
        value={{ events, latest, latestLedger, connected, streamFailed }}
      >
        {children}
      </GameEventContext.Provider>
    </HasGameEventProviderContext.Provider>
  );
}

export function GameEventProvider({ children }: { children: ReactNode }) {
  const hasParentProvider = useContext(HasGameEventProviderContext);
  if (hasParentProvider) {
    return <>{children}</>;
  }
  return <GameEventStreamBoundary>{children}</GameEventStreamBoundary>;
}

export function useGameEvents(): GameEventContextValue {
  return useContext(GameEventContext);
}
