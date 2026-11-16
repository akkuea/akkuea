import { z } from 'zod';
import { stellarAddressSchema, positiveAmountSchema } from '@akkuea/shared';

/**
 * Decimal string that allows zero (for rates/factors)
 */
const decimalString = z.string().regex(/^\d+(\.\d+)?$/, 'Must be a decimal string');

/**
 * Accepts either a 56-character Stellar account public key (G...) or a
 * 56-character Soroban token contract ID (C...).
 */
export const sorobanAssetAddressSchema = z
  .string()
  .regex(/^[GC][A-Z2-7]{55}$/, 'Invalid Stellar or Soroban asset address format');

/**
 * 64-character hex Soroban transaction hash
 */
export const txHashSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, 'Transaction hash must be a 64-character hex string');

/**
 * Create lending pool request schema
 */
export const CreatePoolDto = z.object({
  contractPoolId: z.string().trim().min(1).max(128).optional(),
  name: z.string().min(1, 'Pool name is required').max(255),
  asset: z.string().min(1, 'Asset symbol is required').max(20),
  assetAddress: sorobanAssetAddressSchema,
  collateralFactor: decimalString,
  liquidationThreshold: decimalString,
  liquidationPenalty: decimalString,
  closeFactor: decimalString.default('0.50'),
  reserveFactor: z.coerce.number().int().min(0).max(10000).default(1000),
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
  collateralAsset: sorobanAssetAddressSchema,
});

/**
 * Repay request schema
 */
export const RepayDto = z.object({
  amount: positiveAmountSchema,
});

/**
 * Liquidation prepare request schema.
 * Supports camelCase (`debtToCover`) and snake_case (`debt_to_cover`) input keys.
 */
export const LiquidatePrepareDto = z.preprocess(
  (raw) => {
    if (typeof raw !== 'object' || raw === null) {
      return raw;
    }
    const record = raw as Record<string, unknown>;
    return {
      liquidator: record.liquidator ?? record.liquidatorAddress,
      debtToCover: record.debtToCover ?? record.debt_to_cover,
    };
  },
  z.object({
    liquidator: stellarAddressSchema,
    debtToCover: positiveAmountSchema,
  }),
);

/**
 * Confirm transaction request schema
 */
export const ConfirmLendingTxDto = z.object({
  txHash: txHashSchema,
});

/**
 * Confirm liquidation transaction request schema
 */
export const ConfirmLiquidateDto = z.preprocess(
  (raw) => {
    if (typeof raw !== 'object' || raw === null) {
      return raw;
    }
    const record = raw as Record<string, unknown>;
    return {
      txHash: record.txHash,
      liquidator: record.liquidator ?? record.liquidatorAddress,
    };
  },
  z.object({
    txHash: txHashSchema,
    liquidator: stellarAddressSchema.optional(),
  }),
);

export type CreatePoolInput = z.infer<typeof CreatePoolDto>;
export type DepositInput = z.infer<typeof DepositDto>;
export type WithdrawInput = z.infer<typeof WithdrawDto>;
export type BorrowInput = z.infer<typeof BorrowDto>;
export type RepayInput = z.infer<typeof RepayDto>;
export type LiquidatePrepareInput = z.infer<typeof LiquidatePrepareDto>;
export type ConfirmLendingTxInput = z.infer<typeof ConfirmLendingTxDto>;
export type ConfirmLiquidateInput = z.infer<typeof ConfirmLiquidateDto>;
