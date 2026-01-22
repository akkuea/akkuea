import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { lendingApi } from '../lending';
import { setupMockFetch, wrapFetchMock } from './helpers';
import type { BorrowPosition, DepositPosition, LendingPool } from '@real-estate-defi/shared';

describe('Lending API', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = wrapFetchMock(mock(() => {
      throw new Error('fetch not mocked');
    }));
  });

  describe('getPools', () => {
    it('fetches all lending pools', async () => {
      const mockPools: LendingPool[] = [
        {
          id: '1',
          assetSymbol: 'USD',
          baseRate: 2.5,
          collateralFactor: 0.6,
          totalDeposits: 1000000,
          totalBorrows: 500000,
          depositors: ['0xuser...'],
          borrowers: ['0xborrower...'],
          isActive: true,
        },
        {
          id: '2',
          assetSymbol: 'USD',
          baseRate: 3.1,
          collateralFactor: 0.65,
          totalDeposits: 2000000,
          totalBorrows: 1200000,
          depositors: ['0xuser2...'],
          borrowers: ['0xborrower2...'],
          isActive: true,
        },
      ];

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockPools,
      });
      global.fetch = fetchMock;

      const result = await lendingApi.getPools();

      expect(result).toEqual(mockPools);
      expect(calls[0].url).toBe('http://localhost:3001/lending/pools');
      expect(calls[0].options.method).toBe('GET');
    });
  });

  describe('getPool', () => {
    it('fetches pool by ID', async () => {
      const mockPool: LendingPool = {
        id: '123',
        assetSymbol: 'USD',
        baseRate: 2.5,
        collateralFactor: 0.6,
        totalDeposits: 1000000,
        totalBorrows: 500000,
        depositors: ['0xuser...'],
        borrowers: ['0xborrower...'],
        isActive: true,
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockPool,
      });
      global.fetch = fetchMock;

      const result = await lendingApi.getPool('123');

      expect(result).toEqual(mockPool);
      expect(calls[0].url).toBe('http://localhost:3001/lending/pools/123');
      expect(calls[0].options.method).toBe('GET');
    });
  });

  describe('deposit', () => {
    it('deposits into pool', async () => {
      const depositPayload = {
        user: '0xuser...',
        amount: 1000,
      };

      const mockResponse: { transactionHash: string; position: DepositPosition } = {
        transactionHash: '0xtx...',
        position: {
          poolId: '123',
          user: '0xuser...',
          amount: 1000,
          depositDate: new Date(),
          accruedInterest: 12.5,
        },
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await lendingApi.deposit('123', depositPayload);

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe('http://localhost:3001/lending/pools/123/deposit');
      expect(calls[0].options.method).toBe('POST');
      expect(JSON.parse(calls[0].options.body as string)).toEqual(depositPayload);
    });
  });

  describe('borrow', () => {
    it('borrows from pool', async () => {
      const borrowPayload = {
        borrower: '0xborrower...',
        collateralPropertyId: 'prop123',
        collateralShares: 10,
        borrowAmount: 5000,
      };

      const mockResponse: { transactionHash: string; position: BorrowPosition } = {
        transactionHash: '0xtx...',
        position: {
          poolId: '123',
          borrower: '0xborrower...',
          collateralPropertyId: 'prop123',
          collateralShares: 10,
          borrowAmount: 5000,
          borrowDate: new Date(),
          interestRate: 4.2,
          isLiquidated: false,
        },
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await lendingApi.borrow('123', borrowPayload);

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe('http://localhost:3001/lending/pools/123/borrow');
      expect(calls[0].options.method).toBe('POST');
      expect(JSON.parse(calls[0].options.body as string)).toEqual(borrowPayload);
    });
  });

  describe('getUserDeposits', () => {
    it('gets user deposit positions', async () => {
      const mockDeposits: DepositPosition[] = [
        {
          poolId: '123',
          user: '0xuser...',
          amount: 1000,
          depositDate: new Date(),
          accruedInterest: 5.2,
        },
        {
          poolId: '123',
          user: '0xuser...',
          amount: 2000,
          depositDate: new Date(),
          accruedInterest: 8.1,
        },
      ];

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockDeposits,
      });
      global.fetch = fetchMock;

      const result = await lendingApi.getUserDeposits('123', '0xuser...');

      expect(result).toEqual(mockDeposits);
      expect(calls[0].url).toBe(
        'http://localhost:3001/lending/pools/123/user/0xuser.../deposits'
      );
      expect(calls[0].options.method).toBe('GET');
    });
  });

  describe('getUserBorrows', () => {
    it('gets user borrow positions', async () => {
      const mockBorrows: BorrowPosition[] = [
        {
          poolId: '123',
          borrower: '0xuser...',
          collateralPropertyId: 'prop123',
          collateralShares: 10,
          borrowAmount: 5000,
          borrowDate: new Date(),
          interestRate: 4.2,
          isLiquidated: false,
        },
      ];

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockBorrows,
      });
      global.fetch = fetchMock;

      const result = await lendingApi.getUserBorrows('123', '0xuser...');

      expect(result).toEqual(mockBorrows);
      expect(calls[0].url).toBe(
        'http://localhost:3001/lending/pools/123/user/0xuser.../borrows'
      );
      expect(calls[0].options.method).toBe('GET');
    });
  });
});
