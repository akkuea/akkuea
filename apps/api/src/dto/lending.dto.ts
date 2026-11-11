import { z } from 'zod';
import { stellarAddressSchema, positiveAmountSchema, isStellarContractId } from '@akkuea/shared';

/**
 * Decimal string that allows zero (for rates/factors)
 */
const decimalString = z.string().regex(/^\d+(\.\d+)?$/, 'Must be a decimal string');

/**
 * Soroban token contract address (C...). Pool assets and collateral are token
 * contracts on-chain, so an account address (G...) is rejected here instead of
 * failing inside the contract.
 */
const tokenContractSchema = z
  .string()
  .refine((value: string) => isStellarContractId(value), 'Must be a Soroban contract address');

/** Hex hash of a submitted Stellar transaction. */
const txHashSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, 'Transaction hash must be a 64-character hex string');

/**
 * Create lending pool request schema. Factors are fractions ("0.75" = 75%).
 * `contractPoolId` is the pool id used on-chain; a random id is used when it
 * is omitted.
 */
export const CreatePoolDto = z.object({
  name: z.string().min(1, 'Pool name is required').max(255),
  asset: z.string().min(1, 'Asset symbol is required').max(20),
  assetAddress: tokenContractSchema,
  collateralFactor: decimalString,
  liquidationThreshold: decimalString,
  liquidationPenalty: decimalString,
  closeFactor: decimalString.default('0.5'),
  reserveFactor: z.coerce.number().int().min(0).max(10_000).default(1000),
  contractPoolId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/, 'Use 1 to 64 letters, digits, dashes or underscores')
    .optional(),
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
  collateralAsset: tokenContractSchema,
});

/**
 * Repay request schema
 */
export const RepayDto = z.object({
  amount: positiveAmountSchema,
});

/**
 * Confirm request schema for a submitted lending transaction
 */
export const ConfirmLendingDto = z.object({
  txHash: txHashSchema,
});

/**
 * Liquidation prepare request schema: the liquidator signs and repays
 * `debtToCover` of the borrower's debt.
 */
export const PrepareLiquidationDto = z.object({
  liquidator: stellarAddressSchema,
  debtToCover: positiveAmountSchema,
});

/**
 * Liquidation confirm request schema
 */
export const ConfirmLiquidationDto = z.object({
  txHash: txHashSchema,
  liquidator: stellarAddressSchema,
});

export type CreatePoolInput = z.infer<typeof CreatePoolDto>;
export type DepositInput = z.infer<typeof DepositDto>;
export type WithdrawInput = z.infer<typeof WithdrawDto>;
export type BorrowInput = z.infer<typeof BorrowDto>;
export type RepayInput = z.infer<typeof RepayDto>;
export type ConfirmLendingInput = z.infer<typeof ConfirmLendingDto>;
export type PrepareLiquidationInput = z.infer<typeof PrepareLiquidationDto>;
export type ConfirmLiquidationInput = z.infer<typeof ConfirmLiquidationDto>;
