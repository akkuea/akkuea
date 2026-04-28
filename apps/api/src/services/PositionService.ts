import { ApiError } from '../errors/ApiError';
import type { BorrowPosition, DepositPosition, LendingPool, User } from '../db/schema';
import { lendingRepository, type LendingRepository } from '../repositories/LendingRepository';
import { userRepository, type UserRepository } from '../repositories/UserRepository';
import { StellarService } from './StellarService';

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const DECIMAL_SCALE = 7;
const HEALTH_FACTOR_SCALE = 4;

type OnChainPositionRecord = Record<string, unknown>;

export interface DepositPositionView extends DepositPosition {
  currentBalance: string;
  computedAccruedInterest: string;
  dataSource: 'database' | 'hybrid';
}

export interface BorrowPositionView extends BorrowPosition {
  currentDebt: string;
  computedAccruedInterest: string;
  computedHealthFactor: string | null;
  dataSource: 'database' | 'hybrid';
  collateralAmount: string;
}

export interface PositionSummary {
  poolId: string;
  userId: string | null;
  walletAddress: string;
  totalDeposits: string;
  totalBorrows: string;
  netWorth: string;
  healthFactor: string | null;
  depositCount: number;
  borrowCount: number;
  dataSource: 'database' | 'hybrid';
  asOf: string;
}

export interface PositionServiceDependencies {
  lendingRepository: Pick<LendingRepository, 'findById' | 'getUserDeposits' | 'getUserBorrows'>;
  userRepository: Pick<UserRepository, 'findByWalletAddress'>;
  stellarService: {
    validateAddress(address: string): boolean;
    callContract(
      contractId: string,
      method: string,
      args?: unknown[],
      sourceAccount?: string,
    ): Promise<unknown>;
  };
  now: () => Date;
}

export class PositionService {
  private readonly lendingRepository: PositionServiceDependencies['lendingRepository'];
  private readonly userRepository: PositionServiceDependencies['userRepository'];
  private readonly stellarService: PositionServiceDependencies['stellarService'];
  private readonly now: PositionServiceDependencies['now'];

  constructor(deps: Partial<PositionServiceDependencies> = {}) {
    this.lendingRepository = deps.lendingRepository ?? lendingRepository;
    this.userRepository = deps.userRepository ?? userRepository;
    this.stellarService = deps.stellarService ?? new StellarService();
    this.now = deps.now ?? (() => new Date());
  }

  validateAddress(address: string): boolean {
    return this.stellarService.validateAddress(address);
  }

  async getUserDeposits(poolId: string, walletAddress: string): Promise<DepositPositionView[]> {
    const { pool, user } = await this.getPoolAndUser(poolId, walletAddress);
    if (!user) {
      return [];
    }

    const [deposits, onChainRecords] = await Promise.all([
      this.lendingRepository.getUserDeposits(pool.id, user.id),
      this.readOnChainRecords(pool, 'get_user_deposit_positions', walletAddress),
    ]);

    return deposits.map((deposit) => this.mapDepositPosition(deposit, pool, onChainRecords));
  }

  async getUserBorrows(poolId: string, walletAddress: string): Promise<BorrowPositionView[]> {
    const { pool, user } = await this.getPoolAndUser(poolId, walletAddress);
    if (!user) {
      return [];
    }

    const [borrows, onChainRecords] = await Promise.all([
      this.lendingRepository.getUserBorrows(pool.id, user.id),
      this.readOnChainRecords(pool, 'get_user_borrow_positions', walletAddress),
    ]);

    return borrows.map((borrow) => this.mapBorrowPosition(borrow, pool, onChainRecords));
  }

