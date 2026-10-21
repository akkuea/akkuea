"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  LendingPool,
  DepositPosition,
  BorrowPosition,
} from "@akkuea/shared";
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
  /** Map of poolId to the user's deposit + borrow positions in that pool */
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
  /** Mark an optimistic snapshot as confirmed - the next refetch will reconcile */
  commitOptimisticUpdate: (snapshotId: string) => void;
  /** Revert the changes one optimistic snapshot made to its own pool */
  rollbackOptimisticUpdate: (snapshotId: string) => void;
  /** Set of pool IDs that currently have a pending (uncommitted) optimistic update */
  pendingPoolIds: Set<string>;
}

/**
 * The state of a single pool captured right before an optimistic update, so a
 * rollback can restore that pool without touching any other pool.
 */
interface OptimisticSnapshot {
  poolId: string;
  /** The pool's position entry before the update; undefined if it had none */
  positionBefore: UserPositions | undefined;
  /** The pool's row in `pools` before the update; undefined if it was not loaded */
  poolBefore: LendingPool | undefined;
}

const SSE_ENDPOINT =
  typeof process !== "undefined"
    ? process.env?.NEXT_PUBLIC_LENDING_SSE_URL
    : undefined;

/** Stellar assets use 7 decimal places; rounding to that hides float noise. */
const AMOUNT_DECIMALS = 7;

let snapshotCounter = 0;

function toNumber(value: string): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toAmount(value: number): string {
  return Number(value.toFixed(AMOUNT_DECIMALS)).toString();
}

function isZero(value: number): boolean {
  return Number(value.toFixed(AMOUNT_DECIMALS)) <= 0;
}

interface Balance {
  principal: number;
  interest: number;
}

/**
 * Deducts `amount` from a list of balances as one aggregate position: the
 * principal of every row is used up first, in row order, and accrued interest
 * is only touched once all principal is gone. The total therefore drops by
 * exactly `amount` (capped at the total), however many rows there are.
 */
function deductFromBalances(balances: Balance[], amount: number): Balance[] {
  let remaining = amount;
  const afterPrincipal = balances.map((balance) => {
    const taken = Math.min(remaining, balance.principal);
    remaining -= taken;
    return { ...balance, principal: balance.principal - taken };
  });
  return afterPrincipal.map((balance) => {
    const taken = Math.min(remaining, balance.interest);
    remaining -= taken;
    return { ...balance, interest: balance.interest - taken };
  });
}

function withdrawFromDeposits(
  deposits: DepositPosition[],
  amount: number,
): DepositPosition[] {
  const next = deductFromBalances(
    deposits.map((d) => ({
      principal: toNumber(d.amount),
      interest: toNumber(d.accruedInterest),
    })),
    amount,
  );

  return deposits.flatMap((deposit, i) => {
    const { principal, interest } = next[i];
    const oldPrincipal = toNumber(deposit.amount);
    const oldInterest = toNumber(deposit.accruedInterest);
    if (principal === oldPrincipal && interest === oldInterest) {
      return [deposit];
    }
    if (isZero(principal) && isZero(interest)) {
      return [];
    }
    // Shares shrink in proportion to the principal that was withdrawn.
    const shares =
      oldPrincipal > 0
        ? toNumber(deposit.shares) * (principal / oldPrincipal)
        : toNumber(deposit.shares);
    return [
      {
        ...deposit,
        amount: toAmount(principal),
        shares: toAmount(shares),
        accruedInterest:
          interest === oldInterest
            ? deposit.accruedInterest
            : toAmount(interest),
      },
    ];
  });
}

function repayBorrows(
  borrows: BorrowPosition[],
  amount: number,
): BorrowPosition[] {
  const next = deductFromBalances(
    borrows.map((b) => ({
      principal: toNumber(b.principal),
      interest: toNumber(b.accruedInterest),
    })),
    amount,
  );

  return borrows.flatMap((borrow, i) => {
    const { principal, interest } = next[i];
    const oldPrincipal = toNumber(borrow.principal);
    const oldInterest = toNumber(borrow.accruedInterest);
    if (principal === oldPrincipal && interest === oldInterest) {
      return [borrow];
    }
    if (isZero(principal) && isZero(interest)) {
      return [];
    }
    return [
      {
        ...borrow,
        principal: toAmount(principal),
        accruedInterest:
          interest === oldInterest
            ? borrow.accruedInterest
            : toAmount(interest),
      },
    ];
  });
}

function applyActionToPosition(
  current: UserPositions,
  action: OptimisticAction,
  poolId: string,
  amount: number,
  pool: LendingPool,
  userAddress: string,
  snapshotId: string,
): UserPositions {
  const now = new Date().toISOString();

  switch (action) {
    case "supply":
      // A new row keeps every existing row and its accrued interest intact;
      // the page sums all rows, so the aggregate grows by exactly `amount`.
      return {
        ...current,
        deposits: [
          ...current.deposits,
          {
            id: `optimistic-deposit-${snapshotId}`,
            poolId,
            depositor: userAddress,
            amount: toAmount(amount),
            shares: toAmount(amount),
            depositedAt: now,
            lastAccrualAt: now,
            accruedInterest: "0",
          },
        ],
      };
    case "borrow":
      return {
        ...current,
        borrows: [
          ...current.borrows,
          {
            id: `optimistic-borrow-${snapshotId}`,
            poolId,
            borrower: userAddress,
            principal: toAmount(amount),
            accruedInterest: "0",
            collateralAmount: toAmount(amount),
            collateralAsset: pool.assetAddress,
            healthFactor: 1.5,
            borrowedAt: now,
            lastAccrualAt: now,
          },
        ],
      };
    case "withdraw":
      return {
        ...current,
        deposits: withdrawFromDeposits(current.deposits, amount),
      };
    case "repay":
      return { ...current, borrows: repayBorrows(current.borrows, amount) };
  }
}

