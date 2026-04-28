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
} from '../db/schema';
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

  async deposit(
    poolId: string,
    depositorId: string,
    amount: string,
    shares: string,
  ): Promise<DepositPosition> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await db.transaction(async (tx: any) => {
      const results = await tx
        .insert(depositPositions)
        .values({
          poolId,
          depositorId,
          amount,
          shares,
        } satisfies NewDepositPosition)
        .returning();

      const position = results[0]!;

      await tx
        .update(lendingPools)
        .set({
          totalDeposits: sql`${lendingPools.totalDeposits}::numeric + ${amount}::numeric`,
          availableLiquidity: sql`${lendingPools.availableLiquidity}::numeric + ${amount}::numeric`,
          utilizationRate: sql`CASE WHEN (${lendingPools.totalDeposits}::numeric + ${amount}::numeric) = 0 THEN 0 ELSE (${lendingPools.totalBorrows}::numeric / (${lendingPools.totalDeposits}::numeric + ${amount}::numeric)) * 100 END`,
        })
        .where(eq(lendingPools.id, poolId));

      return position;
    });
  }

  async withdraw(
    poolId: string,
    depositorId: string,
    amount: string,
  ): Promise<DepositPosition | undefined> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await db.transaction(async (tx: any) => {
      const [existing] = await tx
        .select()
        .from(depositPositions)
        .where(
          and(eq(depositPositions.poolId, poolId), eq(depositPositions.depositorId, depositorId)),
        )
        .limit(1);

      if (!existing) return undefined;

      const newAmount = parseFloat(existing.amount) - parseFloat(amount);
      const newShares = parseFloat(existing.shares) - parseFloat(amount);

      const [updated] = await tx
        .update(depositPositions)
        .set({
          amount: Math.max(0, newAmount).toFixed(7),
          shares: Math.max(0, newShares).toFixed(7),
        })
        .where(eq(depositPositions.id, existing.id))
        .returning();

      await tx
        .update(lendingPools)
        .set({
          totalDeposits: sql`GREATEST(${lendingPools.totalDeposits}::numeric - ${amount}::numeric, 0)`,
          availableLiquidity: sql`GREATEST(${lendingPools.availableLiquidity}::numeric - ${amount}::numeric, 0)`,
          utilizationRate: sql`CASE WHEN GREATEST(${lendingPools.totalDeposits}::numeric - ${amount}::numeric, 0) = 0 THEN 0 ELSE (${lendingPools.totalBorrows}::numeric / GREATEST(${lendingPools.totalDeposits}::numeric - ${amount}::numeric, 0)) * 100 END`,
        })
        .where(eq(lendingPools.id, poolId));

      return updated;
    });
  }

  async borrow(
    poolId: string,
    borrowerId: string,
    data: { borrowAmount: string; collateralAmount: string; collateralAsset: string },
  ): Promise<BorrowPosition> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await db.transaction(async (tx: any) => {
      const results = await tx
        .insert(borrowPositions)
        .values({
          poolId,
          borrowerId,
          principal: data.borrowAmount,
          collateralAmount: data.collateralAmount,
          collateralAsset: data.collateralAsset,
          healthFactor: '1.0000',
        } satisfies NewBorrowPosition)
        .returning();

      const position = results[0]!;

      await tx
        .update(lendingPools)
        .set({
          totalBorrows: sql`${lendingPools.totalBorrows}::numeric + ${data.borrowAmount}::numeric`,
          availableLiquidity: sql`GREATEST(${lendingPools.availableLiquidity}::numeric - ${data.borrowAmount}::numeric, 0)`,
          utilizationRate: sql`CASE WHEN ${lendingPools.totalDeposits}::numeric = 0 THEN 0 ELSE ((${lendingPools.totalBorrows}::numeric + ${data.borrowAmount}::numeric) / ${lendingPools.totalDeposits}::numeric) * 100 END`,
        })
        .where(eq(lendingPools.id, poolId));

      return position;
    });
  }

  async repay(
    poolId: string,
    borrowerId: string,
    amount: string,
  ): Promise<BorrowPosition | undefined> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await db.transaction(async (tx: any) => {
      const [existing] = await tx
        .select()
        .from(borrowPositions)
        .where(and(eq(borrowPositions.poolId, poolId), eq(borrowPositions.borrowerId, borrowerId)))
        .limit(1);

      if (!existing) return undefined;

      const requestedRepayment = parseFloat(amount);
      const principal = parseFloat(existing.principal);
      const accruedInterest = parseFloat(existing.accruedInterest);
      const collateralAmount = parseFloat(existing.collateralAmount);
      const totalDebt = principal + accruedInterest;
      const repaidAmount = Math.min(requestedRepayment, totalDebt);
      const interestRepaid = Math.min(repaidAmount, accruedInterest);
      const principalRepaid = repaidAmount - interestRepaid;
      const remainingInterest = Math.max(0, accruedInterest - interestRepaid);
      const remainingPrincipal = Math.max(0, principal - principalRepaid);
      const remainingDebt = remainingPrincipal + remainingInterest;
      const collateralReleased =
        totalDebt === 0 ? 0 : (collateralAmount * repaidAmount) / totalDebt;

      let updated: BorrowPosition;
      if (remainingDebt === 0) {
        await tx.delete(borrowPositions).where(eq(borrowPositions.id, existing.id));
        updated = {
          ...existing,
          principal: '0.0000000',
          accruedInterest: '0.0000000',
          collateralAmount: '0.0000000',
        };
      } else {
        const [updatedRecord] = await tx
          .update(borrowPositions)
          .set({
            principal: remainingPrincipal.toFixed(7),
            accruedInterest: remainingInterest.toFixed(7),
            collateralAmount: Math.max(0, collateralAmount - collateralReleased).toFixed(7),
          })
          .where(eq(borrowPositions.id, existing.id))
          .returning();

        if (!updatedRecord) {
          throw new Error('Borrow position update failed during repayment');
        }

        updated = updatedRecord;
      }

      await tx
        .update(lendingPools)
        .set({
          totalBorrows: sql`GREATEST(${lendingPools.totalBorrows}::numeric - ${principalRepaid.toFixed(7)}::numeric, 0)`,
          availableLiquidity: sql`${lendingPools.availableLiquidity}::numeric + ${principalRepaid.toFixed(7)}::numeric`,
          utilizationRate: sql`CASE WHEN ${lendingPools.totalDeposits}::numeric = 0 THEN 0 ELSE (GREATEST(${lendingPools.totalBorrows}::numeric - ${principalRepaid.toFixed(7)}::numeric, 0) / ${lendingPools.totalDeposits}::numeric) * 100 END`,
        })
        .where(eq(lendingPools.id, poolId));

      return updated;
    });
  }

  async liquidate(poolId: string, borrowerId: string): Promise<BorrowPosition | undefined> {
    return await db.transaction(async (tx) => {
      const [position] = await tx
        .select()
        .from(borrowPositions)
        .where(and(eq(borrowPositions.poolId, poolId), eq(borrowPositions.borrowerId, borrowerId)))
        .limit(1);

      if (!position) return undefined;

      const principal = parseFloat(position.principal);
      const accruedInterest = parseFloat(position.accruedInterest);
      const totalDebt = principal + accruedInterest;

      await tx.delete(borrowPositions).where(eq(borrowPositions.id, position.id));

      await tx
        .update(lendingPools)
        .set({
          totalBorrows: sql`GREATEST(${lendingPools.totalBorrows}::numeric - ${totalDebt.toFixed(7)}::numeric, 0)`,
          availableLiquidity: sql`${lendingPools.availableLiquidity}::numeric + ${principal.toFixed(7)}::numeric`,
          utilizationRate: sql`CASE WHEN ${lendingPools.totalDeposits}::numeric = 0 THEN 0 ELSE (GREATEST(${lendingPools.totalBorrows}::numeric - ${totalDebt.toFixed(7)}::numeric, 0) / ${lendingPools.totalDeposits}::numeric) * 100 END`,
        })
        .where(eq(lendingPools.id, poolId));

      return position;
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
