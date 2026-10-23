import { describe, expect, it, spyOn, beforeEach, afterEach } from 'bun:test';
import { ConflictError } from '@akkuea/shared';
import { PropertyController } from '../controllers/PropertyController';
import { propertyRepository } from '../repositories/PropertyRepository';
import { userRepository } from '../repositories/UserRepository';
import { cacheService } from '../services/CacheService';
import { auditService } from '../services/AuditService';
import { logger } from '../services/logger';
import type { Property } from '../db/schema';

const OWNER_WALLET = 'GOWNERADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

function baseProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'p-1',
    name: 'Test property',
    description: 'A test property description with enough characters',
    propertyType: 'residential',
    location: { address: '1 Main', city: 'Miami', country: 'US' },
    totalValue: '100000.00',
    tokenAddress: null,
    sorobanPropertyId: null,
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
    ownerId: 'owner-1',
    ...overrides,
  };
}

const originalFindById = propertyRepository.findById;
const originalUpdate = propertyRepository.update;
const originalDelete = propertyRepository.delete;
const originalHasShareHolders = propertyRepository.hasShareHolders;
const originalUserFindById = userRepository.findById;

describe('PropertyController owner-edit review state', () => {
  let invalidatedPatterns: string[];
  let auditCalls: Array<Record<string, unknown>>;

  beforeEach(() => {
    spyOn(logger, 'info').mockImplementation(() => {});
    spyOn(logger, 'error').mockImplementation(() => {});

    invalidatedPatterns = [];
    spyOn(cacheService, 'invalidate').mockImplementation(async (pattern: string) => {
      invalidatedPatterns.push(pattern);
    });

    auditCalls = [];
    spyOn(auditService, 'logAction').mockImplementation(async (input) => {
      auditCalls.push(input as unknown as Record<string, unknown>);
    });

    userRepository.findById = async () =>
      ({ id: 'owner-1', walletAddress: OWNER_WALLET }) as Awaited<
        ReturnType<typeof userRepository.findById>
      >;
  });

  afterEach(() => {
    propertyRepository.findById = originalFindById;
    propertyRepository.update = originalUpdate;
    propertyRepository.delete = originalDelete;
    propertyRepository.hasShareHolders = originalHasShareHolders;
    userRepository.findById = originalUserFindById;
  });

  describe('updateProperty', () => {
    it('demotes an approved property to pending_review when a material field changes', async () => {
      const property = baseProperty();
      propertyRepository.findById = async () => property;
      propertyRepository.hasShareHolders = async () => false;

      let updatedWith: Record<string, unknown> | undefined;
      propertyRepository.update = async (_id, data) => {
        updatedWith = data as Record<string, unknown>;
        return { ...property, ...data } as Property;
      };

      await PropertyController.updateProperty('p-1', { pricePerShare: '1200.00' }, OWNER_WALLET);

      expect(updatedWith).toMatchObject({
        pricePerShare: '1200.00',
        reviewStatus: 'pending_review',
        verified: false,
      });
    });

    it('rejects changing pricePerShare on a tokenized property with 409', async () => {
      const property = baseProperty({
        tokenAddress: 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        sorobanPropertyId: 1,
      });
      propertyRepository.findById = async () => property;
      propertyRepository.hasShareHolders = async () => false;

      let updateCalled = false;
      propertyRepository.update = async () => {
        updateCalled = true;
        return property;
      };

      await expect(
        PropertyController.updateProperty('p-1', { pricePerShare: '5000.00' }, OWNER_WALLET),
      ).rejects.toThrow(ConflictError);

      expect(updateCalled).toBe(false);
    });

    it('rejects changing totalValue on a property with share holders with 409', async () => {
      const property = baseProperty();
      propertyRepository.findById = async () => property;
      propertyRepository.hasShareHolders = async () => true;

      let updateCalled = false;
      propertyRepository.update = async () => {
        updateCalled = true;
        return property;
      };

      await expect(
        PropertyController.updateProperty('p-1', { totalValue: '2000000.00' }, OWNER_WALLET),
      ).rejects.toThrow(ConflictError);

      expect(updateCalled).toBe(false);
    });

    it('keeps the approved status when editing a non-material field', async () => {
      const property = baseProperty();
      propertyRepository.findById = async () => property;
      propertyRepository.hasShareHolders = async () => false;

      let updatedWith: Record<string, unknown> | undefined;
      propertyRepository.update = async (_id, data) => {
        updatedWith = data as Record<string, unknown>;
        return { ...property, ...data } as Property;
      };

      await PropertyController.updateProperty(
        'p-1',
        { description: 'An updated description with enough characters' },
        OWNER_WALLET,
      );

      expect(updatedWith).not.toHaveProperty('reviewStatus');
      expect(updatedWith).not.toHaveProperty('verified');
    });

    it('writes an audit entry with before/after values when editing a reviewed property', async () => {
      const property = baseProperty();
      propertyRepository.findById = async () => property;
      propertyRepository.hasShareHolders = async () => false;
      propertyRepository.update = async (_id, data) => ({ ...property, ...data }) as Property;

      await PropertyController.updateProperty('p-1', { pricePerShare: '1200.00' }, OWNER_WALLET);

      expect(auditCalls).toHaveLength(1);
      expect(auditCalls[0]).toMatchObject({
        actor: OWNER_WALLET,
        entityType: 'property',
        entityId: 'p-1',
      });
      const before = auditCalls[0]!.beforeValue as Record<string, unknown>;
      const after = auditCalls[0]!.afterValue as Record<string, unknown>;
      expect(before.pricePerShare).toBe('1000.00');
      expect(after.pricePerShare).toBe('1200.00');
      expect(after.reviewStatus).toBe('pending_review');
    });

    it('does not write an audit entry when the property was never approved', async () => {
      const property = baseProperty({ reviewStatus: 'pending_review', verified: false });
      propertyRepository.findById = async () => property;
      propertyRepository.hasShareHolders = async () => false;
      propertyRepository.update = async (_id, data) => ({ ...property, ...data }) as Property;

      await PropertyController.updateProperty('p-1', { pricePerShare: '1200.00' }, OWNER_WALLET);

      expect(auditCalls).toHaveLength(0);
    });

    it('invalidates both the properties and marketplace list caches', async () => {
      const property = baseProperty();
      propertyRepository.findById = async () => property;
      propertyRepository.hasShareHolders = async () => false;
      propertyRepository.update = async (_id, data) => ({ ...property, ...data }) as Property;

      await PropertyController.updateProperty('p-1', { name: 'New name' }, OWNER_WALLET);

      expect(invalidatedPatterns).toContain('properties:list:*');
      expect(invalidatedPatterns).toContain('marketplace:list:*');
    });
  });

  describe('deleteProperty', () => {
    it('rejects deleting a tokenized property with 409 and leaves the row untouched', async () => {
      const property = baseProperty({
        tokenAddress: 'CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        sorobanPropertyId: 1,
      });
      propertyRepository.findById = async () => property;
      propertyRepository.hasShareHolders = async () => false;

      let deleteCalled = false;
      propertyRepository.delete = async () => {
        deleteCalled = true;
        return true;
      };

      await expect(PropertyController.deleteProperty('p-1', OWNER_WALLET)).rejects.toThrow(
        ConflictError,
      );
      expect(deleteCalled).toBe(false);
    });

    it('rejects deleting a property with share holders with 409 and leaves the row untouched', async () => {
      const property = baseProperty();
      propertyRepository.findById = async () => property;
      propertyRepository.hasShareHolders = async () => true;

      let deleteCalled = false;
      propertyRepository.delete = async () => {
        deleteCalled = true;
        return true;
      };

      await expect(PropertyController.deleteProperty('p-1', OWNER_WALLET)).rejects.toThrow(
        ConflictError,
      );
      expect(deleteCalled).toBe(false);
    });

    it('deletes an untokenized property with no holders and invalidates both caches', async () => {
      const property = baseProperty();
      propertyRepository.findById = async () => property;
      propertyRepository.hasShareHolders = async () => false;
      propertyRepository.delete = async () => true;

      const result = await PropertyController.deleteProperty('p-1', OWNER_WALLET);

      expect(result.success).toBe(true);
      expect(invalidatedPatterns).toContain('properties:list:*');
      expect(invalidatedPatterns).toContain('marketplace:list:*');
    });
  });
});
