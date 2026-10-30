import { randomUUID } from 'node:crypto';
import type { AuthContext } from '../middleware/auth';
import { ApiError } from '../errors/ApiError';
import {
  lendingRepository,
  type ConfirmedLendingAction,
  type LendingActionResult,
  type LendingActionType,
} from '../repositories/LendingRepository';
import { userRepository } from '../repositories/UserRepository';
import type { LendingPool, Transaction } from '../db/schema';

import {
  CreatePoolDto,
  DepositDto,
  WithdrawDto,
  BorrowDto,
  RepayDto,
  ConfirmLendingDto,
  PrepareLiquidationDto,
  ConfirmLiquidationDto,
} from '../dto/lending.dto';
import { positionService } from '../services/PositionService';
import { NotificationService } from '../services/NotificationService';
import { cacheService } from '../services/CacheService';
import { logger } from '../services/logger';
import { stellarService, type VerifiedLendingCall } from '../services/StellarService';
import { isLiquidatorAuthorized } from '../utils/liquidatorAuth';
import { isInternalOperationsAuthorized } from '../utils/internalOperationsAuth';
import { getDefiRwaContractId } from '../config/contracts';
import { formatTokenUnits } from '../utils/paymentAmount';
import { parseContractFactor, parseTokenAmount } from '../utils/lendingChainValues';

const POOLS_CACHE_TTL = 10; // seconds
const POOLS_CACHE_PREFIX = 'lending:pools:';

/** The user-signed pool actions, each settled by one defi-rwa function. */
export type LendingUserAction = 'deposit' | 'withdraw' | 'borrow' | 'repay';

const USER_ACTION_POSITION: Record<LendingUserAction, 'deposit' | 'borrow'> = {
  deposit: 'deposit',
  withdraw: 'deposit',
  borrow: 'borrow',
  repay: 'borrow',
};

type PoolActionContext = AuthContext & {
  params: { id: string };
  body: unknown;
};

