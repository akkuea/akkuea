# C1-001: Add Zod Validation Schemas for All Shared Types

## Detailed Implementation Guide

## Issue Metadata

| Attribute | Value |
|-----------|-------|
| Issue ID | C1-001 |
| Title | Add Zod validation schemas for all shared types |
| Area | SHARED |
| Difficulty | Medium |
| Labels | shared, validation, medium |
| Dependencies | None |
| Estimated Lines | 150-250 |

## Overview

This issue establishes runtime validation for all shared types using Zod. Zod provides TypeScript-first schema validation with automatic type inference, ensuring that runtime data matches compile-time types.

## Prerequisites

Before starting this issue, ensure:

- Familiarity with Zod schema syntax
- Understanding of existing TypeScript types in `apps/shared/src/types/`
- Access to the shared package

## Implementation Steps

### Step 1: Add Zod Dependency

```bash
cd apps/shared
bun add zod
```

Update `package.json`:

```json
{
  "dependencies": {
    "zod": "^3.23.0"
  }
}
```

### Step 2: Create Schema Directory Structure

```
apps/shared/src/
├── schemas/
│   ├── index.ts
│   ├── common.schema.ts
│   ├── property.schema.ts
│   ├── lending.schema.ts
│   └── user.schema.ts
├── types/
└── index.ts
```

### Step 3: Implement Common Schemas

Create `apps/shared/src/schemas/common.schema.ts`:

```typescript
import { z } from 'zod';

/**
 * Schema for Stellar public address validation
 */
export const stellarAddressSchema = z
  .string()
  .length(56)
  .regex(/^G[A-Z2-7]{55}$/, 'Invalid Stellar address format');

/**
 * Schema for positive decimal amounts
 */
export const positiveAmountSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Must be a valid positive number')
  .refine((val) => parseFloat(val) > 0, 'Amount must be greater than 0');

/**
 * Schema for non-negative decimal amounts (allows zero)
 */
export const nonNegativeAmountSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Must be a valid number')
  .refine((val) => parseFloat(val) >= 0, 'Amount cannot be negative');

/**
 * Schema for percentage values (0-100)
 */
export const percentageSchema = z
  .number()
  .min(0, 'Percentage cannot be negative')
  .max(100, 'Percentage cannot exceed 100');

/**
 * Schema for basis points (0-10000)
 */
export const basisPointsSchema = z
  .number()
  .int()
  .min(0)
  .max(10000);

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
  .regex(/^[a-f0-9]{64}$/i, 'Invalid transaction hash');
```

### Step 4: Implement Property Schemas

Create `apps/shared/src/schemas/property.schema.ts`:

```typescript
import { z } from 'zod';
import {
  stellarAddressSchema,
  positiveAmountSchema,
  isoDateSchema,
} from './common.schema';

/**
 * Schema for property location
 */
export const propertyLocationSchema = z.object({
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
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
  type: z.enum(['deed', 'appraisal', 'inspection', 'insurance', 'other']),
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
  name: z.string().min(1, 'Property name is required'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  propertyType: z.enum([
    'residential',
    'commercial',
    'industrial',
    'land',
    'mixed',
  ]),
  location: propertyLocationSchema,
  totalValue: positiveAmountSchema,
  tokenAddress: stellarAddressSchema.optional(),
  totalShares: z.number().int().positive(),
  availableShares: z.number().int().min(0),
  pricePerShare: positiveAmountSchema,
  images: z.array(z.string().url()).min(1, 'At least one image required'),
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
 * Type inference from schemas
 */
export type PropertyInfoInput = z.input<typeof propertyInfoSchema>;
export type PropertyInfoOutput = z.output<typeof propertyInfoSchema>;
export type ShareOwnershipInput = z.input<typeof shareOwnershipSchema>;
```

### Step 5: Implement Lending Schemas

Create `apps/shared/src/schemas/lending.schema.ts`:

```typescript
import { z } from 'zod';
import {
  stellarAddressSchema,
  positiveAmountSchema,
  nonNegativeAmountSchema,
  basisPointsSchema,
  isoDateSchema,
} from './common.schema';

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
 * Type inference
 */
export type LendingPoolInput = z.input<typeof lendingPoolSchema>;
export type DepositPositionInput = z.input<typeof depositPositionSchema>;
export type BorrowPositionInput = z.input<typeof borrowPositionSchema>;
```

### Step 6: Implement User Schemas

Create `apps/shared/src/schemas/user.schema.ts`:

