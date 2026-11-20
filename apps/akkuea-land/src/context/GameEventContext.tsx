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
import { TIMEOUTS } from "@/lib/constants";

const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  process.env.STELLAR_RPC_URL ??
  "https://soroban-testnet.stellar.org";
const FALLBACK_POLL_MS = TIMEOUTS.LEDGER_POLL_MS;

interface GameEventContextValue {
  events: GameEvent[];
  /** Latest event received, or null if none yet. */
  latest: GameEvent | null;
  connected: boolean;
  currentLedger: number;
}

const GameEventContext = createContext<GameEventContextValue>({
  events: [],
  latest: null,
  connected: false,
  currentLedger: 0,
});

const MAX_BUFFERED = 200;

export function GameEventProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [latest, setLatest] = useState<GameEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const [currentLedger, setCurrentLedger] = useState(0);
  const esRef = useRef<EventSource | null>(null);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const dispatch = useCallback((event: GameEvent) => {
    setLatest(event);
    if (typeof event.ledger === "number") {
      setCurrentLedger((prev) => Math.max(prev, event.ledger));
    }
    setEvents((prev) => {
      const next = [...prev, event];
      return next.length > MAX_BUFFERED ? next.slice(-MAX_BUFFERED) : next;
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    async function fetchLatestLedger() {
      try {
        const resp = await fetch(SOROBAN_RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getLatestLedger",
          }),
        });
        const data = (await resp.json()) as {
          result?: { sequence?: number };
        };
        const sequence = data?.result?.sequence;
        if (mountedRef.current && typeof sequence === "number") {
          setCurrentLedger((prev) => Math.max(prev, sequence));
        }
      } catch {
        /* keep current value */
      }
    }

    function startPolling() {
      if (intervalRef.current) return;
      void fetchLatestLedger();
      intervalRef.current = setInterval(fetchLatestLedger, FALLBACK_POLL_MS);
    }

    function stopPolling() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    let backoff = 1_000;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (!mountedRef.current) return;
      if (typeof window === "undefined") {
        startPolling();
        return;
      }

      try {
        const es = new EventSource("/api/game/events");
        esRef.current = es;

        es.onopen = () => {
          if (!mountedRef.current) return;
          setConnected(true);
          // Keep ledger polling running regardless of SSE state so currentLedger advances
          backoff = 1_000;
        };

        es.onmessage = (e: MessageEvent<string>) => {
          if (!mountedRef.current) return;
          try {
            const event = JSON.parse(e.data) as GameEvent;
            dispatch(event);
          } catch {
            // malformed payload - ignore
          }
        };

        es.onerror = () => {
          if (!mountedRef.current) return;
          es.close();
          esRef.current = null;
          setConnected(false);
          timeoutId = setTimeout(() => {
            backoff = Math.min(backoff * 2, 60_000);
            connect();
          }, backoff);
        };
      } catch {
        // failed to construct EventSource
      }
    }

    startPolling();
    connect();

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      esRef.current = null;
      stopPolling();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [dispatch]);

  return (
    <GameEventContext.Provider
      value={{ events, latest, connected, currentLedger }}
    >
      {children}
    </GameEventContext.Provider>
  );
}

export function useGameEvents(): GameEventContextValue {
  return useContext(GameEventContext);
}
