"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

export interface LiveUpdateOptions<T> {
  endpoint?: string;
  pollingInterval?: number;
  onUpdate?: (data: T) => void;
  enabled?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
}

export interface UseLiveUpdatesReturn<T> {
  connectionStatus: ConnectionStatus;
  lastUpdatedAt: Date | null;
  isPolling: boolean;
  data: T | null;
  refresh: () => void;
  reconnect: () => void;
}

const DEFAULT_POLLING_INTERVAL = 30000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 3;
const DEFAULT_RECONNECT_DELAY = 2000;

export function useLiveUpdates<T>(
  fetchFn: () => Promise<T>,
  options: LiveUpdateOptions<T> = {},
): UseLiveUpdatesReturn<T> {
  const {
    endpoint,
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    onUpdate,
    enabled = true,
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
    reconnectDelay = DEFAULT_RECONNECT_DELAY,
  } = options;

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("disconnected");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [data, setData] = useState<T | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const mountedRef = useRef(true);
  const onUpdateRef = useRef(onUpdate);
  const connectSSERef = useRef<() => void>(() => {});

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const updateData = useCallback((newData: T) => {
    if (!mountedRef.current) return;
    setData(newData);
    setLastUpdatedAt(new Date());
    onUpdateRef.current?.(newData);
  }, []);

  const fetchData = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const result = await fetchFn();
      updateData(result);
    } catch {
      // Silently fail on polling fetch errors
    }
  }, [fetchFn, updateData]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;

    setIsPolling(true);
    setConnectionStatus("connected");
    void fetchData();

    pollingIntervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        void fetchData();
      }
    }, pollingInterval);
  }, [fetchData, pollingInterval]);

  const closeEventSource = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    const connectSSE = () => {
      if (!endpoint || typeof window === "undefined") {
        startPolling();
        return;
      }

      closeEventSource();
      setConnectionStatus("connecting");

      try {
        const eventSource = new EventSource(endpoint);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          if (!mountedRef.current) return;
          setConnectionStatus("connected");
          reconnectAttemptsRef.current = 0;
          stopPolling();
        };

        eventSource.onmessage = (event) => {
          if (!mountedRef.current) return;
          try {
            const parsedData = JSON.parse(event.data) as T;
            updateData(parsedData);
          } catch {
            // Invalid JSON, ignore
          }
        };

        eventSource.onerror = () => {
          if (!mountedRef.current) return;

          closeEventSource();
          setConnectionStatus("disconnected");

          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current += 1;
            setConnectionStatus("connecting");

            reconnectTimeoutRef.current = setTimeout(() => {
              if (mountedRef.current) {
                connectSSERef.current();
              }
            }, reconnectDelay);
          } else {
            startPolling();
          }
        };
      } catch {
        startPolling();
      }
    };

    connectSSERef.current = connectSSE;

    mountedRef.current = true;

    if (enabled) {
      connectSSE();
    }

    return () => {
      mountedRef.current = false;
      closeEventSource();
      stopPolling();

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [
    enabled,
    endpoint,
    closeEventSource,
    stopPolling,
    startPolling,
    updateData,
    maxReconnectAttempts,
    reconnectDelay,
  ]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    stopPolling();
    connectSSERef.current();
  }, [stopPolling]);

  const refresh = useCallback(() => {
    void fetchData();
  }, [fetchData]);

  return {
    connectionStatus,
    lastUpdatedAt,
    isPolling,
    data,
    refresh,
    reconnect,
  };
}

export function getTimeSinceUpdate(lastUpdatedAt: Date | null): string {
  if (!lastUpdatedAt) return "Never";

  const now = new Date();
  const diffMs = now.getTime() - lastUpdatedAt.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}h ago`;
}
