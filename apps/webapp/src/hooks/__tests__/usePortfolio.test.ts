import "@/test/setup-dom";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  createBorrowPosition,
  createDepositPosition,
  createLendingPool,
  createProperty,
} from "@akkuea/shared";
import { lendingApi } from "@/services/api/lending";
import { propertyApi } from "@/services/api/properties";
import { userApi } from "@/services/api/users";
import { usePortfolio } from "../usePortfolio";

const USER_ADDRESS = "GUSER";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("usePortfolio", () => {
  let getPortfolio: ReturnType<typeof spyOn>;
  let getPools: ReturnType<typeof spyOn>;
  let getUserDeposits: ReturnType<typeof spyOn>;
  let getUserBorrows: ReturnType<typeof spyOn>;
  let getById: ReturnType<typeof spyOn>;
  let getAll: ReturnType<typeof spyOn>;

  beforeEach(() => {
    getPortfolio = spyOn(userApi, "getPortfolio");
    getPools = spyOn(lendingApi, "getPools");
    getUserDeposits = spyOn(lendingApi, "getUserDeposits");
    getUserBorrows = spyOn(lendingApi, "getUserBorrows");
    getById = spyOn(propertyApi, "getById");
    getAll = spyOn(propertyApi, "getAll");

    getPortfolio.mockResolvedValue({
      properties: [],
      deposits: [],
      borrows: [],
    });
    getPools.mockResolvedValue([]);
    getUserDeposits.mockResolvedValue([]);
    getUserBorrows.mockResolvedValue([]);
    getById.mockImplementation(async (id: string) => {
      throw new Error(`Unexpected property lookup: ${id}`);
    });
  });

  afterEach(() => {
    cleanup();
    mock.restore();
  });

  it("loads totals, deposit-weighted yield, allocations, and every held property by ID", async () => {
    const properties = Array.from({ length: 101 }, (_, index) =>
      createProperty({
        propertyType: index === 100 ? "industrial" : "residential",
        pricePerShare: "10",
      }),
    );
    const propertyById = new Map(
      properties.map((property) => [property.id, property]),
    );
    const pools = [
      createLendingPool({ supplyAPY: 10 }),
      createLendingPool({ supplyAPY: 20 }),
    ];
    const deposits = [
      createDepositPosition({ amount: "100", accruedInterest: "1" }),
      createDepositPosition({ amount: "300", accruedInterest: "3" }),
    ];
    const borrow = createBorrowPosition({
      principal: "50",
      accruedInterest: "5",
    });

    getPortfolio.mockResolvedValue({
      properties: properties.map((property) => ({
        propertyId: property.id,
        shares: 1,
      })),
      deposits: [],
      borrows: [],
    });
    getPools.mockResolvedValue(pools);
    getById.mockImplementation(async (id: string) => {
      const property = propertyById.get(id);
      if (!property) throw new Error(`Unknown property: ${id}`);
      return property;
    });
    getUserDeposits
      .mockResolvedValueOnce([deposits[0]])
      .mockResolvedValueOnce([deposits[1]]);
    getUserBorrows.mockResolvedValueOnce([borrow]).mockResolvedValueOnce([]);

    const { result } = renderHook(() => usePortfolio(USER_ADDRESS));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.properties).toHaveLength(101);
    expect(result.current.properties[100]?.property.id).toBe(
      properties[100]?.id,
    );
    expect(result.current.summary).toEqual({
      totalValue: 1010,
      totalBorrowed: 55,
      totalDeposited: 404,
      avgYield: 17.5,
      propertyCount: 101,
      allocationByType: {
        residential: 1000,
        industrial: 10,
      },
    });
    expect(getById).toHaveBeenCalledTimes(101);
    expect(getAll).not.toHaveBeenCalled();
    expect(result.current.borrows).toEqual([borrow]);
  });

  it("reports portfolio index failures instead of returning an empty portfolio", async () => {
    getPortfolio.mockRejectedValue(new Error("Portfolio unavailable"));

    const { result } = renderHook(() => usePortfolio(USER_ADDRESS));

    await waitFor(() =>
      expect(result.current.error).toBe("Portfolio unavailable"),
    );
    expect(result.current.isLoading).toBe(false);
  });

  it("reports pool failures instead of returning an empty portfolio", async () => {
    getPools.mockRejectedValue(new Error("Pools unavailable"));

    const { result } = renderHook(() => usePortfolio(USER_ADDRESS));

    await waitFor(() => expect(result.current.error).toBe("Pools unavailable"));
    expect(result.current.isLoading).toBe(false);
  });

  it("reports borrow failures instead of reporting no borrows", async () => {
    getPools.mockResolvedValue([createLendingPool()]);
    getUserBorrows.mockRejectedValue(new Error("Borrows unavailable"));

    const { result } = renderHook(() => usePortfolio(USER_ADDRESS));

    await waitFor(() =>
      expect(result.current.error).toBe("Borrows unavailable"),
    );
    expect(result.current.borrows).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("resets loading and error when the wallet disconnects during a load", async () => {
    const pendingPortfolio =
      deferred<Awaited<ReturnType<typeof userApi.getPortfolio>>>();
    getPortfolio.mockReturnValue(pendingPortfolio.promise);

    const initialProps: { address: string | null } = { address: USER_ADDRESS };
    const { result, rerender } = renderHook(
      ({ address }: { address: string | null }) => usePortfolio(address),
      { initialProps },
    );

    await waitFor(() => expect(getPortfolio).toHaveBeenCalledTimes(1));
    rerender({ address: null });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    await act(async () => {
      pendingPortfolio.resolve({
        properties: [],
        deposits: [],
        borrows: [],
      });
      await pendingPortfolio.promise;
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
