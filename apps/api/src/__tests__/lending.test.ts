import { describe, expect, it, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { lendingRoutes } from '../routes/lending';
import { errorHandler } from '../middleware/errorHandler';
import { CreatePoolDto, DepositDto, WithdrawDto, BorrowDto, RepayDto } from '../dto/lending.dto';
import jwt from 'jsonwebtoken';
import { VALID_STELLAR_ADDRESS, VALID_UUID } from '@akkuea/shared';
const TEST_WALLET = 'GCO5CVUVFNX4KZQMYCALTJ5QSG6USOVLFQ74AQCCX7TGJKBNZ33KC5ZC'; // Unique wallet for lending tests
const TOKEN_CONTRACT = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
const OPS_KEY = 'lending-test-ops-key';
process.env.OPERATIONS_BACKEND_CREDENTIAL = process.env.OPERATIONS_BACKEND_CREDENTIAL || OPS_KEY;

function userToken(): string {
  return jwt.sign(
    { id: VALID_UUID, walletAddress: VALID_STELLAR_ADDRESS },
    process.env.JWT_SECRET || 'super-secret-default-key-for-dev',
  );
}

describe('Lending DTO Validation', () => {
  describe('CreatePoolDto', () => {
    it('should accept valid pool data', () => {
      const result = CreatePoolDto.safeParse({
        name: 'USDC Lending Pool',
        asset: 'USDC',
        assetAddress: TOKEN_CONTRACT,
        collateralFactor: '0.75',
        liquidationThreshold: '0.80',
        liquidationPenalty: '0.05',
        reserveFactor: 1000,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.closeFactor).toBe('0.5');
      }
    });

    it('should reject an account address as the pool asset', () => {
      const result = CreatePoolDto.safeParse({
        name: 'USDC Lending Pool',
        asset: 'USDC',
        assetAddress: VALID_STELLAR_ADDRESS,
        collateralFactor: '0.75',
        liquidationThreshold: '0.80',
        liquidationPenalty: '0.05',
      });
      expect(result.success).toBe(false);
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
        collateralAsset: TOKEN_CONTRACT,
      });
      expect(result.success).toBe(true);
    });

    it('should reject an account address as collateral asset', () => {
      const result = BorrowDto.safeParse({
        borrowAmount: '1000',
        collateralAmount: '1500',
        collateralAsset: VALID_STELLAR_ADDRESS,
      });
      expect(result.success).toBe(false);
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
    const poolBody = JSON.stringify({
      name: 'Test Pool',
      asset: 'USDC',
      assetAddress: TOKEN_CONTRACT,
      collateralFactor: '0.75',
      liquidationThreshold: '0.80',
      liquidationPenalty: '0.05',
    });

    it('should return 403 without the operator key', async () => {
      const response = await app.handle(
        new Request('http://localhost/lending/pools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: poolBody,
        }),
      );
      expect(response.status).toBe(403);
    });

    it('should return 403 for an authenticated normal user', async () => {
      const response = await app.handle(
        new Request('http://localhost/lending/pools', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken()}`,
          },
          body: poolBody,
        }),
      );
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('FORBIDDEN');
    });

    it('should reject an invalid body from an operator with a validation error', async () => {
      const response = await app.handle(
        new Request('http://localhost/lending/pools', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-api-key': process.env.OPERATIONS_BACKEND_CREDENTIAL!,
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

  describe('retired database-only write routes', () => {
    for (const action of ['deposit', 'withdraw', 'borrow', 'repay']) {
      it(`POST /lending/pools/:id/${action} answers 410 and points at prepare/confirm`, async () => {
        const response = await app.handle(
          new Request(`http://localhost/lending/pools/${VALID_UUID}/${action}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${userToken()}`,
            },
            body: JSON.stringify({ amount: '100' }),
          }),
        );
        expect(response.status).toBe(410);
        const body = await response.json();
        expect(body.error).toBe('GONE');
        expect(body.message).toContain(`/${action}/prepare`);
      });
    }
  });

  describe('prepare and confirm routes (auth + validation)', () => {
    for (const action of ['deposit', 'withdraw', 'repay']) {
      it(`POST /lending/pools/:id/${action}/prepare requires authentication`, async () => {
        const response = await app.handle(
          new Request(`http://localhost/lending/pools/${VALID_UUID}/${action}/prepare`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: '100' }),
          }),
        );
        expect(response.status).toBe(401);
      });

      it(`POST /lending/pools/:id/${action}/confirm requires authentication`, async () => {
        const response = await app.handle(
          new Request(`http://localhost/lending/pools/${VALID_UUID}/${action}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ txHash: 'a'.repeat(64) }),
          }),
        );
        expect(response.status).toBe(401);
      });
    }

    it('rejects a zero deposit amount', async () => {
      const response = await app.handle(
        new Request(`http://localhost/lending/pools/${VALID_UUID}/deposit/prepare`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken()}`,
          },
          body: JSON.stringify({ amount: '0' }),
        }),
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects a borrow without collateral', async () => {
      const response = await app.handle(
        new Request(`http://localhost/lending/pools/${VALID_UUID}/borrow/prepare`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken()}`,
          },
          body: JSON.stringify({ borrowAmount: '10' }),
        }),
      );
      expect(response.status).toBe(400);
    });

    it('rejects a malformed transaction hash on confirm', async () => {
      const response = await app.handle(
        new Request(`http://localhost/lending/pools/${VALID_UUID}/borrow/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken()}`,
          },
          body: JSON.stringify({ txHash: 'not-a-hash' }),
        }),
      );
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
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
