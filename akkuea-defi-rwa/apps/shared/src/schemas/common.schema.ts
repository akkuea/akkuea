import { z } from "zod";

/**
 * Schema for Stellar public address validation
 */
export const stellarAddressSchema = z
  .string()
  .length(56)
  .regex(/^G[A-Z2-7]{55}$/, "Invalid Stellar address format");

/**
 * Schema for positive decimal amounts
 */
export const positiveAmountSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Must be a valid positive number")
  .refine((val) => parseFloat(val) > 0, "Amount must be greater than 0");

/**
 * Schema for non-negative decimal amounts (allows zero)
 */
export const nonNegativeAmountSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Must be a valid number")
  .refine((val) => parseFloat(val) >= 0, "Amount cannot be negative");

/**
 * Schema for percentage values (0-100)
 */
export const percentageSchema = z
  .number()
  .min(0, "Percentage cannot be negative")
  .max(100, "Percentage cannot exceed 100");

/**
 * Schema for basis points (0-10000)
 */
export const basisPointsSchema = z.number().int().min(0).max(10000);

/**
 * Schema for ISO date strings
 */
export const isoDateSchema = z.string().datetime();

/**
 * Schema for Unix timestamps
 */
export const unixTimestampSchema = z.number().int().positive();

/**
 * Schema for transaction hash
 */
export const transactionHashSchema = z
  .string()
  .length(64)
  .regex(/^[a-f0-9]{64}$/i, "Invalid transaction hash");
