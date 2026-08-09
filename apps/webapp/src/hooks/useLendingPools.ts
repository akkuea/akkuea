"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

export interface UseLendingPoolsOptions {
  enableLiveUpdates?: boolean;
  pollingInterval?: number;
}

export type OptimisticAction = "supply" | "borrow" | "withdraw" | "repay";

export interface UseLendingPoolsReturn {
  /** All available lending pools from the API */
  pools: LendingPool[];
  /** Map of poolId → user's deposit + borrow positions in that pool */
  userPositions: Record<string, UserPositions>;
  /** True while the initial pools fetch or position fetch is in-flight */
  isLoading: boolean;
  /** Non-null when any fetch has failed */
  error: string | null;
  /** Re-trigger a full reload (pools + positions) */
  refetch: () => void;
  /** Current connection status for live updates */
  connectionStatus: ConnectionStatus;
  /** Last time the data was updated */
  lastUpdatedAt: Date | null;
  /** Whether currently using fallback polling */
  isPolling: boolean;
  /**
   * Apply an optimistic update to the UI immediately, before the on-chain tx
   * confirms. Returns a snapshot ID that can be used to commit or rollback.
   */
  applyOptimisticUpdate: (
    action: OptimisticAction,
    poolId: string,
    amount: number,
    pool: LendingPool,
  ) => string;
  /** Mark an optimistic snapshot as confirmed — the next refetch will reconcile */
  commitOptimisticUpdate: (snapshotId: string) => void;
  /** Revert all changes from an optimistic snapshot */
  rollbackOptimisticUpdate: (snapshotId: string) => void;
  /** Set of pool IDs that currently have a pending (uncommitted) optimistic update */
  pendingPoolIds: Set<string>;
}

const SSE_ENDPOINT =
  typeof process !== "undefined"
    ? process.env?.NEXT_PUBLIC_LENDING_SSE_URL
    : undefined;

