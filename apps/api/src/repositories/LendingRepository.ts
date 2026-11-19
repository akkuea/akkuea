import { eq, and, sql, type SQL } from 'drizzle-orm';
import { db } from '../db';
import {
  lendingPools,
  depositPositions,
  borrowPositions,
  type LendingPool,
  type NewLendingPool,
  type DepositPosition,
  type NewDepositPosition,
  type BorrowPosition,
  type NewBorrowPosition,
  type Transaction,
} from '../db/schema';
import { transactions } from '../db/schema/transactions';
import type { DbTransaction } from '../db/types';
import { BaseRepository } from './BaseRepository';

export interface PoolTotalsSnapshot {
  totalDeposits: string;
  totalBorrows: string;
  availableLiquidity: string;
}

export interface ConfirmedLendingActionInput {
  type: 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'liquidation';
  hash: string;
  userId: string;
  amount: string;
  asset: string;
  poolId: string;
  contractPoolId: string;
  metadata: Record<string, unknown>;
  poolTotals: PoolTotalsSnapshot;
  /** undefined leaves the deposit position untouched, null deletes it. */
  deposit?: { amount: string; shares: string } | null;
  /** undefined leaves the borrow position untouched, null deletes it. */
  borrow?: {
    principal: string;
    collateralAmount: string;
    collateralAsset: string;
    healthFactor: string;
  } | null;
}

