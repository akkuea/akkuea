"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  LendingPool,
  DepositPosition,
  BorrowPosition,
} from "@real-estate-defi/shared";
import { lendingApi } from "@/services/api";
import { useLiveUpdates, type ConnectionStatus } from "@/hooks/useLiveUpdates";
import { TIMEOUTS } from "@/lib/constants";

export interface UserPositions {
  deposits: DepositPosition[];
  borrows: BorrowPosition[];
}

export type PendingActionType = "supply" | "withdraw" | "borrow" | "repay";

export interface PendingAction {
  poolId: string;
  type: PendingActionType;
  amount: number;
  timestamp: number;
}

export interface UseLendingPoolsOptions {
  enableLiveUpdates?: boolean;
  pollingInterval?: number;
}

export interface UseLendingPoolsReturn {
  pools: LendingPool[];
  userPositions: Record<string, UserPositions>;
  pendingActions: PendingAction[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  addPendingAction: (action: PendingAction) => void;
  removePendingAction: (poolId: string, type: PendingActionType) => void;
  connectionStatus: ConnectionStatus;
  lastUpdatedAt: Date | null;
  isPolling: boolean;
}

const SSE_ENDPOINT =
  typeof process !== "undefined"
    ? process.env?.NEXT_PUBLIC_LENDING_SSE_URL
    : undefined;

/**
 * Fetches all lending pools and the current user's positions in each pool.
 *
 * @param userAddress - Connected wallet address, or null/undefined when disconnected.
 * @param options - Configuration options for live updates.
 */
export function useLendingPools(
  userAddress?: string | null,
  options: UseLendingPoolsOptions = {},
): UseLendingPoolsReturn {
  const {
    enableLiveUpdates = true,
    pollingInterval = TIMEOUTS.LENDING_POLL_MS,
  } = options;

  const [pools, setPools] = useState<LendingPool[]>([]);
  const [userPositions, setUserPositions] = useState<
    Record<string, UserPositions>
  >({});
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  /** Expose a refetch handle so consuming components can trigger a reload */
  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  const addPendingAction = useCallback((action: PendingAction) => {
    setPendingActions((prev) => [...prev, action]);
  }, []);

  const removePendingAction = useCallback(
    (poolId: string, type: PendingActionType) => {
      setPendingActions((prev) =>
        prev.filter((a) => !(a.poolId === poolId && a.type === type)),
      );
    },
    [],
  );

  const fetchPoolsOnly = useCallback(async () => {
    const fetchedPools = await lendingApi.getPools();
    return fetchedPools;
  }, []);

  const { connectionStatus, isPolling, refresh } = useLiveUpdates(
    fetchPoolsOnly,
    {
      endpoint: SSE_ENDPOINT,
      pollingInterval,
      enabled: enableLiveUpdates && !isLoading,
      onUpdate: (updatedPools) => {
        setPools(updatedPools);
        setLastUpdatedAt(new Date());
      },
    },
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Fetch all pools
        const fetchedPools = await lendingApi.getPools();
        if (cancelled) return;
        setPools(fetchedPools);
        setLastUpdatedAt(new Date());

        // 2. If a wallet is connected, fetch user positions for every pool
        if (userAddress) {
          const positionEntries = await Promise.all(
            fetchedPools.map(async (pool) => {
              const [deposits, borrows] = await Promise.all([
                lendingApi
                  .getUserDeposits(pool.id, userAddress)
                  .catch(() => [] as DepositPosition[]),
                lendingApi
                  .getUserBorrows(pool.id, userAddress)
                  .catch(() => [] as BorrowPosition[]),
              ]);
              return [pool.id, { deposits, borrows }] as const;
            }),
          );

          if (cancelled) return;
          setUserPositions(Object.fromEntries(positionEntries));
        } else {
          setUserPositions({});
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load lending pools. Please try again.";
        setError(message);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    const timer = setTimeout(() => {
      void load();
    }, 0);

    return () => {
      clearTimeout(timer);
      cancelled = true;
    };
  }, [userAddress, fetchKey]);

  const refetchWithLive = useCallback(() => {
    refetch();
    refresh();
  }, [refetch, refresh]);

  return {
    pools,
    userPositions,
    pendingActions,
    isLoading,
    error,
    refetch: refetchWithLive,
    addPendingAction,
    removePendingAction,
    connectionStatus,
    lastUpdatedAt,
    isPolling,
  };
}
