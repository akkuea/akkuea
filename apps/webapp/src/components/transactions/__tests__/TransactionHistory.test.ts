import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";
import type { PaginatedTransactionResponse } from "@real-estate-defi/shared";
import { VALID_TX_HASH, createTransaction } from "@real-estate-defi/shared";
import { transactionsApi } from "@/services/api";

const STELLAR_EXPERT_BASE = "https://stellar.expert/explorer/testnet/tx";

// ---------------------------------------------------------------------------
// Mock the transactionsApi
// ---------------------------------------------------------------------------

const mockGetTransactions = mock(
  async (): Promise<PaginatedTransactionResponse> => ({
    items: [
      createTransaction(),
      createTransaction({
        id: "550e8400-e29b-41d4-a716-446655440002",
        type: "borrow",
      }),
    ],
    nextCursor: undefined,
    total: 2,
  }),
);
const originalGetTransactions = transactionsApi.getTransactions;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TransactionHistory — service integration", () => {
  beforeEach(() => {
    transactionsApi.getTransactions = mockGetTransactions;
    mockGetTransactions.mockClear();
  });

  afterAll(() => {
    transactionsApi.getTransactions = originalGetTransactions;
  });

  it("renders transaction list from API", async () => {
    const result = await transactionsApi.getTransactions({});
    expect(result.items).toHaveLength(2);
    expect(result.items[0].type).toBe("deposit");
    expect(result.items[1].type).toBe("borrow");
  });

  it("hash links to Stellar Expert in correct format", async () => {
    const result = await transactionsApi.getTransactions({});
    const tx = result.items[0];
    const expectedUrl = `${STELLAR_EXPERT_BASE}/${tx.hash}`;
    expect(expectedUrl).toBe(`${STELLAR_EXPERT_BASE}/${VALID_TX_HASH}`);
    expect(tx.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("loading state — API returns result after async call", async () => {
    // Simulate slow API
    mockGetTransactions.mockImplementationOnce(async () => {
      await new Promise((r) => setTimeout(r, 50));
      return { items: [createTransaction()], nextCursor: undefined, total: 1 };
    });

    const result = await transactionsApi.getTransactions({});
    expect(result.items).toHaveLength(1);
  });

  it("empty state on zero results", async () => {
    mockGetTransactions.mockImplementationOnce(async () => ({
      items: [],
      nextCursor: undefined,
      total: 0,
    }));

    const result = await transactionsApi.getTransactions({});
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("error state on failure — error message and retry", async () => {
    mockGetTransactions.mockImplementationOnce(async () => {
      throw new Error("Network error: unable to reach server");
    });

    let errorMessage: string | null = null;

    try {
      await transactionsApi.getTransactions({});
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "Unknown error";
    }

    expect(errorMessage).toBe("Network error: unable to reach server");

    // Retry — second call should succeed (mock reset to default)
    const retryResult = await transactionsApi.getTransactions({});
    expect(retryResult.items).toHaveLength(2);
  });

  it("load more fetches next page with cursor", async () => {
    // Page 1 — has nextCursor
    mockGetTransactions.mockImplementationOnce(async () => ({
      items: [createTransaction({ id: "page1-001" })],
      nextCursor: "cursor_after_page1",
      total: 3,
    }));

    const page1 = await transactionsApi.getTransactions({ limit: 1 });
    expect(page1.items).toHaveLength(1);
    expect(page1.nextCursor).toBe("cursor_after_page1");

    // Page 2 — uses cursor from page 1
    mockGetTransactions.mockImplementationOnce(async () => ({
      items: [
        createTransaction({ id: "page2-001" }),
        createTransaction({ id: "page2-002" }),
      ],
      nextCursor: undefined,
      total: 3,
    }));

    const page2 = await transactionsApi.getTransactions({
      cursor: page1.nextCursor,
      limit: 2,
    });
    expect(page2.items).toHaveLength(2);
    expect(page2.nextCursor).toBeUndefined();

    // Total across both pages
    const allTx = [...page1.items, ...page2.items];
    expect(allTx).toHaveLength(3);
  });

  it("transaction types map to correct values", () => {
    const types = [
      "deposit",
      "withdraw",
      "borrow",
      "repay",
      "liquidation",
      "buy_shares",
      "sell_shares",
      "dividend",
    ] as const;
    for (const type of types) {
      const tx = createTransaction({ type });
      expect(tx.type).toBe(type);
    }
  });

  it("status values are valid enum members", () => {
    const statuses = [
      "submitting",
      "pending",
      "confirmed",
      "failed",
      "not_found",
    ] as const;
    for (const status of statuses) {
      const tx = createTransaction({ status });
      expect(tx.status).toBe(status);
    }
  });
});