export interface ConfirmedLendingActionResult {
  recorded: boolean;
  transaction: Transaction;
}

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

  /**
   * Mirrors a confirmed deposit position read from the contract. Postgres is a
   * cache of on-chain state, so amounts and shares are written as returned by
   * the contract getters rather than recalculated here.
   */
  async syncDepositPosition(
    poolId: string,
    depositorId: string,
    snapshot: { amount: string; shares: string },
  ): Promise<DepositPosition> {
    return await db.transaction(async (tx: DbTransaction) => {
      const [existing] = await tx
        .select()
        .from(depositPositions)
        .where(
          and(eq(depositPositions.poolId, poolId), eq(depositPositions.depositorId, depositorId)),
        )
        .limit(1);

      if (existing) {
        const [updated] = await tx
          .update(depositPositions)
          .set({ amount: snapshot.amount, shares: snapshot.shares })
          .where(eq(depositPositions.id, existing.id))
          .returning();

        if (!updated) {
          throw new Error('Deposit position update failed');
        }
        return updated;
      }

      const results = await tx
        .insert(depositPositions)
        .values({
          poolId,
          depositorId,
          amount: snapshot.amount,
          shares: snapshot.shares,
        } satisfies NewDepositPosition)
        .returning();

      const position = results[0];
      if (!position) {
        throw new Error('Deposit position insert failed');
      }
      return position;
    });
  }

  /**
   * Mirrors a confirmed borrow position read from the contract. The unique
   * `(pool_id, borrower_id)` constraint means later borrows merge into the one
   * cached position instead of creating a second row.
   */
  async syncBorrowPosition(
    poolId: string,
    borrowerId: string,
    snapshot: {
      principal: string;
      collateralAmount: string;
      collateralAsset: string;
      healthFactor: string;
    },
  ): Promise<BorrowPosition> {
    const [position] = await db
      .insert(borrowPositions)
      .values({
        poolId,
        borrowerId,
        principal: snapshot.principal,
        collateralAmount: snapshot.collateralAmount,
        collateralAsset: snapshot.collateralAsset,
        healthFactor: snapshot.healthFactor,
      } satisfies NewBorrowPosition)
      .onConflictDoUpdate({
        target: [borrowPositions.poolId, borrowPositions.borrowerId],
        set: {
          principal: snapshot.principal,
          collateralAmount: snapshot.collateralAmount,
          collateralAsset: snapshot.collateralAsset,
          healthFactor: snapshot.healthFactor,
          lastAccrualAt: new Date(),
        },
      })
      .returning();

    if (!position) {
      throw new Error('Borrow position upsert failed');
    }
    return position;
  }

  async deleteBorrowPosition(poolId: string, borrowerId: string): Promise<void> {
    await db
      .delete(borrowPositions)
      .where(and(eq(borrowPositions.poolId, poolId), eq(borrowPositions.borrowerId, borrowerId)));
  }

  async deleteDepositPosition(poolId: string, depositorId: string): Promise<void> {
    await db
      .delete(depositPositions)
      .where(
        and(eq(depositPositions.poolId, poolId), eq(depositPositions.depositorId, depositorId)),
      );
  }

  /**
   * Records one confirmed on-chain action and refreshes the cached pool totals
   * and position in a single database transaction. The unique transactions.hash
   * index makes repeated confirmation of the same hash idempotent: only the
   * first call writes, later calls return the recorded row untouched.
   */
  async recordConfirmedAction(
    input: ConfirmedLendingActionInput,
  ): Promise<ConfirmedLendingActionResult> {
    return await db.transaction(async (tx: DbTransaction) => {
      const [inserted] = await tx
        .insert(transactions)
        .values({
          type: input.type,
          hash: input.hash,
          fromUserId: input.userId,
          amount: input.amount,
          asset: input.asset,
          status: 'confirmed',
          metadata: {
            ...input.metadata,
            poolId: input.poolId,
            contractPoolId: input.contractPoolId,
          },
        })
        .onConflictDoNothing({ target: transactions.hash })
        .returning();

      if (!inserted) {
        const [existing] = await tx
          .select()
          .from(transactions)
          .where(eq(transactions.hash, input.hash))
          .limit(1);

        if (!existing) {
          throw new Error('Confirmed transaction could not be read back');
        }

        return { recorded: false, transaction: existing };
      }

      await tx
        .update(lendingPools)
        .set({
          totalDeposits: input.poolTotals.totalDeposits,
          totalBorrows: input.poolTotals.totalBorrows,
          availableLiquidity: input.poolTotals.availableLiquidity,
          utilizationRate: sql`CASE WHEN ${input.poolTotals.totalDeposits}::numeric = 0 THEN 0 ELSE (${input.poolTotals.totalBorrows}::numeric / ${input.poolTotals.totalDeposits}::numeric) * 100 END`,
        })
        .where(eq(lendingPools.id, input.poolId));

      if (input.deposit !== undefined) {
        if (input.deposit === null) {
          await tx
            .delete(depositPositions)
            .where(
              and(
                eq(depositPositions.poolId, input.poolId),
                eq(depositPositions.depositorId, input.userId),
              ),
            );
        } else {
          const [existingDeposit] = await tx
            .select()
            .from(depositPositions)
            .where(
              and(
                eq(depositPositions.poolId, input.poolId),
                eq(depositPositions.depositorId, input.userId),
              ),
            )
            .limit(1);

          if (existingDeposit) {
            await tx
              .update(depositPositions)
              .set({ amount: input.deposit.amount, shares: input.deposit.shares })
              .where(eq(depositPositions.id, existingDeposit.id));
          } else {
            await tx.insert(depositPositions).values({
              poolId: input.poolId,
              depositorId: input.userId,
              amount: input.deposit.amount,
              shares: input.deposit.shares,
            } satisfies NewDepositPosition);
          }
        }
      }

      if (input.borrow !== undefined) {
        if (input.borrow === null) {
          await tx
            .delete(borrowPositions)
            .where(
              and(
                eq(borrowPositions.poolId, input.poolId),
                eq(borrowPositions.borrowerId, input.userId),
              ),
            );
        } else {
          await tx
            .insert(borrowPositions)
            .values({
              poolId: input.poolId,
              borrowerId: input.userId,
              principal: input.borrow.principal,
              collateralAmount: input.borrow.collateralAmount,
              collateralAsset: input.borrow.collateralAsset,
              healthFactor: input.borrow.healthFactor,
            } satisfies NewBorrowPosition)
            .onConflictDoUpdate({
              target: [borrowPositions.poolId, borrowPositions.borrowerId],
              set: {
                principal: input.borrow.principal,
                collateralAmount: input.borrow.collateralAmount,
                collateralAsset: input.borrow.collateralAsset,
                healthFactor: input.borrow.healthFactor,
                lastAccrualAt: new Date(),
              },
            });
        }
      }

      return { recorded: true, transaction: inserted };
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
