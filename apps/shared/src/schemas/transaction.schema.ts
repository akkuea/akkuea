import { z } from "zod";
import {
  stellarAddressSchema,
  isoDateSchema,
  positiveAmountSchema,
  transactionHashSchema,
} from "./common.schema";

/**
 * Transaction type enum
 */
export const transactionTypeSchema = z.enum([
  "deposit",
  "withdraw",
  "borrow",
  "repay",
  "liquidation",
  "buy_shares",
  "sell_shares",
  "dividend",
]);

/**
 * Transaction status enum (includes submitting and not_found for state machine)
 */
export const transactionStatusSchema = z.enum([
  "submitting",
  "pending",
  "confirmed",
  "failed",
  "not_found",
]);

/**
 * Schema for Transaction
 */
export const transactionSchema = z.object({
  id: z.string().uuid(),
  type: transactionTypeSchema,
  hash: transactionHashSchema.optional(),
  from: stellarAddressSchema,
  to: stellarAddressSchema.optional(),
  amount: positiveAmountSchema,
  asset: z.string(),
  status: transactionStatusSchema,
  timestamp: isoDateSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
  // Stellar reconstruction fields
  ledger: z.number().int().positive().optional(),
  fee: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .optional(),
  memo: z.string().optional(),
});

/**
 * Transaction filter for API queries
 */
export const transactionFilterSchema = z.object({
  type: transactionTypeSchema.optional(),
  status: transactionStatusSchema.optional(),
  from: stellarAddressSchema.optional(),
  to: stellarAddressSchema.optional(),
  asset: z.string().optional(),
  since: isoDateSchema.optional(),
  until: isoDateSchema.optional(),
});

/**
 * Query params with pagination for transaction list APIs
 */
export const transactionQueryParamsSchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(20),
  })
  .merge(transactionFilterSchema);

/**
 * Paginated transaction list response
 */
export const paginatedTransactionResponseSchema = z.object({
  items: z.array(transactionSchema),
  nextCursor: z.string().optional(),
  total: z.number().int().min(0).optional(),
});

// Type inference
export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionFilter = z.infer<typeof transactionFilterSchema>;
export type TransactionQueryParams = z.infer<
  typeof transactionQueryParamsSchema
>;
export type PaginatedTransactionResponse = z.infer<
  typeof paginatedTransactionResponseSchema
>;

export type TransactionInput = z.input<typeof transactionSchema>;
export type TransactionFilterInput = z.input<typeof transactionFilterSchema>;
export type TransactionQueryParamsInput = z.input<
  typeof transactionQueryParamsSchema
>;
