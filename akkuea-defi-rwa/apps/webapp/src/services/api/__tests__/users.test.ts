import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { userApi } from '../users';
import { setupMockFetch, wrapFetchMock } from './helpers';
import type { KycDocument, Transaction, User } from '@real-estate-defi/shared';

describe('User API', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = wrapFetchMock(mock(() => {
      throw new Error('fetch not mocked');
    }));
  });

  describe('getByWallet', () => {
    it('fetches user by wallet address', async () => {
      const mockUser: User = {
        address: '0xwallet...',
        email: 'user@example.com',
        kycStatus: 'pending',
        reputation: 0,
        createdAt: new Date(),
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockUser,
      });
      global.fetch = fetchMock;

      const result = await userApi.getByWallet('0xwallet...');

      expect(result).toEqual(mockUser);
      expect(calls[0].url).toBe('http://localhost:3001/users/0xwallet...');
      expect(calls[0].options.method).toBe('GET');
    });
  });

  describe('connectWallet', () => {
    it('connects wallet and returns token', async () => {
      const connectPayload = {
        signature: '0xsig...',
        message: 'Connect wallet message',
      };

      const mockResponse: { token: string; user: User } = {
        token: 'auth-token-123',
        user: {
          address: '0xwallet...',
          email: 'user@example.com',
          kycStatus: 'pending',
          reputation: 0,
          createdAt: new Date(),
        },
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await userApi.connectWallet('0xwallet...', connectPayload);

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe('http://localhost:3001/users/0xwallet.../wallet');
      expect(calls[0].options.method).toBe('POST');
      expect(JSON.parse(calls[0].options.body as string)).toEqual(connectPayload);
    });
  });

  describe('getTransactions', () => {
    it('fetches user transactions', async () => {
      const mockTransactions: Transaction[] = [
        {
          id: 'tx1',
          type: 'deposit',
          amount: 1000,
          from: '0xfrom',
          to: '0xto',
          timestamp: new Date(),
          txHash: '0xtxhash1',
          status: 'confirmed',
        },
        {
          id: 'tx2',
          type: 'borrow',
          amount: 500,
          from: '0xfrom',
          to: '0xto',
          timestamp: new Date(),
          txHash: '0xtxhash2',
          status: 'pending',
        },
      ];

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockTransactions,
      });
      global.fetch = fetchMock;

      const result = await userApi.getTransactions('0xwallet...');

      expect(result).toEqual(mockTransactions);
      expect(calls[0].url).toBe(
        'http://localhost:3001/users/0xwallet.../transactions'
      );
      expect(calls[0].options.method).toBe('GET');
    });
  });

  describe('getPortfolio', () => {
    it('fetches user portfolio', async () => {
      const mockPortfolio = {
        properties: [
          { propertyId: 'prop1', shares: 10 },
          { propertyId: 'prop2', shares: 5 },
        ],
        deposits: [{ poolId: 'pool1', amount: 1000 }],
        borrows: [{ poolId: 'pool1', amount: 500 }],
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockPortfolio,
      });
      global.fetch = fetchMock;

      const result = await userApi.getPortfolio('0xwallet...');

      expect(result).toEqual(mockPortfolio);
      expect(calls[0].url).toBe(
        'http://localhost:3001/users/0xwallet.../portfolio'
      );
      expect(calls[0].options.method).toBe('GET');
    });
  });

  describe('getKycStatus', () => {
    it('fetches KYC status', async () => {
      const mockKycStatus = {
        status: 'verified',
        tier: 'tier1',
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockKycStatus,
      });
      global.fetch = fetchMock;

      const result = await userApi.getKycStatus('user123');

      expect(result).toEqual(mockKycStatus);
      expect(calls[0].url).toBe('http://localhost:3001/kyc/status/user123');
      expect(calls[0].options.method).toBe('GET');
    });
  });

  describe('submitKyc', () => {
    it('submits KYC for verification', async () => {
      const submitPayload = {
        userId: 'user123',
        documents: [
          {
            type: 'passport' as const,
            documentUrl: 'https://example.com/doc.pdf',
          },
        ],
      };

      const mockResponse = {
        status: 'pending',
        message: 'KYC submission received',
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await userApi.submitKyc(submitPayload);

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe('http://localhost:3001/kyc/submit');
      expect(calls[0].options.method).toBe('POST');
      expect(JSON.parse(calls[0].options.body as string)).toEqual(submitPayload);
    });
  });

  describe('getKycDocuments', () => {
    it('fetches user KYC documents', async () => {
      const mockDocuments: KycDocument[] = [
        {
          id: 'doc1',
          userId: 'user123',
          documentType: 'passport',
          documentUrl: 'https://example.com/doc.pdf',
          status: 'verified',
          submittedAt: new Date(),
          verifiedAt: new Date(),
        },
      ];

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockDocuments,
      });
      global.fetch = fetchMock;

      const result = await userApi.getKycDocuments('user123');

      expect(result).toEqual(mockDocuments);
      expect(calls[0].url).toBe('http://localhost:3001/kyc/documents/user123');
      expect(calls[0].options.method).toBe('GET');
    });
  });
});
