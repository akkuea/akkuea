import { z } from "zod";
import {
  stellarAddressSchema,
  isoDateSchema,
  positiveAmountSchema,
} from "./common.schema";

/**
 * KYC status enum
 */
export const kycStatusSchema = z.enum([
  "not_started",
  "pending",
  "approved",
  "rejected",
  "expired",
]);

/**
 * KYC tier enum
 */
export const kycTierSchema = z.enum([
  "none",
  "basic",
  "verified",
  "accredited",
]);

/**
 * Schema for KycDocument
 */
export const kycDocumentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum([
    "passport",
    "national_id",
    "drivers_license",
    "proof_of_address",
    "bank_statement",
    "tax_document",
  ]),
  fileName: z.string().min(1),
  fileUrl: z.string().url(),
  status: z.enum(["pending", "approved", "rejected"]),
  rejectionReason: z.string().optional(),
  uploadedAt: isoDateSchema,
  reviewedAt: isoDateSchema.optional(),
});

/**
 * Schema for User
 */
export const userSchema = z.object({
  id: z.string().uuid(),
  walletAddress: stellarAddressSchema,
  email: z.string().email().optional(),
  displayName: z.string().min(2).max(50).optional(),
  kycStatus: kycStatusSchema,
  kycTier: kycTierSchema,
  kycDocuments: z.array(kycDocumentSchema),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  lastLoginAt: isoDateSchema.optional(),
});

/**
 * Schema for Transaction
 */
export const transactionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    "deposit",
    "withdraw",
    "borrow",
    "repay",
    "liquidation",
    "buy_shares",
    "sell_shares",
    "dividend",
  ]),
  hash: z.string().length(64).optional(),
  from: stellarAddressSchema,
  to: stellarAddressSchema.optional(),
  amount: positiveAmountSchema,
  asset: z.string(),
  status: z.enum(["pending", "confirmed", "failed"]),
  timestamp: isoDateSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for OraclePrice
 */
export const oraclePriceSchema = z.object({
  asset: z.string().min(1),
  assetAddress: stellarAddressSchema,
  priceUSD: positiveAmountSchema,
  timestamp: isoDateSchema,
  source: z.string().min(1),
  confidence: z.number().min(0).max(100),
});

/**
 * Type inference
 */
export type UserInput = z.input<typeof userSchema>;
export type KycDocumentInput = z.input<typeof kycDocumentSchema>;
export type TransactionInput = z.input<typeof transactionSchema>;
export type OraclePriceInput = z.input<typeof oraclePriceSchema>;
