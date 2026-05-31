import { http, HttpResponse } from "msw";
import {
  mockLendingPools,
  mockDepositPositions,
  mockBorrowPositions,
} from "../fixtures/lending";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const lendingHandlers = [
  /**
   * GET /lending/pools - list all pools
   */
  http.get(`${API_BASE}/lending/pools`, () => {
    return HttpResponse.json(mockLendingPools);
  }),

  /**
   * GET /lending/pools/:id - get single pool
   */
  http.get(`${API_BASE}/lending/pools/:id`, ({ params }) => {
    const pool = mockLendingPools.find((p) => p.id === params.id);
    if (!pool) {
      return HttpResponse.json(
        { code: "POOL_NOT_FOUND", message: "Lending pool not found" },
        { status: 404 },
      );
    }
    return HttpResponse.json(pool);
  }),

  /**
   * POST /lending/pools/:id/deposit
   */
  http.post(
    `${API_BASE}/lending/pools/:poolId/deposit`,
    async ({ request, params }) => {
      const body = (await request.json()) as { amount?: string };
      const amount = body.amount ?? "1000.00";
      const newDeposit = {
        id: crypto.randomUUID(),
        poolId: params.poolId,
        depositor:
          request.headers.get("x-user-address") ||
          "GDEMOUSER1234567890AKKUEA00000000000000000000000000000000",
        amount,
        shares: String(Number(amount) * 0.98),
        depositedAt: new Date().toISOString(),
        lastAccrualAt: new Date().toISOString(),
        accruedInterest: "0.00",
      };
      return HttpResponse.json(newDeposit, { status: 201 });
    },
  ),

  /**
   * POST /lending/pools/:id/borrow
   */
  http.post(
    `${API_BASE}/lending/pools/:poolId/borrow`,
    async ({ request, params }) => {
      const body = (await request.json()) as {
        borrowAmount?: string;
        collateralAmount?: string;
        collateralAsset?: string;
      };
      const newBorrow = {
        id: crypto.randomUUID(),
        poolId: params.poolId,
        borrower:
          request.headers.get("x-user-address") ||
          "GDEMOUSER1234567890AKKUEA00000000000000000000000000000000",
        principal: body.borrowAmount ?? "1000.00",
        accruedInterest: "0.00",
        collateralAmount: body.collateralAmount ?? "1500.00",
        collateralAsset:
          body.collateralAsset ||
          "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        healthFactor: 1.75,
        borrowedAt: new Date().toISOString(),
        lastAccrualAt: new Date().toISOString(),
      };
      return HttpResponse.json(newBorrow, { status: 201 });
    },
  ),

  /**
   * POST /lending/pools/:id/withdraw
   */
  http.post(
    `${API_BASE}/lending/pools/:poolId/withdraw`,
    async ({ request, params }) => {
      const userAddr =
        request.headers.get("x-user-address") ||
        "GDEMOUSER1234567890AKKUEA00000000000000000000000000000000";
      const existing = mockDepositPositions.find(
        (d) => d.poolId === params.poolId && d.depositor === userAddr,
      );
      return HttpResponse.json(existing ?? mockDepositPositions[0]);
    },
  ),

  /**
   * POST /lending/pools/:id/repay
   */
  http.post(
    `${API_BASE}/lending/pools/:poolId/repay`,
    async ({ request, params }) => {
      const userAddr =
        request.headers.get("x-user-address") ||
        "GDEMOUSER1234567890AKKUEA00000000000000000000000000000000";
      const existing = mockBorrowPositions.find(
        (b) => b.poolId === params.poolId && b.borrower === userAddr,
      );
      return HttpResponse.json(existing ?? mockBorrowPositions[0]);
    },
  ),

  /**
   * GET /lending/pools/:id/user/:address/deposits
   */
  http.get(
    `${API_BASE}/lending/pools/:poolId/user/:address/deposits`,
    ({ params }) => {
      const positions = mockDepositPositions.filter(
        (d) => d.poolId === params.poolId,
      );
      return HttpResponse.json(positions);
    },
  ),

  /**
   * GET /lending/pools/:id/user/:address/borrows
   */
  http.get(
    `${API_BASE}/lending/pools/:poolId/user/:address/borrows`,
    ({ params }) => {
      const positions = mockBorrowPositions.filter(
        (b) => b.poolId === params.poolId,
      );
      return HttpResponse.json(positions);
    },
  ),
];