type LiquidationContext = {
  params: { id: string; borrowerId: string };
  headers: Record<string, string | undefined>;
  body: unknown;
};

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

  private static parseBody<T>(
    schema: {
      safeParse(
        value: unknown,
      ): { success: true; data: T } | { success: false; error: { format(): unknown } };
    },
    body: unknown,
    message: string,
  ): T {
    const result = schema.safeParse(body);
    if (!result.success) {
      throw new ApiError(400, 'VALIDATION_ERROR', message, { errors: result.error.format() });
    }
    return result.data;
  }

  private static toUnits(value: string, field: string): bigint {
    try {
      return parseTokenAmount(value);
    } catch (error) {
      throw new ApiError(400, 'VALIDATION_ERROR', `Invalid ${field}`, {
        errors: { [field]: [(error as Error).message] },
      });
    }
  }

  /** The configured defi-rwa contract; lending cannot settle without it. */
  private static requireContractId(): string {
    const contractId = getDefiRwaContractId();
    if (!contractId) {
      throw new ApiError(
        503,
        'CHAIN_NOT_CONFIGURED',
        'The defi-rwa contract is not configured. Set DEFI_RWA_CONTRACT_ID or the network deployment artifact.',
      );
    }
    return contractId;
  }

  /** A pool that exists on-chain, so its actions can be settled there. */
  private static async requireChainPool(
    poolId: string,
    options: { active: boolean },
  ): Promise<LendingPool & { contractPoolId: string }> {
    const pool = options.active
      ? await lendingRepository.findActivePool(poolId)
      : await lendingRepository.findById(poolId);
    if (!pool) {
      throw new ApiError(
        404,
        'NOT_FOUND',
        options.active
          ? `Active pool with id ${poolId} not found`
          : `Pool with id ${poolId} not found`,
      );
    }
    if (!pool.contractPoolId) {
      throw new ApiError(
        409,
        'POOL_NOT_ON_CHAIN',
        'This pool has no on-chain counterpart, so it cannot settle transactions',
      );
    }
    return pool as LendingPool & { contractPoolId: string };
  }

  private static requireWallet(user: { walletAddress?: string }): string {
    if (!user.walletAddress) {
      throw new ApiError(401, 'UNAUTHORIZED', 'A wallet address is required for this action');
    }
    return user.walletAddress;
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
   * Create a new lending pool (operator only, checked here and by the route).
   *
   * The pool is created on-chain first with the admin key. The database row,
   * carrying the on-chain `contract_pool_id`, is only inserted once that
   * transaction has succeeded.
   */
  static async createPool(ctx: {
    body: unknown;
    headers: Record<string, string | undefined>;
  }): Promise<Response> {
    if (!isInternalOperationsAuthorized(ctx.headers)) {
      throw new ApiError(403, 'FORBIDDEN', 'Operator access required');
    }
    const data = this.parseBody(CreatePoolDto, ctx.body, 'Invalid pool data');

    let factors: {
      collateralFactor: bigint;
      liquidationThreshold: bigint;
      liquidationPenalty: bigint;
      closeFactor: bigint;
    };
    try {
      factors = {
        collateralFactor: parseContractFactor(data.collateralFactor),
        liquidationThreshold: parseContractFactor(data.liquidationThreshold),
        liquidationPenalty: parseContractFactor(data.liquidationPenalty),
        closeFactor: parseContractFactor(data.closeFactor),
      };
    } catch (error) {
      throw new ApiError(400, 'VALIDATION_ERROR', (error as Error).message);
    }
    if (factors.closeFactor === BigInt(0)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Close factor must be greater than zero');
    }

    const contractId = this.requireContractId();
    const adminPublicKey = process.env.STELLAR_ADMIN_PUBLIC_KEY;
    const adminSecret = process.env.STELLAR_ADMIN_SECRET;
    if (!adminPublicKey || !adminSecret) {
      throw new ApiError(
        503,
        'CHAIN_NOT_CONFIGURED',
        'Admin credentials are not configured, so the pool cannot be created on-chain',
      );
    }

    const contractPoolId = data.contractPoolId ?? randomUUID();
    if (await lendingRepository.findByContractPoolId(contractPoolId)) {
      throw ApiError.conflict(`A pool with contract pool id ${contractPoolId} already exists`);
    }

    const { txHash } = await stellarService.createLendingPool({
      contractId,
      adminPublicKey,
      adminSecret,
      poolId: contractPoolId,
      name: data.name,
      asset: data.asset,
      assetAddress: data.assetAddress,
      ...factors,
      reserveFactor: data.reserveFactor,
    });

    let pool: LendingPool;
    try {
      pool = await lendingRepository.create({
        contractPoolId,
        name: data.name,
        asset: data.asset,
        assetAddress: data.assetAddress,
        collateralFactor: data.collateralFactor,
        liquidationThreshold: data.liquidationThreshold,
        liquidationPenalty: data.liquidationPenalty,
        reserveFactor: data.reserveFactor,
      });
    } catch (error) {
      // The pool exists on-chain but not in the database. Log everything an
      // operator needs to insert the row by hand.
      logger.error('Lending pool created on-chain but not recorded', {
        error,
        operation: 'LENDING_CREATE_POOL',
        contractPoolId,
        txHash,
      });
      throw ApiError.internal(
        `Pool ${contractPoolId} was created on-chain (tx ${txHash}) but could not be recorded`,
      );
    }

    await cacheService.invalidate(`${POOLS_CACHE_PREFIX}*`);
    return this.jsonResponse({ ...pool, txHash }, 201);
  }

  /**
   * Step 1 of a deposit, withdrawal, borrow or repayment: return a simulated,
   * unsigned defi-rwa transaction with the user's wallet as source. The user
   * signs and submits it; nothing is written here.
   */
  static async prepareAction(action: LendingUserAction, ctx: PoolActionContext): Promise<Response> {
    const user = await this.resolveAuthenticatedUser(ctx);
    const wallet = this.requireWallet(user);
    const contractId = this.requireContractId();
    const pool = await this.requireChainPool(ctx.params.id, { active: action !== 'repay' });

    let args: unknown[];
    let amount: bigint;
    if (action === 'borrow') {
      const body = this.parseBody(BorrowDto, ctx.body, 'Invalid borrow data');
      amount = this.toUnits(body.borrowAmount, 'borrowAmount');
      const collateralAmount = this.toUnits(body.collateralAmount, 'collateralAmount');
      args = [wallet, pool.contractPoolId, amount, body.collateralAsset, collateralAmount];
    } else {
      const schema =
        action === 'deposit' ? DepositDto : action === 'withdraw' ? WithdrawDto : RepayDto;
      const body = this.parseBody(schema, ctx.body, `Invalid ${action} data`);
      amount = this.toUnits(body.amount, 'amount');
      args = [wallet, pool.contractPoolId, amount];
    }

    const prepared = await stellarService.prepareLendingCall({
      contractId,
      source: wallet,
      functionName: action,
      args,
    });

    return this.jsonResponse({
      xdr: prepared.xdr,
      contractId: prepared.contractId,
      action,
      poolId: pool.id,
      contractPoolId: pool.contractPoolId,
      amount: formatTokenUnits(amount),
    });
  }

  /**
   * Step 2: verify the submitted transaction on Soroban RPC and only then
   * refresh the cached position and pool totals from the contract. Nothing
   * is written unless the transaction succeeded on the configured contract,
   * called the expected function on this pool, and was signed by the
   * authenticated wallet. Confirming a recorded hash returns the recorded
   * result without writing again.
   */
  static async confirmAction(action: LendingUserAction, ctx: PoolActionContext): Promise<Response> {
    const user = await this.resolveAuthenticatedUser(ctx);
    const wallet = this.requireWallet(user);
    const { txHash } = this.parseBody(ConfirmLendingDto, ctx.body, 'Invalid confirmation data');
    const contractId = this.requireContractId();
    const pool = await this.requireChainPool(ctx.params.id, { active: false });

    const recorded = await lendingRepository.findRecordedAction(txHash);
    if (recorded) {
      return this.jsonResponse(this.recordedResult(recorded, action, pool.id, wallet));
    }

    const verified = await stellarService.verifyLendingCall(txHash, contractId, action);
    this.assertSignedBy(verified, wallet);
    this.assertPool(verified, pool.contractPoolId);

    const actor = await userRepository.findById(user.id);
    if (!actor) {
      throw ApiError.notFound('Authenticated user not found');
    }

    const confirmed: ConfirmedLendingAction = {
      txHash: verified.txHash,
      type: action,
      poolId: pool.id,
      contractPoolId: pool.contractPoolId,
      position: USER_ACTION_POSITION[action],
      positionUserId: actor.id,
      fromUserId: actor.id,
      amount: formatTokenUnits(verified.amount),
      asset: pool.assetAddress,
      metadata: {
        action,
        poolId: pool.id,
        contractPoolId: pool.contractPoolId,
        actor: wallet,
        ...(verified.collateralAsset
          ? {
              collateralAsset: verified.collateralAsset,
              collateralAmount: formatTokenUnits(verified.collateralAmount ?? BigInt(0)),
            }
          : {}),
      },
    };

    const applied = await lendingRepository.applyConfirmedAction(confirmed, () =>
      stellarService.readLendingState(
        contractId,
        pool.contractPoolId,
        wallet,
        USER_ACTION_POSITION[action],
      ),
    );
    if (!applied.recorded) {
      return this.jsonResponse(this.recordedResult(applied.transaction, action, pool.id, wallet));
    }

    await cacheService.invalidate(`${POOLS_CACHE_PREFIX}*`);
    logger.info('Lending action confirmed', {
      operation: `LENDING_${action.toUpperCase()}_CONFIRM`,
      entity: 'lending_pool',
      entityId: pool.id,
      userId: actor.id,
      txHash: verified.txHash,
    });

    if (action === 'repay') {
      await this.notifySafely(() =>
        new NotificationService().notifyRepaymentProcessed(
          actor.id,
          pool.id,
          Number(confirmed.amount),
          'IN_APP',
        ),
      );
    }

    return this.jsonResponse(applied.result);
  }

  /**
   * Step 1 of a liquidation (liquidator role required): build
   * `liquidate(liquidator, contract_pool_id, borrower_address, debt_to_cover)`
   * for the liquidator to sign. The borrower's wallet is resolved from their
   * user id. The contract decides whether the position is underwater; a
   * position that is not comes back from the simulation as a 400.
   */
  static async prepareLiquidation(ctx: LiquidationContext): Promise<Response> {
    if (!isLiquidatorAuthorized(ctx.headers)) {
      throw new ApiError(403, 'FORBIDDEN', 'Liquidator access required');
    }
    const body = this.parseBody(PrepareLiquidationDto, ctx.body, 'Invalid liquidation data');
    const debtToCover = this.toUnits(body.debtToCover, 'debtToCover');
    const contractId = this.requireContractId();
    const pool = await this.requireChainPool(ctx.params.id, { active: true });
    const borrowerWallet = await this.resolveBorrowerWallet(ctx.params.borrowerId);

    const prepared = await stellarService.prepareLendingCall({
      contractId,
      source: body.liquidator,
      functionName: 'liquidate',
      args: [body.liquidator, pool.contractPoolId, borrowerWallet, debtToCover],
    });

    return this.jsonResponse({
      xdr: prepared.xdr,
      contractId: prepared.contractId,
      action: 'liquidation',
      poolId: pool.id,
      contractPoolId: pool.contractPoolId,
      borrowerId: ctx.params.borrowerId,
      borrowerAddress: borrowerWallet,
      debtToCover: formatTokenUnits(debtToCover),
    });
  }

  /**
   * Step 2 of a liquidation: verify the liquidator-signed `liquidate`
   * transaction like any other lending confirmation, then refresh the
   * borrower's position from the contract. If the transaction failed on-chain
   * this throws before touching the database, so the position stays as it was.
   */
  static async confirmLiquidation(ctx: LiquidationContext): Promise<Response> {
    if (!isLiquidatorAuthorized(ctx.headers)) {
      throw new ApiError(403, 'FORBIDDEN', 'Liquidator access required');
    }
    const body = this.parseBody(ConfirmLiquidationDto, ctx.body, 'Invalid confirmation data');
    const contractId = this.requireContractId();
    const pool = await this.requireChainPool(ctx.params.id, { active: false });
    const { borrowerId } = ctx.params;

    const recorded = await lendingRepository.findRecordedAction(body.txHash);
    if (recorded) {
      return this.jsonResponse(
        this.recordedResult(recorded, 'liquidation', pool.id, body.liquidator),
      );
    }

    const borrowerWallet = await this.resolveBorrowerWallet(borrowerId);
    const verified = await stellarService.verifyLendingCall(body.txHash, contractId, 'liquidate');
    this.assertSignedBy(verified, body.liquidator);
    this.assertPool(verified, pool.contractPoolId);
    if (verified.borrower !== borrowerWallet) {
      throw ApiError.validation('The transaction liquidates a different borrower');
    }

    const liquidator = await userRepository.getOrCreateByWallet(body.liquidator);
    const confirmed: ConfirmedLendingAction = {
      txHash: verified.txHash,
      type: 'liquidation',
      poolId: pool.id,
      contractPoolId: pool.contractPoolId,
      position: 'borrow',
      positionUserId: borrowerId,
      fromUserId: liquidator.id,
      toUserId: borrowerId,
      amount: formatTokenUnits(verified.amount),
      asset: pool.assetAddress,
      metadata: {
        action: 'liquidation',
        poolId: pool.id,
        contractPoolId: pool.contractPoolId,
        actor: body.liquidator,
        borrowerId,
        borrowerAddress: borrowerWallet,
      },
    };

    const [previous] = await lendingRepository.getUserBorrows(pool.id, borrowerId);
    const applied = await lendingRepository.applyConfirmedAction(confirmed, () =>
      stellarService.readLendingState(contractId, pool.contractPoolId, borrowerWallet, 'borrow'),
    );
    if (!applied.recorded) {
      return this.jsonResponse(
        this.recordedResult(applied.transaction, 'liquidation', pool.id, body.liquidator),
      );
    }

    await cacheService.invalidate(`${POOLS_CACHE_PREFIX}*`);
    logger.info('Liquidation confirmed', {
      operation: 'LENDING_LIQUIDATION_CONFIRM',
      entity: 'lending_pool',
      entityId: pool.id,
      userId: borrowerId,
      txHash: verified.txHash,
    });

    const remainingCollateral = Number(
      (applied.result.position as { collateralAmount?: string } | null)?.collateralAmount ?? 0,
    );
    const collateralSeized = previous
      ? Math.max(0, Number(previous.collateralAmount) - remainingCollateral)
      : 0;
    await this.notifySafely(() =>
      new NotificationService().notifyLiquidationExecuted(
        borrowerId,
        `${pool.id}-${borrowerId}`,
        Number(confirmed.amount),
        collateralSeized,
        'IN_APP',
      ),
    );

    return this.jsonResponse(applied.result);
  }

  /** The tx must be signed by `wallet` and name it as the acting account. */
  private static assertSignedBy(verified: VerifiedLendingCall, wallet: string): void {
    if (verified.sourceAccount !== wallet || verified.actor !== wallet) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'The transaction was not signed by the authenticated wallet',
      );
    }
  }

  private static assertPool(verified: VerifiedLendingCall, contractPoolId: string): void {
    if (verified.poolId !== contractPoolId) {
      throw ApiError.validation('The transaction acts on a different pool');
    }
  }

  private static async resolveBorrowerWallet(borrowerId: string): Promise<string> {
    const borrower = await userRepository.findById(borrowerId);
    if (!borrower) {
      throw ApiError.notFound(`Borrower ${borrowerId} not found`);
    }
    return borrower.walletAddress;
  }

  /**
   * The result stored when a hash was first confirmed. A hash recorded for a
   * different action, pool or signer is a conflict, not a replay.
   */
  private static recordedResult(
    recorded: Transaction,
    action: LendingActionType,
    poolId: string,
    actor: string,
  ): LendingActionResult {
    const metadata = (recorded.metadata ?? {}) as {
      action?: string;
      poolId?: string;
      actor?: string;
      result?: LendingActionResult;
    };
    if (
      metadata.action !== action ||
      metadata.poolId !== poolId ||
      metadata.actor !== actor ||
      !metadata.result
    ) {
      throw ApiError.conflict('Transaction hash was already recorded for another action');
    }
    return metadata.result;
  }

  /** Notifications follow a recorded chain action; failing to send one must not undo it. */
  private static async notifySafely(send: () => Promise<unknown>): Promise<void> {
    try {
      await send();
    } catch (error) {
      logger.warn('Lending notification failed', { error, operation: 'LENDING_NOTIFY' });
    }
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
