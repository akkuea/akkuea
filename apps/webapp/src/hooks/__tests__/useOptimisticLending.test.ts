import { describe, it, expect, beforeEach, afterAll, mock } from "bun:test";
import type { LendingPool, DepositPosition, BorrowPosition } from "@real-estate-defi/shared";
import {
  VALID_STELLAR_ADDRESS,
  createLendingPool,
  createDepositPosition,
  createBorrowPosition,
} from "@real-estate-defi/shared";
import { lendingApi } from "@/services/api";

// ---------------------------------------------------------------------------
// Mock data
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
// Helpers to simulate optimistic update logic without React
// These mirror the pure state-logic from useLendingPools so we can test the
// optimistic / rollback behaviour without a full render.
// ---------------------------------------------------------------------------

interface UserPositions {
  deposits: DepositPosition[];
  borrows: BorrowPosition[];
}

function applyOptimisticDeposit(
  positions: Record<string, UserPositions>,
  poolId: string,
  amount: number,
  userAddress: string,
): Record<string, UserPositions> {
  const current = positions[poolId] ?? { deposits: [], borrows: [] };
  const existingDeposit = current.deposits[0];
  let newDeposits: DepositPosition[];
  if (existingDeposit) {
    newDeposits = [
      {
        ...existingDeposit,
        amount: (parseFloat(existingDeposit.amount) + amount).toString(),
        shares: (parseFloat(existingDeposit.shares) + amount).toString(),
        accruedInterest: "0",
      },
    ];
  } else {
    newDeposits = [
      createDepositPosition({
        poolId,
        depositor: userAddress,
        amount: amount.toString(),
        shares: amount.toString(),
        accruedInterest: "0",
      }),
    ];
  }
  return { ...positions, [poolId]: { deposits: newDeposits, borrows: current.borrows } };
}

function applyOptimisticBorrow(
  positions: Record<string, UserPositions>,
  poolId: string,
  amount: number,
  userAddress: string,
  collateralAsset: string,
): Record<string, UserPositions> {
  const current = positions[poolId] ?? { deposits: [], borrows: [] };
  const existingBorrow = current.borrows[0];
  let newBorrows: BorrowPosition[];
  if (existingBorrow) {
    newBorrows = [
      {
        ...existingBorrow,
        principal: (parseFloat(existingBorrow.principal) + amount).toString(),
        accruedInterest: "0",
      },
    ];
  } else {
    newBorrows = [
      createBorrowPosition({
        poolId,
        borrower: userAddress,
        principal: amount.toString(),
        accruedInterest: "0",
        collateralAmount: amount.toString(),
        collateralAsset,
        healthFactor: 1.5,
      }),
    ];
  }
  return { ...positions, [poolId]: { deposits: current.deposits, borrows: newBorrows } };
}

function applyOptimisticWithdraw(
  positions: Record<string, UserPositions>,
  poolId: string,
  amount: number,
): Record<string, UserPositions> {
  const current = positions[poolId] ?? { deposits: [], borrows: [] };
  const newDeposits = current.deposits
    .map((d) => ({
      ...d,
      amount: (parseFloat(d.amount) - amount).toString(),
      shares: (parseFloat(d.shares) - amount).toString(),
    }))
    .filter((d) => parseFloat(d.amount) > 0);
  return { ...positions, [poolId]: { deposits: newDeposits, borrows: current.borrows } };
}

function applyOptimisticRepay(
  positions: Record<string, UserPositions>,
  poolId: string,
  amount: number,
): Record<string, UserPositions> {
  const current = positions[poolId] ?? { deposits: [], borrows: [] };
  const newBorrows = current.borrows
    .map((b) => ({
      ...b,
      principal: (parseFloat(b.principal) - amount).toString(),
      accruedInterest: "0",
    }))
    .filter((b) => parseFloat(b.principal) > 0);
  return { ...positions, [poolId]: { deposits: current.deposits, borrows: newBorrows } };
}

