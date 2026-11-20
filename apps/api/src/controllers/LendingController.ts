import type { AuthContext } from '../middleware/auth';
import { ApiError } from '../errors/ApiError';
import { lendingRepository, type PoolTotalsSnapshot } from '../repositories/LendingRepository';
import { userRepository } from '../repositories/UserRepository';
import {
  CreatePoolDto,
  ConfirmActionDto,
  LiquidatePrepareDto,
  DepositDto,
  WithdrawDto,
  BorrowDto,
  RepayDto,
} from '../dto/lending.dto';
import { positionService } from '../services/PositionService';
import { NotificationService } from '../services/NotificationService';
import { cacheService } from '../services/CacheService';
import {
  stellarService,
  type LendingAction,
  type LendingPoolTotals,
  type VerifiedContractTransaction,
} from '../services/StellarService';
import { getDefiRwaContractId } from '../config/contracts';
import { formatBigIntAsDecimalString, parseDecimalStringToBigInt } from '@akkuea/shared';
import { randomUUID } from 'node:crypto';

const POOLS_CACHE_TTL = 10; // seconds
const POOLS_CACHE_PREFIX = 'lending:pools:';

/** Token amounts are Soroban i128 values with 7 decimals. */
const TOKEN_DECIMALS = 7;
/** Pool factors (collateral, liquidation, close) use 18 decimal PRECISION units. */
const FACTOR_DECIMALS = 18;

export class LendingController {
  private static async resolveAuthenticatedUser(
    ctx: AuthContext,
  ): Promise<{ id: string; walletAddress: string }> {
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

  private static requireLendingContractId(): string {
    const contractId = getDefiRwaContractId();
    if (!contractId) {
      throw ApiError.internal(
        'Lending contract is not configured. Set DEFI_RWA_CONTRACT_ID or the network deployment artifact.',
      );
    }
    return contractId;
  }

  private static requireContractPoolId(pool: { contractPoolId?: string | null }): string {
    if (!pool.contractPoolId) {
      throw new ApiError(
        409,
        'POOL_NOT_ON_CHAIN',
        'This pool has no contract_pool_id; it was not created on the lending contract',
      );
    }
    return pool.contractPoolId;
  }

  private static async resolvePoolForAction(poolId: string) {
    const pool = await lendingRepository.findActivePool(poolId);
    if (!pool) {
      throw new ApiError(404, 'NOT_FOUND', `Active pool with id ${poolId} not found`);
    }
    return pool;
  }

  private static requireStringArg(args: unknown[], index: number, label: string): string {
    const value = args[index];
    if (typeof value !== 'string') {
      throw ApiError.validation(`Transaction is missing the ${label} argument`);
    }
    return value;
  }

  private static requireBigIntArg(args: unknown[], index: number, label: string): bigint {
    const value = args[index];
    if (typeof value === 'bigint') {
      return value;
    }
    if (typeof value === 'number' && Number.isInteger(value)) {
      return BigInt(value);
    }
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      return BigInt(value);
    }
    throw ApiError.validation(`Transaction is missing the ${label} argument`);
  }

  private static unitsToDecimal(value: bigint): string {
    return formatBigIntAsDecimalString(value, TOKEN_DECIMALS);
  }

  private static decimalToUnits(value: string): bigint {
    return parseDecimalStringToBigInt(value, TOKEN_DECIMALS);
  }

  private static factorToUnits(value: string): bigint {
    return parseDecimalStringToBigInt(value, FACTOR_DECIMALS);
  }

  /** Contract health factor (1.0 = 1e18) stored in the 4-decimal column. */
  private static healthFactorToDecimal(value: bigint | null): string {
    if (value === null) {
      return '0.0000';
    }
    return formatBigIntAsDecimalString(value / BigInt(10) ** BigInt(FACTOR_DECIMALS - 4), 4);
  }

  private static toPoolTotals(totals: LendingPoolTotals): PoolTotalsSnapshot {
    return {
      totalDeposits: this.unitsToDecimal(totals.totalDeposits),
      totalBorrows: this.unitsToDecimal(totals.totalBorrows),
      availableLiquidity: this.unitsToDecimal(totals.availableLiquidity),
    };
  }

