import { z } from 'zod';
import type { PropertyInfo } from '@real-estate-defi/shared';
import {
  stellarAddressSchema,
  positiveAmountSchema,
  propertyLocationSchema,
  propertyDocumentSchema,
} from '@real-estate-defi/shared';

/**
 * DTO for creating a new property
 */
export const CreatePropertyDto = z.object({
  owner: stellarAddressSchema,
  totalShares: z.number().int().positive(),
  valuePerShare: positiveAmountSchema,
  metadata: z.record(z.string()),
  location: propertyLocationSchema.optional(),
  documents: z.array(
    z.object({
      title: z.string().min(1),
      url: z.string().url(),
      type: z.enum(['deed', 'appraisal', 'inspection', 'other']),
    }),
  ).optional(),
});

/**
 * DTO for updating an existing property
 */
export const UpdatePropertyDto = z.object({
  owner: stellarAddressSchema.optional(),
  totalShares: z.number().int().positive().optional(),
  availableShares: z.number().int().min(0).optional(),
  valuePerShare: positiveAmountSchema.optional(),
  metadata: z.record(z.string()).optional(),
  location: propertyLocationSchema.optional(),
  documents: z.array(
    z.object({
      title: z.string().min(1),
      url: z.string().url(),
      type: z.enum(['deed', 'appraisal', 'inspection', 'other']),
    }),
  ).optional(),
});

/**
 * DTO for filtering properties
 */
export interface PropertyFilterDto {
  owner?: string;
  city?: string;
  country?: string;
  minValuePerShare?: number;
  maxValuePerShare?: number;
  minAvailableShares?: number;
  hasAvailableShares?: boolean;
}

/**
 * DTO for pagination parameters
 */
export interface PaginationDto {
  page: number;
  limit: number;
}

/**
 * DTO for paginated response
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
 * Validates a CreatePropertyDto using zod schema
 */
export function validateCreateProperty(data: unknown): { valid: boolean; errors: string[] } {
  const result = CreatePropertyDto.safeParse(data);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
  };
}

/**
 * Validates an UpdatePropertyDto using zod schema
 */
export function validateUpdateProperty(data: unknown): { valid: boolean; errors: string[] } {
  const result = UpdatePropertyDto.safeParse(data);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
  };
}

// Export inferred types
export type CreatePropertyInput = z.infer<typeof CreatePropertyDto>;
export type UpdatePropertyInput = z.infer<typeof UpdatePropertyDto>;

/**
 * Validates pagination parameters
 */
export function validatePagination(page: unknown, limit: unknown): PaginationDto {
  const pageNum =
    typeof page === 'string' ? parseInt(page, 10) : typeof page === 'number' ? page : 1;
  const limitNum =
    typeof limit === 'string' ? parseInt(limit, 10) : typeof limit === 'number' ? limit : 10;

  return {
    page: pageNum > 0 ? pageNum : 1,
    limit: limitNum > 0 && limitNum <= 100 ? limitNum : 10,
  };
}

/**
 * Applies filters to a property
 */
export function matchesFilter(property: PropertyInfo, filter: PropertyFilterDto): boolean {
  if (filter.owner && property.owner !== filter.owner) {
    return false;
  }

  if (filter.city && property.location?.city !== filter.city) {
    return false;
  }

  if (filter.country && property.location?.country !== filter.country) {
    return false;
  }

  const pricePerShare = parseFloat(property.pricePerShare);
  if (filter.minValuePerShare !== undefined && pricePerShare < filter.minValuePerShare) {
    return false;
  }

  if (filter.maxValuePerShare !== undefined && pricePerShare > filter.maxValuePerShare) {
    return false;
  }

  if (
    filter.minAvailableShares !== undefined &&
    property.availableShares < filter.minAvailableShares
  ) {
    return false;
  }

  if (filter.hasAvailableShares && property.availableShares <= 0) {
    return false;
  }

  return true;
}
