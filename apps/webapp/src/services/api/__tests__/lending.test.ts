import { describe, it, expect, beforeEach, mock } from "bun:test";
import { lendingApi } from "../lending";
import { setupMockFetch, wrapFetchMock } from "./helpers";
import type {
  BorrowPosition,
  DepositPosition,
  LendingPool,
} from "@real-estate-defi/shared";
import {
  VALID_STELLAR_ADDRESS,
  VALID_UUID,
  createLendingPool,
  createDepositPosition,
  createBorrowPosition,
} from "@real-estate-defi/shared";

describe("Lending API", () => {
  beforeEach(() => {
    global.fetch = wrapFetchMock(
      mock(() => {
        throw new Error("fetch not mocked");
      }),
    );
  });

  describe("getPools", () => {
    it("fetches all lending pools", async () => {
      const mockPools: LendingPool[] = [
        createLendingPool({
          name: "USD Pool",
          asset: "USD",
          totalDeposits: "1000000",
          totalBorrows: "500000",
          availableLiquidity: "500000",
          utilizationRate: 50,
          supplyAPY: 2.5,
          borrowAPY: 5.0,
          collateralFactor: 60,
        }),
        createLendingPool({
          name: "EUR Pool",
          asset: "EUR",
          totalDeposits: "2000000",
          totalBorrows: "1200000",
          availableLiquidity: "800000",
          utilizationRate: 60,
          supplyAPY: 3.1,
          borrowAPY: 6.5,
          collateralFactor: 65,
          liquidationThreshold: 85,
        }),
      ];

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockPools,
      });
      global.fetch = fetchMock;

      const result = await lendingApi.getPools();

      expect(result).toEqual(mockPools);
      expect(calls[0].url).toBe("http://localhost:3001/lending/pools");
      expect(calls[0].options.method).toBe("GET");
    });
  });

  describe("getPool", () => {
    it("fetches pool by ID", async () => {
      const mockPool = createLendingPool({
        name: "USD Pool",
        asset: "USD",
        totalDeposits: "1000000",
        totalBorrows: "500000",
        availableLiquidity: "500000",
        utilizationRate: 50,
        supplyAPY: 2.5,
        borrowAPY: 5.0,
        collateralFactor: 60,
      });

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockPool,
      });
      global.fetch = fetchMock;

      const result = await lendingApi.getPool(VALID_UUID);

      expect(result).toEqual(mockPool);
      expect(calls[0].url).toBe(
        "http://localhost:3001/lending/pools/550e8400-e29b-41d4-a716-446655440001",
      );
      expect(calls[0].options.method).toBe("GET");
    });
  });

  describe("deposit", () => {
    it("deposits into pool", async () => {
      const depositPayload = {
        userAddress: VALID_STELLAR_ADDRESS,
        amount: 1000,
      };

      const mockResponse = createDepositPosition({ accruedInterest: "12.5" });

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await lendingApi.deposit(VALID_UUID, depositPayload);

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe(
        "http://localhost:3001/lending/pools/550e8400-e29b-41d4-a716-446655440001/deposit",
      );
      expect(calls[0].options.method).toBe("POST");
      expect(JSON.parse(calls[0].options.body as string)).toEqual({
        amount: "1000",
      });
      expect(new Headers(calls[0].options.headers).get("x-user-address")).toBe(
        VALID_STELLAR_ADDRESS,
      );
    });
  });

  describe("borrow", () => {
    it("borrows from pool", async () => {
      const borrowPayload = {
        userAddress: VALID_STELLAR_ADDRESS,
        collateralAmount: 10000,
        collateralAsset: VALID_STELLAR_ADDRESS,
        borrowAmount: 5000,
      };

      const mockResponse = createBorrowPosition({
        principal: "5000",
        accruedInterest: "0",
        collateralAmount: "10000",
      });

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await lendingApi.borrow(VALID_UUID, borrowPayload);

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe(
        "http://localhost:3001/lending/pools/550e8400-e29b-41d4-a716-446655440001/borrow",
      );
      expect(calls[0].options.method).toBe("POST");
      expect(JSON.parse(calls[0].options.body as string)).toEqual({
        borrowAmount: "5000",
        collateralAmount: "10000",
        collateralAsset: VALID_STELLAR_ADDRESS,
      });
      expect(new Headers(calls[0].options.headers).get("x-user-address")).toBe(
        VALID_STELLAR_ADDRESS,
      );
    });
  });

  describe("withdraw", () => {
    it("withdraws from pool", async () => {
      const mockResponse = createDepositPosition({
        amount: "500",
        shares: "500",
        accruedInterest: "12.5",
      });

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await lendingApi.withdraw(VALID_UUID, {
        userAddress: VALID_STELLAR_ADDRESS,
        amount: 500,
      });

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe(
        "http://localhost:3001/lending/pools/550e8400-e29b-41d4-a716-446655440001/withdraw",
      );
      expect(JSON.parse(calls[0].options.body as string)).toEqual({
        amount: "500",
      });
      expect(new Headers(calls[0].options.headers).get("x-user-address")).toBe(
        VALID_STELLAR_ADDRESS,
      );
    });
  });

  describe("repay", () => {
    it("repays a borrow position", async () => {
      const mockResponse = createBorrowPosition({
        principal: "4500",
        accruedInterest: "10",
        collateralAmount: "9000",
        healthFactor: 1.9,
      });

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await lendingApi.repay(VALID_UUID, {
        userAddress: VALID_STELLAR_ADDRESS,
        amount: 500,
      });

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe(
        "http://localhost:3001/lending/pools/550e8400-e29b-41d4-a716-446655440001/repay",
      );
      expect(JSON.parse(calls[0].options.body as string)).toEqual({
        amount: "500",
      });
      expect(new Headers(calls[0].options.headers).get("x-user-address")).toBe(
        VALID_STELLAR_ADDRESS,
      );
    });
  });

  describe("getUserDeposits", () => {
    it("gets user deposit positions", async () => {
      const mockDeposits: DepositPosition[] = [
        createDepositPosition({ accruedInterest: "5.2" }),
        createDepositPosition({
          amount: "2000",
          shares: "2000",
          accruedInterest: "8.1",
        }),
      ];

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockDeposits,
      });
      global.fetch = fetchMock;

      const result = await lendingApi.getUserDeposits(
        VALID_UUID,
        VALID_STELLAR_ADDRESS,
      );

      expect(result).toEqual(mockDeposits);
      expect(calls[0].url).toBe(
        `http://localhost:3001/lending/pools/550e8400-e29b-41d4-a716-446655440001/user/${VALID_STELLAR_ADDRESS}/deposits`,
      );
      expect(calls[0].options.method).toBe("GET");
    });
  });

  describe("getUserBorrows", () => {
    it("gets user borrow positions", async () => {
      const mockBorrows: BorrowPosition[] = [
        createBorrowPosition({
          principal: "5000",
          accruedInterest: "21",
          collateralAmount: "10000",
          healthFactor: 1.75,
        }),
      ];

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockBorrows,
      });
      global.fetch = fetchMock;

      const result = await lendingApi.getUserBorrows(
        VALID_UUID,
        VALID_STELLAR_ADDRESS,
      );

      expect(result).toEqual(mockBorrows);
      expect(calls[0].url).toBe(
        `http://localhost:3001/lending/pools/550e8400-e29b-41d4-a716-446655440001/user/${VALID_STELLAR_ADDRESS}/borrows`,
      );
      expect(calls[0].options.method).toBe("GET");
    });
  });
});
