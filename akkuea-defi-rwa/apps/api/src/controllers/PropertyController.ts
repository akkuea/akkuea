import type { PropertyInfo, Transaction, ShareOwnership } from '@real-estate-defi/shared';
import { logger } from '../utils/logger';
import { BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError } from '../utils/errors';
import { propertyRepository } from '../repositories/PropertyRepository';
import type {
  CreatePropertyDto,
  UpdatePropertyDto,
  PropertyFilterDto,
  PaginatedResponse,
  PaginationDto,
} from '../dto/property.dto';
import {
  validateCreateProperty,
  validateUpdateProperty,
  validatePagination,
} from '../dto/property.dto';

export class PropertyController {
  static async getProperties(query?: {
    page?: string | number;
    limit?: string | number;
    owner?: string;
    city?: string;
    country?: string;
    minValuePerShare?: string | number;
    maxValuePerShare?: string | number;
    minAvailableShares?: string | number;
    hasAvailableShares?: string | boolean;
  }): Promise<PaginatedResponse<PropertyInfo>> {
    const startTime = Date.now();
    logger.crud.read('property');

    try {
      const pagination: PaginationDto = validatePagination(query?.page, query?.limit);

      const filter: PropertyFilterDto = {
        owner: query?.owner,
        city: query?.city,
        country: query?.country,
        minValuePerShare:
          query?.minValuePerShare !== undefined ? Number(query.minValuePerShare) : undefined,
        maxValuePerShare:
          query?.maxValuePerShare !== undefined ? Number(query.maxValuePerShare) : undefined,
        minAvailableShares:
          query?.minAvailableShares !== undefined ? Number(query.minAvailableShares) : undefined,
        hasAvailableShares:
          query?.hasAvailableShares === 'true' || query?.hasAvailableShares === true,
      };

      // Remove undefined values from filter
      Object.keys(filter).forEach((key) => {
        if (filter[key as keyof PropertyFilterDto] === undefined) {
          delete filter[key as keyof PropertyFilterDto];
        }
      });

      const { properties, total } = propertyRepository.getPaginated(
        pagination.page,
        pagination.limit,
        Object.keys(filter).length > 0 ? filter : undefined,
      );

      logger.crud.success('READ', 'property', undefined, Date.now() - startTime);

      return {
        data: properties,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages: Math.ceil(total / pagination.limit),
        },
      };
    } catch (error) {
      logger.crud.failure('READ', 'property', error as Error);
      throw error;
    }
  }

  static async getProperty(id: string): Promise<PropertyInfo> {
    const startTime = Date.now();

    if (!id) {
      throw new BadRequestError('Property ID is required');
    }

    logger.crud.read('property', id);

    try {
      const property = propertyRepository.getById(id);

      if (!property) {
        throw new NotFoundError(`Property with id ${id} not found`);
      }

      logger.crud.success('READ', 'property', id, Date.now() - startTime);
      return property;
    } catch (error) {
      logger.crud.failure('READ', 'property', error as Error, id);
      throw error;
    }
  }

  static async createProperty(
    data: Partial<PropertyInfo>,
    userAddress?: string,
  ): Promise<PropertyInfo> {
    const startTime = Date.now();
    logger.crud.create('property', data as Record<string, unknown>, userAddress);

    try {
      // Validate input
      const validation = validateCreateProperty(data);

      if (!validation.valid) {
        throw new BadRequestError(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Create property
      const property = propertyRepository.create(data as CreatePropertyDto);

      logger.crud.success('CREATE', 'property', undefined, Date.now() - startTime);
      return property;
    } catch (error) {
      logger.crud.failure('CREATE', 'property', error as Error);
      throw error;
    }
  }

  static async updateProperty(
    id: string,
    data: Partial<PropertyInfo>,
    userAddress: string,
  ): Promise<PropertyInfo> {
    const startTime = Date.now();

    if (!id) {
      throw new BadRequestError('Property ID is required');
    }

    if (!userAddress) {
      throw new UnauthorizedError('User address is required for authentication');
    }

    logger.crud.update('property', id, data as Record<string, unknown>, userAddress);

    try {
      // Validate input
      const validation = validateUpdateProperty(data);

      if (!validation.valid) {
        throw new BadRequestError(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if property exists
      const property = propertyRepository.getById(id);

      if (!property) {
        throw new NotFoundError(`Property with id ${id} not found`);
      }

      // Verify ownership
      if (property.owner !== userAddress) {
        throw new ForbiddenError('You do not have permission to update this property');
      }

      // Update property
      const updatedProperty = propertyRepository.update(id, data as UpdatePropertyDto);

      if (!updatedProperty) {
        throw new Error('Failed to update property');
      }

      logger.crud.success('UPDATE', 'property', id, Date.now() - startTime);
      return updatedProperty;
    } catch (error) {
      logger.crud.failure('UPDATE', 'property', error as Error, id);
      throw error;
    }
  }

  static async deleteProperty(id: string, userAddress: string): Promise<{ success: boolean }> {
    const startTime = Date.now();

    if (!id) {
      throw new BadRequestError('Property ID is required');
    }

    if (!userAddress) {
      throw new UnauthorizedError('User address is required for authentication');
    }

    logger.crud.delete('property', id, userAddress);

    try {
      // Check if property exists
      const property = propertyRepository.getById(id);

      if (!property) {
        throw new NotFoundError(`Property with id ${id} not found`);
      }

      // Verify ownership
      if (property.owner !== userAddress) {
        throw new ForbiddenError('You do not have permission to delete this property');
      }

      // Delete property
      const deleted = propertyRepository.delete(id);

      if (!deleted) {
        throw new Error('Failed to delete property');
      }

      logger.crud.success('DELETE', 'property', id, Date.now() - startTime);
      return { success: true };
    } catch (error) {
      logger.crud.failure('DELETE', 'property', error as Error, id);
      throw error;
    }
  }

  static async tokenizeProperty(
    id: string,
    _data: unknown,
    userAddress?: string,
  ): Promise<{ txHash: string }> {
    const startTime = Date.now();

    if (!id) {
      throw new BadRequestError('Property ID is required');
    }

    logger.info('Tokenizing property', {
      operation: 'TOKENIZE',
      entity: 'property',
      entityId: id,
      userId: userAddress,
    });

    try {
      // Implementation to tokenize property on blockchain
      const result = { txHash: 'placeholder' };

      logger.crud.success('TOKENIZE', 'property', id, Date.now() - startTime);
      return result;
    } catch (error) {
      logger.crud.failure('TOKENIZE', 'property', error as Error, id);
      throw error;
    }
  }

  static async buyShares(
    id: string,
    data: { buyer: string; shares: number },
  ): Promise<Transaction> {
    const startTime = Date.now();

    if (!id) {
      throw new BadRequestError('Property ID is required');
    }

    if (!data.buyer) {
      throw new BadRequestError('Buyer address is required');
    }

    if (!data.shares || data.shares <= 0) {
      throw new BadRequestError('Number of shares must be greater than 0');
    }

    logger.info('Buying shares', {
      operation: 'BUY_SHARES',
      entity: 'property',
      entityId: id,
      userId: data.buyer,
      shares: data.shares,
    });

    try {
      // Implementation to handle share purchase
      const transaction = {} as Transaction; // Placeholder

      logger.crud.success('BUY_SHARES', 'property', id, Date.now() - startTime);
      return transaction;
    } catch (error) {
      logger.crud.failure('BUY_SHARES', 'property', error as Error, id);
      throw error;
    }
  }

  static async getUserShares(id: string, owner: string): Promise<ShareOwnership> {
    const startTime = Date.now();

    if (!id) {
      throw new BadRequestError('Property ID is required');
    }

    if (!owner) {
      throw new BadRequestError('Owner address is required');
    }

    logger.info('Fetching user shares', {
      operation: 'GET_SHARES',
      entity: 'property',
      entityId: id,
      userId: owner,
    });

    try {
      // Implementation to fetch user shares
      const shares = {} as ShareOwnership; // Placeholder

      logger.crud.success('GET_SHARES', 'property', id, Date.now() - startTime);
      return shares;
    } catch (error) {
      logger.crud.failure('GET_SHARES', 'property', error as Error, id);
      throw error;
    }
  }
}

// Export logger for use in routes
export { logger };
