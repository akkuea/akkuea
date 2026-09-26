"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildCycleTimeline, type PilotCycleTimeline } from "@akkuea/shared";
import { captureErrorSafely } from "@akkuea/shared";
import type { ConnectionStatus } from "@/hooks/useLiveUpdates";
import {
  fetchPilotCycles,
  fetchPilotHoldings,
  fetchPayoutPaused,
  type PilotEvidenceDetail,
  type PilotHoldings,
} from "@/services/pilot/reads";

export const PILOT_POLL_INTERVAL_MS = 30_000;

interface AsyncReadState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
  connectionStatus: ConnectionStatus;
  isStale: boolean;
}

function initialState<T>(): AsyncReadState<T> {
  return {
    data: null,
    isLoading: true,
    error: null,
    lastUpdatedAt: null,
    connectionStatus: "connecting",
    isStale: false,
  };
}

function messageFor(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Could not reach Soroban RPC. Check your connection and try again.";
}

function usePolledRead<T>(
  read: () => Promise<T>,
  { enabled = true, intervalMs = PILOT_POLL_INTERVAL_MS } = {},
): AsyncReadState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncReadState<T>>(initialState<T>());
  const readRef = useRef(read);
  readRef.current = read;

  const load = useCallback(async (mountedRef: { current: boolean }) => {
    try {
      const data = await readRef.current();
      if (!mountedRef.current) return;
      setState({
        data,
        isLoading: false,
        error: null,
        lastUpdatedAt: new Date(),
        connectionStatus: "connected",
        isStale: false,
      });
    } catch (error) {
      if (!mountedRef.current) return;
      captureErrorSafely(error, { context: "pilot-poll-read" });
      setState((previous) => ({
        data: previous.data,
        isLoading: false,
        error: messageFor(error),
        lastUpdatedAt: previous.lastUpdatedAt,
        connectionStatus: "disconnected",
        isStale: previous.data !== null,
      }));
    }
  }, []);

  const [reloadToken, setReloadToken] = useState(0);
  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const mountedRef = { current: true };

    if (!enabled) {
      setState({
        data: null,
        isLoading: false,
        error: null,
        lastUpdatedAt: null,
        connectionStatus: "disconnected",
        isStale: false,
      });
      return () => {
        mountedRef.current = false;
      };
    }

    setState((previous) => ({
      ...previous,
      isLoading: previous.data === null,
    }));
    void load(mountedRef);
    const timer = setInterval(() => void load(mountedRef), intervalMs);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [enabled, intervalMs, load, reloadToken]);

  return { ...state, refetch };
}

const EMPTY_TIMELINE: PilotCycleTimeline = {
  entries: [],
  escalated: false,
  consecutiveMissed: 0,
  totalDistributed: BigInt(0),
};

export interface UsePilotCyclesReturn {
  cycles: PilotEvidenceDetail[];
  timeline: PilotCycleTimeline;
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
  connectionStatus: ConnectionStatus;
  isStale: boolean;
  refetch: () => void;
}

export function usePilotCycles(): UsePilotCyclesReturn {
  const read = useCallback(() => fetchPilotCycles(), []);
  const state = usePolledRead(read);

  const cycles = useMemo(() => state.data ?? [], [state.data]);

  const timeline = useMemo(() => {
    if (!state.lastUpdatedAt) {
      return EMPTY_TIMELINE;
    }
    return buildCycleTimeline(cycles, {
      now: Math.floor(state.lastUpdatedAt.getTime() / 1000),
    });
  }, [cycles, state.lastUpdatedAt]);

  return {
    cycles,
    timeline,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdatedAt: state.lastUpdatedAt,
    connectionStatus: state.connectionStatus,
    isStale: state.isStale,
    refetch: state.refetch,
  };
}

export interface UsePilotHoldingsReturn {
  holdings: PilotHoldings | null;
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
  connectionStatus: ConnectionStatus;
  isStale: boolean;
  refetch: () => void;
  isDisconnected: boolean;
}

export function usePilotHoldings(
  address: string | null | undefined,
): UsePilotHoldingsReturn {
  const read = useCallback(
    () => fetchPilotHoldings(address as string),
    [address],
  );
  const state = usePolledRead(read, { enabled: Boolean(address) });

  return {
    holdings: state.data,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdatedAt: state.lastUpdatedAt,
    connectionStatus: state.connectionStatus,
    isStale: state.isStale,
    refetch: state.refetch,
    isDisconnected: !address,
  };
}

export function usePayoutPaused() {
  const read = useCallback(() => fetchPayoutPaused(), []);
  const state = usePolledRead(read);
  return {
    isPaused: state.data ?? false,
    isLoading: state.isLoading,
    error: state.error,
    refetch: state.refetch,
  };
}