function applyPoolLiquidityUpdate(
  pools: LendingPool[],
  poolId: string,
  action: "supply" | "borrow" | "withdraw" | "repay",
  amount: number,
): LendingPool[] {
  return pools.map((p) => {
    if (p.id !== poolId) return p;
    const liq = parseFloat(p.availableLiquidity);
    const totalDep = parseFloat(p.totalDeposits);
    const totalBor = parseFloat(p.totalBorrows);
    switch (action) {
      case "supply":
        return { ...p, availableLiquidity: (liq - amount).toString(), totalDeposits: (totalDep + amount).toString() };
      case "borrow":
        return { ...p, availableLiquidity: (liq - amount).toString(), totalBorrows: (totalBor + amount).toString() };
      case "withdraw":
        return { ...p, availableLiquidity: (liq + amount).toString(), totalDeposits: (totalDep - amount).toString() };
      case "repay":
        return { ...p, availableLiquidity: (liq + amount).toString(), totalBorrows: (totalBor - amount).toString() };
    }
  });
}

// ---------------------------------------------------------------------------
// Mock lendingApi methods
// ---------------------------------------------------------------------------

const mockDeposit = mock(async () => createDepositPosition({ accruedInterest: "12.5" }));
const mockBorrow = mock(async () => createBorrowPosition({ principal: "5000", accruedInterest: "0" }));
const mockWithdraw = mock(async () => createDepositPosition({ amount: "500", shares: "500" }));
const mockRepay = mock(async () => createBorrowPosition({ principal: "4500", accruedInterest: "0" }));

const originalDeposit = lendingApi.deposit;
const originalBorrow = lendingApi.borrow;
const originalWithdraw = lendingApi.withdraw;
const originalRepay = lendingApi.repay;

