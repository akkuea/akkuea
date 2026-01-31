import { z } from "zod";
import {
  stellarAddressSchema,
  positiveAmountSchema,
  nonNegativeAmountSchema,
  basisPointsSchema,
  isoDateSchema,
} from "./common.schema";

/**
 * Schema for LendingPool
 */
export const lendingPoolSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  asset: z.string().min(1),
  assetAddress: stellarAddressSchema,
  totalDeposits: nonNegativeAmountSchema,
  totalBorrows: nonNegativeAmountSchema,
  availableLiquidity: nonNegativeAmountSchema,
  utilizationRate: z.number().min(0).max(100),
  supplyAPY: z.number().min(0),
  borrowAPY: z.number().min(0),
  collateralFactor: z.number().min(0).max(100),
  liquidationThreshold: z.number().min(0).max(100),
  liquidationPenalty: z.number().min(0).max(50),
  reserveFactor: basisPointsSchema,
  isActive: z.boolean(),
  isPaused: z.boolean(),
  createdAt: isoDateSchema,
});

/**
 * Schema for DepositPosition
 */
export const depositPositionSchema = z.object({
  id: z.string().uuid(),
  poolId: z.string().uuid(),
  depositor: stellarAddressSchema,
  amount: positiveAmountSchema,
  shares: positiveAmountSchema,
  depositedAt: isoDateSchema,
  lastAccrualAt: isoDateSchema,
  accruedInterest: nonNegativeAmountSchema,
});

/**
 * Schema for BorrowPosition
 */
export const borrowPositionSchema = z.object({
  id: z.string().uuid(),
  poolId: z.string().uuid(),
  borrower: stellarAddressSchema,
  principal: positiveAmountSchema,
  accruedInterest: nonNegativeAmountSchema,
  collateralAmount: positiveAmountSchema,
  collateralAsset: stellarAddressSchema,
  healthFactor: z.number().positive(),
  borrowedAt: isoDateSchema,
  lastAccrualAt: isoDateSchema,
});

/**
 * Type inference - Single source of truth
 */
export type LendingPool = z.infer<typeof lendingPoolSchema>;
export type DepositPosition = z.infer<typeof depositPositionSchema>;
export type BorrowPosition = z.infer<typeof borrowPositionSchema>;

// Keep input types for advanced use cases
export type LendingPoolInput = z.input<typeof lendingPoolSchema>;
export type DepositPositionInput = z.input<typeof depositPositionSchema>;
export type BorrowPositionInput = z.input<typeof borrowPositionSchema>;
