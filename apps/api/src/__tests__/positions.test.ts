import { beforeAll, describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import type { BorrowPosition, DepositPosition, LendingPool, User } from '../db/schema';
import { errorHandler } from '../middleware/errorHandler';
import { lendingRoutes } from '../routes/lending';
import { PositionService } from '../services/PositionService';
import {
  VALID_STELLAR_ADDRESS,
  VALID_STELLAR_ADDRESS_2,
  VALID_UUID as VALID_POOL_ID,
} from '@real-estate-defi/shared';

const INVALID_STELLAR_ADDRESS = 'NOT_A_VALID_STELLAR_ADDRESS';
const FIXED_NOW = new Date('2026-03-22T12:00:00.000Z');

const testPool: LendingPool = {
  id: VALID_POOL_ID,
  name: 'USDC Pool',
  asset: 'USDC',
  assetAddress: VALID_STELLAR_ADDRESS,
  totalDeposits: '0',
  totalBorrows: '0',
  availableLiquidity: '0',
  utilizationRate: '0',
  supplyAPY: '10.00',
  borrowAPY: '12.00',
  collateralFactor: '0.75',
  liquidationThreshold: '0.80',
  liquidationPenalty: '0.05',
  reserveFactor: 1000,
  isActive: true,
  isPaused: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

const testUser: User = {
  id: '2b0e8400-e29b-41d4-a716-446655440000',
  walletAddress: VALID_STELLAR_ADDRESS,
  email: null,
  displayName: null,
  kycStatus: 'not_started',
  kycTier: 'none',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  lastLoginAt: null,
};

const testDeposit: DepositPosition = {
  id: '3c0e8400-e29b-41d4-a716-446655440000',
  poolId: VALID_POOL_ID,
  depositorId: testUser.id,
  amount: '1000.0000000',
  shares: '1000.0000000',
  depositedAt: new Date('2025-03-22T12:00:00.000Z'),
  lastAccrualAt: new Date('2025-03-22T12:00:00.000Z'),
  accruedInterest: '0.0000000',
};

const testBorrow: BorrowPosition = {
  id: '4d0e8400-e29b-41d4-a716-446655440000',
  poolId: VALID_POOL_ID,
  borrowerId: testUser.id,
  principal: '500.0000000',
  accruedInterest: '0.0000000',
  collateralAmount: '900.0000000',
  collateralAsset: VALID_STELLAR_ADDRESS,
  healthFactor: '1.0000',
  borrowedAt: new Date('2025-03-22T12:00:00.000Z'),
  lastAccrualAt: new Date('2025-03-22T12:00:00.000Z'),
};

describe('PositionService', () => {
  const service = new PositionService({
    lendingRepository: {
      findById: async (poolId: string) => (poolId === VALID_POOL_ID ? testPool : undefined),
      getUserDeposits: async () => [testDeposit],
      getUserBorrows: async () => [testBorrow],
    },
    userRepository: {
      findByWalletAddress: async (walletAddress: string) =>
        walletAddress === VALID_STELLAR_ADDRESS ? testUser : undefined,
    },
    stellarService: {
      validateAddress: (address: string) => address === VALID_STELLAR_ADDRESS,
      callContract: async (_contractId: string, method: string) => {
        if (method === 'get_user_position_summary') {
          return null;
        }

        return [];
      },
    },
    now: () => FIXED_NOW,
  });

  it('computes deposit interest on read', async () => {
    const deposits = await service.getUserDeposits(VALID_POOL_ID, VALID_STELLAR_ADDRESS);

    expect(deposits).toHaveLength(1);
    expect(Number(deposits[0]?.computedAccruedInterest)).toBeCloseTo(99.9315537, 7);
    expect(Number(deposits[0]?.currentBalance)).toBeCloseTo(1099.9315537, 7);
    expect(deposits[0]?.dataSource).toBe('database');
  });

  it('computes borrow interest and summary metrics on read', async () => {
    const borrows = await service.getUserBorrows(VALID_POOL_ID, VALID_STELLAR_ADDRESS);
    const summary = await service.getPositionSummary(VALID_POOL_ID, VALID_STELLAR_ADDRESS);

    expect(borrows).toHaveLength(1);
    expect(Number(borrows[0]?.computedAccruedInterest)).toBeCloseTo(59.9589322, 7);
    expect(Number(borrows[0]?.currentDebt)).toBeCloseTo(559.9589322, 7);
    expect(borrows[0]?.computedHealthFactor).toBe('1.2858');

    expect(Number(summary.totalDeposits)).toBeCloseTo(1099.9315537, 7);
    expect(Number(summary.totalBorrows)).toBeCloseTo(559.9589322, 7);
    expect(Number(summary.netWorth)).toBeCloseTo(539.9726215, 7);
    expect(summary.healthFactor).toBe('1.2858');
    expect(summary.depositCount).toBe(1);
    expect(summary.borrowCount).toBe(1);
  });

  it('returns an empty snapshot when the wallet has no local user record', async () => {
    const deposits = await service.getUserDeposits(VALID_POOL_ID, VALID_STELLAR_ADDRESS_2);
    const borrows = await service.getUserBorrows(VALID_POOL_ID, VALID_STELLAR_ADDRESS_2);
    const summary = await service.getPositionSummary(VALID_POOL_ID, VALID_STELLAR_ADDRESS_2);

    expect(deposits).toEqual([]);
    expect(borrows).toEqual([]);
    expect(summary.totalDeposits).toBe('0.0000000');
    expect(summary.totalBorrows).toBe('0.0000000');
    expect(summary.netWorth).toBe('0.0000000');
    expect(summary.healthFactor).toBeNull();
  });
});

describe('Lending position routes', () => {
  let app: (request: Request) => Promise<Response>;
  type ValidationResponse = {
    code?: string;
    error?: string;
    message?: string;
    details?: {
      source?: string;
      errors?: Record<string, string[]>;
    };
  };

  beforeAll(() => {
    const testApp = new Elysia().use(errorHandler).use(lendingRoutes);
    app = testApp.handle.bind(testApp);
  });

  it('rejects malformed Stellar addresses through path validation', async () => {
    const response = await app(
      new Request(
        `http://localhost/lending/pools/${VALID_POOL_ID}/user/${INVALID_STELLAR_ADDRESS}/deposits`,
      ),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as ValidationResponse;
    expect(body.error).toBe('INVALID_ADDRESS');
    expect(body.message).toBe('Invalid Stellar address format');
  });

  it('exposes the summary endpoint and validates address params before hitting the database', async () => {
    const response = await app(
      new Request(
        `http://localhost/lending/pools/${VALID_POOL_ID}/user/${INVALID_STELLAR_ADDRESS}/summary`,
      ),
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as ValidationResponse;
    expect(body.error).toBe('INVALID_ADDRESS');
    expect(body.message).toBe('Invalid Stellar address format');
  });
});
