import { eq, and, sql, type SQL } from 'drizzle-orm';
import { db } from '../db';
import {
  lendingPools,
  depositPositions,
  borrowPositions,
  transactions,
  type LendingPool,
  type NewLendingPool,
  type DepositPosition,
  type NewDepositPosition,
  type BorrowPosition,
  type NewBorrowPosition,
  type Transaction,
} from '../db/schema';
import type { DbTransaction } from '../db/types';
import { ApiError } from '../errors/ApiError';
import type { LendingChainState } from '../services/StellarService';
import { formatTokenUnits } from '../utils/paymentAmount';
import {
  formatHealthFactor,
  fromContractTimestamp,
  poolTotalsFromChain,
} from '../utils/lendingChainValues';
import { BaseRepository } from './BaseRepository';

export interface LendingPoolFilter {
  asset?: string;
  isActive?: boolean;
}

export type LendingActionType = 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'liquidation';

/** A lending transaction already verified on-chain, ready to be recorded. */
export interface ConfirmedLendingAction {
  txHash: string;
  type: LendingActionType;
  poolId: string;
  contractPoolId: string;
  /** Whose cached position to refresh from the contract. */
  position: 'deposit' | 'borrow';
  positionUserId: string;
  /** The signer (depositor, borrower or liquidator). */
  fromUserId: string;
  /** The liquidated borrower, for liquidations. */
  toUserId?: string;
  /** Amount from the call arguments, as a 7-decimal string. */
  amount: string;
  asset: string;
  metadata: Record<string, unknown>;
}

/** What a lending confirmation returns, stored so a repeat returns the same. */
export interface LendingActionResult {
  transactionHash: string;
  action: LendingActionType;
  poolId: string;
  contractPoolId: string;
  position: Record<string, unknown> | null;
  pool: {
    totalDeposits: string;
    totalBorrows: string;
    availableLiquidity: string;
    utilizationRate: string;
  };
}

export type AppliedLendingAction =
  { recorded: true; result: LendingActionResult } | { recorded: false; transaction: Transaction };

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class LendingRepository extends BaseRepository<
  typeof lendingPools,
  LendingPool,
  NewLendingPool
