import type { Context } from 'elysia';
import type { User, Transaction, PropertyInfo } from '@real-estate-defi/shared';
import { z } from 'zod';
import { userRepository } from '../repositories/UserRepository';
import { ApiError } from '../errors/ApiError';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { StellarService } from '../services/StellarService';

export class UserController {
  /**
   * Helper method to create JSON responses
   */
  private static jsonResponse(data: unknown, status: number = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Create new user
   */
  static async create(ctx: Context): Promise<Response> {
    const validationResult = CreateUserDto.safeParse(ctx.body);

    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid user data', {
        errors: z.treeifyError(validationResult.error),
      });
    }

    const { walletAddress, email, displayName } = validationResult.data;

    // Check for existing wallet
    const exists = await userRepository.walletExists(walletAddress);
    if (exists) {
      throw new ApiError(
        409,
        'WALLET_EXISTS',
        'User with this wallet address already exists'
      );
    }

    const user = await userRepository.createUser({
      walletAddress,
      email,
      displayName,
    });

    return this.jsonResponse(user, 201);
  }

  /**
   * Get current user profile (authenticated)
   */
  static async getProfile(ctx: Context): Promise<Response> {
    const userId = ctx.headers['x-user-id'];

    if (!userId) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const user = await userRepository.findById(userId);

    if (!user) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found');
    }

    return this.jsonResponse(user);
  }

  /**
   * Get user by ID
   */
  static async getById(ctx: Context<{ params: { id: string } }>): Promise<Response> {
    const { id } = ctx.params;

    const user = await userRepository.findById(id);

    if (!user) {
      throw new ApiError(404, 'NOT_FOUND', `User with ID ${id} not found`);
    }

    // Return public profile (omit sensitive fields)
    const publicProfile = {
      id: user.id,
      walletAddress: user.walletAddress,
      displayName: user.displayName,
      kycTier: user.kycTier,
      createdAt: user.createdAt,
    };

    return this.jsonResponse(publicProfile);
  }

  /**
   * Get user by wallet address
   */
  static async getByWallet(ctx: Context<{ params: { address: string } }>): Promise<Response> {
   
    const { address } = ctx.params;

    // Validate wallet address format
    if (!/^G[A-Z2-7]{55}$/.test(address)) {
      throw new ApiError(400, 'INVALID_ADDRESS', 'Invalid Stellar address format');
    }

    const user = await userRepository.findByWalletAddress(address);

    if (!user) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found');
    }

    // Return public profile
    const publicProfile = {
      id: user.id,
      walletAddress: user.walletAddress,
      displayName: user.displayName,
      kycTier: user.kycTier,
      createdAt: user.createdAt,
    };

    return this.jsonResponse(publicProfile);
  }

  /**
   * Update current user profile
   */
  static async updateProfile(ctx: Context): Promise<Response> {
    const userId = ctx.headers['x-user-id'];

    if (!userId) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    const validationResult = UpdateUserDto.safeParse(ctx.body);

    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid update data', {
        errors: z.treeifyError(validationResult.error),
      });
    }

    const user = await userRepository.updateProfile(userId, validationResult.data);

    if (!user) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found');
    }

    return this.jsonResponse(user);
  }

  /**
   * Authenticate user by wallet (get or create)
   */
  static async authenticateByWallet(ctx: Context): Promise<Response> {
    const { walletAddress } = ctx.body as { walletAddress?: string };

    if (!walletAddress || !/^G[A-Z2-7]{55}$/.test(walletAddress)) {
      throw new ApiError(400, 'INVALID_ADDRESS', 'Invalid Stellar address format');
    }

    const user = await userRepository.getOrCreateByWallet(walletAddress);

    return this.jsonResponse(user);
  }

  static async getUser(address: string): Promise<User> {
    try {
      // const stellar = new StellarService();
      // const balance = await stellar.getAccountBalance(address);

      const now = new Date().toISOString();
      return {
        id: crypto.randomUUID(),
        walletAddress: address,
        kycStatus: 'pending' as const,
        kycTier: 'none' as const,
        kycDocuments: [],
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      throw new Error(`Failed to fetch user ${address}: ${error}`);
    }
  }

  static async connectWallet(
    address: string,
    _data: { signature: string; message: string },
  ): Promise<User> {
    try {
      // Verify signature and message
      // const stellar = new StellarService();
      const stellarService = new StellarService();
      if (!stellarService.validateAddress(address)) {
        throw new Error('Invalid address format');
      }

      // Implementation for wallet connection
      return await this.getUser(address);
    } catch (error) {
      throw new Error(`Failed to connect wallet: ${error}`);
    }
  }

  static async getUserTransactions(_address: string): Promise<Transaction[]> {
    try {
      // const stellar = new StellarService();
      // Implementation to fetch user transaction history
      return []; // Placeholder
    } catch (error) {
      throw new Error(`Failed to fetch user transactions: ${error}`);
    }
  }

  static async getUserPortfolio(_address: string): Promise<{
    properties: PropertyInfo[];
    totalValue: number;
    deposits: number;
    borrows: number;
    netWorth: number;
  }> {
    try {
      // const stellar = new StellarService();
      // Implementation to calculate user portfolio
      return {
        properties: [],
        totalValue: 0,
        deposits: 0,
        borrows: 0,
        netWorth: 0,
      };
    } catch (error) {
      throw new Error(`Failed to fetch user portfolio: ${error}`);
    }
  }
}
