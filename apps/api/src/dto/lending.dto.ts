import { z } from 'zod';
import { stellarAddressSchema, positiveAmountSchema } from '@akkuea/shared';

/**
 * Decimal string that allows zero (for rates/factors)
 */
const decimalString = z.string().regex(/^\d+(\.\d+)?$/, 'Must be a decimal string');

/**
 * Create lending pool request schema
 */
export const CreatePoolDto = z.object({
  name: z.string().min(1, 'Pool name is required').max(255),
  asset: z.string().min(1, 'Asset symbol is required').max(20),
  assetAddress: stellarAddressSchema,
  collateralFactor: decimalString,
  liquidationThreshold: decimalString,
  liquidationPenalty: decimalString,
  closeFactor: decimalString,
  reserveFactor: z.coerce.number().int().nonnegative().default(1000),
});

/**
 * Deposit request schema
 */
export const DepositDto = z.object({
  amount: positiveAmountSchema,
});

/**
 * Withdraw request schema
 */
export const WithdrawDto = z.object({
  amount: positiveAmountSchema,
});

/**
 * Borrow request schema
 */
export const BorrowDto = z.object({
  borrowAmount: positiveAmountSchema,
  collateralAmount: positiveAmountSchema,
  collateralAsset: stellarAddressSchema,
});

/**
 * Repay request schema
 */
export const RepayDto = z.object({
  amount: positiveAmountSchema,
});

/**
 * Confirmation of a submitted on-chain action
 */
export const ConfirmActionDto = z.object({
  txHash: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'Transaction hash must be a 64-character hex string'),
});

/**
 * Liquidation preparation request
 */
export const LiquidatePrepareDto = z.object({
  liquidator: stellarAddressSchema,
  debtToCover: positiveAmountSchema,
});

export type CreatePoolInput = z.infer<typeof CreatePoolDto>;
export type ConfirmActionInput = z.infer<typeof ConfirmActionDto>;
export type LiquidatePrepareInput = z.infer<typeof LiquidatePrepareDto>;
export type DepositInput = z.infer<typeof DepositDto>;
export type WithdrawInput = z.infer<typeof WithdrawDto>;
export type BorrowInput = z.infer<typeof BorrowDto>;
export type RepayInput = z.infer<typeof RepayDto>;
