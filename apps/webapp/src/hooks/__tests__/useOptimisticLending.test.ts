import "@/test/setup-dom";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

import type {
  BorrowPosition,
  DepositPosition,
  LendingPool,
} from "@akkuea/shared";

import {
  VALID_STELLAR_ADDRESS,
  createBorrowPosition,
  createDepositPosition,
  createLendingPool,
} from "@akkuea/shared";
import { lendingApi } from "@/services/api";
import { useLendingPools, type UserPositions } from "../useLendingPools";

/**
 * These tests drive the real `useLendingPools` hook through `renderHook`.
 * Only the three `lendingApi` reads the hook performs are replaced, so every
 * optimistic, commit and rollback assertion runs against the shipped logic.
 * Live updates are disabled so no polling timer or extra pool fetch runs.
 */

const POOL_A = createLendingPool({
  name: "USDC Stable Pool",
  asset: "USDC",
  totalDeposits: "5000000",
  totalBorrows: "3600000",
  availableLiquidity: "1400000",
});

const POOL_B = createLendingPool({
  name: "XLM Native Pool",
  asset: "XLM",
  totalDeposits: "2000000",
  totalBorrows: "1300000",
  availableLiquidity: "700000",
});

const getPools = mock<() => Promise<LendingPool[]>>();
const getUserDeposits =
  mock<(poolId: string, address: string) => Promise<DepositPosition[]>>();
const getUserBorrows =
  mock<(poolId: string, address: string) => Promise<BorrowPosition[]>>();

const originalGetPools = lendingApi.getPools;
const originalGetUserDeposits = lendingApi.getUserDeposits;
const originalGetUserBorrows = lendingApi.getUserBorrows;

/** Server-side positions per pool, read by the mocked position endpoints. */
let serverPositions: Record<string, UserPositions> = {};

function serverReturns(positions: Record<string, UserPositions>) {
  serverPositions = positions;
}

function totalOf(values: string[]): number {
  return values.reduce((sum, value) => sum + parseFloat(value), 0);
}

function deposited(positions: UserPositions | undefined): number {
  return totalOf((positions?.deposits ?? []).map((d) => d.amount));
}

function depositInterest(positions: UserPositions | undefined): number {
  return totalOf((positions?.deposits ?? []).map((d) => d.accruedInterest));
}

function borrowed(positions: UserPositions | undefined): number {
  return totalOf((positions?.borrows ?? []).map((b) => b.principal));
}

function borrowInterest(positions: UserPositions | undefined): number {
  return totalOf((positions?.borrows ?? []).map((b) => b.accruedInterest));
}

/** Renders the hook for a connected wallet and waits for the first load. */
async function renderLoaded() {
  const hook = renderHook(() =>
    useLendingPools(VALID_STELLAR_ADDRESS, { enableLiveUpdates: false }),
  );
  await waitFor(() => {
    expect(hook.result.current.isLoading).toBe(false);
    expect(hook.result.current.pools).toHaveLength(2);
  });
  return hook;
}

function poolIn(pools: LendingPool[], id: string): LendingPool {
  const pool = pools.find((p) => p.id === id);
  if (!pool) throw new Error(`pool ${id} is not loaded`);
  return pool;
}

beforeEach(() => {
  getPools.mockReset();
  getUserDeposits.mockReset();
  getUserBorrows.mockReset();

  getPools.mockImplementation(async () => [POOL_A, POOL_B]);
  getUserDeposits.mockImplementation(
    async (poolId) => serverPositions[poolId]?.deposits ?? [],
  );
  getUserBorrows.mockImplementation(
    async (poolId) => serverPositions[poolId]?.borrows ?? [],
  );
  serverPositions = {};

  lendingApi.getPools = getPools;
  lendingApi.getUserDeposits = getUserDeposits;
  lendingApi.getUserBorrows = getUserBorrows;
});

afterEach(() => {
  cleanup();
});

afterAll(() => {
  lendingApi.getPools = originalGetPools;
  lendingApi.getUserDeposits = originalGetUserDeposits;
  lendingApi.getUserBorrows = originalGetUserBorrows;
});

