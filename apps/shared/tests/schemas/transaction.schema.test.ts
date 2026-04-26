/// <reference types="bun-types" />
import { describe, it, expect } from "bun:test";
import {
  transactionSchema,
  transactionFilterSchema,
  transactionQueryParamsSchema,
  type TransactionFilter,
} from "../../src/schemas";

const validStellarAddress =
  "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

const validTransaction = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  type: "deposit",
  hash: "a".repeat(64),
  from: validStellarAddress,
  to: validStellarAddress,
  amount: "100.50",
  asset: "USDC",
  status: "confirmed",
  timestamp: "2024-01-15T10:30:00Z",
  metadata: { source: "web" },
};

describe("transactionSchema", () => {
  it("valid transaction parses", () => {
    const result = transactionSchema.safeParse(validTransaction);
    expect(result.success).toBe(true);
  });

  it("rejects non-hex hash", () => {
    const invalid = {
      ...validTransaction,
      hash: "G".repeat(64),
    };
    const result = transactionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      const hashIssue = result.error.issues.find((i) =>
        i.path.includes("hash"),
      );
      expect(hashIssue).toBeDefined();
    }
  });

  it("accepts status submitting", () => {
    const withSubmitting = { ...validTransaction, status: "submitting" };
    const result = transactionSchema.safeParse(withSubmitting);
    expect(result.success).toBe(true);
  });

  it("accepts status not_found", () => {
    const withNotFound = { ...validTransaction, status: "not_found" };
    const result = transactionSchema.safeParse(withNotFound);
    expect(result.success).toBe(true);
  });

  it("parses Stellar fields ledger, fee, memo correctly", () => {
    const withStellar = {
      ...validTransaction,
      ledger: 12345,
      fee: "0.00001",
      memo: "payment-id-001",
    };
    const result = transactionSchema.safeParse(withStellar);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ledger).toBe(12345);
      expect(result.data.fee).toBe("0.00001");
      expect(result.data.memo).toBe("payment-id-001");
    }
  });

  it("accepts valid hex hash (lowercase)", () => {
    const withHexHash = {
      ...validTransaction,
      hash: "abcdef0123456789".repeat(4),
    };
    const result = transactionSchema.safeParse(withHexHash);
    expect(result.success).toBe(true);
  });

  it("accepts valid hex hash (uppercase)", () => {
    const withHexHash = {
      ...validTransaction,
      hash: "ABCDEF0123456789".repeat(4),
    };
    const result = transactionSchema.safeParse(withHexHash);
    expect(result.success).toBe(true);
  });
});

describe("transactionFilterSchema", () => {
  it("filter type compiles and parses valid filter", () => {
    const filter: TransactionFilter = {
      type: "deposit",
      status: "pending",
      asset: "USDC",
    };
    const result = transactionFilterSchema.safeParse(filter);
    expect(result.success).toBe(true);
  });

  it("accepts empty filter", () => {
    const result = transactionFilterSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("transactionQueryParamsSchema", () => {
  it("parses query params with pagination", () => {
    const params = {
      cursor: "cursor-123",
      limit: 10,
      status: "confirmed",
    };
    const result = transactionQueryParamsSchema.safeParse(params);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
      expect(result.data.cursor).toBe("cursor-123");
    }
  });

  it("defaults limit to 20", () => {
    const result = transactionQueryParamsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
    }
  });
});
