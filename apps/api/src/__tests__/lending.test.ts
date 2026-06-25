import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { lendingRoutes } from '../routes/lending';
import { errorHandler } from '../middleware/errorHandler';
import { CreatePoolDto, DepositDto, WithdrawDto, BorrowDto, RepayDto } from '../dto/lending.dto';
import jwt from 'jsonwebtoken';
import { VALID_STELLAR_ADDRESS, VALID_UUID } from '@real-estate-defi/shared';
const TEST_WALLET = 'GCO5CVUVFNX4KZQMYCALTJ5QSG6USOVLFQ74AQCCX7TGJKBNZ33KC5ZC'; // Unique wallet for lending tests

describe('Lending DTO Validation', () => {
  describe('CreatePoolDto', () => {
    it('should accept valid pool data', () => {
      const result = CreatePoolDto.safeParse({
        name: 'USDC Lending Pool',
        asset: 'USDC',
        assetAddress: VALID_STELLAR_ADDRESS,
        collateralFactor: '0.75',
        liquidationThreshold: '0.80',
        liquidationPenalty: '0.05',
        reserveFactor: 1000,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing name', () => {
      const result = CreatePoolDto.safeParse({
        asset: 'USDC',
        assetAddress: VALID_STELLAR_ADDRESS,
        collateralFactor: '0.75',
        liquidationThreshold: '0.80',
        liquidationPenalty: '0.05',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid Stellar address', () => {
      const result = CreatePoolDto.safeParse({
        name: 'Test Pool',
        asset: 'USDC',
        assetAddress: 'INVALID_ADDRESS',
        collateralFactor: '0.75',
        liquidationThreshold: '0.80',
        liquidationPenalty: '0.05',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('DepositDto', () => {
    it('should accept valid amount string', () => {
      const result = DepositDto.safeParse({ amount: '100.5' });
      expect(result.success).toBe(true);
    });

    it('should reject zero amount', () => {
      const result = DepositDto.safeParse({ amount: '0' });
      expect(result.success).toBe(false);
    });

    it('should reject negative amount', () => {
      const result = DepositDto.safeParse({ amount: '-10' });
      expect(result.success).toBe(false);
    });

    it('should reject non-numeric string', () => {
      const result = DepositDto.safeParse({ amount: 'abc' });
      expect(result.success).toBe(false);
    });
  });

  describe('BorrowDto', () => {
    it('should accept valid borrow data', () => {
      const result = BorrowDto.safeParse({
        borrowAmount: '1000',
        collateralAmount: '1500',
        collateralAsset: VALID_STELLAR_ADDRESS,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing collateral asset', () => {
      const result = BorrowDto.safeParse({
        borrowAmount: '1000',
        collateralAmount: '1500',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('WithdrawDto', () => {
    it('should accept valid amount', () => {
      const result = WithdrawDto.safeParse({ amount: '50.25' });
      expect(result.success).toBe(true);
    });
  });

  describe('RepayDto', () => {
    it('should accept valid amount', () => {
      const result = RepayDto.safeParse({ amount: '200' });
      expect(result.success).toBe(true);
    });
  });
});

describe('Lending Routes', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;

  beforeAll(() => {
    app = new Elysia().use(errorHandler).use(lendingRoutes);
  });

  describe('GET /lending/pools', () => {
    it('should return 200 with paginated structure or handle DB absence', async () => {
      const response = await app.handle(
        new Request('http://localhost/lending/pools?page=1&limit=10'),
      );
      // Without DB, may return 500; with DB, returns 200
      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        const body = await response.json();
        expect(body.data).toBeDefined();
        expect(body.pagination).toBeDefined();
      }
    });
  });

  describe('POST /lending/pools (auth)', () => {
    it('should return 401 without Authorization header', async () => {
      const response = await app.handle(
        new Request('http://localhost/lending/pools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test Pool',
            asset: 'USDC',
            assetAddress: TEST_WALLET,
            collateralFactor: '0.75',
            liquidationThreshold: '0.80',
            liquidationPenalty: '0.05',
          }),
        }),
      );
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('UNAUTHORIZED');
    });

    it('should reject invalid body with validation error', async () => {
      // Mock valid token for validation test
      const validToken = jwt.sign(
        { id: VALID_UUID, walletAddress: VALID_STELLAR_ADDRESS },
        process.env.JWT_SECRET || 'super-secret-default-key-for-dev',
      );

      const response = await app.handle(
        new Request('http://localhost/lending/pools', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${validToken}`,
          },
          body: JSON.stringify({ name: '' }),
        }),
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /lending/pools/:id', () => {
    it('should return pool when id is provided', async () => {
      const response = await app.handle(new Request('http://localhost/lending/pools/test-pool-id'));
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /lending/pools/:id/deposit (auth + validation)', () => {
    it('should return 401 without auth', async () => {
      const response = await app.handle(
        new Request(`http://localhost/lending/pools/${VALID_UUID}/deposit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: '100' }),
        }),
      );
      expect(response.status).toBe(401);
    });

    it('should reject invalid amount', async () => {
      const validToken = jwt.sign(
        { id: VALID_UUID, walletAddress: VALID_STELLAR_ADDRESS },
        process.env.JWT_SECRET || 'super-secret-default-key-for-dev',
      );

      const response = await app.handle(
        new Request(`http://localhost/lending/pools/${VALID_UUID}/deposit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${validToken}`,
          },
          body: JSON.stringify({ amount: '0' }),
        }),
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /lending/pools/:id/withdraw (auth)', () => {
    it('should return 401 without auth', async () => {
      const response = await app.handle(
        new Request(`http://localhost/lending/pools/${VALID_UUID}/withdraw`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: '50' }),
        }),
      );
      expect(response.status).toBe(401);
    });
  });

  describe('POST /lending/pools/:id/borrow (auth + validation)', () => {
    it('should return 401 without auth', async () => {
      const response = await app.handle(
        new Request(`http://localhost/lending/pools/${VALID_UUID}/borrow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            borrowAmount: '1000',
            collateralAmount: '1500',
            collateralAsset: TEST_WALLET,
          }),
        }),
      );
      expect(response.status).toBe(401);
    });

    it('should reject invalid body', async () => {
      const validToken = jwt.sign(
        { id: VALID_UUID, walletAddress: VALID_STELLAR_ADDRESS },
        process.env.JWT_SECRET || 'super-secret-default-key-for-dev',
      );
      const response = await app.handle(
        new Request(`http://localhost/lending/pools/${VALID_UUID}/borrow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${validToken}`,
          },
          body: JSON.stringify({ borrowAmount: '0' }),
        }),
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /lending/pools/:id/repay (auth)', () => {
    it('should return 401 without auth', async () => {
      const response = await app.handle(
        new Request(`http://localhost/lending/pools/${VALID_UUID}/repay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: '100' }),
        }),
      );
      expect(response.status).toBe(401);
    });
  });

  describe('GET /lending/pools/:id/user/:address/deposits', () => {
    it('should return 200, 404 or 500 with valid params', async () => {
      const response = await app.handle(
        new Request(`http://localhost/lending/pools/${VALID_UUID}/user/${TEST_WALLET}/deposits`),
      );
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('GET /lending/pools/:id/user/:address/borrows', () => {
    it('should return 200, 404 or 500 with valid params', async () => {
      const response = await app.handle(
        new Request(`http://localhost/lending/pools/${VALID_UUID}/user/${TEST_WALLET}/borrows`),
      );
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('GET /lending/pools/:id/user/:address/summary', () => {
    it('should reject malformed Stellar addresses', async () => {
      const response = await app.handle(
        new Request(`http://localhost/lending/pools/${VALID_UUID}/user/INVALID_ADDRESS/summary`),
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('INVALID_ADDRESS');
    });
  });
});

describe.skipIf(!process.env.DATABASE_URL)('Lending Integration Tests (DB required)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let testUserId: string;
  let testPoolId: string;
  let testToken: string;

  beforeAll(async () => {
    app = new Elysia().use(errorHandler).use(lendingRoutes);

    // Create or get a test user via the users route so deposit/borrow can find them
    const { userRepository } = await import('../repositories/UserRepository');
    const user = await userRepository.getOrCreateByWallet(TEST_WALLET);
    testUserId = user.id;

    testToken = jwt.sign(
      { id: testUserId, walletAddress: VALID_STELLAR_ADDRESS },
      process.env.JWT_SECRET || 'super-secret-default-key-for-dev',
    );
  });

  afterAll(async () => {
    // Clean up test data in correct order (FK constraints)
    const { db } = await import('../db');
    const { depositPositions, borrowPositions, lendingPools } = await import('../db/schema');
    const { users } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    if (testPoolId) {
      await db.delete(depositPositions).where(eq(depositPositions.poolId, testPoolId));
      await db.delete(borrowPositions).where(eq(borrowPositions.poolId, testPoolId));
      await db.delete(lendingPools).where(eq(lendingPools.id, testPoolId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
  });

  it('should return paginated pools from database', async () => {
    const response = await app.handle(new Request('http://localhost/lending/pools?page=1&limit=5'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toBeDefined();
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(5);
    expect(typeof body.pagination.total).toBe('number');
    expect(typeof body.pagination.totalPages).toBe('number');
  });

  it('should return 404 for non-existent pool', async () => {
    const response = await app.handle(new Request(`http://localhost/lending/pools/${VALID_UUID}`));
    expect(response.status).toBe(404);
  });

  it('should create pool with valid data and auth', async () => {
    const response = await app.handle(
      new Request('http://localhost/lending/pools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testToken}`,
          'x-test-bypass-ratelimit': 'true',
        },
        body: JSON.stringify({
          name: 'Integration Test Pool',
          asset: 'USDC',
          assetAddress: TEST_WALLET,
          collateralFactor: '0.75',
          liquidationThreshold: '0.80',
          liquidationPenalty: '0.05',
          reserveFactor: 1000,
        }),
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Integration Test Pool');
    expect(body.asset).toBe('USDC');
    expect(body.isActive).toBe(true);
    testPoolId = body.id;
  });

  it('should get pool by ID', async () => {
    const response = await app.handle(new Request(`http://localhost/lending/pools/${testPoolId}`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(testPoolId);
    expect(body.name).toBe('Integration Test Pool');
  });

  it('should deposit and update pool balance', async () => {
    const response = await app.handle(
      new Request(`http://localhost/lending/pools/${testPoolId}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testToken}`,
          'x-test-bypass-ratelimit': 'true',
        },
        body: JSON.stringify({ amount: '1000' }),
      }),
    );
    if (response.status !== 200) {
      console.error('LENDING DEPOSIT FAIL:', response.status, await response.text());
    }
    expect(response.status).toBe(200);
    const position = await response.json();
    expect(position.poolId).toBe(testPoolId);
    expect(position.depositorId).toBe(testUserId);
    expect(parseFloat(position.amount)).toBe(1000);

    // Verify pool balance updated
    const poolRes = await app.handle(new Request(`http://localhost/lending/pools/${testPoolId}`));
    const pool = await poolRes.json();
    expect(parseFloat(pool.totalDeposits)).toBe(1000);
    expect(parseFloat(pool.availableLiquidity)).toBe(1000);
  });

  it('should borrow and update pool balance', async () => {
    const response = await app.handle(
      new Request(`http://localhost/lending/pools/${testPoolId}/borrow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testToken}`,
          'x-test-bypass-ratelimit': 'true',
        },
        body: JSON.stringify({
          borrowAmount: '300',
          collateralAmount: '500',
          collateralAsset: VALID_STELLAR_ADDRESS,
        }),
      }),
    );
    if (response.status !== 200) {
      console.error('LENDING BORROW FAIL:', response.status, await response.text());
    }
    expect(response.status).toBe(200);
    const position = await response.json();
    expect(position.poolId).toBe(testPoolId);
    expect(position.borrowerId).toBe(testUserId);
    expect(parseFloat(position.principal)).toBe(300);
    expect(parseFloat(position.collateralAmount)).toBe(500);

    // Verify pool balance updated
    const poolRes = await app.handle(new Request(`http://localhost/lending/pools/${testPoolId}`));
    const pool = await poolRes.json();
    expect(parseFloat(pool.totalBorrows)).toBe(300);
    expect(parseFloat(pool.availableLiquidity)).toBe(700);
  });

  it('should repay and reduce borrow position', async () => {
    const response = await app.handle(
      new Request(`http://localhost/lending/pools/${testPoolId}/repay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testToken}`,
          'x-test-bypass-ratelimit': 'true',
        },
        body: JSON.stringify({ amount: '100' }),
      }),
    );
    if (response.status !== 200) {
      console.error('LENDING REPAY FAIL:', response.status, await response.json());
    }
    expect(response.status).toBe(200);
    const position = await response.json();
    expect(parseFloat(position.principal)).toBeCloseTo(200);

    // Verify pool balance updated
    const poolRes = await app.handle(new Request(`http://localhost/lending/pools/${testPoolId}`));
    const pool = await poolRes.json();
    expect(parseFloat(pool.totalBorrows)).toBeCloseTo(200);
    expect(parseFloat(pool.availableLiquidity)).toBe(800);
  });

  it('should return position summary for a seeded user', async () => {
    const response = await app.handle(
      new Request(`http://localhost/lending/pools/${testPoolId}/user/${TEST_WALLET}/summary`),
    );
    if (response.status !== 200) {
      console.error('LENDING SUMMARY FAIL:', response.status, await response.text());
    }
    expect(response.status).toBe(200);
    const summary = await response.json();
    expect(summary.poolId).toBe(testPoolId);
    expect(summary.userId).toBe(testUserId);
    expect(summary.walletAddress).toBe(TEST_WALLET);
    expect(summary.depositCount).toBeGreaterThan(0);
    expect(summary.borrowCount).toBeGreaterThan(0);
    expect(parseFloat(summary.totalDeposits)).toBeGreaterThan(0);
    expect(parseFloat(summary.totalBorrows)).toBeGreaterThan(0);
    expect(parseFloat(summary.netWorth)).toBeGreaterThan(0);
  });
});
