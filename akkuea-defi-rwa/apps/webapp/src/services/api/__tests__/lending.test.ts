import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { lendingApi } from '../lending';
import { setupMockFetch } from './helpers';

describe('Lending API', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = mock(() => {
      throw new Error('fetch not mocked');
    });
  });

  describe('getPools', () => {
    it('fetches all lending pools', async () => {
      const mockPools = [
        { id: '1', name: 'Pool 1', totalAssets: '1000000' },
        { id: '2', name: 'Pool 2', totalAssets: '2000000' },
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
      const mockPool = {
        id: '123',
        name: 'Test Pool',
        totalAssets: '1000000',
        apy: '5.5',
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

      const mockResponse = {
        transactionHash: '0xtx...',
        position: {
          id: 'pos1',
          user: '0xuser...',
          amount: 1000,
          poolId: '123',
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

      const mockResponse = {
        transactionHash: '0xtx...',
        position: {
          id: 'borrow1',
          borrower: '0xborrower...',
          amount: 5000,
          poolId: '123',
          collateralPropertyId: 'prop123',
          collateralShares: 10,
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
      const mockDeposits = [
        {
          id: 'dep1',
          user: '0xuser...',
          amount: 1000,
          poolId: '123',
        },
        {
          id: 'dep2',
          user: '0xuser...',
          amount: 2000,
          poolId: '123',
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
      const mockBorrows = [
        {
          id: 'borrow1',
          borrower: '0xuser...',
          amount: 5000,
          poolId: '123',
          collateralPropertyId: 'prop123',
          collateralShares: 10,
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
