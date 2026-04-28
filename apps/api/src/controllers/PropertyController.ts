import type {
  PropertyInfo,
  ShareOwnership as SharedShareOwnership,
} from '@real-estate-defi/shared';
import {
  ValidationError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
} from '@real-estate-defi/shared';
import { and, eq } from 'drizzle-orm';
import { logger } from '../services/logger';
import { db } from '../db';
import { tokenizationService, type TokenizationResponse } from '../services/TokenizationService';
import { stellarService } from '../services/StellarService';
import {
  propertyRepository,
  type PropertyFilter,
  type PaginatedResult,
  type PropertyListRow,
} from '../repositories/PropertyRepository';
import { userRepository } from '../repositories/UserRepository';
import {
  properties,
  shareOwnerships,
  transactions,
  type Property,
  type NewProperty,
  type PropertyDocument,
} from '../db/schema';
import { cacheService } from '../services/CacheService';

const PROPERTIES_CACHE_TTL = 30; // seconds
const PROPERTIES_CACHE_PREFIX = 'properties:list:';

/**
 * DTO for creating a property
 */
export interface CreatePropertyInput {
  name: string;
  description: string;
  propertyType: 'residential' | 'commercial' | 'industrial' | 'land' | 'mixed';
  location: {
    address: string;
    city: string;
    country: string;
    postalCode?: string;
    coordinates?: { latitude: number; longitude: number };
  };
  totalValue: string; // Decimal as string for precision
  totalShares: number;
  pricePerShare: string; // Decimal as string for precision
  images: string[];
}

/**
 * DTO for updating a property
 */
