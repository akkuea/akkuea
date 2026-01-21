import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { propertyApi } from '../properties';
import { setupMockFetch } from './helpers';

describe('Property API', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = mock(() => {
      throw new Error('fetch not mocked');
    });
  });

  describe('getAll', () => {
    it('fetches all properties with pagination', async () => {
      const mockResponse = {
        data: [
          { id: '1', name: 'Property 1' },
          { id: '2', name: 'Property 2' },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await propertyApi.getAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockResponse.data);
      expect(result.pagination).toEqual(mockResponse.pagination);
      expect(calls[0].url).toContain('/properties');
      expect(calls[0].url).toContain('page=1');
      expect(calls[0].url).toContain('limit=10');
    });

    it('handles filters correctly', async () => {
      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } },
      });
      global.fetch = fetchMock;

      await propertyApi.getAll({
        propertyType: 'residential',
        country: 'USA',
        minPrice: 100000,
        maxPrice: 500000,
        verified: true,
      });

      const url = calls[0].url;
      expect(url).toContain('propertyType=residential');
      expect(url).toContain('country=USA');
      expect(url).toContain('minPrice=100000');
      expect(url).toContain('maxPrice=500000');
      expect(url).toContain('verified=true');
    });

    it('handles no parameters', async () => {
      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } },
      });
      global.fetch = fetchMock;

      await propertyApi.getAll();

      expect(calls[0].url).toBe('http://localhost:3001/properties');
    });
  });

  describe('getById', () => {
    it('fetches property by ID', async () => {
      const mockProperty = {
        id: '123',
        name: 'Test Property',
        description: 'A test property',
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockProperty,
      });
      global.fetch = fetchMock;

      const result = await propertyApi.getById('123');

      expect(result).toEqual(mockProperty);
      expect(calls[0].url).toBe('http://localhost:3001/properties/123');
      expect(calls[0].options.method).toBe('GET');
    });
  });

  describe('create', () => {
    it('creates a new property', async () => {
      const createPayload = {
        name: 'New Property',
        description: 'Description',
        propertyType: 'residential',
        location: {
          address: '123 Main St',
          city: 'New York',
          country: 'USA',
          postalCode: '10001',
        },
        totalValue: '1000000',
        totalShares: 1000,
        pricePerShare: '1000',
        images: ['image1.jpg'],
      };

      const mockResponse = {
        id: '123',
        ...createPayload,
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 201,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await propertyApi.create(createPayload);

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe('http://localhost:3001/properties');
      expect(calls[0].options.method).toBe('POST');
      expect(JSON.parse(calls[0].options.body as string)).toEqual(createPayload);
    });
  });

  describe('tokenize', () => {
    it('tokenizes a property', async () => {
      const mockResponse = {
        tokenAddress: '0x123...',
        transactionHash: '0xabc...',
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await propertyApi.tokenize('123');

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe('http://localhost:3001/properties/123/tokenize');
      expect(calls[0].options.method).toBe('POST');
    });
  });

  describe('buyShares', () => {
    it('buys property shares', async () => {
      const mockResponse = {
        transactionHash: '0xdef...',
        newBalance: 50,
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockResponse,
      });
      global.fetch = fetchMock;

      const result = await propertyApi.buyShares('123', 50);

      expect(result).toEqual(mockResponse);
      expect(calls[0].url).toBe('http://localhost:3001/properties/123/buy-shares');
      expect(calls[0].options.method).toBe('POST');
      expect(JSON.parse(calls[0].options.body as string)).toEqual({ shares: 50 });
    });
  });

  describe('getShares', () => {
    it('gets user share holdings for a property', async () => {
      const mockShareOwnership = {
        propertyId: '123',
        ownerAddress: '0xowner...',
        shares: 100,
        percentage: 10,
      };

      const { fetchMock, calls } = setupMockFetch({
        status: 200,
        body: mockShareOwnership,
      });
      global.fetch = fetchMock;

      const result = await propertyApi.getShares('123', '0xowner...');

      expect(result).toEqual(mockShareOwnership);
      expect(calls[0].url).toBe(
        'http://localhost:3001/properties/123/shares/0xowner...'
      );
      expect(calls[0].options.method).toBe('GET');
    });

    it('handles null response when no shares found', async () => {
      const { fetchMock } = setupMockFetch({
        status: 200,
        body: null,
        headers: { 'Content-Type': 'application/json' },
      });
      global.fetch = fetchMock;

      const result = await propertyApi.getShares('123', '0xowner...');

      expect(result).toBeNull();
    });
  });
});
