import { z } from 'zod';

/**
 * Stellar address validation regex
 */
const stellarAddressRegex = /^G[A-Z2-7]{55}$/;

/**
 * Create user request schema
 */
export const CreateUserDto = z.object({
  walletAddress: z
    .string()
    .length(56, 'Wallet address must be 56 characters')
    .regex(stellarAddressRegex, 'Invalid Stellar address format'),
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
  kycStatus: z.enum(['not_started', 'pending', 'approved', 'rejected', 'expired']),
  kycTier: z.enum(['none', 'basic', 'verified', 'accredited']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable(),
});

export type CreateUserInput = z.infer<typeof CreateUserDto>;
export type UpdateUserInput = z.infer<typeof UpdateUserDto>;
export type UserResponse = z.infer<typeof UserResponseDto>;