export interface UpdatePropertyInput {
  name?: string;
  description?: string;
  propertyType?: 'residential' | 'commercial' | 'industrial' | 'land' | 'mixed';
  location?: {
    address: string;
    city: string;
    country: string;
    postalCode?: string;
    coordinates?: { latitude: number; longitude: number };
  };
  totalValue?: string; // Decimal as string for precision
  pricePerShare?: string; // Decimal as string for precision
  images?: string[];
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Maps database Property to shared PropertyInfo type
 */
async function mapPropertyToPropertyInfo(
  property: Property & { documents?: PropertyDocument[] },
  ownerAddress?: string,
): Promise<PropertyInfo> {
  let walletAddress = ownerAddress;
  if (walletAddress === undefined) {
    const owner = await userRepository.findById(property.ownerId);
    walletAddress = owner?.walletAddress ?? '';
  }

  return {
    id: property.id,
    name: property.name,
    description: property.description,
    propertyType: property.propertyType,
    location: property.location,
    totalValue: property.totalValue, // Already a string in DB
    tokenAddress: property.tokenAddress ?? undefined,
    totalShares: property.totalShares,
    availableShares: property.availableShares,
    pricePerShare: property.pricePerShare, // Already a string in DB
    images: property.images,
    documents: (property.documents ?? []).map((doc: PropertyDocument) => ({
      id: doc.id,
      type: doc.type,
      name: doc.name,
      url: doc.url,
      uploadedAt: doc.uploadedAt.toISOString(),
      verified: doc.verified,
    })),
    verified: property.verified,
    listedAt: property.listedAt.toISOString(),
    owner: walletAddress,
  };
}

function mapShareOwnershipToShared(
  ownership: typeof shareOwnerships.$inferSelect,
  ownerAddress: string,
): SharedShareOwnership {
  return {
    propertyId: ownership.propertyId,
    owner: ownerAddress,
    shares: ownership.shares,
    purchasePrice: ownership.purchasePrice,
    purchasedAt: ownership.purchasedAt.toISOString(),
    lastDividendClaimed: ownership.lastDividendClaimed?.toISOString(),
  };
}

/**
 * Validates pagination parameters
 */
function validatePagination(page: unknown, limit: unknown): { page: number; limit: number } {
  const pageNum =
    typeof page === 'string' ? parseInt(page, 10) : typeof page === 'number' ? page : 1;
  const limitNum =
    typeof limit === 'string' ? parseInt(limit, 10) : typeof limit === 'number' ? limit : 10;

  return {
    page: pageNum > 0 ? pageNum : 1,
    limit: limitNum > 0 && limitNum <= 100 ? limitNum : 10,
  };
}

export class PropertyController {
  /**
   * Get properties with pagination and filters
   */
  static async getProperties(query?: {
    page?: string | number;
    limit?: string | number;
    ownerId?: string;
    city?: string;
    country?: string;
    propertyType?: string;
    minPricePerShare?: string | number;
    maxPricePerShare?: string | number;
    minAvailableShares?: string | number;
    hasAvailableShares?: string | boolean;
    verified?: string | boolean;
  }): Promise<PaginatedResponse<PropertyInfo>> {
    const startTime = Date.now();
    logger.info('Fetching properties', { operation: 'READ', entity: 'property' });

    try {
      const pagination = validatePagination(query?.page, query?.limit);

      const filter: PropertyFilter = {};

      if (query?.ownerId) filter.ownerId = query.ownerId;
      if (query?.city) filter.city = query.city;
      if (query?.country) filter.country = query.country;
      if (
        query?.propertyType &&
        ['residential', 'commercial', 'industrial', 'land', 'mixed'].includes(query.propertyType)
      ) {
        filter.propertyType = query.propertyType as PropertyFilter['propertyType'];
      }
      if (query?.minPricePerShare !== undefined) {
        filter.minPricePerShare = Number(query.minPricePerShare);
      }
      if (query?.maxPricePerShare !== undefined) {
        filter.maxPricePerShare = Number(query.maxPricePerShare);
      }
      if (query?.minAvailableShares !== undefined) {
        filter.minAvailableShares = Number(query.minAvailableShares);
      }
      if (query?.hasAvailableShares === 'true' || query?.hasAvailableShares === true) {
        filter.hasAvailableShares = true;
      }
      if (query?.verified === 'true' || query?.verified === true) {
        filter.verified = true;
      }

      // Build a stable cache key from pagination + filter params
      const cacheKey =
        `${PROPERTIES_CACHE_PREFIX}` +
        `${pagination.page}:${pagination.limit}:` +
        `${filter.ownerId ?? ''}:${filter.city ?? ''}:${filter.country ?? ''}:` +
        `${filter.propertyType ?? ''}:${filter.minPricePerShare ?? ''}:` +
        `${filter.maxPricePerShare ?? ''}:${filter.minAvailableShares ?? ''}:` +
        `${filter.hasAvailableShares ?? ''}:${filter.verified ?? ''}`;

      const cached = await cacheService.get<PaginatedResponse<PropertyInfo>>(cacheKey);
      if (cached) {
        logger.info('Properties served from cache', { operation: 'READ', entity: 'property' });
        return cached;
      }

      const result: PaginatedResult<PropertyListRow> = await propertyRepository.findPaginated(
        pagination,
        Object.keys(filter).length > 0 ? filter : undefined,
      );

      const mappedProperties = await Promise.all(
        result.data.map((row) => mapPropertyToPropertyInfo(row, row.ownerWalletAddress)),
      );

      const response: PaginatedResponse<PropertyInfo> = {
        data: mappedProperties,
        pagination: result.pagination,
      };

      await cacheService.set(cacheKey, response, PROPERTIES_CACHE_TTL);

      logger.info('Properties fetched successfully', {
        operation: 'READ',
        entity: 'property',
        count: mappedProperties.length,
        duration: Date.now() - startTime,
      });

      return response;
    } catch (error) {
      logger.error('Failed to fetch properties', { error, operation: 'READ', entity: 'property' });
      throw error;
    }
  }

  /**
   * Get a single property by ID
   */
  static async getProperty(id: string): Promise<PropertyInfo> {
    const startTime = Date.now();

    if (!id) {
      throw new ValidationError('Property ID is required', [
        { field: 'id', message: 'Property ID is required' },
      ]);
    }

    logger.info('Fetching property', { operation: 'READ', entity: 'property', entityId: id });

    try {
      const property = await propertyRepository.findByIdWithDocuments(id);

      if (!property) {
        throw new NotFoundError('Property', id);
      }

      const propertyInfo = await mapPropertyToPropertyInfo(property);

      logger.info('Property fetched successfully', {
        operation: 'READ',
        entity: 'property',
        entityId: id,
        duration: Date.now() - startTime,
      });

      return propertyInfo;
    } catch (error) {
      logger.error('Failed to fetch property', {
        error,
        operation: 'READ',
        entity: 'property',
        entityId: id,
      });
      throw error;
    }
  }

