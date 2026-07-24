import { z } from 'zod';
import {
  stellarAddressSchema,
  kycStatusSchema,
  kycTierSchema,
  isoDateSchema,
} from '@real-estate-defi/shared';

/**
 * Create user request schema
 */
export const CreateUserDto = z.object({
  walletAddress: stellarAddressSchema,
  email: z.string().email().optional(),
  displayName: z.string().min(2).max(50).optional(),
});

/**
 * Update user request schema
 */
export const UpdateUserDto = z.object({
  email: z.string().email().optional(),
  displayName: z.string().min(2).max(50).optional(),
});

/**
 * User response schema
 */
export const UserResponseDto = z.object({
  id: z.string().uuid(),
  walletAddress: z.string(),
  email: z.string().email().nullable(),
  displayName: z.string().nullable(),
  kycStatus: kycStatusSchema,
  kycTier: kycTierSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  lastLoginAt: isoDateSchema.nullable(),
});

export type CreateUserInput = z.infer<typeof CreateUserDto>;
export type UpdateUserInput = z.infer<typeof UpdateUserDto>;
export type UserResponse = z.infer<typeof UserResponseDto>;
