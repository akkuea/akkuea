import { z } from 'zod';

const stellarAddressRegex = /^G[A-Z2-7]{55}$/;

/**
 * Positive decimal string (for i128 compatibility with Soroban contracts)
 */
const positiveDecimalString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Must be a positive decimal string')
  .refine((val: string) => parseFloat(val) > 0, 'Amount must be greater than 0');

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
  assetAddress: z
    .string()
    .length(56, 'Asset address must be 56 characters')
    .regex(stellarAddressRegex, 'Invalid Stellar address format'),
  collateralFactor: decimalString,
  liquidationThreshold: decimalString,
  liquidationPenalty: decimalString,
  reserveFactor: z.coerce.number().int().nonnegative().default(1000),
});

/**
 * Deposit request schema
 */
export const DepositDto = z.object({
  amount: positiveDecimalString,
});

/**
 * Withdraw request schema
 */
export const WithdrawDto = z.object({
  amount: positiveDecimalString,
});

/**
 * Borrow request schema
 */
export const BorrowDto = z.object({
  borrowAmount: positiveDecimalString,
  collateralAmount: positiveDecimalString,
  collateralAsset: z
    .string()
    .length(56, 'Collateral asset address must be 56 characters')
    .regex(stellarAddressRegex, 'Invalid Stellar address format'),
});

/**
 * Repay request schema
 */
export const RepayDto = z.object({
  amount: positiveDecimalString,
});

export type CreatePoolInput = z.infer<typeof CreatePoolDto>;
export type DepositInput = z.infer<typeof DepositDto>;
export type WithdrawInput = z.infer<typeof WithdrawDto>;
export type BorrowInput = z.infer<typeof BorrowDto>;
export type RepayInput = z.infer<typeof RepayDto>;
