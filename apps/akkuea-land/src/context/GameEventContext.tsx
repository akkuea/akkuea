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

export interface GameEventContextValue {
  events: GameEvent[];
  /** Latest event received, or null if none yet. */
  latest: GameEvent | null;
  /** Highest ledger sequence observed on the event stream, or 0 before any message. */
  latestLedger: number;
  connected: boolean;
  /** True after an EventSource error or when EventSource is unavailable. */
  streamFailed: boolean;
}

const DEFAULT_CONTEXT_VALUE: GameEventContextValue = {
  events: [],
  latest: null,
  latestLedger: 0,
  connected: false,
  streamFailed: false,
};

const GameEventContext = createContext<GameEventContextValue>(
  DEFAULT_CONTEXT_VALUE,
);
const GameEventProvidedContext = createContext(false);

const MAX_BUFFERED = 200;

export function GameEventProvider({ children }: { children: ReactNode }) {
  const hasParentProvider = useContext(GameEventProvidedContext);
  if (hasParentProvider) {
    return <>{children}</>;
  }
  return <GameEventRootProvider>{children}</GameEventRootProvider>;
}

function GameEventRootProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [latest, setLatest] = useState<GameEvent | null>(null);
  const [latestLedger, setLatestLedger] = useState(0);
  const [connected, setConnected] = useState(false);
  const [streamFailed, setStreamFailed] = useState(
    () => typeof EventSource === "undefined",
  );
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

    function clearReconnectTimer() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }

    function connect() {
      if (!mountedRef.current || typeof EventSource === "undefined") return;

      let es: EventSource;
      try {
        es = new EventSource("/api/game/events");
      } catch {
        queueMicrotask(() => {
          if (mountedRef.current) {
            setConnected(false);
            setStreamFailed(true);
          }
        });
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
          const parsed = JSON.parse(e.data) as Record<string, unknown>;
          if (
            typeof parsed.ledger === "number" &&
            Number.isFinite(parsed.ledger)
          ) {
            const ledger = parsed.ledger;
            setLatestLedger((prev) => Math.max(prev, ledger));
          } else if (
            typeof parsed.sequence === "number" &&
            Number.isFinite(parsed.sequence)
          ) {
            const sequence = parsed.sequence;
            setLatestLedger((prev) => Math.max(prev, sequence));
          }

          if (typeof parsed.type === "string") {
            dispatch(parsed as unknown as GameEvent);
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
    <GameEventProvidedContext.Provider value={true}>
      <GameEventContext.Provider
        value={{ events, latest, latestLedger, connected, streamFailed }}
      >
        {children}
      </GameEventContext.Provider>
    </GameEventProvidedContext.Provider>
  );
}

export function useGameEvents(): GameEventContextValue {
  return useContext(GameEventContext);
}