describe("useLendingPools optimistic pool liquidity", () => {
  it("supply of X raises availableLiquidity and totalDeposits by X", async () => {
    const { result } = await renderLoaded();

    act(() => {
      result.current.applyOptimisticUpdate("supply", POOL_A.id, 5000, POOL_A);
    });

    const pool = poolIn(result.current.pools, POOL_A.id);
    expect(pool.availableLiquidity).toBe("1405000");
    expect(pool.totalDeposits).toBe("5005000");
    expect(pool.totalBorrows).toBe(POOL_A.totalBorrows);
  });

  it("withdraw of X lowers availableLiquidity and totalDeposits by X", async () => {
    serverReturns({
      [POOL_A.id]: {
        deposits: [
          createDepositPosition({ poolId: POOL_A.id, amount: "9000" }),
        ],
        borrows: [],
      },
    });
    const { result } = await renderLoaded();

    act(() => {
      result.current.applyOptimisticUpdate("withdraw", POOL_A.id, 5000, POOL_A);
    });

    const pool = poolIn(result.current.pools, POOL_A.id);
    expect(pool.availableLiquidity).toBe("1395000");
    expect(pool.totalDeposits).toBe("4995000");
    expect(pool.totalBorrows).toBe(POOL_A.totalBorrows);
  });

  it("borrow lowers availableLiquidity and raises totalBorrows", async () => {
    const { result } = await renderLoaded();

    act(() => {
      result.current.applyOptimisticUpdate("borrow", POOL_A.id, 5000, POOL_A);
    });

    const pool = poolIn(result.current.pools, POOL_A.id);
    expect(pool.availableLiquidity).toBe("1395000");
    expect(pool.totalBorrows).toBe("3605000");
    expect(pool.totalDeposits).toBe(POOL_A.totalDeposits);
  });

  it("repay raises availableLiquidity and lowers totalBorrows", async () => {
    serverReturns({
      [POOL_A.id]: {
        deposits: [],
        borrows: [
          createBorrowPosition({ poolId: POOL_A.id, principal: "9000" }),
        ],
      },
    });
    const { result } = await renderLoaded();

    act(() => {
      result.current.applyOptimisticUpdate("repay", POOL_A.id, 5000, POOL_A);
    });

    const pool = poolIn(result.current.pools, POOL_A.id);
    expect(pool.availableLiquidity).toBe("1405000");
    expect(pool.totalBorrows).toBe("3595000");
    expect(pool.totalDeposits).toBe(POOL_A.totalDeposits);
  });

  it("leaves every other pool untouched", async () => {
    const { result } = await renderLoaded();

    act(() => {
      result.current.applyOptimisticUpdate("supply", POOL_A.id, 5000, POOL_A);
    });

    expect(poolIn(result.current.pools, POOL_B.id)).toEqual(POOL_B);
  });
});

