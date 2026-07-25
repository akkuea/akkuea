import { describe, expect, it, spyOn, beforeEach, afterEach } from 'bun:test';
import type { PropertyInfo } from '@real-estate-defi/shared';
import { MarketplaceController } from '../controllers/MarketplaceController';
import { propertyRepository, type PropertyListRow } from '../repositories/PropertyRepository';
import { userRepository } from '../repositories/UserRepository';
import { cacheService } from '../services/CacheService';
import { logger } from '../services/logger';

function listRow(id: string, overrides: Partial<PropertyListRow> = {}): PropertyListRow {
  return {
    id,
    name: 'Test property',
    description: 'A test property description with enough characters',
    propertyType: 'residential',
    location: { address: '1 Main', city: 'Miami', country: 'US' },
    totalValue: '100000.00',
    tokenAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    sorobanPropertyId: 1,
    totalShares: 100,
    availableShares: 50,
    pricePerShare: '1000.00',
    images: ['https://example.com/image.jpg'],
    verified: true,
    reviewStatus: 'approved',
    lastReviewNote: null,
    lastReviewedAt: null,
    lastReviewerWallet: null,
    listedAt: new Date('2024-01-01T00:00:00.000Z'),
    ownerId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    ownerWalletAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2T',
    ownerKycStatus: 'approved',
    ownerKycTier: 'basic',
    ...overrides,
  };
}

const originalFindPaginated = propertyRepository.findPaginated;

