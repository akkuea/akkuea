import type { PropertyInfo, Transaction, ShareOwnership } from '@real-estate-defi/shared';
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
  static async getAll(query: {
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
    try {
      const pagination: PaginationDto = validatePagination(query.page, query.limit);

      const filter: PropertyFilterDto = {
        owner: query.owner,
        city: query.city,
        country: query.country,
        minValuePerShare:
          query.minValuePerShare !== undefined ? Number(query.minValuePerShare) : undefined,
        maxValuePerShare:
          query.maxValuePerShare !== undefined ? Number(query.maxValuePerShare) : undefined,
        minAvailableShares:
          query.minAvailableShares !== undefined ? Number(query.minAvailableShares) : undefined,
        hasAvailableShares:
          query.hasAvailableShares === 'true' || query.hasAvailableShares === true,
      };

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
      throw new Error(`Failed to fetch properties: ${error}`);
    }
  }

  static async getById(id: string): Promise<PropertyInfo> {
    if (!id?.trim()) {
      throw new Error('Property ID is required');
    }

    const property = propertyRepository.getById(id);

    if (!property) {
      throw new Error('Property not found');
    }

    return property;
  }

  static async create(data: CreatePropertyDto): Promise<PropertyInfo> {
    const validation = validateCreateProperty(data);
    
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    return propertyRepository.create(data);
  }

  static async update(id: string, data: UpdatePropertyDto): Promise<PropertyInfo> {
    if (!id?.trim()) {
      throw new Error('Property ID is required');
    }

    if (!propertyRepository.exists(id)) {
      throw new Error('Property not found');
    }

    const validation = validateUpdateProperty(data);
    
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    const property = propertyRepository.update(id, data);

    if (!property) {
      throw new Error('Failed to update property');
    }

    return property;
  }

  static async delete(id: string, userAddress?: string): Promise<void> {
    if (!id?.trim()) {
      throw new Error('Property ID is required');
    }

    const property = propertyRepository.getById(id);

    if (!property) {
      throw new Error('Property not found');
    }

    if (userAddress && property.owner !== userAddress) {
      throw new Error('Unauthorized: Only the property owner can delete this property');
    }

    const deleted = propertyRepository.delete(id);

    if (!deleted) {
      throw new Error('Failed to delete property');
    }
  }

  static async getProperties(): Promise<PropertyInfo[]> {
    return propertyRepository.getAll();
  }

  static async getProperty(id: string): Promise<PropertyInfo> {
    return this.getById(id);
  }

  static async createProperty(data: Partial<PropertyInfo>): Promise<PropertyInfo> {
    return this.create(data as CreatePropertyDto);
  }

  static async tokenizeProperty(_id: string, _data: unknown): Promise<{ txHash: string }> {
    try {
      return { txHash: 'placeholder' };
    } catch (error) {
      throw new Error(`Failed to tokenize property: ${error}`);
    }
  }

  static async buyShares(
    _id: string,
    _data: { buyer: string; shares: number },
  ): Promise<Transaction> {
    try {
      return {} as Transaction;
    } catch (error) {
      throw new Error(`Failed to buy shares: ${error}`);
    }
  }

  static async getUserShares(_id: string, _owner: string): Promise<ShareOwnership> {
    try {
      return {} as ShareOwnership;
    } catch (error) {
      throw new Error(`Failed to fetch user shares: ${error}`);
    }
  }
}