> {
  constructor() {
    super(lendingPools);
  }

  async findPaginated(
    options: PaginationOptions,
    filter?: LendingPoolFilter,
  ): Promise<PaginatedResult<LendingPool>> {
    const { page, limit } = options;
    const offset = (page - 1) * limit;

    const conditions = filter ? this.buildFilterConditions(filter) : [];
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(lendingPools)
      .where(whereClause);
    const total = countResult[0]?.count ?? 0;

    const data = await db
      .select()
      .from(lendingPools)
      .where(whereClause)
      .limit(limit)
      .offset(offset);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findActivePool(id: string): Promise<LendingPool | undefined> {
    const results = await db
      .select()
      .from(lendingPools)
      .where(
        and(
          eq(lendingPools.id, id),
          eq(lendingPools.isActive, true),
          eq(lendingPools.isPaused, false),
        ),
      );
    return results[0];
  }

  async findByContractPoolId(contractPoolId: string): Promise<LendingPool | undefined> {
    const results = await db
      .select()
      .from(lendingPools)
      .where(eq(lendingPools.contractPoolId, contractPoolId))
      .limit(1);
    return results[0];
  }

  /** The `transactions` row recorded for a confirmed lending hash, if any. */
  async findRecordedAction(txHash: string): Promise<Transaction | undefined> {
    const results = await db
      .select()
      .from(transactions)
      .where(eq(transactions.hash, txHash))
      .limit(1);
    return results[0];
  }

  /**
   * Records a verified lending transaction and refreshes the cached pool
   * totals and the affected position from the contract, all in one database
   * transaction.
   *
   * The pool row is locked first, so confirmations for the same pool run one
   * at a time and each one reads the chain after the previous one wrote: the
   * last write always reflects the newest chain state. A hash that is
   * already recorded is returned untouched, so confirming twice writes once.
   * If the chain read fails, nothing is written and the confirmation can be
   * retried.
   */
  async applyConfirmedAction(
    action: ConfirmedLendingAction,
    readChainState: () => Promise<LendingChainState>,
  ): Promise<AppliedLendingAction> {
    return await db.transaction(async (tx: DbTransaction) => {
      const [pool] = await tx
        .select({ id: lendingPools.id })
        .from(lendingPools)
        .where(eq(lendingPools.id, action.poolId))
        .for('update');
      if (!pool) {
        throw ApiError.notFound(`Pool with id ${action.poolId} not found`);
      }

      const [existing] = await tx
        .select()
        .from(transactions)
        .where(eq(transactions.hash, action.txHash))
        .limit(1);
      if (existing) {
        return { recorded: false as const, transaction: existing };
      }

      const chain = await readChainState();
      const totals = poolTotalsFromChain(chain.totalDeposits, chain.totalBorrows);
      await tx.update(lendingPools).set(totals).where(eq(lendingPools.id, action.poolId));

      const position =
        action.position === 'deposit'
          ? await this.replaceDepositPosition(tx, action, chain.deposit)
          : await this.replaceBorrowPosition(tx, action, chain.borrow);

      const result: LendingActionResult = {
        transactionHash: action.txHash,
        action: action.type,
        poolId: action.poolId,
        contractPoolId: action.contractPoolId,
        position: position ? JSON.parse(JSON.stringify(position)) : null,
        pool: totals,
      };

      const [inserted] = await tx
        .insert(transactions)
        .values({
          type: action.type,
          hash: action.txHash,
          fromUserId: action.fromUserId,
          toUserId: action.toUserId ?? null,
          amount: action.amount,
          asset: action.asset,
          status: 'confirmed',
          metadata: { ...action.metadata, result },
        })
        .onConflictDoNothing({ target: transactions.hash })
        .returning({ id: transactions.id });
      if (!inserted) {
        // Another confirmation recorded this hash first; roll this one back.
        throw ApiError.conflict('Transaction hash was recorded concurrently, retry to read it');
      }

      return { recorded: true as const, result };
    });
  }

  /** The contract keeps one deposit per (pool, depositor); so does the cache. */
  private async replaceDepositPosition(
    tx: DbTransaction,
    action: ConfirmedLendingAction,
    chain: LendingChainState['deposit'],
  ): Promise<DepositPosition | null> {
    await tx
      .delete(depositPositions)
      .where(
        and(
          eq(depositPositions.poolId, action.poolId),
          eq(depositPositions.depositorId, action.positionUserId),
        ),
      );
    if (!chain) {
      return null;
    }

    const [inserted] = await tx
      .insert(depositPositions)
      .values({
        poolId: action.poolId,
        depositorId: action.positionUserId,
        amount: formatTokenUnits(chain.amount),
        shares: formatTokenUnits(chain.shares),
        accruedInterest: '0',
        depositedAt: fromContractTimestamp(chain.deposited_at),
      } satisfies NewDepositPosition)
      .returning();
    return inserted ?? null;
  }

  /** Upserts the single (pool, borrower) row, or removes it once the contract has. */
  private async replaceBorrowPosition(
    tx: DbTransaction,
    action: ConfirmedLendingAction,
    chain: LendingChainState['borrow'],
  ): Promise<BorrowPosition | null> {
    if (!chain) {
      await tx
        .delete(borrowPositions)
        .where(
          and(
            eq(borrowPositions.poolId, action.poolId),
            eq(borrowPositions.borrowerId, action.positionUserId),
          ),
        );
      return null;
    }

    const values = {
      principal: formatTokenUnits(chain.principal),
      accruedInterest: '0',
      collateralAmount: formatTokenUnits(chain.collateral_amount),
      collateralAsset: chain.collateral_asset,
      healthFactor: formatHealthFactor(chain.healthFactor),
      borrowedAt: fromContractTimestamp(chain.borrowed_at),
      lastAccrualAt: new Date(),
    };
    const [upserted] = await tx
      .insert(borrowPositions)
      .values({
        poolId: action.poolId,
        borrowerId: action.positionUserId,
        ...values,
      } satisfies NewBorrowPosition)
      .onConflictDoUpdate({
        target: [borrowPositions.poolId, borrowPositions.borrowerId],
        set: values,
      })
      .returning();
    return upserted ?? null;
  }

  async getUserDeposits(poolId: string, depositorId: string): Promise<DepositPosition[]> {
    return db
      .select()
      .from(depositPositions)
      .where(
        and(eq(depositPositions.poolId, poolId), eq(depositPositions.depositorId, depositorId)),
      );
  }

  async getUserBorrows(poolId: string, borrowerId: string): Promise<BorrowPosition[]> {
    return db
      .select()
      .from(borrowPositions)
      .where(and(eq(borrowPositions.poolId, poolId), eq(borrowPositions.borrowerId, borrowerId)));
  }

  async getBorrowPositionsByPool(poolId: string): Promise<BorrowPosition[]> {
    return db.select().from(borrowPositions).where(eq(borrowPositions.poolId, poolId));
  }

  async getAllBorrowPositions(): Promise<BorrowPosition[]> {
    return db.select().from(borrowPositions);
  }

  private buildFilterConditions(filter: LendingPoolFilter): SQL[] {
    const conditions: SQL[] = [];

    if (filter.asset) {
      conditions.push(eq(lendingPools.asset, filter.asset));
    }

    if (filter.isActive !== undefined) {
      conditions.push(eq(lendingPools.isActive, filter.isActive));
    }

    return conditions;
  }
}

export const lendingRepository = new LendingRepository();
