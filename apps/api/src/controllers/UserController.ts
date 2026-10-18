import type { User, Transaction, PropertyInfo } from '@akkuea/shared';
import type { User as UserRow } from '../db/schema';
import type { AuthContext } from '../middleware/auth';
import { userRepository } from '../repositories/UserRepository';
import { ApiError } from '../errors/ApiError';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { StellarService } from '../services/StellarService';

/** Fields safe to expose to any caller: no email or other private data. */
interface PublicUserProfile {
  id: string;
  walletAddress: string;
  displayName: string | null;
  kycTier: string;
  createdAt: Date;
}

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
   * Project a full user row down to the fields safe to return publicly
   * (omits email and any other private data).
   */
  private static toPublicProfile(user: UserRow): PublicUserProfile {
    return {
      id: user.id,
      walletAddress: user.walletAddress,
      displayName: user.displayName,
      kycTier: user.kycTier,
      createdAt: user.createdAt,
    };
  }

  /**
   * Create new user
   */
  static async create(ctx: { body: unknown }): Promise<Response> {
    const validationResult = CreateUserDto.safeParse(ctx.body);

    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid user data', {
        errors: validationResult.error.format(),
      });
    }

    const { walletAddress, email, displayName } = validationResult.data;

    // Check for existing wallet
    const exists = await userRepository.walletExists(walletAddress);
    if (exists) {
      throw new ApiError(409, 'WALLET_EXISTS', 'User with this wallet address already exists');
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
  static async getProfile(ctx: AuthContext): Promise<Response> {
    const { id: userId } = await ctx.getAuthenticatedUser();

    const user = await userRepository.findById(userId);

    if (!user) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found');
    }

    return this.jsonResponse(user);
  }

  /**
   * Get user by ID
   */
  static async getById(ctx: { params: { id: string } }): Promise<Response> {
    const { id } = ctx.params;

    const user = await userRepository.findById(id);

    if (!user) {
      throw new ApiError(404, 'NOT_FOUND', `User with ID ${id} not found`);
    }

    return this.jsonResponse(this.toPublicProfile(user));
  }

  /**
   * Get user by wallet address
   */
  static async getByWallet(ctx: { params: { address: string } }): Promise<Response> {
    const { address } = ctx.params;

    // Validate wallet address format
    if (!/^G[A-Z2-7]{55}$/.test(address)) {
      throw new ApiError(400, 'INVALID_ADDRESS', 'Invalid Stellar address format');
    }

    const user = await userRepository.findByWalletAddress(address);

    if (!user) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found');
    }

    return this.jsonResponse(this.toPublicProfile(user));
  }

  /**
   * Update current user profile
   */
  static async updateProfile(ctx: AuthContext & { body: unknown }): Promise<Response> {
    const { id: userId } = await ctx.getAuthenticatedUser();

    const validationResult = UpdateUserDto.safeParse(ctx.body);

    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid update data', {
        errors: validationResult.error.format(),
      });
    }

    const user = await userRepository.updateProfile(userId, validationResult.data);

    if (!user) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found');
    }

    return this.jsonResponse(user);
  }

  /**
   * Authenticate user by wallet. Returns the same public projection as
   * getById/getByWallet for an existing wallet. Does not create a new user
   * unless the caller holds a valid session for that exact wallet (proven
   * via /auth/challenge + /auth/session), since this endpoint otherwise has
   * no proof of wallet ownership.
   */
  static async authenticateByWallet(ctx: AuthContext & { body: unknown }): Promise<Response> {
    const { walletAddress } = ctx.body as { walletAddress?: string };

    if (!walletAddress || !/^G[A-Z2-7]{55}$/.test(walletAddress)) {
      throw new ApiError(400, 'INVALID_ADDRESS', 'Invalid Stellar address format');
    }

    const existingUser = await userRepository.findByWalletAddress(walletAddress);

    if (existingUser) {
      return this.jsonResponse(this.toPublicProfile(existingUser));
    }

    let authenticatedWallet: string | undefined;
    try {
      const authenticatedUser = await ctx.getAuthenticatedUser();
      authenticatedWallet = authenticatedUser.walletAddress;
    } catch {
      authenticatedWallet = undefined;
    }

    if (authenticatedWallet !== walletAddress) {
      throw new ApiError(404, 'NOT_FOUND', 'User not found');
    }

    const user = await userRepository.getOrCreateByWallet(walletAddress);

    return this.jsonResponse(this.toPublicProfile(user));
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
