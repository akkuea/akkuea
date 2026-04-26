import { describe, expect, it, spyOn, beforeEach } from 'bun:test';
import { PropertyController } from '../controllers/PropertyController';
import { propertyRepository, type PropertyListRow } from '../repositories/PropertyRepository';
import { userRepository } from '../repositories/UserRepository';
import { cacheService } from '../services/CacheService';
import { logger } from '../services/logger';

function listRow(id: string, ownerId: string, wallet: string): PropertyListRow {
  return {
    id,
    name: 'Test property',
    description: 'A test property description with enough characters',
    propertyType: 'residential',
    location: { address: '1 Main', city: 'Miami', country: 'US' },
    totalValue: '100000.00',
    tokenAddress: null,
    sorobanPropertyId: null,
    totalShares: 100,
    availableShares: 100,
    pricePerShare: '1000.00',
    images: [],
    verified: true,
    reviewStatus: 'approved',
    lastReviewNote: null,
    lastReviewedAt: null,
    lastReviewerWallet: null,
    listedAt: new Date('2024-01-01T00:00:00.000Z'),
    ownerId,
    ownerWalletAddress: wallet,
    ownerKycStatus: 'approved',
    ownerKycTier: 'basic',
  };
}

describe('PropertyController.getProperties', () => {
  beforeEach(() => {
    spyOn(logger, 'info').mockImplementation(() => {});
    spyOn(logger, 'error').mockImplementation(() => {});
    spyOn(cacheService, 'get').mockResolvedValue(null);
    spyOn(cacheService, 'set').mockResolvedValue(undefined);
  });

  it('loads owner wallets in one repository call without per-row user lookups', async () => {
    const rows: PropertyListRow[] = [
      listRow(
        '11111111-1111-1111-1111-111111111101',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2T',
      ),
      listRow(
        '11111111-1111-1111-1111-111111111102',
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB2T',
      ),
      listRow(
        '11111111-1111-1111-1111-111111111103',
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC2T',
      ),
    ];

    const findPaginatedSpy = spyOn(propertyRepository, 'findPaginated').mockResolvedValue({
      data: rows,
      pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
    });
    const findUserByIdSpy = spyOn(userRepository, 'findById');

    const out = await PropertyController.getProperties({ page: 1, limit: 20 });

    expect(findPaginatedSpy).toHaveBeenCalledTimes(1);
    expect(findUserByIdSpy).not.toHaveBeenCalled();
    expect(out.data).toHaveLength(3);
    expect(out.data.map((p) => p.owner)).toEqual(rows.map((r) => r.ownerWalletAddress));
  });
});
