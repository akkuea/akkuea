import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { lendingRoutes } from '../routes/lending';
import { errorHandler } from '../middleware/errorHandler';
import { CreatePoolDto, DepositDto, WithdrawDto, BorrowDto, RepayDto } from '../dto/lending.dto';
import { VALID_STELLAR_ADDRESS, VALID_UUID } from '@akkuea/shared';
const TEST_WALLET = 'GCO5CVUVFNX4KZQMYCALTJ5QSG6USOVLFQ74AQCCX7TGJKBNZ33KC5ZC'; // Unique wallet for lending tests

process.env.OPERATIONS_BACKEND_CREDENTIAL = 'test-ops-secret';
process.env.LIQUIDATOR_API_KEY = 'test-liquidator-secret';

const validPoolBody = {
  name: 'USDC Lending Pool',
  asset: 'USDC',
  assetAddress: VALID_STELLAR_ADDRESS,
  collateralFactor: '0.75',
  liquidationThreshold: '0.80',
  liquidationPenalty: '0.05',
  closeFactor: '0.50',
  reserveFactor: 1000,
};

describe('Lending DTO Validation', () => {
  describe('CreatePoolDto', () => {
    it('should accept valid pool data including closeFactor', () => {
      const result = CreatePoolDto.safeParse(validPoolBody);
      expect(result.success).toBe(true);
    });

    it('should reject missing name', () => {
      const result = CreatePoolDto.safeParse({
        asset: 'USDC',
        assetAddress: VALID_STELLAR_ADDRESS,
        collateralFactor: '0.75',
        liquidationThreshold: '0.80',
        liquidationPenalty: '0.05',
        closeFactor: '0.50',
      });
      expect(result.success).toBe(false);
    });

    it('should require closeFactor because the contract create_pool takes it', () => {
      const { closeFactor: _closeFactor, ...withoutCloseFactor } = validPoolBody;
      const result = CreatePoolDto.safeParse(withoutCloseFactor);
      expect(result.success).toBe(false);
    });

    it('should reject invalid Stellar address', () => {
      const result = CreatePoolDto.safeParse({
        ...validPoolBody,
        assetAddress: 'INVALID_ADDRESS',
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

  describe('POST /lending/pools (operator only)', () => {
    it('should return 403 without the operator key', async () => {
      const response = await app.handle(
        new Request('http://localhost/lending/pools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validPoolBody),
        }),
      );
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('FORBIDDEN');
    });

    it('should return 403 with a wrong operator key', async () => {
      const response = await app.handle(
        new Request('http://localhost/lending/pools', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': 'wrong-key',
          },
          body: JSON.stringify(validPoolBody),
        }),
      );
      expect(response.status).toBe(403);
    });

    it('should reject invalid body with validation error', async () => {
      const response = await app.handle(
        new Request('http://localhost/lending/pools', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': 'test-ops-secret',
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
      const response = await app.handle(
        new Request(`http://localhost/lending/pools/${VALID_UUID}`),
      );
      expect([200, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /lending/pools/:id/:action/prepare (auth)', () => {
    it('should return 401 without auth', async () => {
      const response = await app.handle(
        new Request(`http://localhost/lending/pools/${VALID_UUID}/deposit/prepare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: '100' }),
        }),
      );
      expect(response.status).toBe(401);
    });

    it('should reject invalid amount', async () => {
      // The auth derive rejects before the controller can be reached, so only
      // the validation of the schema is asserted through the DTO above.
      const result = DepositDto.safeParse({ amount: '0' });
      expect(result.success).toBe(false);
    });
  });

  describe('legacy write routes are retired', () => {
    for (const action of ['deposit', 'withdraw', 'borrow', 'repay']) {
      it(`POST /lending/pools/:id/${action} returns 410 Gone`, async () => {
        const response = await app.handle(
          new Request(`http://localhost/lending/pools/${VALID_UUID}/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: '100' }),
          }),
        );
        expect(response.status).toBe(410);
        const body = await response.json();
        expect(body.error).toBe('GONE');
        expect(body.message).toContain(`${action}/prepare`);
      });
    }
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
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.details.source).toBe('params');
      expect(body.details.errors.address).toContain('Invalid Stellar address format');
    });
  });
});

describe.skipIf(!process.env.DATABASE_URL)('Lending read endpoints (DB required)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let testUserId: string;
  let testPoolId: string;

  beforeAll(async () => {
    app = new Elysia().use(errorHandler).use(lendingRoutes);

    const { userRepository } = await import('../repositories/UserRepository');
    const user = await userRepository.getOrCreateByWallet(TEST_WALLET);
    testUserId = user.id;

    const { lendingRepository } = await import('../repositories/LendingRepository');
    const pool = await lendingRepository.create({
      name: 'Integration Test Pool',
      asset: 'USDC',
      assetAddress: TEST_WALLET,
      contractPoolId: `it-${Date.now()}`,
      totalDeposits: '1000',
      availableLiquidity: '1000',
      collateralFactor: '0.75',
      liquidationThreshold: '0.80',
      liquidationPenalty: '0.05',
      reserveFactor: 1000,
    });
    testPoolId = pool.id;
  });

  afterAll(async () => {
    const { db } = await import('../db');
    const { depositPositions, borrowPositions, lendingPools, users } = await import('../db/schema');
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
  });

  it('should return 404 for non-existent pool', async () => {
    const response = await app.handle(new Request(`http://localhost/lending/pools/${VALID_UUID}`));
    expect(response.status).toBe(404);
  });

  it('should get the seeded pool by ID with its contract_pool_id', async () => {
    const response = await app.handle(new Request(`http://localhost/lending/pools/${testPoolId}`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(testPoolId);
    expect(body.contractPoolId).toBeDefined();
  });

  it('does not change pool totals through the retired deposit route', async () => {
    const before = await app.handle(new Request(`http://localhost/lending/pools/${testPoolId}`));
    const beforePool = await before.json();

    const response = await app.handle(
      new Request(`http://localhost/lending/pools/${testPoolId}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: '1000' }),
      }),
    );
    expect(response.status).toBe(410);

    const after = await app.handle(new Request(`http://localhost/lending/pools/${testPoolId}`));
    const afterPool = await after.json();
    expect(afterPool.totalDeposits).toBe(beforePool.totalDeposits);
    expect(afterPool.availableLiquidity).toBe(beforePool.availableLiquidity);
  });
});