  /**
   * Create a new property
   */
  static async createProperty(
    data: CreatePropertyInput,
    userAddress: string,
  ): Promise<PropertyInfo> {
    const startTime = Date.now();
    logger.info('Creating property', {
      operation: 'CREATE',
      entity: 'property',
      userId: userAddress,
    });

    try {
      // Validate required fields
      if (!data.name || data.name.trim().length === 0) {
        throw new ValidationError('Property name is required');
      }
      if (!data.description || data.description.length < 10) {
        throw new ValidationError('Description must be at least 10 characters');
      }
      if (!data.location) {
        throw new ValidationError('Location is required');
      }
      if (data.totalShares <= 0) {
        throw new ValidationError('Total shares must be positive');
      }
      const pricePerShare = parseFloat(data.pricePerShare);
      if (isNaN(pricePerShare) || pricePerShare <= 0) {
        throw new ValidationError('Price per share must be positive');
      }
      if (!data.images || data.images.length === 0) {
        throw new ValidationError('At least one image is required');
      }

      // Get or create user by wallet address
      const user = await userRepository.getOrCreateByWallet(userAddress);

      // Create property
      const newProperty: NewProperty = {
        name: data.name,
        description: data.description,
        propertyType: data.propertyType,
        location: data.location,
        totalValue: data.totalValue, // Already a string from validation
        totalShares: data.totalShares,
        availableShares: data.totalShares, // Initially all shares are available
        pricePerShare: data.pricePerShare, // Already a string from validation
        images: data.images,
        verified: false,
        ownerId: user.id,
      };

      const property = await propertyRepository.create(newProperty);
      const propertyInfo = await mapPropertyToPropertyInfo(property, userAddress);

      await cacheService.invalidate(`${PROPERTIES_CACHE_PREFIX}*`);

      logger.info('Property created successfully', {
        operation: 'CREATE',
        entity: 'property',
        entityId: property.id,
        duration: Date.now() - startTime,
      });

      return propertyInfo;
    } catch (error) {
      logger.error('Failed to create property', { error, operation: 'CREATE', entity: 'property' });
      throw error;
    }
  }

  /**
   * Update an existing property
   */
  static async updateProperty(
    id: string,
    data: UpdatePropertyInput,
    userAddress: string,
  ): Promise<PropertyInfo> {
    const startTime = Date.now();

    if (!id) {
      throw new ValidationError('Property ID is required');
    }

    if (!userAddress) {
      throw new AuthenticationError('User address is required for authentication');
    }

    logger.info('Updating property', {
      operation: 'UPDATE',
      entity: 'property',
      entityId: id,
      userId: userAddress,
    });

    try {
      // Check if property exists
      const property = await propertyRepository.findById(id);

      if (!property) {
        throw new NotFoundError('Property', id);
      }

      // Verify ownership
      const owner = await userRepository.findById(property.ownerId);
      if (!owner || owner.walletAddress !== userAddress) {
        throw new AuthorizationError('You do not have permission to update this property');
      }

      // Build update data
      const updateData: Partial<NewProperty> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.propertyType !== undefined) updateData.propertyType = data.propertyType;
      if (data.location !== undefined) updateData.location = data.location;
      if (data.totalValue !== undefined) updateData.totalValue = data.totalValue; // Already a string
      if (data.pricePerShare !== undefined) updateData.pricePerShare = data.pricePerShare; // Already a string
      if (data.images !== undefined) updateData.images = data.images;

      const updatedProperty = await propertyRepository.update(id, updateData);

      if (!updatedProperty) {
        throw new Error('Failed to update property');
      }

      const propertyInfo = await mapPropertyToPropertyInfo(updatedProperty, userAddress);

      await cacheService.invalidate(`${PROPERTIES_CACHE_PREFIX}*`);

      logger.info('Property updated successfully', {
        operation: 'UPDATE',
        entity: 'property',
        entityId: id,
        duration: Date.now() - startTime,
      });

      return propertyInfo;
    } catch (error) {
      logger.error('Failed to update property', {
        error,
        operation: 'UPDATE',
        entity: 'property',
        entityId: id,
      });
      throw error;
    }
  }

