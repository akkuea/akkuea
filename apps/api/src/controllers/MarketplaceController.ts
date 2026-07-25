import type { PropertyInfo } from '@real-estate-defi/shared';
import { NotFoundError, ValidationError } from '@real-estate-defi/shared';
import { logger } from '../services/logger';
import {
  propertyRepository,
  type PropertyFilter,
  type PaginatedResult,
  type PropertyListRow,
} from '../repositories/PropertyRepository';
import { userRepository } from '../repositories/UserRepository';
import { cacheService } from '../services/CacheService';
import type { PaginatedResponse } from './PropertyController';

const MARKETPLACE_CACHE_TTL = 30;
const MARKETPLACE_CACHE_PREFIX = 'marketplace:list:';

/**
 * Maps a PropertyListRow to a PropertyInfo response.
 * Expects the owner wallet address to be pre-joined by the repository.
 */
async function mapToPropertyInfo(
  row: PropertyListRow,
): Promise<PropertyInfo> {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    propertyType: row.propertyType,
    location: row.location,
    totalValue: row.totalValue,
    tokenAddress: row.tokenAddress ?? undefined,
    totalShares: row.totalShares,
    availableShares: row.availableShares,
    pricePerShare: row.pricePerShare,
    images: row.images,
    documents: [],
    verified: row.verified,
    listedAt: row.listedAt.toISOString(),
    owner: row.ownerWalletAddress,
  };
}

/**
 * Validates and normalises pagination parameters.
 */
function paginate(page: unknown, limit: unknown): { page: number; limit: number } {
  const pageNum = typeof page === 'string' ? parseInt(page, 10) : typeof page === 'number' ? page : 1;
  const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : typeof limit === 'number' ? limit : 20;

  return {
    page: pageNum > 0 ? pageNum : 1,
    limit: limitNum > 0 && limitNum <= 100 ? limitNum : 20,
  };
}

export class MarketplaceController {
  /**
   * List marketplace properties (approved, verified, with available shares).
   */
  static async getListings(query?: {
    page?: string | number;
    limit?: string | number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    propertyType?: string;
    country?: string;
    minPrice?: string | number;
    maxPrice?: string | number;
  }): Promise<PaginatedResponse<PropertyInfo>> {
    const startTime = Date.now();
    logger.info('Fetching marketplace listings', { operation: 'READ', entity: 'marketplace' });

    try {
      const pagination = paginate(query?.page, query?.limit);

      const filter: PropertyFilter = {
        reviewStatuses: ['approved'],
        verified: true,
        hasAvailableShares: true,
      };

      if (
        query?.propertyType &&
        ['residential', 'commercial', 'industrial', 'land', 'mixed'].includes(query.propertyType)
      ) {
        filter.propertyType = query.propertyType as PropertyFilter['propertyType'];
      }
      if (query?.country) filter.country = query.country;
      if (query?.minPrice !== undefined) filter.minPricePerShare = Number(query.minPrice);
      if (query?.maxPrice !== undefined) filter.maxPricePerShare = Number(query.maxPrice);

      const cacheKey =
        `${MARKETPLACE_CACHE_PREFIX}` +
        `${pagination.page}:${pagination.limit}:` +
        `${query?.sortBy ?? ''}:${query?.sortOrder ?? 'desc'}:` +
        `${filter.propertyType ?? ''}:${filter.country ?? ''}:` +
        `${filter.minPricePerShare ?? ''}:${filter.maxPricePerShare ?? ''}`;

      const cached = await cacheService.get<PaginatedResponse<PropertyInfo>>(cacheKey);
      if (cached) {
        logger.info('Marketplace served from cache', { operation: 'READ', entity: 'marketplace' });
        return cached;
      }

      const result: PaginatedResult<PropertyListRow> = await propertyRepository.findPaginated(
        pagination,
        filter,
      );

      const data = await Promise.all(result.data.map(mapToPropertyInfo));

      const response: PaginatedResponse<PropertyInfo> = {
        data,
        pagination: result.pagination,
      };

      await cacheService.set(cacheKey, response, MARKETPLACE_CACHE_TTL);

      logger.info('Marketplace listings fetched successfully', {
        operation: 'READ',
        entity: 'marketplace',
        count: data.length,
        duration: Date.now() - startTime,
      });

      return response;
    } catch (error) {
      logger.error('Failed to fetch marketplace listings', {
        error,
        operation: 'READ',
        entity: 'marketplace',
      });
      throw error;
    }
  }

  /**
   * Get a single marketplace listing by ID.
   * Only returns approved, verified properties with available shares.
   */
  static async getListing(id: string): Promise<PropertyInfo> {
    const startTime = Date.now();

    if (!id) {
      throw new ValidationError('Property ID is required', [
        { field: 'id', message: 'Property ID is required' },
      ]);
    }

    logger.info('Fetching marketplace listing', {
      operation: 'READ',
      entity: 'marketplace',
      entityId: id,
    });

    try {
      const property = await propertyRepository.findById(id);

      if (!property) {
        throw new NotFoundError('Marketplace listing', id);
      }

      if (property.reviewStatus !== 'approved' || !property.verified) {
        throw new NotFoundError('Marketplace listing', id);
      }

      if (property.availableShares <= 0) {
        throw new NotFoundError('Marketplace listing', id);
      }

      const owner = await userRepository.findById(property.ownerId);

      const info: PropertyInfo = {
        id: property.id,
        name: property.name,
        description: property.description,
        propertyType: property.propertyType,
        location: property.location,
        totalValue: property.totalValue,
        tokenAddress: property.tokenAddress ?? undefined,
        totalShares: property.totalShares,
        availableShares: property.availableShares,
        pricePerShare: property.pricePerShare,
        images: property.images,
        documents: [],
        verified: property.verified,
        listedAt: property.listedAt.toISOString(),
        owner: owner?.walletAddress ?? '',
      };

      logger.info('Marketplace listing fetched successfully', {
        operation: 'READ',
        entity: 'marketplace',
        entityId: id,
        duration: Date.now() - startTime,
      });

      return info;
    } catch (error) {
      logger.error('Failed to fetch marketplace listing', {
        error,
        operation: 'READ',
        entity: 'marketplace',
        entityId: id,
      });
      throw error;
    }
  }
}