```typescript
import { z } from 'zod';
import { stellarAddressSchema, isoDateSchema } from './common.schema';

/**
 * KYC status enum
 */
export const kycStatusSchema = z.enum([
  'not_started',
  'pending',
  'approved',
  'rejected',
  'expired',
]);

/**
 * KYC tier enum
 */
export const kycTierSchema = z.enum(['none', 'basic', 'verified', 'accredited']);

/**
 * Schema for KycDocument
 */
export const kycDocumentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.enum([
    'passport',
    'national_id',
    'drivers_license',
    'proof_of_address',
    'bank_statement',
    'tax_document',
  ]),
  fileName: z.string().min(1),
  fileUrl: z.string().url(),
  status: z.enum(['pending', 'approved', 'rejected']),
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
    'deposit',
    'withdraw',
    'borrow',
    'repay',
    'liquidation',
    'buy_shares',
    'sell_shares',
    'dividend',
  ]),
  hash: z.string().length(64).optional(),
  from: stellarAddressSchema,
  to: stellarAddressSchema.optional(),
  amount: positiveAmountSchema,
  asset: z.string(),
  status: z.enum(['pending', 'confirmed', 'failed']),
  timestamp: isoDateSchema,
  metadata: z.record(z.unknown()).optional(),
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
```

### Step 7: Create Schema Index

Create `apps/shared/src/schemas/index.ts`:

```typescript
// Common schemas
export {
  stellarAddressSchema,
  positiveAmountSchema,
  nonNegativeAmountSchema,
  percentageSchema,
  basisPointsSchema,
  isoDateSchema,
  unixTimestampSchema,
  transactionHashSchema,
} from './common.schema';

// Property schemas
export {
  propertyLocationSchema,
  propertyDocumentSchema,
  propertyInfoSchema,
  shareOwnershipSchema,
  type PropertyInfoInput,
  type PropertyInfoOutput,
  type ShareOwnershipInput,
} from './property.schema';

// Lending schemas
export {
  lendingPoolSchema,
  depositPositionSchema,
  borrowPositionSchema,
  type LendingPoolInput,
  type DepositPositionInput,
  type BorrowPositionInput,
} from './lending.schema';

// User schemas
export {
  kycStatusSchema,
  kycTierSchema,
  kycDocumentSchema,
  userSchema,
  transactionSchema,
  oraclePriceSchema,
  type UserInput,
  type KycDocumentInput,
  type TransactionInput,
  type OraclePriceInput,
} from './user.schema';
```

### Step 8: Update Main Index

Modify `apps/shared/src/index.ts`:

```typescript
// Types
export * from './types';

// Schemas
export * from './schemas';

// Utils
export * from './utils';

// Constants
export * from './constants';
```

## Testing Guidelines

### Unit Test Example

Create `apps/shared/tests/schemas/property.schema.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test';
import { propertyInfoSchema, shareOwnershipSchema } from '../../src/schemas';

describe('propertyInfoSchema', () => {
  const validProperty = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Downtown Apartment',
    description: 'A beautiful apartment in the city center with modern amenities',
    propertyType: 'residential',
    location: {
      address: '123 Main St',
      city: 'New York',
      country: 'USA',
    },
    totalValue: '500000.00',
    totalShares: 1000,
    availableShares: 750,
    pricePerShare: '500.00',
    images: ['https://example.com/image1.jpg'],
    documents: [],
    verified: true,
    listedAt: '2024-01-15T10:30:00Z',
    owner: 'GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  };

  it('should validate a correct property', () => {
    const result = propertyInfoSchema.safeParse(validProperty);
    expect(result.success).toBe(true);
  });

  it('should reject property with missing name', () => {
    const invalid = { ...validProperty, name: '' };
    const result = propertyInfoSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('name');
    }
  });

  it('should reject property with invalid Stellar address', () => {
    const invalid = { ...validProperty, owner: 'invalid-address' };
    const result = propertyInfoSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('should reject property with negative shares', () => {
    const invalid = { ...validProperty, availableShares: -10 };
    const result = propertyInfoSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
```

## Related Resources

| Resource | Link |
|----------|------|
| Zod Documentation | https://zod.dev |
| Zod GitHub | https://github.com/colinhacks/zod |
| TypeScript Handbook | https://www.typescriptlang.org/docs/handbook/ |

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Schema and type mismatch | Use `z.infer<typeof schema>` for type derivation |
| Circular imports | Keep common schemas in separate file |
| Over-validation | Only validate at boundaries, trust internal data |
| Missing optional fields | Use `.optional()` or `.nullable()` appropriately |

## Verification Checklist

| Item | Status |
|------|--------|
| All schemas created | |
| Type inference working | |
| Unit tests passing | |
| No circular dependencies | |
| Exported from index | |
| Documentation complete | |
