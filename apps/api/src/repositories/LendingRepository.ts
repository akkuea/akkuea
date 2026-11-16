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
} from '../db/schema';
import type { DbTransaction } from '../db/types';
import { ApiError } from '../errors/ApiError';
import { BaseRepository } from './BaseRepository';

export interface LendingPoolFilter {
  asset?: string;
  isActive?: boolean;
}

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

export type ConfirmedLendingAction = 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'liquidate';

export interface ConfirmedDepositSnapshotInput {
  amount: string;
  shares: string;
  accruedInterest?: string;
}

export interface ConfirmedBorrowSnapshotInput {
  principal: string;
  collateralAmount: string;
  collateralAsset: string;
  healthFactor: string;
  accruedInterest?: string;
}

export interface RecordConfirmedLendingActionParams {
  txHash: string;
  action: ConfirmedLendingAction;
  poolId: string;
  contractPoolId: string;
  contractId: string;
  actorUserId: string;
  actorWallet: string;
  positionUserId: string;
  toUserId?: string | null;
  amount: string;
  asset: string;
  totalDeposits: string;
  totalBorrows: string;
  availableLiquidity: string;
  utilizationRate: string;
  kind: 'deposit' | 'borrow';
  depositPosition: ConfirmedDepositSnapshotInput | null;
  borrowPosition: ConfirmedBorrowSnapshotInput | null;
}

export interface ConfirmedLendingRecordResult {
  recorded: boolean;
  txHash: string;
  pool: LendingPool;
  depositPosition: DepositPosition | null;
  borrowPosition: BorrowPosition | null;
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