  /**
   * Both the transaction source and its first contract argument must be the
   * authenticated wallet; anything else is someone else's action.
   */
  private static assertActor(verified: VerifiedContractTransaction, walletAddress: string): void {
    const actor = verified.args[0];
    if (verified.sourceAccount !== walletAddress || actor !== walletAddress) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'The transaction was not signed by the authenticated wallet',
      );
    }
  }

  private static async invalidatePoolsCache(): Promise<void> {
    await cacheService.invalidate(`${POOLS_CACHE_PREFIX}*`);
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
   * Create a lending pool on-chain first, then cache it in Postgres. This is an
   * operator-only action; the route guard authenticates the operations caller.
   */
  static async createPool(ctx: { body: unknown }): Promise<Response> {
    const validationResult = CreatePoolDto.safeParse(ctx.body);
    if (!validationResult.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid pool data', {
        errors: validationResult.error.format(),
      });
    }

    const data = validationResult.data;
    const contractId = this.requireLendingContractId();
    const adminPublicKey = process.env.STELLAR_ADMIN_PUBLIC_KEY;
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;
    if (!adminPublicKey || !adminSecret) {
      throw ApiError.internal(
        'Stellar admin signer is not configured. Set STELLAR_ADMIN_PUBLIC_KEY and STELLAR_ADMIN_SECRET.',
      );
    }

    // The database UUID doubles as the contract pool id, so one identifier maps
    // a cached row to exactly one on-chain pool.
    const poolId = randomUUID();

    await stellarService.createLendingPool({
      contractId,
      adminPublicKey,
      adminSecret,
      poolId,
      name: data.name,
      asset: data.asset,
      assetAddress: data.assetAddress,
      collateralFactor: this.factorToUnits(data.collateralFactor),
      liquidationThreshold: this.factorToUnits(data.liquidationThreshold),
      liquidationPenalty: this.factorToUnits(data.liquidationPenalty),
      closeFactor: this.factorToUnits(data.closeFactor),
      reserveFactor: data.reserveFactor,
    });

    // Only reached when the contract call succeeded.
    const pool = await lendingRepository.create({
      id: poolId,
      contractPoolId: poolId,
      name: data.name,
      asset: data.asset,
      assetAddress: data.assetAddress,
      collateralFactor: data.collateralFactor,
      liquidationThreshold: data.liquidationThreshold,
      liquidationPenalty: data.liquidationPenalty,
      reserveFactor: data.reserveFactor,
    });

    await this.invalidatePoolsCache();
    return this.jsonResponse(pool, 201);
  }

  /**
   * Database-only writes are gone: balances and positions may only change after
   * a verified on-chain transaction.
   */
  private static gone(action: 'deposit' | 'withdraw' | 'borrow' | 'repay'): Response {
    return this.jsonResponse(
      {
        success: false,
        error: 'GONE',
        message: `POST /lending/pools/:id/${action} no longer writes to Postgres. Use POST /lending/pools/:id/${action}/prepare, sign and submit the returned XDR, then POST /lending/pools/:id/${action}/confirm with the transaction hash.`,
        timestamp: new Date().toISOString(),
      },
      410,
    );
  }

  static async deposit(): Promise<Response> {
    return this.gone('deposit');
  }

  static async withdraw(): Promise<Response> {
    return this.gone('withdraw');
  }

  static async borrow(): Promise<Response> {
    return this.gone('borrow');
  }

  static async repay(): Promise<Response> {
    return this.gone('repay');
  }

  private static async prepareAction(
    ctx: AuthContext & { params: { id: string }; body: unknown },
    action: LendingAction,
    parseBody: (body: unknown) => {
      amount?: string;
      borrowAmount?: string;
      collateralAmount?: string;
      collateralAsset?: string;
    },
  ): Promise<Response> {
    const user = await this.resolveAuthenticatedUser(ctx);
    const pool = await this.resolvePoolForAction(ctx.params.id);
    const contractPoolId = this.requireContractPoolId(pool);
    const contractId = this.requireLendingContractId();
    const data = parseBody(ctx.body);

    const amountValue = action === 'borrow' ? data.borrowAmount : data.amount;
    if (!amountValue) {
      throw ApiError.badRequest('Amount is required');
    }

    const { xdr } = await stellarService.prepareLendingAction({
      contractId,
      action,
      wallet: user.walletAddress,
      poolId: contractPoolId,
      amount: this.decimalToUnits(amountValue),
      ...(action === 'borrow'
        ? {
            collateralAsset: data.collateralAsset,
            collateralAmount: data.collateralAmount
              ? this.decimalToUnits(data.collateralAmount)
              : undefined,
          }
        : {}),
    });

    return this.jsonResponse({
      action,
      xdr,
      contractId,
      contractPoolId,
      poolId: pool.id,
      sourceAccount: user.walletAddress,
    });
  }

  static async prepareDeposit(
    ctx: AuthContext & { params: { id: string }; body: unknown },
  ): Promise<Response> {
    return this.prepareAction(ctx, 'deposit', (body) => {
      const parsed = DepositDto.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid deposit data', {
          errors: parsed.error.format(),
        });
      }
      return parsed.data;
    });
  }

  static async prepareWithdraw(
    ctx: AuthContext & { params: { id: string }; body: unknown },
  ): Promise<Response> {
    return this.prepareAction(ctx, 'withdraw', (body) => {
      const parsed = WithdrawDto.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid withdrawal data', {
          errors: parsed.error.format(),
        });
      }
      return parsed.data;
    });
  }

  static async prepareBorrow(
    ctx: AuthContext & { params: { id: string }; body: unknown },
  ): Promise<Response> {
    return this.prepareAction(ctx, 'borrow', (body) => {
      const parsed = BorrowDto.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid borrow data', {
          errors: parsed.error.format(),
        });
      }
      return parsed.data;
    });
  }

  static async prepareRepay(
    ctx: AuthContext & { params: { id: string }; body: unknown },
  ): Promise<Response> {
    return this.prepareAction(ctx, 'repay', (body) => {
      const parsed = RepayDto.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid repayment data', {
          errors: parsed.error.format(),
        });
      }
      return parsed.data;
    });
  }

  /**
   * Verifies a submitted lending transaction, reads the resulting position and
   * pool totals from the contract, and only then refreshes Postgres.
   */
  private static async confirmAction(
    ctx: AuthContext & { params: { id: string }; body: unknown },
    action: LendingAction,
  ): Promise<Response> {
    const user = await this.resolveAuthenticatedUser(ctx);
    const body = ConfirmActionDto.safeParse(ctx.body);
    if (!body.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid confirmation data', {
        errors: body.error.format(),
      });
    }

    const pool = await lendingRepository.findById(ctx.params.id);
    if (!pool) {
      throw new ApiError(404, 'NOT_FOUND', `Pool with id ${ctx.params.id} not found`);
    }
    const contractPoolId = this.requireContractPoolId(pool);
    const contractId = this.requireLendingContractId();

    const verified = await stellarService.verifyContractTransaction(
      body.data.txHash,
      contractId,
      action,
    );
    this.assertActor(verified, user.walletAddress);

    const callPoolId = this.requireStringArg(verified.args, 1, 'pool_id');
    if (callPoolId !== contractPoolId) {
      throw ApiError.validation('Transaction targets a different pool');
    }
    const amountUnits = this.requireBigIntArg(verified.args, 2, 'amount');

    const totals = await stellarService.getLendingPoolTotals(
      contractId,
      contractPoolId,
      user.walletAddress,
    );
    const poolTotals = this.toPoolTotals(totals);

    let deposit: { amount: string; shares: string } | null | undefined;
    let borrow:
      | {
          principal: string;
          collateralAmount: string;
          collateralAsset: string;
          healthFactor: string;
        }
      | null
      | undefined;

    if (action === 'deposit' || action === 'withdraw') {
      const position = await stellarService.getLendingDepositPosition(
        contractId,
        contractPoolId,
        user.walletAddress,
        user.walletAddress,
      );
      if (!position) {
        if (action === 'deposit') {
          throw ApiError.validation('Contract did not return a deposit position after the deposit');
        }
        deposit = null;
      } else {
        deposit = {
          amount: this.unitsToDecimal(position.amount),
          shares: this.unitsToDecimal(position.shares),
        };
      }
    } else {
      const position = await stellarService.getLendingBorrowPosition(
        contractId,
        contractPoolId,
        user.walletAddress,
        user.walletAddress,
      );
      if (!position) {
        if (action === 'borrow') {
          throw ApiError.validation('Contract did not return a borrow position after the borrow');
        }
        borrow = null;
      } else {
        const healthFactor = await stellarService.getLendingHealthFactor(
          contractId,
          contractPoolId,
          user.walletAddress,
          user.walletAddress,
        );
        borrow = {
          principal: this.unitsToDecimal(position.principal),
          collateralAmount: this.unitsToDecimal(position.collateralAmount),
          collateralAsset: position.collateralAsset,
          healthFactor: this.healthFactorToDecimal(healthFactor),
        };
      }
    }

    const result = await lendingRepository.recordConfirmedAction({
      type: action,
      hash: verified.txHash,
      userId: user.id,
      amount: this.unitsToDecimal(amountUnits),
      asset: pool.asset,
      poolId: pool.id,
      contractPoolId,
      metadata: { contractId, function: action, walletAddress: user.walletAddress },
      poolTotals,
      ...(deposit !== undefined ? { deposit } : {}),
      ...(borrow !== undefined ? { borrow } : {}),
    });

    await this.invalidatePoolsCache();

    return this.jsonResponse({
      action,
      txHash: verified.txHash,
      poolId: pool.id,
      contractPoolId,
      recorded: result.recorded,
      position: deposit !== undefined ? deposit : borrow,
      poolTotals,
    });
  }

  static async confirmDeposit(
    ctx: AuthContext & { params: { id: string }; body: unknown },
  ): Promise<Response> {
    return this.confirmAction(ctx, 'deposit');
  }

  static async confirmWithdraw(
    ctx: AuthContext & { params: { id: string }; body: unknown },
  ): Promise<Response> {
    return this.confirmAction(ctx, 'withdraw');
  }

  static async confirmBorrow(
    ctx: AuthContext & { params: { id: string }; body: unknown },
  ): Promise<Response> {
    return this.confirmAction(ctx, 'borrow');
  }

  static async confirmRepay(
    ctx: AuthContext & { params: { id: string }; body: unknown },
  ): Promise<Response> {
    return this.confirmAction(ctx, 'repay');
  }

  /**
   * Step 1 of a liquidation: the liquidator asks for an unsigned four-argument
   * `liquidate(liquidator, pool_id, borrower_address, debt_to_cover)` call. The
   * borrower address is resolved from their user ID, never from the caller.
   */
  static async prepareLiquidation(ctx: {
    params: { id: string; borrowerId: string };
    body: unknown;
  }): Promise<Response> {
    const body = LiquidatePrepareDto.safeParse(ctx.body);
    if (!body.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid liquidation data', {
        errors: body.error.format(),
      });
    }

    const pool = await lendingRepository.findById(ctx.params.id);
    if (!pool) {
      throw new ApiError(404, 'NOT_FOUND', `Pool with id ${ctx.params.id} not found`);
    }
    const contractPoolId = this.requireContractPoolId(pool);
    const contractId = this.requireLendingContractId();

    const borrower = await userRepository.findById(ctx.params.borrowerId);
    if (!borrower) {
      throw new ApiError(404, 'NOT_FOUND', `Borrower ${ctx.params.borrowerId} not found`);
    }

    const { xdr } = await stellarService.prepareLiquidation({
      contractId,
      liquidator: body.data.liquidator,
      poolId: contractPoolId,
      borrowerAddress: borrower.walletAddress,
      debtToCover: this.decimalToUnits(body.data.debtToCover),
    });

    return this.jsonResponse({
      xdr,
      contractId,
      contractPoolId,
      poolId: pool.id,
      borrowerId: borrower.id,
      borrowerAddress: borrower.walletAddress,
      liquidator: body.data.liquidator,
      debtToCover: body.data.debtToCover,
    });
  }

  /**
   * Step 2 of a liquidation: verify the submitted four-argument call, refresh
   * the borrower's cached position from the contract, and record it. A failed
   * liquidation never touches the database.
   */
  static async confirmLiquidation(ctx: {
    params: { id: string; borrowerId: string };
    body: unknown;
  }): Promise<Response> {
    const body = ConfirmActionDto.safeParse(ctx.body);
    if (!body.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid confirmation data', {
        errors: body.error.format(),
      });
    }

    const pool = await lendingRepository.findById(ctx.params.id);
    if (!pool) {
      throw new ApiError(404, 'NOT_FOUND', `Pool with id ${ctx.params.id} not found`);
    }
    const contractPoolId = this.requireContractPoolId(pool);
    const contractId = this.requireLendingContractId();

    const borrower = await userRepository.findById(ctx.params.borrowerId);
    if (!borrower) {
      throw new ApiError(404, 'NOT_FOUND', `Borrower ${ctx.params.borrowerId} not found`);
    }

    const verified = await stellarService.verifyContractTransaction(
      body.data.txHash,
      contractId,
      'liquidate',
    );

    const liquidator = this.requireStringArg(verified.args, 0, 'liquidator');
    if (liquidator !== verified.sourceAccount) {
      throw ApiError.validation('The liquidation transaction was not submitted by its liquidator');
    }
    const callPoolId = this.requireStringArg(verified.args, 1, 'pool_id');
    if (callPoolId !== contractPoolId) {
      throw ApiError.validation('Transaction targets a different pool');
    }
    const borrowerAddress = this.requireStringArg(verified.args, 2, 'borrower_address');
    if (borrowerAddress !== borrower.walletAddress) {
      throw ApiError.validation('Transaction liquidates a different borrower');
    }
    const debtUnits = this.requireBigIntArg(verified.args, 3, 'debt_to_cover');

    const totals = await stellarService.getLendingPoolTotals(
      contractId,
      contractPoolId,
      verified.sourceAccount,
    );
    const poolTotals = this.toPoolTotals(totals);

    const position = await stellarService.getLendingBorrowPosition(
      contractId,
      contractPoolId,
      borrower.walletAddress,
      verified.sourceAccount,
    );
    let borrow: {
      principal: string;
      collateralAmount: string;
      collateralAsset: string;
      healthFactor: string;
    } | null = null;
    if (position) {
      const healthFactor = await stellarService.getLendingHealthFactor(
        contractId,
        contractPoolId,
        borrower.walletAddress,
        verified.sourceAccount,
      );
      borrow = {
        principal: this.unitsToDecimal(position.principal),
        collateralAmount: this.unitsToDecimal(position.collateralAmount),
        collateralAsset: position.collateralAsset,
        healthFactor: this.healthFactorToDecimal(healthFactor),
      };
    }

    const result = await lendingRepository.recordConfirmedAction({
      type: 'liquidation',
      hash: verified.txHash,
      userId: borrower.id,
      amount: this.unitsToDecimal(debtUnits),
      asset: pool.asset,
      poolId: pool.id,
      contractPoolId,
      metadata: {
        contractId,
        function: 'liquidate',
        liquidator,
        borrowerAddress: borrower.walletAddress,
      },
      poolTotals,
      borrow,
    });

    await this.invalidatePoolsCache();

    if (result.recorded) {
      const notificationService = new NotificationService();
      await notificationService.notifyLiquidationExecuted(
        borrower.id,
        `${pool.id}-${borrower.id}`,
        Number(this.unitsToDecimal(debtUnits)),
        borrow ? Number(borrow.collateralAmount) : 0,
        'IN_APP',
      );
    }

    return this.jsonResponse({
      action: 'liquidation',
      txHash: verified.txHash,
      poolId: pool.id,
      contractPoolId,
      borrowerId: borrower.id,
      borrowerAddress: borrower.walletAddress,
      liquidator,
      recorded: result.recorded,
      position: borrow,
      poolTotals,
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
