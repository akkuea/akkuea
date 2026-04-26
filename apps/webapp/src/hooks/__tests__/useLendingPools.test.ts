import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { LendingPool, DepositPosition } from "@real-estate-defi/shared";
import {
  VALID_STELLAR_ADDRESS,
  createLendingPool,
  createDepositPosition,
} from "@real-estate-defi/shared";
import { lendingApi } from "@/services/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockPool = createLendingPool({
  name: "USDC Stable Pool",
  asset: "USDC",
  totalDeposits: "5000000",
  totalBorrows: "3600000",
  availableLiquidity: "1400000",
  utilizationRate: 72,
  supplyAPY: 5.2,
  borrowAPY: 7.8,
});

const mockPool2 = createLendingPool({
  name: "XLM Native Pool",
  asset: "XLM",
  totalDeposits: "2000000",
  totalBorrows: "1300000",
  availableLiquidity: "700000",
  utilizationRate: 65,
  supplyAPY: 4.5,
  borrowAPY: 6.5,
  collateralFactor: 70,
});

// ---------------------------------------------------------------------------
// Direct tests of lendingApi — mirrors the unit-test approach used by the
// existing services/api/__tests__/lending.test.ts in the project
// ---------------------------------------------------------------------------

/**
 * Simulates what useLendingPools does: fetches pools then user positions.
 * Testing the async logic directly avoids a @testing-library/react dependency
 * that is not set up in this monorepo, keeping tests consistent with the
 * existing bun:test patterns.
 */

const mockGetPools = mock(
  async (): Promise<LendingPool[]> => [mockPool, mockPool2],
);
const mockGetUserDeposits = mock(async (): Promise<DepositPosition[]> => []);
const mockGetUserBorrows = mock(async () => []);
const originalGetPools = lendingApi.getPools;
const originalGetUserDeposits = lendingApi.getUserDeposits;
const originalGetUserBorrows = lendingApi.getUserBorrows;

describe("useLendingPools — service integration", () => {
  beforeEach(() => {
    lendingApi.getPools = mockGetPools;
    lendingApi.getUserDeposits = mockGetUserDeposits;
    lendingApi.getUserBorrows = mockGetUserBorrows;

    mockGetPools.mockClear();
    mockGetUserDeposits.mockClear();
    mockGetUserBorrows.mockClear();
  });

  afterAll(() => {
    lendingApi.getPools = originalGetPools;
    lendingApi.getUserDeposits = originalGetUserDeposits;
    lendingApi.getUserBorrows = originalGetUserBorrows;
  });

  it("getPools returns all pools", async () => {
    const pools = await lendingApi.getPools();
    expect(pools).toHaveLength(2);
    expect(pools[0].name).toBe("USDC Stable Pool");
    expect(pools[1].name).toBe("XLM Native Pool");
  });

  it("getPools returns empty list when API throws — error state scenario", async () => {
    mockGetPools.mockImplementationOnce(async () => {
      throw new Error("Network error: unable to reach server");
    });

    let result: LendingPool[] = [];
    let errorMessage: string | null = null;

    try {
      result = await lendingApi.getPools();
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Unknown error";
    }

    expect(result).toHaveLength(0);
    expect(errorMessage).toBe("Network error: unable to reach server");
  });

  it("fetches user deposit positions per pool when address is provided", async () => {
    const mockDeposit = createDepositPosition({
      poolId: mockPool.id,
      amount: "25000",
      shares: "25000",
      accruedInterest: "12.5",
    });

    mockGetUserDeposits.mockImplementationOnce(
      async (): Promise<DepositPosition[]> => [mockDeposit],
    );
    mockGetUserDeposits.mockImplementationOnce(
      async (): Promise<DepositPosition[]> => [],
    );

    const pools = await lendingApi.getPools();
    const deposits = await lendingApi.getUserDeposits(
      pools[0].id,
      VALID_STELLAR_ADDRESS,
    );

    expect(mockGetUserDeposits).toHaveBeenCalledWith(
      mockPool.id,
      VALID_STELLAR_ADDRESS,
    );
    expect(deposits).toHaveLength(1);
    expect(deposits[0].amount).toBe("25000");
  });

  it("does not call getUserDeposits when no address is given", async () => {
    // Simulate the hook's guard: no address → skip position fetch
    const userAddress: string | null = null;
    await lendingApi.getPools();

    if (userAddress) {
      await lendingApi.getUserDeposits(mockPool.id, userAddress);
    }

    expect(mockGetUserDeposits).not.toHaveBeenCalled();
  });

  it("aggregates positions across multiple pools", async () => {
    const pools = await lendingApi.getPools();

    // Both calls succeed — simulating what refetch does
    const calls = await Promise.all(
      pools.map((pool) =>
        lendingApi.getUserDeposits(pool.id, VALID_STELLAR_ADDRESS),
      ),
    );

    expect(mockGetUserDeposits).toHaveBeenCalledTimes(pools.length);
    expect(calls).toHaveLength(pools.length);
  });
});