  async getPositionSummary(poolId: string, walletAddress: string): Promise<PositionSummary> {
    const { pool, user } = await this.getPoolAndUser(poolId, walletAddress);
    const asOf = this.now().toISOString();

    if (!user) {
      return {
        poolId: pool.id,
        userId: null,
        walletAddress,
        totalDeposits: this.formatDecimal(0),
        totalBorrows: this.formatDecimal(0),
        netWorth: this.formatDecimal(0),
        healthFactor: null,
        depositCount: 0,
        borrowCount: 0,
        dataSource: 'database',
        asOf,
      };
    }

    const [deposits, borrows, onChainSummary] = await Promise.all([
      this.getUserDeposits(pool.id, walletAddress),
      this.getUserBorrows(pool.id, walletAddress),
      this.readOnChainSummary(pool, walletAddress),
    ]);

    const totalDeposits = deposits.reduce(
      (sum, deposit) => sum + this.toNumber(deposit.currentBalance),
      0,
    );
    const totalBorrows = borrows.reduce(
      (sum, borrow) => sum + this.toNumber(borrow.currentDebt),
      0,
    );
    const summaryHealthFactor = this.computeSummaryHealthFactor(pool, borrows);
    const usesHybridData =
      onChainSummary !== null ||
      deposits.some((deposit) => deposit.dataSource === 'hybrid') ||
      borrows.some((borrow) => borrow.dataSource === 'hybrid');

    return {
      poolId: pool.id,
      userId: user.id,
      walletAddress,
      totalDeposits: onChainSummary?.totalDeposits ?? this.formatDecimal(totalDeposits),
      totalBorrows: onChainSummary?.totalBorrows ?? this.formatDecimal(totalBorrows),
      netWorth: onChainSummary?.netWorth ?? this.formatDecimal(totalDeposits - totalBorrows),
      healthFactor: onChainSummary?.healthFactor ?? summaryHealthFactor,
      depositCount: deposits.length,
      borrowCount: borrows.length,
      dataSource: usesHybridData ? 'hybrid' : 'database',
      asOf,
    };
  }

  private async getPoolAndUser(
    poolId: string,
    walletAddress: string,
  ): Promise<{
    pool: LendingPool;
    user: User | undefined;
  }> {
    const [pool, user] = await Promise.all([
      this.lendingRepository.findById(poolId),
      this.userRepository.findByWalletAddress(walletAddress),
    ]);

    if (!pool) {
      throw new ApiError(404, 'NOT_FOUND', `Pool with id ${poolId} not found`);
    }

    return { pool, user };
  }

  private mapDepositPosition(
    deposit: DepositPosition,
    pool: LendingPool,
    onChainRecords: OnChainPositionRecord[] | null,
  ): DepositPositionView {
    const onChainRecord = this.findOnChainRecord(onChainRecords, deposit.id);
    const amount = this.toNumber(this.readStringValue(onChainRecord, 'amount') ?? deposit.amount);
    const baseAccruedInterest = this.toNumber(
      this.readStringValue(onChainRecord, 'accruedInterest') ?? deposit.accruedInterest,
    );
    const lastAccrualAt =
      this.readDateValue(onChainRecord, 'lastAccrualAt') ?? deposit.lastAccrualAt;
    const computedAccruedInterest =
      baseAccruedInterest + this.computeAccruedInterest(amount, pool.supplyAPY, lastAccrualAt);

    return {
      ...deposit,
      amount: this.formatDecimal(amount),
      shares: this.readStringValue(onChainRecord, 'shares') ?? deposit.shares,
      accruedInterest: this.formatDecimal(baseAccruedInterest),
      lastAccrualAt,
      computedAccruedInterest: this.formatDecimal(computedAccruedInterest),
      currentBalance: this.formatDecimal(amount + computedAccruedInterest),
      dataSource: onChainRecord ? 'hybrid' : 'database',
    };
  }

  private mapBorrowPosition(
    borrow: BorrowPosition,
    pool: LendingPool,
    onChainRecords: OnChainPositionRecord[] | null,
  ): BorrowPositionView {
    const onChainRecord = this.findOnChainRecord(onChainRecords, borrow.id);
    const principal = this.toNumber(
      this.readStringValue(onChainRecord, 'principal') ?? borrow.principal,
    );
    const collateralAmount = this.toNumber(
      this.readStringValue(onChainRecord, 'collateralAmount') ?? borrow.collateralAmount,
    );
    const baseAccruedInterest = this.toNumber(
      this.readStringValue(onChainRecord, 'accruedInterest') ?? borrow.accruedInterest,
    );
    const lastAccrualAt =
      this.readDateValue(onChainRecord, 'lastAccrualAt') ?? borrow.lastAccrualAt;
    const computedAccruedInterest =
      baseAccruedInterest + this.computeAccruedInterest(principal, pool.borrowAPY, lastAccrualAt);
    const currentDebt = principal + computedAccruedInterest;
    const computedHealthFactor =
      this.readStringValue(onChainRecord, 'healthFactor') ??
      this.computeHealthFactor(currentDebt, collateralAmount, pool.liquidationThreshold);

    return {
      ...borrow,
      principal: this.formatDecimal(principal),
      collateralAmount: this.formatDecimal(collateralAmount),
      accruedInterest: this.formatDecimal(baseAccruedInterest),
      lastAccrualAt,
      computedAccruedInterest: this.formatDecimal(computedAccruedInterest),
      currentDebt: this.formatDecimal(currentDebt),
      computedHealthFactor,
      healthFactor: computedHealthFactor ?? borrow.healthFactor,
      dataSource: onChainRecord ? 'hybrid' : 'database',
    };
  }

