"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildCycleTimeline,
  type PilotCycleTimeline,
} from "@real-estate-defi/shared";
import type { ConnectionStatus } from "@/hooks/useLiveUpdates";
import {
  fetchPilotCycles,
  fetchPilotHoldings,
  fetchPayoutPaused,
  type PilotEvidenceDetail,
  type PilotHoldings,
} from "@/services/pilot/reads";

/**
 * Data layer for the pilot dashboard.
 *
 * Reads go straight to Soroban RPC. There is no API call, no cache table, and
 * no investor account: the same three hooks serve the ally, the operator, and
 * the investor, because all three are looking at the same contract storage.
 *
 * Refreshes are polled rather than streamed. Soroban RPC has no server-sent
 * event channel, so `connectionStatus` reports "connected" while a poll has
 * recently succeeded and "disconnected" once one has failed, which is what the
 * FreshnessIndicator needs to tell an investor whether a status is current.
 */

/** How often the dashboard re-reads contract state, in milliseconds. */
export const PILOT_POLL_INTERVAL_MS = 30_000;

interface AsyncReadState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
  connectionStatus: ConnectionStatus;
}

function initialState<T>(): AsyncReadState<T> {
  return {
    data: null,
    isLoading: true,
    error: null,
    lastUpdatedAt: null,
    connectionStatus: "connecting",
  };
}

function messageFor(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Could not reach Soroban RPC. Check your connection and try again.";
}

/**
 * Polls a read until unmounted.
 *
 * `enabled` exists so a hook that needs a connected wallet does not fire a read
 * with an empty address and then report the resulting failure as an RPC error.
 */
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
      });
    } catch (error) {
      if (!mountedRef.current) return;
      setState((previous) => ({
        // Keep the last good data on screen and mark it stale, rather than
        // blanking a timeline an investor is reading because one poll failed.
        data: previous.data,
        isLoading: false,
        error: messageFor(error),
        lastUpdatedAt: previous.lastUpdatedAt,
        connectionStatus: "disconnected",
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

/** Shown until the first read lands, so callers never handle a null timeline. */
const EMPTY_TIMELINE: PilotCycleTimeline = {
  entries: [],
  escalated: false,
  consecutiveMissed: 0,
  totalDistributed: BigInt(0),
};

export interface UsePilotCyclesReturn {
  cycles: PilotEvidenceDetail[];
  /** Derived timeline: per-cycle status, escalation flag, total distributed. */
  timeline: PilotCycleTimeline;
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
  connectionStatus: ConnectionStatus;
  refetch: () => void;
}

/**
 * Every cycle from the configured pilot start month to today, with its derived
 * payment status.
 */
export function usePilotCycles(): UsePilotCyclesReturn {
  const read = useCallback(() => fetchPilotCycles(), []);
  const state = usePolledRead(read);

  const cycles = useMemo(() => state.data ?? [], [state.data]);

  // Derived against the instant of the last successful read rather than the
  // clock, so a re-render cannot quietly move a cycle from pending to late
  // without new data behind it.
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
    refetch: state.refetch,
  };
}

export interface UsePilotHoldingsReturn {
  holdings: PilotHoldings | null;
  isLoading: boolean;
  error: string | null;
  lastUpdatedAt: Date | null;
  connectionStatus: ConnectionStatus;
  refetch: () => void;
  /** True when no wallet is connected, so the caller can show that state. */
  isDisconnected: boolean;
}

/** The connected investor's token balance and whitelist standing. */
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
    refetch: state.refetch,
    isDisconnected: !address,
  };
}

/**
 * Whether the payout contract is paused.
 *
 * A paused contract rejects every submission, review, and distribution, so the
 * views disable their actions and say why instead of letting a signature fail.
 */
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
