import type { AuthContext } from '../middleware/auth';
import { ApiError } from '../errors/ApiError';
import { lendingRepository } from '../repositories/LendingRepository';

import { CreatePoolDto, DepositDto, WithdrawDto, BorrowDto, RepayDto } from '../dto/lending.dto';
import { positionService } from '../services/PositionService';
import { NotificationService } from '../services/NotificationService';
import { cacheService } from '../services/CacheService';
import { RiskMonitoringController } from './RiskMonitoringController';
import { stellarService } from '../services/StellarService';
import { isLiquidatorAuthorized } from '../utils/liquidatorAuth';
import { getDefiRwaContractId } from '../config/contracts';

const POOLS_CACHE_TTL = 10; // seconds
const POOLS_CACHE_PREFIX = 'lending:pools:';

export class LendingController {
  private static async resolveAuthenticatedUser(
    ctx: AuthContext,
  ): Promise<{ id: string; walletAddress?: string }> {
    return await ctx.getAuthenticatedUser();
  }

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
   * Get paginated list of lending pools (cached for 10 seconds)
   */
  static async getPools(ctx: { query: Record<string, string | undefined> }): Promise<Response> {
    const query = ctx.query as Record<string, string | undefined>;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const asset = query.asset;
    const isActive = query.isActive !== undefined ? query.isActive === 'true' : undefined;

    const cacheKey = `${POOLS_CACHE_PREFIX}${page}:${limit}:${asset ?? ''}:${isActive ?? ''}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return this.jsonResponse(cached);

    const filter = asset || isActive !== undefined ? { asset, isActive } : undefined;
    const result = await lendingRepository.findPaginated({ page, limit }, filter);

    await cacheService.set(cacheKey, result, POOLS_CACHE_TTL);
    return this.jsonResponse(result);
  }

  /**
   * Get a single lending pool by ID
   */
  static async getPool(ctx: { params: { id: string } }): Promise<Response> {
    const { id } = ctx.params;

    const pool = await lendingRepository.findById(id);

    if (!pool) {
      throw new ApiError(404, 'NOT_FOUND', `Pool with id ${id} not found`);
    }

    return this.jsonResponse(pool);
  }

  /**
   * Create a new lending pool (auth required)
   */
  static async createPool(ctx: AuthContext & { body: unknown }): Promise<Response> {
    await this.resolveAuthenticatedUser(ctx);

    const validationResult = CreatePoolDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid pool data', {
        errors: validationResult.error.format(),
      });
    }

    const data = validationResult.data;

    const pool = await lendingRepository.create({
      name: data.name,
      asset: data.asset,
      assetAddress: data.assetAddress,
      collateralFactor: data.collateralFactor,
      liquidationThreshold: data.liquidationThreshold,
      liquidationPenalty: data.liquidationPenalty,
      reserveFactor: data.reserveFactor,
    });

    await cacheService.invalidate(`${POOLS_CACHE_PREFIX}*`);
    return this.jsonResponse(pool, 201);
  }

  /**
   * Deposit into a lending pool (auth required)
   */
  static async deposit(
    ctx: AuthContext & {
      params: { id: string };
      body: unknown;
    },
  ): Promise<Response> {
    const { id: poolId } = ctx.params;
    const user = await this.resolveAuthenticatedUser(ctx);

    const validationResult = DepositDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid deposit data', {
        errors: validationResult.error.format(),
      });
    }

    const { amount } = validationResult.data;

    const pool = await lendingRepository.findActivePool(poolId);
    if (!pool) {
      throw new ApiError(404, 'NOT_FOUND', `Active pool with id ${poolId} not found`);
    }

    const position = await lendingRepository.deposit(poolId, user.id, amount, amount);

    await cacheService.invalidate(`${POOLS_CACHE_PREFIX}*`);
    return this.jsonResponse(position);
  }

  /**
   * Withdraw from a lending pool (auth required)
   */
  static async withdraw(
    ctx: AuthContext & {
      params: { id: string };
      body: unknown;
    },
  ): Promise<Response> {
    const { id: poolId } = ctx.params;
    const user = await this.resolveAuthenticatedUser(ctx);

    const validationResult = WithdrawDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid withdrawal data', {
        errors: validationResult.error.format(),
      });
    }

    const { amount } = validationResult.data;

    const pool = await lendingRepository.findActivePool(poolId);
    if (!pool) {
      throw new ApiError(404, 'NOT_FOUND', `Active pool with id ${poolId} not found`);
    }

    if (parseFloat(pool.availableLiquidity) < parseFloat(amount)) {
      throw new ApiError(400, 'INSUFFICIENT_LIQUIDITY', 'Insufficient liquidity in pool');
    }

    const position = await lendingRepository.withdraw(poolId, user.id, amount);
    if (!position) {
      throw new ApiError(404, 'NOT_FOUND', 'No deposit position found for this user in this pool');
    }

    await cacheService.invalidate(`${POOLS_CACHE_PREFIX}*`);
    return this.jsonResponse(position);
  }

  /**
   * Borrow from a lending pool (auth required)
   */
  static async borrow(
    ctx: AuthContext & {
      params: { id: string };
      body: unknown;
    },
  ): Promise<Response> {
    const { id: poolId } = ctx.params;
    const user = await this.resolveAuthenticatedUser(ctx);

    const validationResult = BorrowDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid borrow data', {
        errors: validationResult.error.format(),
      });
    }

    const { borrowAmount, collateralAmount, collateralAsset } = validationResult.data;

    const pool = await lendingRepository.findActivePool(poolId);
    if (!pool) {
      throw new ApiError(404, 'NOT_FOUND', `Active pool with id ${poolId} not found`);
    }

    if (parseFloat(pool.availableLiquidity) < parseFloat(borrowAmount)) {
      throw new ApiError(400, 'INSUFFICIENT_LIQUIDITY', 'Insufficient liquidity in pool');
    }

    const position = await lendingRepository.borrow(poolId, user.id, {
      borrowAmount,
      collateralAmount,
      collateralAsset,
    });

    await cacheService.invalidate(`${POOLS_CACHE_PREFIX}*`);
    return this.jsonResponse(position);
  }

  /**
   * Repay a loan (auth required)
   */
  static async repay(
    ctx: AuthContext & {
      params: { id: string };
      body: unknown;
    },
  ): Promise<Response> {
    const { id: poolId } = ctx.params;
    const user = await this.resolveAuthenticatedUser(ctx);

    const validationResult = RepayDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid repayment data', {
        errors: validationResult.error.format(),
      });
    }

    const { amount } = validationResult.data;

    const pool = await lendingRepository.findById(poolId);
    if (!pool) {
      throw new ApiError(404, 'NOT_FOUND', `Pool with id ${poolId} not found`);
    }

    const position = await lendingRepository.repay(poolId, user.id, amount);
    if (!position) {
      throw new ApiError(404, 'NOT_FOUND', 'No borrow position found for this user in this pool');
    }

    await cacheService.invalidate(`${POOLS_CACHE_PREFIX}*`);

    // Send repayment processed notification
    const notificationService = new NotificationService();
    await notificationService.notifyRepaymentProcessed(
      user.id,
      poolId,
      parseFloat(amount),
      'IN_APP',
    );

    return this.jsonResponse(position);
  }

  /**
   * Execute liquidation of an underwater borrow position (liquidator role required)
   */
  static async liquidate(ctx: {
    params: { id: string; borrowerId: string };
    headers: Record<string, string | undefined>;
  }): Promise<Response> {
    if (!isLiquidatorAuthorized(ctx.headers)) {
      throw new ApiError(403, 'FORBIDDEN', 'Liquidator access required');
    }

    const { id: poolId, borrowerId } = ctx.params;
    const positionId = `${poolId}-${borrowerId}`;

    const readiness = await RiskMonitoringController.getLiquidationReadiness(positionId);
    if (!readiness.isLiquidatable) {
      throw new ApiError(
        400,
        'NOT_LIQUIDATABLE',
        'Position health factor is above the liquidation threshold',
      );
    }

    // Best-effort on-chain liquidation - proceeds even if contract call fails
    let txHash: string | null = null;
    const contractId = getDefiRwaContractId();
    const adminPublicKey = process.env.STELLAR_ADMIN_PUBLIC_KEY;
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;
    if (contractId && adminPublicKey && adminSecret) {
      try {
        txHash = await stellarService.callAndSubmitContract(
          contractId,
          'liquidate',
          [poolId, borrowerId],
          adminSecret,
          adminPublicKey,
        );
      } catch (err) {
        console.error('On-chain liquidation failed:', err);
      }
    }

    const position = await lendingRepository.liquidate(poolId, borrowerId);
    if (!position) {
      throw ApiError.notFound(
        `Borrow position for borrower ${borrowerId} in pool ${poolId} not found`,
      );
    }

    await cacheService.invalidate(`${POOLS_CACHE_PREFIX}*`);

    const notificationService = new NotificationService();
    await notificationService.notifyLiquidationExecuted(
      borrowerId,
      positionId,
      readiness.debtToCover,
      readiness.collateralToSeize,
      'IN_APP',
    );

    return this.jsonResponse({
      positionId,
      poolId,
      borrowerId,
      debtCovered: readiness.debtToCover,
      collateralSeized: readiness.collateralToSeize,
      estimatedProceeds: readiness.estimatedProceeds,
      txHash,
    });
  }

  /**
   * Get user's deposit positions in a pool
   */
  static async getUserDeposits(ctx: {
    params: { id: string; address: string };
  }): Promise<Response> {
    const { id: poolId, address } = ctx.params;
    if (!positionService.validateAddress(address)) {
      throw new ApiError(400, 'INVALID_ADDRESS', 'Invalid Stellar address format');
    }

    const deposits = await positionService.getUserDeposits(poolId, address);

    return this.jsonResponse(deposits);
  }

  /**
   * Get user's borrow positions in a pool
   */
  static async getUserBorrows(ctx: { params: { id: string; address: string } }): Promise<Response> {
    const { id: poolId, address } = ctx.params;
    if (!positionService.validateAddress(address)) {
      throw new ApiError(400, 'INVALID_ADDRESS', 'Invalid Stellar address format');
    }

    const borrows = await positionService.getUserBorrows(poolId, address);

    return this.jsonResponse(borrows);
  }

  /**
   * Get user position summary in a pool
   */
  static async getUserPositionSummary(ctx: {
    params: { id: string; address: string };
  }): Promise<Response> {
    const { id: poolId, address } = ctx.params;
    if (!positionService.validateAddress(address)) {
      throw new ApiError(400, 'INVALID_ADDRESS', 'Invalid Stellar address format');
    }

    const summary = await positionService.getPositionSummary(poolId, address);

    return this.jsonResponse(summary);
  }
}