function applyActionToPool(
  pool: LendingPool,
  action: OptimisticAction,
  amount: number,
): LendingPool {
  const liquidity = toNumber(pool.availableLiquidity);
  const totalDeposits = toNumber(pool.totalDeposits);
  const totalBorrows = toNumber(pool.totalBorrows);

  switch (action) {
    case "supply":
      return {
        ...pool,
        availableLiquidity: toAmount(liquidity + amount),
        totalDeposits: toAmount(totalDeposits + amount),
      };
    case "withdraw":
      return {
        ...pool,
        availableLiquidity: toAmount(liquidity - amount),
        totalDeposits: toAmount(totalDeposits - amount),
      };
    case "borrow":
      return {
        ...pool,
        availableLiquidity: toAmount(liquidity - amount),
        totalBorrows: toAmount(totalBorrows + amount),
      };
    case "repay":
      return {
        ...pool,
        availableLiquidity: toAmount(liquidity + amount),
        totalBorrows: toAmount(totalBorrows - amount),
      };
  }
}

/**
 * Replaces `current` with `incoming`, except for pools that still have a
 * pending optimistic update: those keep their current (optimistic) values
 * until the update is committed or rolled back.
 */
function mergePools(
  current: LendingPool[],
  incoming: LendingPool[],
  pending: Set<string>,
): LendingPool[] {
  if (pending.size === 0) return incoming;
  const currentById = new Map(current.map((p) => [p.id, p]));
  return incoming.map((p) =>
    pending.has(p.id) ? (currentById.get(p.id) ?? p) : p,
  );
}

function mergePositions(
  current: Record<string, UserPositions>,
  incoming: Record<string, UserPositions>,
  pending: Set<string>,
): Record<string, UserPositions> {
  if (pending.size === 0) return incoming;
  const merged = { ...incoming };
  for (const poolId of pending) {
    if (current[poolId]) {
      merged[poolId] = current[poolId];
    }
  }
  return merged;
}

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

  /** Outstanding optimistic snapshots, keyed by snapshot ID */
  const snapshotsRef = useRef<Map<string, OptimisticSnapshot>>(new Map());

  /** The pool IDs that still have at least one outstanding snapshot */
  const getPendingPoolIds = useCallback(
    () =>
      new Set(
        Array.from(
          snapshotsRef.current.values(),
          (snapshot) => snapshot.poolId,
        ),
      ),
    [],
  );

  const syncPendingPoolIds = useCallback(() => {
    setPendingPoolIds(getPendingPoolIds());
  }, [getPendingPoolIds]);

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

      // Capture only this pool's state, so a rollback cannot touch other pools.
      snapshotsRef.current.set(snapshotId, {
        poolId,
        positionBefore: userPositions[poolId],
        poolBefore: pools.find((p) => p.id === poolId),
      });

      setUserPositions((prev) => ({
        ...prev,
        [poolId]: applyActionToPosition(
          prev[poolId] ?? { deposits: [], borrows: [] },
          action,
          poolId,
          amount,
          pool,
          userAddress ?? "",
          snapshotId,
        ),
      }));

      setPools((prev) =>
        prev.map((p) =>
          p.id === poolId ? applyActionToPool(p, action, amount) : p,
        ),
      );

      syncPendingPoolIds();

      return snapshotId;
    },
    [userPositions, pools, userAddress, syncPendingPoolIds],
  );

  const commitOptimisticUpdate = useCallback(
    (snapshotId: string) => {
      if (!snapshotsRef.current.delete(snapshotId)) return;
      // Only this snapshot's pool leaves the pending set; other pools with a
      // transaction still in flight stay pending.
      syncPendingPoolIds();
      // Refetch so real data replaces the optimistic values for this pool.
      setFetchKey((k) => k + 1);
    },
    [syncPendingPoolIds],
  );

  const rollbackOptimisticUpdate = useCallback(
    (snapshotId: string) => {
      const snapshot = snapshotsRef.current.get(snapshotId);
      if (!snapshot) return;
      snapshotsRef.current.delete(snapshotId);

      const { poolId, positionBefore, poolBefore } = snapshot;

      // Restore only this pool's entries; every other pool is left as it is.
      setUserPositions((prev) => {
        const next = { ...prev };
        if (positionBefore) {
          next[poolId] = positionBefore;
        } else {
          delete next[poolId];
        }
        return next;
      });

      if (poolBefore) {
        setPools((prev) => prev.map((p) => (p.id === poolId ? poolBefore : p)));
      }

      syncPendingPoolIds();
    },
    [syncPendingPoolIds],
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
        const pending = getPendingPoolIds();
        setPools((prev) => mergePools(prev, updatedPools, pending));
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
        const pendingAfterPools = getPendingPoolIds();
        setPools((prev) => mergePools(prev, fetchedPools, pendingAfterPools));
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
          const fetchedPositions = Object.fromEntries(positionEntries);
          const pendingAfterPositions = getPendingPoolIds();
          setUserPositions((prev) =>
            mergePositions(prev, fetchedPositions, pendingAfterPositions),
          );
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
  }, [userAddress, fetchKey, getPendingPoolIds]);

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