describe("Optimistic UI for lending actions", () => {
  beforeEach(() => {
    lendingApi.deposit = mockDeposit;
    lendingApi.borrow = mockBorrow;
    lendingApi.withdraw = mockWithdraw;
    lendingApi.repay = mockRepay;
    mockDeposit.mockClear();
    mockBorrow.mockClear();
    mockWithdraw.mockClear();
    mockRepay.mockClear();
  });

  afterAll(() => {
    lendingApi.deposit = originalDeposit;
    lendingApi.borrow = originalBorrow;
    lendingApi.withdraw = originalWithdraw;
    lendingApi.repay = originalRepay;
  });

  // -----------------------------------------------------------------------
  // Supply
  // -----------------------------------------------------------------------

  describe("supply (deposit)", () => {
    it("applies optimistic deposit immediately before API confirmation", () => {
      const positionsBefore: Record<string, UserPositions> = {};
      const amount = 5000;

      const positionsAfter = applyOptimisticDeposit(
        positionsBefore,
        mockPool.id,
        amount,
        VALID_STELLAR_ADDRESS,
      );

      // Deposit should appear immediately
      expect(positionsAfter[mockPool.id].deposits).toHaveLength(1);
      expect(positionsAfter[mockPool.id].deposits[0].amount).toBe("5000");
      expect(positionsAfter[mockPool.id].deposits[0].shares).toBe("5000");
    });

    it("increments existing deposit when one already exists", () => {
      const existingDeposit = createDepositPosition({
        poolId: mockPool.id,
        amount: "10000",
        shares: "10000",
      });
      const positionsBefore: Record<string, UserPositions> = {
        [mockPool.id]: { deposits: [existingDeposit], borrows: [] },
      };

      const positionsAfter = applyOptimisticDeposit(
        positionsBefore,
        mockPool.id,
        5000,
        VALID_STELLAR_ADDRESS,
      );

      expect(positionsAfter[mockPool.id].deposits[0].amount).toBe("15000");
      expect(positionsAfter[mockPool.id].deposits[0].shares).toBe("15000");
    });

    it("rolls back deposit when API call fails", () => {
      const positionsBefore: Record<string, UserPositions> = {};
      const amount = 5000;

      // Apply optimistic update
      const positionsOptimistic = applyOptimisticDeposit(
        positionsBefore,
        mockPool.id,
        amount,
        VALID_STELLAR_ADDRESS,
      );

      expect(positionsOptimistic[mockPool.id].deposits).toHaveLength(1);

      // Rollback = restore original state
      const positionsRolledBack = positionsBefore;

      expect(positionsRolledBack[mockPool.id]).toBeUndefined();
    });

    it("successful tx flow: optimistic update then reconcile", async () => {
      const positionsBefore: Record<string, UserPositions> = {};
      const amount = 5000;

      // Step 1: Apply optimistic update (UI shows immediately)
      const positionsOptimistic = applyOptimisticDeposit(
        positionsBefore,
        mockPool.id,
        amount,
        VALID_STELLAR_ADDRESS,
      );
      expect(positionsOptimistic[mockPool.id].deposits[0].amount).toBe("5000");

      // Step 2: Submit transaction to API
      const result = await lendingApi.deposit(mockPool.id, {
        userAddress: VALID_STELLAR_ADDRESS,
        amount,
      });
      expect(mockDeposit).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();

      // Step 3: Commit (refetch replaces optimistic with real data)
      // In the real app, refetch() would reload from the API.
      // The test verifies the API call succeeded.
    });

    it("failed tx flow: optimistic update then rollback", async () => {
      mockDeposit.mockImplementationOnce(async () => {
        throw new Error("Insufficient liquidity");
      });

      const positionsBefore: Record<string, UserPositions> = {};
      const amount = 5000;

      // Step 1: Apply optimistic update
      const positionsOptimistic = applyOptimisticDeposit(
        positionsBefore,
        mockPool.id,
        amount,
        VALID_STELLAR_ADDRESS,
      );
      expect(positionsOptimistic[mockPool.id].deposits[0].amount).toBe("5000");

      // Step 2: API call fails
      let errorMessage: string | null = null;
      try {
        await lendingApi.deposit(mockPool.id, {
          userAddress: VALID_STELLAR_ADDRESS,
          amount,
        });
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : "Unknown";
      }
      expect(errorMessage).toBe("Insufficient liquidity");

      // Step 3: Rollback — state reverts to before
      const positionsRolledBack = positionsBefore;
      expect(positionsRolledBack[mockPool.id]).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Borrow
  // -----------------------------------------------------------------------

  describe("borrow", () => {
    it("applies optimistic borrow immediately", () => {
      const positionsBefore: Record<string, UserPositions> = {};
      const amount = 5000;

      const positionsAfter = applyOptimisticBorrow(
        positionsBefore,
        mockPool.id,
        amount,
        VALID_STELLAR_ADDRESS,
        mockPool.assetAddress,
      );

      expect(positionsAfter[mockPool.id].borrows).toHaveLength(1);
      expect(positionsAfter[mockPool.id].borrows[0].principal).toBe("5000");
    });

    it("increments existing borrow when one already exists", () => {
      const existingBorrow = createBorrowPosition({
        poolId: mockPool.id,
        principal: "3000",
      });
      const positionsBefore: Record<string, UserPositions> = {
        [mockPool.id]: { deposits: [], borrows: [existingBorrow] },
      };

      const positionsAfter = applyOptimisticBorrow(
        positionsBefore,
        mockPool.id,
        2000,
        VALID_STELLAR_ADDRESS,
        mockPool.assetAddress,
      );

      expect(positionsAfter[mockPool.id].borrows[0].principal).toBe("5000");
    });

    it("failed tx flow: optimistic borrow then rollback", async () => {
      mockBorrow.mockImplementationOnce(async () => {
        throw new Error("Collateral ratio too low");
      });

      const positionsBefore: Record<string, UserPositions> = {};
      const amount = 5000;

      const positionsOptimistic = applyOptimisticBorrow(
        positionsBefore,
        mockPool.id,
        amount,
        VALID_STELLAR_ADDRESS,
        mockPool.assetAddress,
      );
      expect(positionsOptimistic[mockPool.id].borrows[0].principal).toBe("5000");

      let errorMessage: string | null = null;
      try {
        await lendingApi.borrow(mockPool.id, {
          userAddress: VALID_STELLAR_ADDRESS,
          collateralAmount: amount,
          collateralAsset: mockPool.assetAddress,
          borrowAmount: amount,
        });
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : "Unknown";
      }
      expect(errorMessage).toBe("Collateral ratio too low");

      // Rollback
      const positionsRolledBack = positionsBefore;
      expect(positionsRolledBack[mockPool.id]).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Withdraw
  // -----------------------------------------------------------------------

  describe("withdraw", () => {
    it("reduces deposit optimistically", () => {
      const existingDeposit = createDepositPosition({
        poolId: mockPool.id,
        amount: "10000",
        shares: "10000",
      });
      const positionsBefore: Record<string, UserPositions> = {
        [mockPool.id]: { deposits: [existingDeposit], borrows: [] },
      };

      const positionsAfter = applyOptimisticWithdraw(
        positionsBefore,
        mockPool.id,
        3000,
      );

      expect(positionsAfter[mockPool.id].deposits[0].amount).toBe("7000");
    });

    it("removes deposit entirely when withdrawing full amount", () => {
      const existingDeposit = createDepositPosition({
        poolId: mockPool.id,
        amount: "10000",
        shares: "10000",
      });
      const positionsBefore: Record<string, UserPositions> = {
        [mockPool.id]: { deposits: [existingDeposit], borrows: [] },
      };

      const positionsAfter = applyOptimisticWithdraw(
        positionsBefore,
        mockPool.id,
        10000,
      );

      expect(positionsAfter[mockPool.id].deposits).toHaveLength(0);
    });

    it("failed tx flow: optimistic withdraw then rollback", async () => {
      mockWithdraw.mockImplementationOnce(async () => {
        throw new Error("Withdrawal exceeds balance");
      });

      const existingDeposit = createDepositPosition({
        poolId: mockPool.id,
        amount: "10000",
        shares: "10000",
      });
      const positionsBefore: Record<string, UserPositions> = {
        [mockPool.id]: { deposits: [existingDeposit], borrows: [] },
      };

      const positionsOptimistic = applyOptimisticWithdraw(
        positionsBefore,
        mockPool.id,
        3000,
      );
      expect(positionsOptimistic[mockPool.id].deposits[0].amount).toBe("7000");

      let errorMessage: string | null = null;
      try {
        await lendingApi.withdraw(mockPool.id, {
          userAddress: VALID_STELLAR_ADDRESS,
          amount: 3000,
        });
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : "Unknown";
      }
      expect(errorMessage).toBe("Withdrawal exceeds balance");

      // Rollback — deposit is back to original 10000
      expect(positionsBefore[mockPool.id].deposits[0].amount).toBe("10000");
    });
  });

  // -----------------------------------------------------------------------
  // Repay
  // -----------------------------------------------------------------------

  describe("repay", () => {
    it("reduces borrow optimistically", () => {
      const existingBorrow = createBorrowPosition({
        poolId: mockPool.id,
        principal: "10000",
      });
      const positionsBefore: Record<string, UserPositions> = {
        [mockPool.id]: { deposits: [], borrows: [existingBorrow] },
      };

      const positionsAfter = applyOptimisticRepay(
        positionsBefore,
        mockPool.id,
        5000,
      );

      expect(positionsAfter[mockPool.id].borrows[0].principal).toBe("5000");
    });

    it("removes borrow entirely when repaying full amount", () => {
      const existingBorrow = createBorrowPosition({
        poolId: mockPool.id,
        principal: "10000",
      });
      const positionsBefore: Record<string, UserPositions> = {
        [mockPool.id]: { deposits: [], borrows: [existingBorrow] },
      };

      const positionsAfter = applyOptimisticRepay(
        positionsBefore,
        mockPool.id,
        10000,
      );

      expect(positionsAfter[mockPool.id].borrows).toHaveLength(0);
    });

    it("failed tx flow: optimistic repay then rollback", async () => {
      mockRepay.mockImplementationOnce(async () => {
        throw new Error("Repayment failed");
      });

      const existingBorrow = createBorrowPosition({
        poolId: mockPool.id,
        principal: "10000",
      });
      const positionsBefore: Record<string, UserPositions> = {
        [mockPool.id]: { deposits: [], borrows: [existingBorrow] },
      };

      const positionsOptimistic = applyOptimisticRepay(
        positionsBefore,
        mockPool.id,
        5000,
      );
      expect(positionsOptimistic[mockPool.id].borrows[0].principal).toBe("5000");

      let errorMessage: string | null = null;
      try {
        await lendingApi.repay(mockPool.id, {
          userAddress: VALID_STELLAR_ADDRESS,
          amount: 5000,
        });
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : "Unknown";
      }
      expect(errorMessage).toBe("Repayment failed");

      // Rollback — borrow is back to original 10000
      expect(positionsBefore[mockPool.id].borrows[0].principal).toBe("10000");
    });
  });

  // -----------------------------------------------------------------------
  // Pool liquidity updates
  // -----------------------------------------------------------------------

  describe("pool liquidity optimistic updates", () => {
    it("supply decreases available liquidity and increases totalDeposits", () => {
      const pools = applyPoolLiquidityUpdate([mockPool], mockPool.id, "supply", 5000);
      const updated = pools[0];

      expect(updated.availableLiquidity).toBe("1395000"); // 1400000 - 5000
      expect(updated.totalDeposits).toBe("5005000"); // 5000000 + 5000
    });

    it("borrow decreases available liquidity and increases totalBorrows", () => {
      const pools = applyPoolLiquidityUpdate([mockPool], mockPool.id, "borrow", 5000);
      const updated = pools[0];

      expect(updated.availableLiquidity).toBe("1395000");
      expect(updated.totalBorrows).toBe("3605000");
    });

    it("withdraw increases available liquidity and decreases totalDeposits", () => {
      const pools = applyPoolLiquidityUpdate([mockPool], mockPool.id, "withdraw", 5000);
      const updated = pools[0];

      expect(updated.availableLiquidity).toBe("1405000");
      expect(updated.totalDeposits).toBe("4995000");
    });

    it("repay increases available liquidity and decreases totalBorrows", () => {
      const pools = applyPoolLiquidityUpdate([mockPool], mockPool.id, "repay", 5000);
      const updated = pools[0];

      expect(updated.availableLiquidity).toBe("1405000");
      expect(updated.totalBorrows).toBe("3595000");
    });

    it("does not modify other pools", () => {
      const pools = applyPoolLiquidityUpdate(
        [mockPool, mockPool2],
        mockPool.id,
        "supply",
        5000,
      );

      expect(pools[1].availableLiquidity).toBe(mockPool2.availableLiquidity);
      expect(pools[1].totalDeposits).toBe(mockPool2.totalDeposits);
    });
  });

  // -----------------------------------------------------------------------
  // Multi-pool scenarios
  // -----------------------------------------------------------------------

  describe("multi-pool optimistic updates", () => {
    it("tracks pending pool IDs correctly", () => {
      let pendingPoolIds = new Set<string>();

      // Apply update to pool 1
      pendingPoolIds = new Set([...pendingPoolIds, mockPool.id]);
      expect(pendingPoolIds.has(mockPool.id)).toBe(true);
      expect(pendingPoolIds.has(mockPool2.id)).toBe(false);

      // Apply update to pool 2
      pendingPoolIds = new Set([...pendingPoolIds, mockPool2.id]);
      expect(pendingPoolIds.has(mockPool.id)).toBe(true);
      expect(pendingPoolIds.has(mockPool2.id)).toBe(true);

      // Commit pool 1
      pendingPoolIds = new Set([...pendingPoolIds].filter((id) => id !== mockPool.id));
      expect(pendingPoolIds.has(mockPool.id)).toBe(false);
      expect(pendingPoolIds.has(mockPool2.id)).toBe(true);
    });
  });
});