  /**
   * Atomically records a confirmed on-chain `defi-rwa` lending transaction in
   * `transactions` (keyed by `hash`) and refreshes the cached pool totals and
   * user position from the snapshot read directly from the contract.
   *
   * Confirming an already-recorded `txHash` for the same operation is a no-op
   * that returns the cached state without modifying any balances.
   */
  async recordConfirmedLendingAction(
    params: RecordConfirmedLendingActionParams,
  ): Promise<ConfirmedLendingRecordResult> {
    const transactionType = params.action === 'liquidate' ? 'liquidation' : params.action;

    return await db.transaction(async (tx: DbTransaction) => {
      const [inserted] = await tx
        .insert(transactions)
        .values({
          type: transactionType,
          hash: params.txHash,
          fromUserId: params.actorUserId,
          toUserId: params.toUserId ?? null,
          amount: params.amount,
          asset: params.asset,
          status: 'confirmed',
          metadata: {
            poolId: params.poolId,
            contractPoolId: params.contractPoolId,
            contractId: params.contractId,
            action: params.action,
            actorWallet: params.actorWallet,
            positionUserId: params.positionUserId,
          },
        })
        .onConflictDoNothing({ target: transactions.hash })
        .returning({ id: transactions.id });

      if (!inserted) {
        const [recorded] = await tx
          .select()
          .from(transactions)
          .where(eq(transactions.hash, params.txHash))
          .limit(1);

        const meta = (recorded?.metadata ?? {}) as {
          poolId?: string;
          action?: string;
          actorWallet?: string;
          positionUserId?: string;
        };

        if (
          (meta.poolId && meta.poolId !== params.poolId) ||
          (meta.action && meta.action !== params.action) ||
          (meta.actorWallet && meta.actorWallet !== params.actorWallet) ||
          (meta.positionUserId && meta.positionUserId !== params.positionUserId)
        ) {
          throw new ApiError(
            409,
            'CONFLICT',
            'Transaction hash was already recorded for a different lending operation',
          );
        }

        const [existingPool] = await tx
          .select()
          .from(lendingPools)
          .where(eq(lendingPools.id, params.poolId))
          .limit(1);

        if (!existingPool) {
          throw ApiError.notFound(`Pool with id ${params.poolId} not found`);
        }

        const [existingDeposit] =
          params.kind === 'deposit'
            ? await tx
                .select()
                .from(depositPositions)
                .where(
                  and(
                    eq(depositPositions.poolId, params.poolId),
                    eq(depositPositions.depositorId, params.positionUserId),
                  ),
                )
                .limit(1)
            : [undefined];

        const [existingBorrow] =
          params.kind === 'borrow'
            ? await tx
                .select()
                .from(borrowPositions)
                .where(
                  and(
                    eq(borrowPositions.poolId, params.poolId),
                    eq(borrowPositions.borrowerId, params.positionUserId),
                  ),
                )
                .limit(1)
            : [undefined];

        return {
          recorded: false,
          txHash: params.txHash,
          pool: existingPool,
          depositPosition: existingDeposit ?? null,
          borrowPosition: existingBorrow ?? null,
        };
      }

      const [updatedPool] = await tx
        .update(lendingPools)
        .set({
          totalDeposits: params.totalDeposits,
          totalBorrows: params.totalBorrows,
          availableLiquidity: params.availableLiquidity,
          utilizationRate: params.utilizationRate,
        })
        .where(eq(lendingPools.id, params.poolId))
        .returning();

      if (!updatedPool) {
        throw ApiError.notFound(`Pool with id ${params.poolId} not found`);
      }

      let syncedDeposit: DepositPosition | null = null;
      let syncedBorrow: BorrowPosition | null = null;
      const now = new Date();

      if (params.kind === 'deposit') {
        if (params.depositPosition === null) {
          await tx
            .delete(depositPositions)
            .where(
              and(
                eq(depositPositions.poolId, params.poolId),
                eq(depositPositions.depositorId, params.positionUserId),
              ),
            );
        } else {
          const [upserted] = await tx
            .insert(depositPositions)
            .values({
              poolId: params.poolId,
              depositorId: params.positionUserId,
              amount: params.depositPosition.amount,
              shares: params.depositPosition.shares,
              accruedInterest: params.depositPosition.accruedInterest ?? '0.0000000',
              lastAccrualAt: now,
            } satisfies NewDepositPosition)
            .onConflictDoUpdate({
              target: [depositPositions.poolId, depositPositions.depositorId],
              set: {
                amount: params.depositPosition.amount,
                shares: params.depositPosition.shares,
                accruedInterest: params.depositPosition.accruedInterest ?? '0.0000000',
                lastAccrualAt: now,
              },
            })
            .returning();

          if (!upserted) {
            throw new Error('Failed to persist deposit position');
          }
          syncedDeposit = upserted;
        }
      } else {
        if (params.borrowPosition === null) {
          await tx
            .delete(borrowPositions)
            .where(
              and(
                eq(borrowPositions.poolId, params.poolId),
                eq(borrowPositions.borrowerId, params.positionUserId),
              ),
            );
        } else {
          const [upserted] = await tx
            .insert(borrowPositions)
            .values({
              poolId: params.poolId,
              borrowerId: params.positionUserId,
              principal: params.borrowPosition.principal,
              accruedInterest: params.borrowPosition.accruedInterest ?? '0.0000000',
              collateralAmount: params.borrowPosition.collateralAmount,
              collateralAsset: params.borrowPosition.collateralAsset,
              healthFactor: params.borrowPosition.healthFactor,
              lastAccrualAt: now,
            } satisfies NewBorrowPosition)
            .onConflictDoUpdate({
              target: [borrowPositions.poolId, borrowPositions.borrowerId],
              set: {
                principal: params.borrowPosition.principal,
                accruedInterest: params.borrowPosition.accruedInterest ?? '0.0000000',
                collateralAmount: params.borrowPosition.collateralAmount,
                collateralAsset: params.borrowPosition.collateralAsset,
                healthFactor: params.borrowPosition.healthFactor,
                lastAccrualAt: now,
              },
            })
            .returning();

          if (!upserted) {
            throw new Error('Failed to persist borrow position');
          }
          syncedBorrow = upserted;
        }
      }

      return {
        recorded: true,
        txHash: params.txHash,
        pool: updatedPool,
        depositPosition: syncedDeposit,
        borrowPosition: syncedBorrow,
      };
    });
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
