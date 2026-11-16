import { formatBigIntAsDecimalString, parseDecimalStringToBigInt } from '@akkuea/shared';
import type { AuthContext } from '../middleware/auth';
import { ApiError } from '../errors/ApiError';
import { lendingRepository } from '../repositories/LendingRepository';
import { userRepository } from '../repositories/UserRepository';
import type { LendingPool } from '../db/schema';
import {
  CreatePoolDto,
  DepositDto,
  WithdrawDto,
  BorrowDto,
  RepayDto,
  LiquidatePrepareDto,
  ConfirmLendingTxDto,
  ConfirmLiquidateDto,
} from '../dto/lending.dto';
import { positionService } from '../services/PositionService';
import { NotificationService } from '../services/NotificationService';
import { cacheService } from '../services/CacheService';
import { stellarService, type LendingAction } from '../services/StellarService';
import { isLiquidatorAuthorized } from '../utils/liquidatorAuth';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';
import { getDefiRwaContractId } from '../config/contracts';

const POOLS_CACHE_TTL = 10; // seconds
const POOLS_CACHE_PREFIX = 'lending:pools:';
const TOKEN_DECIMALS = 7;
const FACTOR_DECIMALS = 18;
const HEALTH_FACTOR_DB_DECIMALS = 4;
const HEALTH_FACTOR_DOWNSCALE = 10n ** BigInt(FACTOR_DECIMALS - HEALTH_FACTOR_DB_DECIMALS);
const MAX_DB_HEALTH_FACTOR_UNITS = 9_999_999_999n;
const MAX_DB_UTILIZATION_BPS = 99_999n;

export class LendingController {
  private static async resolveAuthenticatedUser(
    ctx: AuthContext,
  ): Promise<{ id: string; walletAddress?: string }> {
    return await ctx.getAuthenticatedUser();
  }

