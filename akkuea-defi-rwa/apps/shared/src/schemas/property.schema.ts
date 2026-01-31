import { z } from "zod";
import {
  stellarAddressSchema,
  positiveAmountSchema,
  isoDateSchema,
} from "./common.schema";

/**
 * Schema for property location
 */
export const propertyLocationSchema = z.object({
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"),
  postalCode: z.string().optional(),
  coordinates: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
});

/**
 * Schema for property document
 */
export const propertyDocumentSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["deed", "appraisal", "inspection", "insurance", "other"]),
  name: z.string().min(1),
  url: z.string().url(),
  uploadedAt: isoDateSchema,
  verified: z.boolean(),
});

/**
 * Schema for PropertyInfo
 */
export const propertyInfoSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Property name is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  propertyType: z.enum([
    "residential",
    "commercial",
    "industrial",
    "land",
    "mixed",
  ]),
  location: propertyLocationSchema,
  totalValue: positiveAmountSchema,
  tokenAddress: stellarAddressSchema.optional(),
  totalShares: z.number().int().positive(),
  availableShares: z.number().int().min(0),
  pricePerShare: positiveAmountSchema,
  images: z.array(z.string().url()).min(1, "At least one image required"),
  documents: z.array(propertyDocumentSchema),
  verified: z.boolean(),
  listedAt: isoDateSchema,
  owner: stellarAddressSchema,
});

/**
 * Schema for ShareOwnership
 */
export const shareOwnershipSchema = z.object({
  propertyId: z.string().uuid(),
  owner: stellarAddressSchema,
  shares: z.number().int().positive(),
  purchasePrice: positiveAmountSchema,
  purchasedAt: isoDateSchema,
  lastDividendClaimed: isoDateSchema.optional(),
});

/**
 * Type inference from schemas - Single source of truth
 */
export type PropertyLocation = z.infer<typeof propertyLocationSchema>;
export type PropertyDocument = z.infer<typeof propertyDocumentSchema>;
export type PropertyInfo = z.infer<typeof propertyInfoSchema>;
export type ShareOwnership = z.infer<typeof shareOwnershipSchema>;

// Keep input/output types for advanced use cases
export type PropertyInfoInput = z.input<typeof propertyInfoSchema>;
export type PropertyInfoOutput = z.output<typeof propertyInfoSchema>;
export type ShareOwnershipInput = z.input<typeof shareOwnershipSchema>;