let snapshotCounter = 0;

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchKey, setFetchKey] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [pendingPoolIds, setPendingPoolIds] = useState<Set<string>>(new Set());

  // Snapshot storage: maps snapshotId → { positionsBefore, poolsBefore, poolIds }
  const snapshotsRef = useRef<
    Map<
      string,
      {
        positionsBefore: Record<string, UserPositions>;
        poolsBefore: LendingPool[];
        poolIds: Set<string>;
      }
    >
  >(new Map());

  /** Expose a refetch handle so consuming components can trigger a reload */
  const refetch = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  const applyOptimisticUpdate = useCallback(
    (
      action: OptimisticAction,
      poolId: string,
      amount: number,
      pool: LendingPool,
    ): string => {
      const snapshotId = `opt-${++snapshotCounter}`;

      // Store current state for rollback
      const snapshot = {
        positionsBefore: userPositions,
        poolsBefore: pools,
        poolIds: new Set([poolId]),
      };
      snapshotsRef.current.set(snapshotId, snapshot);

      // Apply optimistic position changes
      setUserPositions((prev) => {
        const current = prev[poolId] ?? { deposits: [], borrows: [] };
        let newDeposits = [...current.deposits];
        let newBorrows = [...current.borrows];

        switch (action) {
          case "supply": {
            const existingDeposit = newDeposits[0];
            if (existingDeposit) {
              newDeposits = [
                {
                  ...existingDeposit,
                  amount: (
                    parseFloat(existingDeposit.amount) + amount
                  ).toString(),
                  shares: (
                    parseFloat(existingDeposit.shares) + amount
                  ).toString(),
                  accruedInterest: "0",
                },
              ];
            } else {
              newDeposits = [
                {
                  id: `opt-deposit-${snapshotCounter}`,
                  poolId,
                  depositor: userAddress ?? "",
                  amount: amount.toString(),
                  shares: amount.toString(),
                  depositedAt: new Date().toISOString(),
                  lastAccrualAt: new Date().toISOString(),
                  accruedInterest: "0",
                },
              ];
            }
            break;
          }
          case "borrow": {
            const existingBorrow = newBorrows[0];
            if (existingBorrow) {
              newBorrows = [
                {
                  ...existingBorrow,
                  principal: (
                    parseFloat(existingBorrow.principal) + amount
                  ).toString(),
                  accruedInterest: "0",
                },
              ];
            } else {
              newBorrows = [
                {
                  id: `opt-borrow-${snapshotCounter}`,
                  poolId,
                  borrower: userAddress ?? "",
                  principal: amount.toString(),
                  accruedInterest: "0",
                  collateralAmount: amount.toString(),
                  collateralAsset: pool.assetAddress,
                  healthFactor: 1.5,
                  borrowedAt: new Date().toISOString(),
                  lastAccrualAt: new Date().toISOString(),
                },
              ];
            }
            break;
          }
          case "withdraw": {
            newDeposits = newDeposits
              .map((d) => ({
                ...d,
                amount: (parseFloat(d.amount) - amount).toString(),
                shares: (parseFloat(d.shares) - amount).toString(),
              }))
              .filter((d) => parseFloat(d.amount) > 0);
            break;
          }
          case "repay": {
            newBorrows = newBorrows
              .map((b) => ({
                ...b,
                principal: (parseFloat(b.principal) - amount).toString(),
                accruedInterest: "0",
              }))
              .filter((b) => parseFloat(b.principal) > 0);
            break;
          }
        }

        return {
          ...prev,
          [poolId]: { deposits: newDeposits, borrows: newBorrows },
        };
      });

      // Apply optimistic pool-level changes (liquidity / totals)
      setPools((prev) =>
        prev.map((p) => {
          if (p.id !== poolId) return p;
          const liq = parseFloat(p.availableLiquidity);
          const totalDep = parseFloat(p.totalDeposits);
          const totalBor = parseFloat(p.totalBorrows);

          switch (action) {
            case "supply":
              return {
                ...p,
                availableLiquidity: (liq - amount).toString(),
                totalDeposits: (totalDep + amount).toString(),
              };
            case "borrow":
              return {
                ...p,
                availableLiquidity: (liq - amount).toString(),
                totalBorrows: (totalBor + amount).toString(),
              };
            case "withdraw":
              return {
                ...p,
                availableLiquidity: (liq + amount).toString(),
                totalDeposits: (totalDep - amount).toString(),
              };
            case "repay":
              return {
                ...p,
                availableLiquidity: (liq + amount).toString(),
                totalBorrows: (totalBor - amount).toString(),
              };
          }
        }),
      );

      // Track this pool as pending
      setPendingPoolIds((prev) => {
        const next = new Set(prev);
        next.add(poolId);
        return next;
      });

      return snapshotId;
    },
    [userPositions, pools, userAddress],
  );

  const commitOptimisticUpdate = useCallback((snapshotId: string) => {
    snapshotsRef.current.delete(snapshotId);
    setPendingPoolIds((prev) => {
      const next = new Set(prev);
      // We can't know which poolIds belong to this snapshot after commit,
      // but the refetch that follows will clear them all anyway.
      // Clear all pending IDs since the refetch will reconcile.
      next.clear();
      return next;
    });
    // Trigger a refetch so the real data replaces the optimistic snapshot
    setFetchKey((k) => k + 1);
  }, []);

  const rollbackOptimisticUpdate = useCallback((snapshotId: string) => {
    const snapshot = snapshotsRef.current.get(snapshotId);
    if (!snapshot) return;

    // Restore the state captured before the optimistic update
    setUserPositions(snapshot.positionsBefore);
    setPools(snapshot.poolsBefore);
    setPendingPoolIds((prev) => {
      const next = new Set(prev);
      for (const id of snapshot.poolIds) {
        next.delete(id);
      }
      return next;
    });
    snapshotsRef.current.delete(snapshotId);
  }, []);

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
    isLoading,
    error,
    refetch: refetchWithLive,
    connectionStatus,
    lastUpdatedAt,
    isPolling,
    applyOptimisticUpdate,
    commitOptimisticUpdate,
    rollbackOptimisticUpdate,
    pendingPoolIds,
  };
}