  private static async requireAuthenticatedWallet(
    ctx: AuthContext,
  ): Promise<{ id: string; walletAddress: string }> {
    const user = await this.resolveAuthenticatedUser(ctx);
    if (!user.walletAddress || !/^G[A-Z2-7]{55}$/.test(user.walletAddress)) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authenticated Stellar wallet address is required');
    }
    return {
      id: user.id,
      walletAddress: user.walletAddress,
    };
  }

  private static requireDefiRwaContractId(): string {
    const contractId = getDefiRwaContractId();
    if (!contractId) {
      throw ApiError.internal(
        'DeFi lending contract is not configured. Set DEFI_RWA_CONTRACT_ID or the network deployment artifact.',
      );
    }
    return contractId;
  }

  private static async requireLinkedPool(
    poolId: string,
    requireActiveUnpaused: boolean,
  ): Promise<LendingPool & { contractPoolId: string }> {
    const pool = requireActiveUnpaused
      ? await lendingRepository.findActivePool(poolId)
      : await lendingRepository.findById(poolId);

    if (!pool) {
      throw new ApiError(
        404,
        'NOT_FOUND',
        requireActiveUnpaused
          ? `Active pool with id ${poolId} not found`
          : `Pool with id ${poolId} not found`,
      );
    }

    if (!pool.contractPoolId) {
      throw new ApiError(
        400,
        'UNLINKED_POOL',
        `Pool ${poolId} is not linked to an on-chain defi-rwa pool`,
      );
    }

    return pool as LendingPool & { contractPoolId: string };
  }

  private static parseScaledUnits(value: string, decimals: number, fieldName: string): bigint {
    try {
      return parseDecimalStringToBigInt(value, decimals);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Invalid ${fieldName}`;
      throw new ApiError(400, 'VALIDATION_ERROR', message);
    }
  }

  private static formatUtilizationRate(totalDeposits: bigint, totalBorrows: bigint): string {
    if (totalDeposits <= 0n || totalBorrows <= 0n) {
      return '0.00';
    }
    const bps = (totalBorrows * 10_000n) / totalDeposits;
    const clamped = bps > MAX_DB_UTILIZATION_BPS ? MAX_DB_UTILIZATION_BPS : bps;
    return formatBigIntAsDecimalString(clamped, 2);
  }

  private static formatHealthFactor(rawHealthFactor: bigint | null): string {
    if (rawHealthFactor === null) {
      return '1.0000';
    }
    if (rawHealthFactor <= 0n) {
      return '0.0000';
    }
    const scaled = rawHealthFactor / HEALTH_FACTOR_DOWNSCALE;
    const clamped = scaled > MAX_DB_HEALTH_FACTOR_UNITS ? MAX_DB_HEALTH_FACTOR_UNITS : scaled;
    return formatBigIntAsDecimalString(clamped, HEALTH_FACTOR_DB_DECIMALS);
  }

  private static legacyWriteRouteGone(
    action: string,
    preparePath: string,
    confirmPath: string,
  ): never {
    throw new ApiError(
      410,
      'GONE',
      `Direct ${action} writes are retired. Use POST ${preparePath} and POST ${confirmPath} with a confirmed defi-rwa transaction.`,
      {
        prepareEndpoint: preparePath,
        confirmEndpoint: confirmPath,
      },
    );
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
   * Create a new lending pool on-chain via `defi-rwa.create_pool` (operator-only)
   * and persist the row with `contract_pool_id` only after the transaction succeeds.
   */
  static async createPool(
    ctx: AuthContext & {
      body: unknown;
      headers?: Record<string, string | undefined>;
    },
  ): Promise<Response> {
    const headers = (ctx.headers ?? {}) as Record<string, string | undefined>;
    if (!isInternalOperationsAuthorized(headers)) {
      if (headers['x-internal-api-key'] !== undefined) {
        throw new ApiError(
          403,
          'FORBIDDEN',
          'Operator authorization required to create lending pools',
        );
      }
      await this.resolveAuthenticatedUser(ctx);
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Operator authorization required to create lending pools',
      );
    }

    const validationResult = CreatePoolDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid pool data', {
        errors: validationResult.error.format(),
      });
    }

    const data = validationResult.data;
    const contractPoolId = data.contractPoolId ?? crypto.randomUUID();

    const existing = await lendingRepository.findByContractPoolId(contractPoolId);
    if (existing) {
      throw new ApiError(
        409,
        'CONFLICT',
        `A lending pool with contractPoolId ${contractPoolId} already exists`,
      );
    }

    const collateralFactor = this.parseScaledUnits(
      data.collateralFactor,
      FACTOR_DECIMALS,
      'collateralFactor',
    );
    const liquidationThreshold = this.parseScaledUnits(
      data.liquidationThreshold,
      FACTOR_DECIMALS,
      'liquidationThreshold',
    );
    const liquidationPenalty = this.parseScaledUnits(
      data.liquidationPenalty,
      FACTOR_DECIMALS,
      'liquidationPenalty',
    );
    const closeFactor = this.parseScaledUnits(data.closeFactor, FACTOR_DECIMALS, 'closeFactor');

    const onChain = await stellarService.createLendingPool({
      poolId: contractPoolId,
      name: data.name,
      asset: data.asset,
      assetAddress: data.assetAddress,
      collateralFactor,
      liquidationThreshold,
      liquidationPenalty,
      closeFactor,
      reserveFactor: data.reserveFactor,
    });

    const pool = await lendingRepository.create({
      contractPoolId: onChain.contractPoolId,
      name: data.name,
      asset: data.asset,
      assetAddress: data.assetAddress,
      collateralFactor: data.collateralFactor,
      liquidationThreshold: data.liquidationThreshold,
      liquidationPenalty: data.liquidationPenalty,
      reserveFactor: data.reserveFactor,
    });

    await cacheService.invalidate(`${POOLS_CACHE_PREFIX}*`);
    return this.jsonResponse({ ...pool, txHash: onChain.txHash }, 201);
  }

  /**
   * Retired direct deposit endpoint: returns 410 Gone pointing to prepare/confirm.
   */
  static async deposit(
    ctx: AuthContext & {
      params: { id: string };
      body: unknown;
    },
  ): Promise<Response> {
    const { id: poolId } = ctx.params;
    await this.resolveAuthenticatedUser(ctx);

    const validationResult = DepositDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid deposit data', {
        errors: validationResult.error.format(),
      });
    }

    return this.legacyWriteRouteGone(
      'deposit',
      `/lending/pools/${poolId}/deposit/prepare`,
      `/lending/pools/${poolId}/deposit/confirm`,
    );
  }

  /**
   * Retired direct withdraw endpoint: returns 410 Gone pointing to prepare/confirm.
   */
  static async withdraw(
    ctx: AuthContext & {
      params: { id: string };
      body: unknown;
    },
  ): Promise<Response> {
    const { id: poolId } = ctx.params;
    await this.resolveAuthenticatedUser(ctx);

    const validationResult = WithdrawDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid withdrawal data', {
        errors: validationResult.error.format(),
      });
    }

    return this.legacyWriteRouteGone(
      'withdraw',
      `/lending/pools/${poolId}/withdraw/prepare`,
      `/lending/pools/${poolId}/withdraw/confirm`,
    );
  }

  /**
   * Retired direct borrow endpoint: returns 410 Gone pointing to prepare/confirm.
   */
  static async borrow(
    ctx: AuthContext & {
      params: { id: string };
      body: unknown;
    },
  ): Promise<Response> {
    const { id: poolId } = ctx.params;
    await this.resolveAuthenticatedUser(ctx);

    const validationResult = BorrowDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid borrow data', {
        errors: validationResult.error.format(),
      });
    }

    return this.legacyWriteRouteGone(
      'borrow',
      `/lending/pools/${poolId}/borrow/prepare`,
      `/lending/pools/${poolId}/borrow/confirm`,
    );
  }

  /**
   * Retired direct repay endpoint: returns 410 Gone pointing to prepare/confirm.
   */
  static async repay(
    ctx: AuthContext & {
      params: { id: string };
      body: unknown;
    },
  ): Promise<Response> {
    const { id: poolId } = ctx.params;
    await this.resolveAuthenticatedUser(ctx);

    const validationResult = RepayDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid repayment data', {
        errors: validationResult.error.format(),
      });
    }

    return this.legacyWriteRouteGone(
      'repay',
      `/lending/pools/${poolId}/repay/prepare`,
      `/lending/pools/${poolId}/repay/confirm`,
    );
  }

  /**
   * Retired direct liquidation endpoint: returns 410 Gone pointing to prepare/confirm.
   */
  static async liquidate(ctx: {
    params: { id: string; borrowerId: string };
    headers: Record<string, string | undefined>;
  }): Promise<Response> {
    if (!isLiquidatorAuthorized(ctx.headers)) {
      throw new ApiError(403, 'FORBIDDEN', 'Liquidator access required');
    }

    const { id: poolId, borrowerId } = ctx.params;
    return this.legacyWriteRouteGone(
      'liquidate',
      `/lending/pools/${poolId}/positions/${borrowerId}/liquidate/prepare`,
      `/lending/pools/${poolId}/positions/${borrowerId}/liquidate/confirm`,
    );
  }

  static async prepareDeposit(
    ctx: AuthContext & {
      params: { id: string };
      body: unknown;
    },
  ): Promise<Response> {
    const { id: poolId } = ctx.params;
    const user = await this.requireAuthenticatedWallet(ctx);

    const validationResult = DepositDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid deposit data', {
        errors: validationResult.error.format(),
      });
    }

    const pool = await this.requireLinkedPool(poolId, true);
    const contractId = this.requireDefiRwaContractId();
    const amountUnits = this.parseScaledUnits(
      validationResult.data.amount,
      TOKEN_DECIMALS,
      'amount',
    );

    const prepared = await stellarService.prepareLendingAction({
      contractId,
      action: 'deposit',
      actor: user.walletAddress,
      poolId: pool.contractPoolId,
      amount: amountUnits,
    });

    return this.jsonResponse({
      xdr: prepared.xdr,
      contractId: prepared.contractId,
      poolId: pool.id,
      contractPoolId: pool.contractPoolId,
      action: 'deposit',
      actor: user.walletAddress,
      amount: formatBigIntAsDecimalString(amountUnits, TOKEN_DECIMALS),
    });
  }

  static async confirmDeposit(
    ctx: AuthContext & {
      params: { id: string };
      body: unknown;
    },
  ): Promise<Response> {
    return this.confirmUserLendingAction(ctx, 'deposit');
  }

  static async prepareWithdraw(
    ctx: AuthContext & {
      params: { id: string };
      body: unknown;
    },
  ): Promise<Response> {
    const { id: poolId } = ctx.params;
    const user = await this.requireAuthenticatedWallet(ctx);

    const validationResult = WithdrawDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid withdrawal data', {
        errors: validationResult.error.format(),
      });
    }

    const pool = await this.requireLinkedPool(poolId, true);
    const contractId = this.requireDefiRwaContractId();
    const amountUnits = this.parseScaledUnits(
      validationResult.data.amount,
      TOKEN_DECIMALS,
      'amount',
    );

    const prepared = await stellarService.prepareLendingAction({
      contractId,
      action: 'withdraw',
      actor: user.walletAddress,
      poolId: pool.contractPoolId,
      amount: amountUnits,
    });

    return this.jsonResponse({
      xdr: prepared.xdr,
      contractId: prepared.contractId,
      poolId: pool.id,
      contractPoolId: pool.contractPoolId,
      action: 'withdraw',
      actor: user.walletAddress,
      amount: formatBigIntAsDecimalString(amountUnits, TOKEN_DECIMALS),
    });
  }

  static async confirmWithdraw(
    ctx: AuthContext & {
      params: { id: string };
      body: unknown;
    },
  ): Promise<Response> {
    return this.confirmUserLendingAction(ctx, 'withdraw');
  }

  static async prepareBorrow(
    ctx: AuthContext & {
      params: { id: string };
      body: unknown;
    },
  ): Promise<Response> {
    const { id: poolId } = ctx.params;
    const user = await this.requireAuthenticatedWallet(ctx);

    const validationResult = BorrowDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid borrow data', {
        errors: validationResult.error.format(),
      });
    }

    const pool = await this.requireLinkedPool(poolId, true);
    const contractId = this.requireDefiRwaContractId();
    const { borrowAmount, collateralAmount, collateralAsset } = validationResult.data;

    const borrowUnits = this.parseScaledUnits(borrowAmount, TOKEN_DECIMALS, 'borrowAmount');
    const collateralUnits = this.parseScaledUnits(
      collateralAmount,
      TOKEN_DECIMALS,
      'collateralAmount',
    );

    const prepared = await stellarService.prepareLendingAction({
      contractId,
      action: 'borrow',
      actor: user.walletAddress,
      poolId: pool.contractPoolId,
      amount: borrowUnits,
      collateralAsset,
      collateralAmount: collateralUnits,
    });

    return this.jsonResponse({
      xdr: prepared.xdr,
      contractId: prepared.contractId,
      poolId: pool.id,
      contractPoolId: pool.contractPoolId,
      action: 'borrow',
      actor: user.walletAddress,
      borrowAmount: formatBigIntAsDecimalString(borrowUnits, TOKEN_DECIMALS),
      collateralAmount: formatBigIntAsDecimalString(collateralUnits, TOKEN_DECIMALS),
      collateralAsset,
    });
  }

  static async confirmBorrow(
    ctx: AuthContext & {
      params: { id: string };
      body: unknown;
    },
  ): Promise<Response> {
    return this.confirmUserLendingAction(ctx, 'borrow');
  }

  static async prepareRepay(
    ctx: AuthContext & {
      params: { id: string };
      body: unknown;
    },
  ): Promise<Response> {
    const { id: poolId } = ctx.params;
    const user = await this.requireAuthenticatedWallet(ctx);

    const validationResult = RepayDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid repayment data', {
        errors: validationResult.error.format(),
      });
    }

    const pool = await this.requireLinkedPool(poolId, false);
    const contractId = this.requireDefiRwaContractId();
    const amountUnits = this.parseScaledUnits(
      validationResult.data.amount,
      TOKEN_DECIMALS,
      'amount',
    );

    const prepared = await stellarService.prepareLendingAction({
      contractId,
      action: 'repay',
      actor: user.walletAddress,
      poolId: pool.contractPoolId,
      amount: amountUnits,
    });

    return this.jsonResponse({
      xdr: prepared.xdr,
      contractId: prepared.contractId,
      poolId: pool.id,
      contractPoolId: pool.contractPoolId,
      action: 'repay',
      actor: user.walletAddress,
      amount: formatBigIntAsDecimalString(amountUnits, TOKEN_DECIMALS),
    });
  }

  static async confirmRepay(
    ctx: AuthContext & {
      params: { id: string };
      body: unknown;
    },
  ): Promise<Response> {
    return this.confirmUserLendingAction(ctx, 'repay');
  }

  private static async confirmUserLendingAction(
    ctx: AuthContext & {
      params: { id: string };
      body: unknown;
    },
    action: Exclude<LendingAction, 'liquidate'>,
  ): Promise<Response> {
    const { id: poolId } = ctx.params;
    const user = await this.requireAuthenticatedWallet(ctx);

    const validationResult = ConfirmLendingTxDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid transaction confirmation payload', {
        errors: validationResult.error.format(),
      });
    }

    const pool = await this.requireLinkedPool(poolId, false);
    const contractId = this.requireDefiRwaContractId();
    const { txHash } = validationResult.data;

    const verified = await stellarService.verifyLendingTransaction(txHash, contractId, action);

    if (
      verified.sourceAccount !== user.walletAddress ||
      verified.call.actor !== user.walletAddress
    ) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Transaction actor does not match the authenticated wallet',
      );
    }

    if (verified.call.poolId !== pool.contractPoolId) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Transaction targets a different lending pool');
    }

    if (verified.call.kind === 'liquidate' || verified.call.amount <= 0n) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Transaction amount must be greater than zero');
    }

    if (verified.call.kind === 'borrow' && verified.call.collateralAmount <= 0n) {
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        'Transaction collateral amount must be greater than zero',
      );
    }

    const kind: 'deposit' | 'borrow' =
      action === 'deposit' || action === 'withdraw' ? 'deposit' : 'borrow';

    const snapshot = await stellarService.readLendingStateFromChain({
      contractId,
      contractPoolId: pool.contractPoolId,
      userWallet: user.walletAddress,
      kind,
    });

    const availableLiquidityUnits =
      snapshot.totalDeposits > snapshot.totalBorrows
        ? snapshot.totalDeposits - snapshot.totalBorrows
        : 0n;

    const formattedAmount = formatBigIntAsDecimalString(verified.call.amount, TOKEN_DECIMALS);

    const result = await lendingRepository.recordConfirmedLendingAction({
      txHash: verified.txHash,
      action,
      poolId: pool.id,
      contractPoolId: pool.contractPoolId,
      contractId,
      actorUserId: user.id,
      actorWallet: user.walletAddress,
      positionUserId: user.id,
      amount: formattedAmount,
      asset: pool.asset,
      totalDeposits: formatBigIntAsDecimalString(snapshot.totalDeposits, TOKEN_DECIMALS),
      totalBorrows: formatBigIntAsDecimalString(snapshot.totalBorrows, TOKEN_DECIMALS),
      availableLiquidity: formatBigIntAsDecimalString(availableLiquidityUnits, TOKEN_DECIMALS),
      utilizationRate: this.formatUtilizationRate(snapshot.totalDeposits, snapshot.totalBorrows),
      kind,
      depositPosition: snapshot.depositPosition
        ? {
            amount: formatBigIntAsDecimalString(snapshot.depositPosition.amount, TOKEN_DECIMALS),
            shares: formatBigIntAsDecimalString(snapshot.depositPosition.shares, TOKEN_DECIMALS),
          }
        : null,
      borrowPosition: snapshot.borrowPosition
        ? {
            principal: formatBigIntAsDecimalString(
              snapshot.borrowPosition.principal,
              TOKEN_DECIMALS,
            ),
            collateralAmount: formatBigIntAsDecimalString(
              snapshot.borrowPosition.collateralAmount,
              TOKEN_DECIMALS,
            ),
            collateralAsset: snapshot.borrowPosition.collateralAsset,
            healthFactor: this.formatHealthFactor(snapshot.borrowPosition.healthFactor),
          }
        : null,
    });

    if (result.recorded) {
      await cacheService.invalidate(`${POOLS_CACHE_PREFIX}*`);
      if (action === 'repay') {
        try {
          const notificationService = new NotificationService();
          await notificationService.notifyRepaymentProcessed(
            user.id,
            poolId,
            parseFloat(formattedAmount),
            'IN_APP',
          );
        } catch {
          // Notification delivery failure must not roll back a confirmed chain state write.
        }
      }
    }

    const position = kind === 'deposit' ? result.depositPosition : result.borrowPosition;
    return this.jsonResponse({
      ...(position ?? {}),
      txHash: result.txHash,
      poolId: pool.id,
      contractPoolId: pool.contractPoolId,
      position,
      pool: result.pool,
    });
  }

  /**
   * Prepare an unsigned four-argument `defi-rwa.liquidate` transaction
   * (`liquidator`, `contract_pool_id`, `borrower_address`, `debt_to_cover`).
   */
  static async prepareLiquidate(ctx: {
    params: { id: string; borrowerId: string };
    headers: Record<string, string | undefined>;
    body: unknown;
  }): Promise<Response> {
    if (!isLiquidatorAuthorized(ctx.headers)) {
      throw new ApiError(403, 'FORBIDDEN', 'Liquidator access required');
    }

    const validationResult = LiquidatePrepareDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid liquidation prepare data', {
        errors: validationResult.error.format(),
      });
    }

    const { id: poolId, borrowerId } = ctx.params;
    const { liquidator, debtToCover } = validationResult.data;

    const pool = await this.requireLinkedPool(poolId, false);
    const borrower = await userRepository.findById(borrowerId);
    if (!borrower || !borrower.walletAddress) {
      throw ApiError.notFound(`Borrower with id ${borrowerId} not found`);
    }

    const contractId = this.requireDefiRwaContractId();
    const debtToCoverUnits = this.parseScaledUnits(debtToCover, TOKEN_DECIMALS, 'debtToCover');

    const prepared = await stellarService.prepareLendingAction({
      contractId,
      action: 'liquidate',
      actor: liquidator,
      poolId: pool.contractPoolId,
      borrowerAddress: borrower.walletAddress,
      debtToCover: debtToCoverUnits,
    });

    return this.jsonResponse({
      xdr: prepared.xdr,
      contractId: prepared.contractId,
      poolId: pool.id,
      contractPoolId: pool.contractPoolId,
      borrowerId: borrower.id,
      borrowerAddress: borrower.walletAddress,
      liquidator,
      debtToCover: formatBigIntAsDecimalString(debtToCoverUnits, TOKEN_DECIMALS),
    });
  }

  /**
   * Confirm a submitted `defi-rwa.liquidate` transaction via Soroban RPC and
   * refresh the borrower's position and pool totals from chain.
   */
  static async confirmLiquidate(ctx: {
    params: { id: string; borrowerId: string };
    headers: Record<string, string | undefined>;
    body: unknown;
  }): Promise<Response> {
    if (!isLiquidatorAuthorized(ctx.headers)) {
      throw new ApiError(403, 'FORBIDDEN', 'Liquidator access required');
    }

    const validationResult = ConfirmLiquidateDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid liquidation confirmation payload', {
        errors: validationResult.error.format(),
      });
    }

    const { id: poolId, borrowerId } = ctx.params;
    const { txHash, liquidator: bodyLiquidator } = validationResult.data;
    const expectedLiquidator = bodyLiquidator ?? ctx.headers['x-liquidator-wallet'];

    const pool = await this.requireLinkedPool(poolId, false);
    const borrower = await userRepository.findById(borrowerId);
    if (!borrower || !borrower.walletAddress) {
      throw ApiError.notFound(`Borrower with id ${borrowerId} not found`);
    }

    const contractId = this.requireDefiRwaContractId();
    const verified = await stellarService.verifyLendingTransaction(txHash, contractId, 'liquidate');

    if (verified.call.kind !== 'liquidate') {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Expected a liquidate contract call');
    }

    if (verified.sourceAccount !== verified.call.actor) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Transaction source account does not match liquidator argument',
      );
    }

    if (
      expectedLiquidator &&
      (verified.sourceAccount !== expectedLiquidator || verified.call.actor !== expectedLiquidator)
    ) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'Transaction actor does not match the liquidator wallet',
      );
    }

    if (verified.call.poolId !== pool.contractPoolId) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Transaction targets a different lending pool');
    }

    if (verified.call.borrowerAddress !== borrower.walletAddress) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Transaction liquidates a different borrower');
    }

    if (verified.call.debtToCover <= 0n) {
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        'Liquidated debt amount must be greater than zero',
      );
    }

    const snapshot = await stellarService.readLendingStateFromChain({
      contractId,
      contractPoolId: pool.contractPoolId,
      userWallet: borrower.walletAddress,
      kind: 'borrow',
      readerPublicKey: verified.sourceAccount,
    });

    const availableLiquidityUnits =
      snapshot.totalDeposits > snapshot.totalBorrows
        ? snapshot.totalDeposits - snapshot.totalBorrows
        : 0n;

    const liquidatorUser = await userRepository.getOrCreateByWallet(verified.sourceAccount);
    const formattedDebtCovered = formatBigIntAsDecimalString(
      verified.call.debtToCover,
      TOKEN_DECIMALS,
    );

    const result = await lendingRepository.recordConfirmedLendingAction({
      txHash: verified.txHash,
      action: 'liquidate',
      poolId: pool.id,
      contractPoolId: pool.contractPoolId,
      contractId,
      actorUserId: liquidatorUser.id,
      actorWallet: verified.sourceAccount,
      positionUserId: borrower.id,
      toUserId: borrower.id,
      amount: formattedDebtCovered,
      asset: pool.asset,
      totalDeposits: formatBigIntAsDecimalString(snapshot.totalDeposits, TOKEN_DECIMALS),
      totalBorrows: formatBigIntAsDecimalString(snapshot.totalBorrows, TOKEN_DECIMALS),
      availableLiquidity: formatBigIntAsDecimalString(availableLiquidityUnits, TOKEN_DECIMALS),
      utilizationRate: this.formatUtilizationRate(snapshot.totalDeposits, snapshot.totalBorrows),
      kind: 'borrow',
      depositPosition: null,
      borrowPosition: snapshot.borrowPosition
        ? {
            principal: formatBigIntAsDecimalString(
              snapshot.borrowPosition.principal,
              TOKEN_DECIMALS,
            ),
            collateralAmount: formatBigIntAsDecimalString(
              snapshot.borrowPosition.collateralAmount,
              TOKEN_DECIMALS,
            ),
            collateralAsset: snapshot.borrowPosition.collateralAsset,
            healthFactor: this.formatHealthFactor(snapshot.borrowPosition.healthFactor),
          }
        : null,
    });

    if (result.recorded) {
      await cacheService.invalidate(`${POOLS_CACHE_PREFIX}*`);
      try {
        const positionId = `${pool.id}-${borrower.id}`;
        const notificationService = new NotificationService();
        await notificationService.notifyLiquidationExecuted(
          borrower.id,
          positionId,
          parseFloat(formattedDebtCovered),
          0,
          'IN_APP',
        );
      } catch {
        // Notification delivery failure must not roll back a confirmed chain state write.
      }
    }

    return this.jsonResponse({
      txHash: result.txHash,
      poolId: pool.id,
      contractPoolId: pool.contractPoolId,
      borrowerId: borrower.id,
      borrowerAddress: borrower.walletAddress,
      liquidator: verified.sourceAccount,
      debtCovered: formattedDebtCovered,
      position: result.borrowPosition,
      pool: result.pool,
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
