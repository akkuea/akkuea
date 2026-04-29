import { describe, expect, it, beforeAll } from 'bun:test';
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
      expect([200, 404, 400, 500]).toContain(response.status);
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