  private computeAccruedInterest(
    principal: number,
    annualPercentageYield: string,
    lastAccrualAt: Date | string,
  ): number {
    const lastAccrual = new Date(lastAccrualAt);
    const elapsedMs = Math.max(0, this.now().getTime() - lastAccrual.getTime());

    if (elapsedMs === 0 || principal <= 0) {
      return 0;
    }

    const annualRate = this.toNumber(annualPercentageYield) / 100;
    return principal * annualRate * (elapsedMs / MS_PER_YEAR);
  }

  private computeHealthFactor(
    debt: number,
    collateralAmount: number,
    liquidationThreshold: string,
  ): string | null {
    if (debt <= 0) {
      return null;
    }

    const threshold = this.normalizeCollateralRatio(liquidationThreshold);
    return ((collateralAmount * threshold) / debt).toFixed(HEALTH_FACTOR_SCALE);
  }

  private computeSummaryHealthFactor(
    pool: LendingPool,
    borrows: BorrowPositionView[],
  ): string | null {
    const totalDebt = borrows.reduce((sum, borrow) => sum + this.toNumber(borrow.currentDebt), 0);
    const totalCollateral = borrows.reduce(
      (sum, borrow) => sum + this.toNumber(borrow.collateralAmount),
      0,
    );

    return this.computeHealthFactor(totalDebt, totalCollateral, pool.liquidationThreshold);
  }

  private async readOnChainRecords(
    pool: LendingPool,
    method: 'get_user_deposit_positions' | 'get_user_borrow_positions',
    walletAddress: string,
  ): Promise<OnChainPositionRecord[] | null> {
    try {
      const response = await this.stellarService.callContract(pool.assetAddress, method, [
        pool.id,
        walletAddress,
      ]);

      return Array.isArray(response) ? response.filter(this.isRecord) : null;
    } catch {
      return null;
    }
  }

  private async readOnChainSummary(
    pool: LendingPool,
    walletAddress: string,
  ): Promise<Pick<
    PositionSummary,
    'totalDeposits' | 'totalBorrows' | 'netWorth' | 'healthFactor'
  > | null> {
    try {
      const response = await this.stellarService.callContract(
        pool.assetAddress,
        'get_user_position_summary',
        [pool.id, walletAddress],
      );

      if (!this.isRecord(response)) {
        return null;
      }

      const totalDeposits = this.readStringValue(response, 'totalDeposits');
      const totalBorrows = this.readStringValue(response, 'totalBorrows');
      const netWorth = this.readStringValue(response, 'netWorth');

      if (!totalDeposits || !totalBorrows || !netWorth) {
        return null;
      }

      return {
        totalDeposits,
        totalBorrows,
        netWorth,
        healthFactor: this.readStringValue(response, 'healthFactor'),
      };
    } catch {
      return null;
    }
  }

  private findOnChainRecord(
    records: OnChainPositionRecord[] | null,
    positionId: string,
  ): OnChainPositionRecord | null {
    if (!records) {
      return null;
    }

    return records.find((record) => this.readStringValue(record, 'id') === positionId) ?? null;
  }

  private readStringValue(record: OnChainPositionRecord | null, field: string): string | null {
    if (!record) {
      return null;
    }

    const value = record[field];
    return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : null;
  }

  private readDateValue(record: OnChainPositionRecord | null, field: string): Date | null {
    const value = record?.[field];

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    return null;
  }

  private isRecord(value: unknown): value is OnChainPositionRecord {
    return typeof value === 'object' && value !== null;
  }

  private toNumber(value: string | number): number {
    const numericValue = typeof value === 'number' ? value : Number.parseFloat(value);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }

  private formatDecimal(value: number): string {
    return value.toFixed(DECIMAL_SCALE);
  }

  private normalizeCollateralRatio(value: string): number {
    const numericValue = this.toNumber(value);
    return numericValue > 1 ? numericValue / 100 : numericValue;
  }
}

export const positionService = new PositionService();