describe("useLendingPools optimistic positions", () => {
  it("supply adds X to the total and keeps existing rows and their interest", async () => {
    serverReturns({
      [POOL_A.id]: {
        deposits: [
          createDepositPosition({
            poolId: POOL_A.id,
            amount: "200",
            accruedInterest: "12.50",
          }),
          createDepositPosition({
            poolId: POOL_A.id,
            amount: "100",
            accruedInterest: "5",
          }),
        ],
        borrows: [],
      },
    });
    const { result } = await renderLoaded();

    act(() => {
      result.current.applyOptimisticUpdate("supply", POOL_A.id, 50, POOL_A);
    });

    const positions = result.current.userPositions[POOL_A.id];
    expect(positions.deposits).toHaveLength(3);
    expect(deposited(positions)).toBe(350);
    expect(depositInterest(positions)).toBe(17.5);
    expect(positions.deposits[0].accruedInterest).toBe("12.50");
    expect(positions.deposits[1].accruedInterest).toBe("5");
  });

  it("supply creates a position when the user had none", async () => {
    const { result } = await renderLoaded();

    act(() => {
      result.current.applyOptimisticUpdate("supply", POOL_A.id, 5000, POOL_A);
    });

    const [deposit] = result.current.userPositions[POOL_A.id].deposits;
    expect(deposit.amount).toBe("5000");
    expect(deposit.shares).toBe("5000");
    expect(deposit.poolId).toBe(POOL_A.id);
    expect(deposit.depositor).toBe(VALID_STELLAR_ADDRESS);
  });

  it("withdraw of 100 from two rows totalling 300 leaves 200 and keeps interest", async () => {
    serverReturns({
      [POOL_A.id]: {
        deposits: [
          createDepositPosition({
            poolId: POOL_A.id,
            amount: "200",
            shares: "200",
            accruedInterest: "12.50",
          }),
          createDepositPosition({
            poolId: POOL_A.id,
            amount: "100",
            shares: "100",
            accruedInterest: "5",
          }),
        ],
        borrows: [],
      },
    });
    const { result } = await renderLoaded();

    act(() => {
      result.current.applyOptimisticUpdate("withdraw", POOL_A.id, 100, POOL_A);
    });

    const positions = result.current.userPositions[POOL_A.id];
    expect(deposited(positions)).toBe(200);
    expect(depositInterest(positions)).toBe(17.5);
    expect(positions.deposits).toHaveLength(2);
  });

  it("withdraw spanning rows drops a row only once nothing is left in it", async () => {
    serverReturns({
      [POOL_A.id]: {
        deposits: [
          createDepositPosition({
            poolId: POOL_A.id,
            amount: "200",
            accruedInterest: "0",
          }),
          createDepositPosition({
            poolId: POOL_A.id,
            amount: "100",
            accruedInterest: "5",
          }),
        ],
        borrows: [],
      },
    });
    const { result } = await renderLoaded();

    act(() => {
      result.current.applyOptimisticUpdate("withdraw", POOL_A.id, 250, POOL_A);
    });

    const positions = result.current.userPositions[POOL_A.id];
    expect(positions.deposits).toHaveLength(1);
    expect(deposited(positions)).toBe(50);
    expect(depositInterest(positions)).toBe(5);
  });

  it("borrow adds X to the total and keeps existing rows and their interest", async () => {
    serverReturns({
      [POOL_A.id]: {
        deposits: [],
        borrows: [
          createBorrowPosition({
            poolId: POOL_A.id,
            principal: "3000",
            accruedInterest: "8.25",
          }),
        ],
      },
    });
    const { result } = await renderLoaded();

    act(() => {
      result.current.applyOptimisticUpdate("borrow", POOL_A.id, 2000, POOL_A);
    });

    const positions = result.current.userPositions[POOL_A.id];
    expect(positions.borrows).toHaveLength(2);
    expect(borrowed(positions)).toBe(5000);
    expect(borrowInterest(positions)).toBe(8.25);
    expect(positions.borrows[1].collateralAsset).toBe(POOL_A.assetAddress);
  });

  it("repay of 100 from two rows totalling 300 leaves 200 and keeps interest", async () => {
    serverReturns({
      [POOL_A.id]: {
        deposits: [],
        borrows: [
          createBorrowPosition({
            poolId: POOL_A.id,
            principal: "200",
            accruedInterest: "8.25",
          }),
          createBorrowPosition({
            poolId: POOL_A.id,
            principal: "100",
            accruedInterest: "1.75",
          }),
        ],
      },
    });
    const { result } = await renderLoaded();

    act(() => {
      result.current.applyOptimisticUpdate("repay", POOL_A.id, 100, POOL_A);
    });

    const positions = result.current.userPositions[POOL_A.id];
    expect(borrowed(positions)).toBe(200);
    expect(borrowInterest(positions)).toBe(10);
    expect(positions.borrows).toHaveLength(2);
  });

  it("repaying principal and interest in full removes the borrow rows", async () => {
    serverReturns({
      [POOL_A.id]: {
        deposits: [],
        borrows: [
          createBorrowPosition({
            poolId: POOL_A.id,
            principal: "500",
            accruedInterest: "8.25",
          }),
        ],
      },
    });
    const { result } = await renderLoaded();

    act(() => {
      result.current.applyOptimisticUpdate("repay", POOL_A.id, 508.25, POOL_A);
    });

    expect(result.current.userPositions[POOL_A.id].borrows).toHaveLength(0);
  });
});