describe('MarketplaceController.getListings', () => {
  beforeEach(() => {
    spyOn(logger, 'info').mockImplementation(() => {});
    spyOn(logger, 'error').mockImplementation(() => {});
    spyOn(cacheService, 'get').mockResolvedValue(null);
    spyOn(cacheService, 'set').mockResolvedValue(undefined);
  });

  afterEach(() => {
    propertyRepository.findPaginated = originalFindPaginated;
  });

  it('returns only approved, verified properties with available shares', async () => {
    const rows: PropertyListRow[] = [
      listRow('p-1', { reviewStatus: 'approved', verified: true, availableShares: 10 }),
      listRow('p-2', { reviewStatus: 'pending_review', verified: true, availableShares: 10 }),
      listRow('p-3', { reviewStatus: 'approved', verified: false, availableShares: 10 }),
      listRow('p-4', { reviewStatus: 'approved', verified: true, availableShares: 0 }),
      listRow('p-5', { reviewStatus: 'approved', verified: true, availableShares: 5 }),
    ];

    propertyRepository.findPaginated = async () => ({
      data: rows.filter(
        (r) => r.reviewStatus === 'approved' && r.verified && r.availableShares > 0,
      ),
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });

    const result = await MarketplaceController.getListings();
    expect(result.data).toHaveLength(2);
    expect(result.data.map((p) => p.id).sort()).toEqual(['p-1', 'p-5']);
  });

  it('passes marketplace-specific filters to repository', async () => {
    let capturedFilter: Record<string, unknown> | undefined;
    propertyRepository.findPaginated = async (_options, filter) => {
      capturedFilter = filter as Record<string, unknown>;
      return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    };

    await MarketplaceController.getListings({
      page: 2,
      limit: 10,
      propertyType: 'commercial',
      country: 'US',
      minPrice: '500',
      maxPrice: '2000',
    });

    expect(capturedFilter).toEqual({
      reviewStatuses: ['approved'],
      verified: true,
      hasAvailableShares: true,
      propertyType: 'commercial',
      country: 'US',
      minPricePerShare: 500,
      maxPricePerShare: 2000,
    });
  });

  it('returns cached response when available', async () => {
    const cached = {
      data: [listRow('cached-1', { name: 'Cached property' }) as unknown as PropertyInfo],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    spyOn(cacheService, 'get').mockResolvedValue(cached);

    let repositoryCalled = false;
    propertyRepository.findPaginated = async () => {
      repositoryCalled = true;
      return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    };

    const result = await MarketplaceController.getListings();
    expect(result).toEqual(cached);
    expect(repositoryCalled).toBe(false);
  });

  it('applies pagination parameters', async () => {
    let capturedOptions: Record<string, unknown> | undefined;
    propertyRepository.findPaginated = async (options) => {
      capturedOptions = options as unknown as Record<string, unknown>;
      return { data: [], pagination: { page: 2, limit: 5, total: 15, totalPages: 3 } };
    };

    await MarketplaceController.getListings({ page: '2', limit: '5' });

    expect(capturedOptions).toEqual({ page: 2, limit: 5 });
  });

  it('defaults to page 1, limit 20', async () => {
    let capturedOptions: Record<string, unknown> | undefined;
    propertyRepository.findPaginated = async (options) => {
      capturedOptions = options as unknown as Record<string, unknown>;
      return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    };

    await MarketplaceController.getListings();

    expect(capturedOptions).toEqual({ page: 1, limit: 20 });
  });
});

describe('MarketplaceController.getListing', () => {
  beforeEach(() => {
    spyOn(logger, 'info').mockImplementation(() => {});
    spyOn(logger, 'error').mockImplementation(() => {});
  });

  it('returns an approved, verified property with available shares', async () => {
    spyOn(propertyRepository, 'findById').mockResolvedValue({
      id: 'p-1',
      name: 'Test',
      description: 'Test',
      propertyType: 'residential',
      location: { address: '1 Main', city: 'Miami', country: 'US' },
      totalValue: '100000.00',
      tokenAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      sorobanPropertyId: 1,
      totalShares: 100,
      availableShares: 10,
      pricePerShare: '1000.00',
      images: [],
      verified: true,
      reviewStatus: 'approved',
      lastReviewNote: null,
      lastReviewedAt: null,
      lastReviewerWallet: null,
      listedAt: new Date(),
      ownerId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    });
    spyOn(userRepository, 'findById').mockResolvedValue({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      walletAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2T',
      email: null,
      displayName: null,
      kycStatus: 'approved',
      kycTier: 'basic',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
    });

    const result = await MarketplaceController.getListing('p-1');
    expect(result.id).toBe('p-1');
    expect(result.owner).toBe('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2T');
  });

  it('throws NotFoundError for non-existent property', async () => {
    spyOn(propertyRepository, 'findById').mockResolvedValue(undefined);

    await expect(MarketplaceController.getListing('non-existent')).rejects.toThrow(
      'Marketplace listing',
    );
  });

  it('throws NotFoundError for non-approved property', async () => {
    spyOn(propertyRepository, 'findById').mockResolvedValue({
      id: 'p-1',
      name: 'Test',
      description: 'Test',
      propertyType: 'residential',
      location: { address: '1 Main', city: 'Miami', country: 'US' },
      totalValue: '100000.00',
      tokenAddress: null,
      sorobanPropertyId: null,
      totalShares: 100,
      availableShares: 10,
      pricePerShare: '1000.00',
      images: [],
      verified: true,
      reviewStatus: 'pending_review',
      lastReviewNote: null,
      lastReviewedAt: null,
      lastReviewerWallet: null,
      listedAt: new Date(),
      ownerId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    });

    await expect(MarketplaceController.getListing('p-1')).rejects.toThrow('Marketplace listing');
  });

  it('throws NotFoundError for property with no available shares', async () => {
    spyOn(propertyRepository, 'findById').mockResolvedValue({
      id: 'p-1',
      name: 'Test',
      description: 'Test',
      propertyType: 'residential',
      location: { address: '1 Main', city: 'Miami', country: 'US' },
      totalValue: '100000.00',
      tokenAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      sorobanPropertyId: 1,
      totalShares: 100,
      availableShares: 0,
      pricePerShare: '1000.00',
      images: [],
      verified: true,
      reviewStatus: 'approved',
      lastReviewNote: null,
      lastReviewedAt: null,
      lastReviewerWallet: null,
      listedAt: new Date(),
      ownerId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    });

    await expect(MarketplaceController.getListing('p-1')).rejects.toThrow('Marketplace listing');
  });

  it('throws ValidationError for empty ID', async () => {
    await expect(MarketplaceController.getListing('')).rejects.toThrow('Property ID is required');
  });
});