  /**
   * Delete a property
   */
  static async deleteProperty(id: string, userAddress: string): Promise<{ success: boolean }> {
    const startTime = Date.now();

    if (!id) {
      throw new ValidationError('Property ID is required');
    }

    if (!userAddress) {
      throw new AuthenticationError('User address is required for authentication');
    }

    logger.info('Deleting property', {
      operation: 'DELETE',
      entity: 'property',
      entityId: id,
      userId: userAddress,
    });

    try {
      // Check if property exists
      const property = await propertyRepository.findById(id);

      if (!property) {
        throw new NotFoundError('Property', id);
      }

      // Verify ownership
      const owner = await userRepository.findById(property.ownerId);
      if (!owner || owner.walletAddress !== userAddress) {
        throw new AuthorizationError('You do not have permission to delete this property');
      }

      // Delete property
      const deleted = await propertyRepository.delete(id);

      if (!deleted) {
        throw new Error('Failed to delete property');
      }

      await cacheService.invalidate(`${PROPERTIES_CACHE_PREFIX}*`);

      logger.info('Property deleted successfully', {
        operation: 'DELETE',
        entity: 'property',
        entityId: id,
        duration: Date.now() - startTime,
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to delete property', {
        error,
        operation: 'DELETE',
        entity: 'property',
        entityId: id,
      });
      throw error;
    }
  }

  /**
   * Tokenize a property on the blockchain
   * Note: This feature is planned for Cycle 2
   */
  static async tokenizeProperty(
    id: string,
    _data: unknown,
    userAddress?: string,
  ): Promise<TokenizationResponse> {
    return tokenizationService.tokenizeProperty(id, userAddress);
  }