describe("useLendingPools commit and rollback", () => {
  it("rollback restores the pool's position and values from before the update", async () => {
    const deposit = createDepositPosition({
      poolId: POOL_A.id,
      amount: "9000",
    });
    serverReturns({ [POOL_A.id]: { deposits: [deposit], borrows: [] } });
    const { result } = await renderLoaded();
    const positionsBefore = result.current.userPositions[POOL_A.id];

    let snapshotId = "";
    act(() => {
      snapshotId = result.current.applyOptimisticUpdate(
        "withdraw",
        POOL_A.id,
        5000,
        POOL_A,
      );
    });
    expect(result.current.pendingPoolIds.has(POOL_A.id)).toBe(true);

    act(() => {
      result.current.rollbackOptimisticUpdate(snapshotId);
    });

    expect(result.current.userPositions[POOL_A.id]).toEqual(positionsBefore);
    expect(poolIn(result.current.pools, POOL_A.id)).toEqual(POOL_A);
    expect(result.current.pendingPoolIds.has(POOL_A.id)).toBe(false);
  });

  it("rollback of a pool the user had no position in removes the optimistic entry", async () => {
    const { result } = await renderLoaded();

    let snapshotId = "";
    act(() => {
      snapshotId = result.current.applyOptimisticUpdate(
        "supply",
        POOL_A.id,
        5000,
        POOL_A,
      );
    });
    act(() => {
      result.current.rollbackOptimisticUpdate(snapshotId);
    });

    expect(result.current.userPositions[POOL_A.id]).toEqual({
      deposits: [],
      borrows: [],
    });
  });

  it("rolling back A keeps B's optimistic position, pool values and pending state", async () => {
    const { result } = await renderLoaded();

    let snapshotA = "";
    act(() => {
      snapshotA = result.current.applyOptimisticUpdate(
        "supply",
        POOL_A.id,
        5000,
        POOL_A,
      );
    });
    act(() => {
      result.current.applyOptimisticUpdate("supply", POOL_B.id, 700, POOL_B);
    });
    const poolBOptimistic = poolIn(result.current.pools, POOL_B.id);
    const positionsBOptimistic = result.current.userPositions[POOL_B.id];

    act(() => {
      result.current.rollbackOptimisticUpdate(snapshotA);
    });

    expect(poolIn(result.current.pools, POOL_A.id)).toEqual(POOL_A);
    expect(deposited(result.current.userPositions[POOL_A.id])).toBe(0);
    expect(poolIn(result.current.pools, POOL_B.id)).toEqual(poolBOptimistic);
    expect(poolIn(result.current.pools, POOL_B.id).availableLiquidity).toBe(
      "700700",
    );
    expect(result.current.userPositions[POOL_B.id]).toEqual(
      positionsBOptimistic,
    );
    expect(deposited(result.current.userPositions[POOL_B.id])).toBe(700);
    expect(result.current.pendingPoolIds.has(POOL_A.id)).toBe(false);
    expect(result.current.pendingPoolIds.has(POOL_B.id)).toBe(true);
  });

  it("committing A keeps B pending and B's optimistic values through the refetch", async () => {
    const { result } = await renderLoaded();

    let snapshotA = "";
    act(() => {
      snapshotA = result.current.applyOptimisticUpdate(
        "supply",
        POOL_A.id,
        5000,
        POOL_A,
      );
    });
    act(() => {
      result.current.applyOptimisticUpdate("supply", POOL_B.id, 700, POOL_B);
    });

    // The API now reports A's confirmed deposit; B's tx is still in flight.
    const confirmedA = { ...POOL_A, availableLiquidity: "1405000" };
    getPools.mockImplementation(async () => [confirmedA, POOL_B]);
    serverReturns({
      [POOL_A.id]: {
        deposits: [
          createDepositPosition({ poolId: POOL_A.id, amount: "5000" }),
        ],
        borrows: [],
      },
    });
    const callsBefore = getPools.mock.calls.length;

    act(() => {
      result.current.commitOptimisticUpdate(snapshotA);
    });

    expect(result.current.pendingPoolIds.has(POOL_A.id)).toBe(false);
    expect(result.current.pendingPoolIds.has(POOL_B.id)).toBe(true);

    await waitFor(() => {
      expect(getPools.mock.calls.length).toBeGreaterThan(callsBefore);
      expect(result.current.isLoading).toBe(false);
      expect(
        result.current.userPositions[POOL_A.id].deposits[0].id,
      ).not.toMatch(/^optimistic-/);
    });

    expect(poolIn(result.current.pools, POOL_A.id)).toEqual(confirmedA);
    expect(poolIn(result.current.pools, POOL_B.id).availableLiquidity).toBe(
      "700700",
    );
    expect(deposited(result.current.userPositions[POOL_B.id])).toBe(700);
    expect(result.current.pendingPoolIds.has(POOL_B.id)).toBe(true);
  });

  it("keeps a pool pending until its last outstanding snapshot settles", async () => {
    const { result } = await renderLoaded();

    let first = "";
    let second = "";
    act(() => {
      first = result.current.applyOptimisticUpdate(
        "supply",
        POOL_A.id,
        100,
        POOL_A,
      );
    });
    act(() => {
      second = result.current.applyOptimisticUpdate(
        "borrow",
        POOL_A.id,
        50,
        POOL_A,
      );
    });

    act(() => {
      result.current.commitOptimisticUpdate(first);
    });
    expect(result.current.pendingPoolIds.has(POOL_A.id)).toBe(true);

    act(() => {
      result.current.commitOptimisticUpdate(second);
    });
    expect(result.current.pendingPoolIds.has(POOL_A.id)).toBe(false);
  });

  it("ignores commit and rollback for an unknown snapshot", async () => {
    const { result } = await renderLoaded();

    act(() => {
      result.current.applyOptimisticUpdate("supply", POOL_A.id, 5000, POOL_A);
    });
    const callsBefore = getPools.mock.calls.length;
    const poolsBefore = result.current.pools;

    act(() => {
      result.current.commitOptimisticUpdate("opt-unknown");
      result.current.rollbackOptimisticUpdate("opt-unknown");
    });

    expect(result.current.pools).toBe(poolsBefore);
    expect(result.current.pendingPoolIds.has(POOL_A.id)).toBe(true);
    expect(getPools.mock.calls.length).toBe(callsBefore);
  });
});
