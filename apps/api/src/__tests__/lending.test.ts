import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { lendingRoutes } from '../routes/lending';
import { errorHandler } from '../middleware/errorHandler';
import { CreatePoolDto, DepositDto, WithdrawDto, BorrowDto, RepayDto } from '../dto/lending.dto';
import jwt from 'jsonwebtoken';
import { VALID_STELLAR_ADDRESS, VALID_UUID } from '@akkuea/shared';
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
      const response = await app.handle(
        new Request(`http://localhost/lending/pools/${VALID_UUID}`),
      );
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
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.details.source).toBe('params');
      expect(body.details.errors.address).toContain('Invalid Stellar address format');
    });
  });
});

describe.skipIf(!process.env.DATABASE_URL)('Lending Integration Tests (DB required)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  let testUserId: string;
  let testPoolId: string;
  let testContractPoolId: string;
  let testToken: string;

  const OPS_SECRET = 'lending-integration-ops-secret';
  const MOCK_DEFI_CONTRACT_ID = 'CBFQV2RY5VHVFU3HT2I72FLXWY5YNZC37LWJSOZQCX45B76NBO4YZHM4';
  const prevOpsSecret = process.env.OPERATIONS_BACKEND_CREDENTIAL;
  const prevDefiContractId = process.env.DEFI_RWA_CONTRACT_ID;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let origCreateLendingPool: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let origPrepareLendingAction: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let origVerifyLendingTransaction: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let origReadLendingStateFromChain: any;

  beforeAll(async () => {
    process.env.OPERATIONS_BACKEND_CREDENTIAL = OPS_SECRET;
    process.env.DEFI_RWA_CONTRACT_ID = MOCK_DEFI_CONTRACT_ID;

    const { stellarService } = await import('../services/StellarService');
    origCreateLendingPool = stellarService.createLendingPool;
    origPrepareLendingAction = stellarService.prepareLendingAction;
    origVerifyLendingTransaction = stellarService.verifyLendingTransaction;
    origReadLendingStateFromChain = stellarService.readLendingStateFromChain;

    app = new Elysia().use(errorHandler).use(lendingRoutes);

    // Create or get a test user via the users repository so deposit/borrow can find them
    const { userRepository } = await import('../repositories/UserRepository');
    const user = await userRepository.getOrCreateByWallet(TEST_WALLET);
    testUserId = user.id;

    testToken = jwt.sign(
      { id: testUserId, walletAddress: TEST_WALLET },
      process.env.JWT_SECRET || 'super-secret-default-key-for-dev',
    );
  });

  afterAll(async () => {
    const { stellarService } = await import('../services/StellarService');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (stellarService as any).createLendingPool = origCreateLendingPool;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (stellarService as any).prepareLendingAction = origPrepareLendingAction;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (stellarService as any).verifyLendingTransaction = origVerifyLendingTransaction;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (stellarService as any).readLendingStateFromChain = origReadLendingStateFromChain;

    if (prevOpsSecret === undefined) {
      delete process.env.OPERATIONS_BACKEND_CREDENTIAL;
    } else {
      process.env.OPERATIONS_BACKEND_CREDENTIAL = prevOpsSecret;
    }
    if (prevDefiContractId === undefined) {
      delete process.env.DEFI_RWA_CONTRACT_ID;
    } else {
      process.env.DEFI_RWA_CONTRACT_ID = prevDefiContractId;
    }

    // Clean up test data in correct order (FK constraints)
    const { db } = await import('../db');
    const { depositPositions, borrowPositions, lendingPools, transactions } =
      await import('../db/schema');
    const { users } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');

    if (testPoolId) {
      await db.delete(depositPositions).where(eq(depositPositions.poolId, testPoolId));
      await db.delete(borrowPositions).where(eq(borrowPositions.poolId, testPoolId));
      await db.delete(lendingPools).where(eq(lendingPools.id, testPoolId));
    }
    if (testUserId) {
      await db.delete(transactions).where(eq(transactions.fromUserId, testUserId));
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

  it('should reject pool creation by normal authenticated user with 403 and allow operator', async () => {
    const { stellarService } = await import('../services/StellarService');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (stellarService as any).createLendingPool = async (params: { poolId: string }) => ({
      txHash: '1'.repeat(64),
      contractId: MOCK_DEFI_CONTRACT_ID,
      contractPoolId: params.poolId,
    });

    const forbiddenRes = await app.handle(
      new Request('http://localhost/lending/pools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testToken}`,
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
    expect(forbiddenRes.status).toBe(403);

    const response = await app.handle(
      new Request('http://localhost/lending/pools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': OPS_SECRET,
        },
        body: JSON.stringify({
          contractPoolId: `integration-usdc-${Date.now()}`,
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
    expect(body.contractPoolId).toBeDefined();
    expect(body.name).toBe('Integration Test Pool');
    expect(body.asset).toBe('USDC');
    expect(body.isActive).toBe(true);
    testPoolId = body.id;
    testContractPoolId = body.contractPoolId;
  });

  it('should get pool by ID', async () => {
    const response = await app.handle(new Request(`http://localhost/lending/pools/${testPoolId}`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(testPoolId);
    expect(body.name).toBe('Integration Test Pool');
  });

  it('should deposit via prepare/confirm and cache chain balance', async () => {
    const { stellarService } = await import('../services/StellarService');
    const depositTxHash = '2'.repeat(64);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (stellarService as any).prepareLendingAction = async () => ({
      xdr: 'AAAA-DEPOSIT-XDR',
      contractId: MOCK_DEFI_CONTRACT_ID,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (stellarService as any).verifyLendingTransaction = async () => ({
      txHash: depositTxHash,
      sourceAccount: TEST_WALLET,
      contractId: MOCK_DEFI_CONTRACT_ID,
      functionName: 'deposit',
      call: {
        kind: 'deposit',
        actor: TEST_WALLET,
        poolId: testContractPoolId,
        amount: 1000_0000000n,
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (stellarService as any).readLendingStateFromChain = async () => ({
      totalDeposits: 1000_0000000n,
      totalBorrows: 0n,
      depositPosition: {
        amount: 1000_0000000n,
        shares: 1000_0000000n,
        depositedAt: 1n,
      },
      borrowPosition: null,
    });

    const retiredRes = await app.handle(
      new Request(`http://localhost/lending/pools/${testPoolId}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testToken}`,
        },
        body: JSON.stringify({ amount: '1000' }),
      }),
    );
    expect(retiredRes.status).toBe(410);

    const prepRes = await app.handle(
      new Request(`http://localhost/lending/pools/${testPoolId}/deposit/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testToken}`,
        },
        body: JSON.stringify({ amount: '1000' }),
      }),
    );
    expect(prepRes.status).toBe(200);

    const response = await app.handle(
      new Request(`http://localhost/lending/pools/${testPoolId}/deposit/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testToken}`,
        },
        body: JSON.stringify({ txHash: depositTxHash }),
      }),
    );
    expect(response.status).toBe(200);
    const position = await response.json();
    expect(position.poolId).toBe(testPoolId);
    expect(position.depositorId).toBe(testUserId);
    expect(parseFloat(position.amount)).toBe(1000);

    // Verify pool balance updated from chain state
    const poolRes = await app.handle(new Request(`http://localhost/lending/pools/${testPoolId}`));
    const pool = await poolRes.json();
    expect(parseFloat(pool.totalDeposits)).toBe(1000);
    expect(parseFloat(pool.availableLiquidity)).toBe(1000);
  });

  it('should borrow via prepare/confirm and cache chain balance', async () => {
    const { stellarService } = await import('../services/StellarService');
    const borrowTxHash = '3'.repeat(64);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (stellarService as any).verifyLendingTransaction = async () => ({
      txHash: borrowTxHash,
      sourceAccount: TEST_WALLET,
      contractId: MOCK_DEFI_CONTRACT_ID,
      functionName: 'borrow',
      call: {
        kind: 'borrow',
        actor: TEST_WALLET,
        poolId: testContractPoolId,
        amount: 300_0000000n,
        collateralAsset: VALID_STELLAR_ADDRESS,
        collateralAmount: 500_0000000n,
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (stellarService as any).readLendingStateFromChain = async () => ({
      totalDeposits: 1000_0000000n,
      totalBorrows: 300_0000000n,
      depositPosition: null,
      borrowPosition: {
        principal: 300_0000000n,
        collateralAmount: 500_0000000n,
        collateralAsset: VALID_STELLAR_ADDRESS,
        borrowedAt: 2n,
        healthFactor: 1_333_333_333_333_333_333n,
      },
    });

    const response = await app.handle(
      new Request(`http://localhost/lending/pools/${testPoolId}/borrow/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testToken}`,
        },
        body: JSON.stringify({ txHash: borrowTxHash }),
      }),
    );
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

  it('should repay via confirm and reduce cached borrow position', async () => {
    const { stellarService } = await import('../services/StellarService');
    const repayTxHash = '4'.repeat(64);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (stellarService as any).verifyLendingTransaction = async () => ({
      txHash: repayTxHash,
      sourceAccount: TEST_WALLET,
      contractId: MOCK_DEFI_CONTRACT_ID,
      functionName: 'repay',
      call: {
        kind: 'repay',
        actor: TEST_WALLET,
        poolId: testContractPoolId,
        amount: 100_0000000n,
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (stellarService as any).readLendingStateFromChain = async () => ({
      totalDeposits: 1000_0000000n,
      totalBorrows: 200_0000000n,
      depositPosition: null,
      borrowPosition: {
        principal: 200_0000000n,
        collateralAmount: 333_3333333n,
        collateralAsset: VALID_STELLAR_ADDRESS,
        borrowedAt: 2n,
        healthFactor: 2_000_000_000_000_000_000n,
      },
    });

    const response = await app.handle(
      new Request(`http://localhost/lending/pools/${testPoolId}/repay/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testToken}`,
        },
        body: JSON.stringify({ txHash: repayTxHash }),
      }),
    );
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