  /**
   * Buy shares of a property
   * Note: This feature is planned for Cycle 2
   */
  static async buyShares(
    id: string,
    data: { buyer: string; shares: number },
    authenticatedAddress: string,
  ): Promise<{ transactionHash: string; newBalance: number }> {
    const startTime = Date.now();

    if (!id) {
      throw new ValidationError('Property ID is required', [
        { field: 'id', message: 'Property ID is required' },
      ]);
    }

    if (!data.buyer || data.buyer.trim().length === 0) {
      throw new AuthenticationError('Buyer wallet address is required');
    }

    if (data.buyer !== authenticatedAddress) {
      throw new AuthorizationError('Authenticated wallet does not match buyer address');
    }

    if (!Number.isInteger(data.shares) || data.shares <= 0) {
      throw new ValidationError('Shares must be a positive integer', [
        { field: 'shares', message: 'Shares must be a positive integer' },
      ]);
    }

    logger.info('Share purchase attempted', {
      operation: 'BUY_SHARES',
      entity: 'property',
      entityId: id,
      userId: data.buyer,
      shares: data.shares,
    });

    try {
      const property = await propertyRepository.findById(id);
      if (!property) {
        throw new NotFoundError('Property', id);
      }

      if (property.availableShares < data.shares) {
        throw new ValidationError('Not enough shares available', [
          { field: 'shares', message: 'Requested shares exceed available inventory' },
        ]);
      }

      if (!property.tokenAddress || property.sorobanPropertyId === null) {
        throw new ValidationError('Property must be tokenized before shares can be purchased', [
          {
            field: 'id',
            message: 'Property must be tokenized on-chain before buyShares can execute',
          },
        ]);
      }

      const owner = await userRepository.findById(property.ownerId);
      if (!owner) {
        throw new NotFoundError('Property owner', property.ownerId);
      }

      const buyer = await userRepository.getOrCreateByWallet(data.buyer);
      const totalPurchasePrice = (parseFloat(property.pricePerShare) * data.shares).toFixed(2);
      const { adminPublicKey, adminSecret } = stellarService.getMintingConfig();
      const { txHash: transactionHash } = await stellarService.mintPropertyShares({
        contractId: property.tokenAddress,
        adminPublicKey,
        adminSecret,
        sorobanPropertyId: property.sorobanPropertyId,
        recipient: data.buyer,
        amount: data.shares,
      });

      const propertyId = property.id;
      const propertyOwnerId = property.ownerId;
      const propertyTokenAddress = property.tokenAddress;
      const propertyAvailableShares = property.availableShares;

      const result = await db.transaction(async (tx) => {
        const [existingOwnership] = await tx
          .select()
          .from(shareOwnerships)
          .where(
            and(eq(shareOwnerships.propertyId, propertyId), eq(shareOwnerships.ownerId, buyer.id)),
          )
          .limit(1);

        const [updatedProperty] = await tx
          .update(properties)
          .set({ availableShares: propertyAvailableShares - data.shares })
          .where(eq(properties.id, propertyId))
          .returning();

        if (!updatedProperty) {
          throw new Error('Failed to update available shares');
        }

        const [ownership] = existingOwnership
          ? await tx
              .update(shareOwnerships)
              .set({
                shares: existingOwnership.shares + data.shares,
                purchasePrice: (
                  parseFloat(existingOwnership.purchasePrice) + parseFloat(totalPurchasePrice)
                ).toFixed(2),
              })
              .where(eq(shareOwnerships.id, existingOwnership.id))
              .returning()
          : await tx
              .insert(shareOwnerships)
              .values({
                propertyId: propertyId,
                ownerId: buyer.id,
                shares: data.shares,
                purchasePrice: totalPurchasePrice,
              })
              .returning();

        if (!ownership) {
          throw new Error('Failed to persist share ownership');
        }

        await tx.insert(transactions).values({
          type: 'buy_shares',
          hash: transactionHash,
          fromUserId: buyer.id,
          toUserId: propertyOwnerId,
          amount: totalPurchasePrice,
          asset: propertyTokenAddress ?? 'USDC',
          status: 'confirmed',
          metadata: {
            propertyId: propertyId,
            shares: data.shares,
          },
        });

        return {
          newBalance: ownership.shares,
        };
      });

      logger.info('Share purchase completed successfully', {
        operation: 'BUY_SHARES',
        entity: 'property',
        entityId: id,
        userId: data.buyer,
        shares: data.shares,
        duration: Date.now() - startTime,
      });

      await cacheService.invalidate(`${PROPERTIES_CACHE_PREFIX}*`);

      return {
        transactionHash,
        newBalance: result.newBalance,
      };
    } catch (error) {
      logger.error('Failed to purchase shares', {
        error,
        operation: 'BUY_SHARES',
        entity: 'property',
        entityId: id,
      });
      throw error;
    }
  }

  /**
   * Get user's share ownership for a property
   * Note: This feature is planned for Cycle 2
   */
  static async getUserShares(id: string, owner: string): Promise<SharedShareOwnership | null> {
    const startTime = Date.now();

    if (!id) {
      throw new ValidationError('Property ID is required', [
        { field: 'id', message: 'Property ID is required' },
      ]);
    }

    if (!owner || owner.trim().length === 0) {
      throw new ValidationError('Owner wallet address is required', [
        { field: 'owner', message: 'Owner wallet address is required' },
      ]);
    }

    logger.info('Share ownership lookup attempted', {
      operation: 'GET_SHARES',
      entity: 'property',
      entityId: id,
      userId: owner,
    });

    try {
      const property = await propertyRepository.findById(id);
      if (!property) {
        throw new NotFoundError('Property', id);
      }

      const user = await userRepository.findByWalletAddress(owner);
      if (!user) {
        return null;
      }

      const [ownership] = await db
        .select()
        .from(shareOwnerships)
        .where(and(eq(shareOwnerships.propertyId, id), eq(shareOwnerships.ownerId, user.id)))
        .limit(1);

      logger.info('Share ownership lookup completed', {
        operation: 'GET_SHARES',
        entity: 'property',
        entityId: id,
        duration: Date.now() - startTime,
      });

      return ownership ? mapShareOwnershipToShared(ownership, owner) : null;
    } catch (error) {
      logger.error('Failed to fetch share ownership', {
        error,
        operation: 'GET_SHARES',
        entity: 'property',
        entityId: id,
      });
      throw error;
    }
  }
}
